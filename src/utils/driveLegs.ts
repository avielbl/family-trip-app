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

function legKey(from: string, to: string): string {
  return `${from.trim().toLowerCase()}|${to.trim().toLowerCase()}`;
}

/** No day drive on a family trip crosses a continent. */
const MAX_PLAUSIBLE_KM = 900;

/**
 * Reject endpoints a geocoder clearly got wrong. A single bad match — a
 * same-named town in another country — otherwise draws a line across Europe
 * and drags the map's bounds out with it, hiding the whole trip.
 *
 * When the leg records its own distance, that is the better check: a straight
 * line much longer than the recorded drive means an endpoint is not where the
 * distance was measured from.
 */
export function isPlausibleLeg(a: Coords, b: Coords, distanceKm?: number): boolean {
  const straight = haversineKm(a, b);
  if (straight > MAX_PLAUSIBLE_KM) return false;
  // Straight-line is always shorter than the road, so a recorded distance far
  // below it can only mean the endpoints are wrong. The allowance is generous
  // to avoid rejecting a leg whose distance was entered roughly by hand.
  if (distanceKm && distanceKm > 0 && straight > distanceKm * 3 + 50) return false;
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
  resolve: PlaceResolver
): DriveLeg[] {
  const legs: DriveLeg[] = [];
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
    if (!a || !b) return;
    // Mark it seen either way: a mis-geocoded leg should not be retried from
    // the other source and drawn wrong after all.
    seen.add(key);
    if (!isPlausibleLeg(a, b, distanceKm)) return;
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
  return legs;
}
