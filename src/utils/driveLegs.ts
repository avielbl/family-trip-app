// Collecting the drives a map should draw.
//
// The same journey can be recorded in two places — as a driving segment on the
// Driving page, or as a plan item of kind "drive" inside a day — so this
// collapses them into one list of legs with resolvable endpoints.

import type { DrivingSegment, TripDay } from '../types/trip';
import { haversineKm, type Coords } from './geocode';

export interface DriveLeg {
  id: string;
  from: string;
  to: string;
  dayIndex: number;
  distanceKm?: number;
  durationMinutes?: number;
  a: Coords;
  b: Coords;
  /** Where this leg came from, so a caller can prefer one source's details. */
  source: 'segment' | 'plan';
}

/** Resolve a place name to coordinates, or null when it cannot be located. */
export type PlaceResolver = (name: string) => Coords | null;

/** A drive that could not be drawn, and why — so it is not lost silently. */
export interface UnplaceableLeg {
  from: string;
  to: string;
  reason: 'not-found' | 'implausible';
}

function legKey(from: string, to: string): string {
  return `${from.trim().toLowerCase()}|${to.trim().toLowerCase()}`;
}

/** Backstop for a trip whose own extent is unknown. */
const MAX_PLAUSIBLE_KM = 900;

/** Where a trip happens: its centre and how far its hotels spread from it. */
export interface TripRegion {
  center: Coords;
  radiusKm: number;
}

/**
 * The region a trip occupies, from the hotels that carry coordinates.
 * Returns null when the trip has none and nothing can be inferred.
 */
export function tripRegionFrom(points: Coords[]): TripRegion | null {
  const valid = points.filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (!valid.length) return null;
  const center = {
    lat: valid.reduce((sum, p) => sum + p.lat, 0) / valid.length,
    lng: valid.reduce((sum, p) => sum + p.lng, 0) / valid.length,
  };
  const radiusKm = valid.reduce((max, p) => Math.max(max, haversineKm(center, p)), 0);
  return { center, radiusKm };
}

/**
 * How far from the trip's centre a drive may plausibly reach. Scaled from the
 * trip's own spread — you might drive out a good way past where you sleep, but
 * not several times the length of the whole trip — with a floor so a trip based
 * in one town still allows a proper day excursion.
 */
export function reachKm(region: TripRegion): number {
  return Math.max(region.radiusKm * 2, 150);
}

/**
 * Reject endpoints a geocoder clearly got wrong. A single bad match — a
 * same-named town in another country — otherwise draws a line across Europe
 * and drags the map's bounds out with it, hiding the whole trip.
 *
 * Three checks, cheapest first:
 * - the leg is longer than any family drive, whatever the trip;
 * - the leg is far longer than the distance it records for itself, which can
 *   only mean an endpoint is not where that distance was measured from;
 * - an endpoint sits outside the area the trip actually occupies. This is the
 *   one that catches a plausible-looking 450 km line to a real town in the
 *   next country, which the fixed cap alone lets through.
 */
export function isPlausibleLeg(
  a: Coords,
  b: Coords,
  distanceKm?: number,
  region?: TripRegion | null
): boolean {
  const straight = haversineKm(a, b);
  if (straight > MAX_PLAUSIBLE_KM) return false;
  // The allowance is generous so a distance entered roughly by hand still passes.
  if (distanceKm && distanceKm > 0 && straight > distanceKm * 3 + 50) return false;
  if (region) {
    const limit = reachKm(region);
    if (haversineKm(a, region.center) > limit) return false;
    if (haversineKm(b, region.center) > limit) return false;
  }
  return true;
}

/**
 * Build the list of drives to draw.
 *
 * Driving segments win over plan items for the same from/to pair: they are the
 * dedicated record and carry the distance the route estimator worked out. Only
 * approved plan drives are considered, matching how approved plan items are the
 * ones the map shows at all. Legs whose endpoints cannot be geocoded, or whose
 * endpoints are implausibly far apart, are dropped rather than drawn wrong.
 */
export function collectDriveLegs(
  driving: DrivingSegment[],
  days: TripDay[],
  resolve: PlaceResolver,
  region?: TripRegion | null
): DriveLeg[] {
  return collectDriveLegsDetailed(driving, days, resolve, region).legs;
}

/**
 * As `collectDriveLegs`, but also reporting the drives it could not draw. A leg
 * dropped for a bad place name looks identical to one that was never entered,
 * so the caller is given enough to say which drives are missing and why.
 */
export function collectDriveLegsDetailed(
  driving: DrivingSegment[],
  days: TripDay[],
  resolve: PlaceResolver,
  region?: TripRegion | null
): { legs: DriveLeg[]; unplaceable: UnplaceableLeg[] } {
  const legs: DriveLeg[] = [];
  const unplaceable: UnplaceableLeg[] = [];
  const seen = new Set<string>();

  const add = (
    source: DriveLeg['source'],
    id: string,
    from: string | undefined,
    to: string | undefined,
    dayIndex: number,
    distanceKm?: number,
    durationMinutes?: number
  ) => {
    if (!from?.trim() || !to?.trim()) return;
    const key = legKey(from, to);
    if (seen.has(key)) return;
    const a = resolve(from);
    const b = resolve(to);
    if (!a || !b) {
      seen.add(key);
      unplaceable.push({ from, to, reason: 'not-found' });
      return;
    }
    // Mark it seen either way: a mis-geocoded leg should not be retried from
    // the other source and drawn wrong after all.
    seen.add(key);
    if (!isPlausibleLeg(a, b, distanceKm, region)) {
      unplaceable.push({ from, to, reason: 'implausible' });
      return;
    }
    legs.push({ id, from, to, dayIndex, distanceKm, durationMinutes, a, b, source });
  };

  for (const segment of driving) {
    add('segment', segment.id, segment.from, segment.to, segment.dayIndex,
        segment.distanceKm, segment.durationMinutes);
  }
  for (const day of days) {
    for (const item of day.plan?.items ?? []) {
      if (item.kind !== 'drive' || !item.approved) continue;
      add('plan', item.id, item.from, item.to, day.dayIndex,
          item.distanceKm, item.durationMinutes);
    }
  }
  return { legs, unplaceable };
}
