// Collecting the drives a map should draw.
//
// The same journey can be recorded in two places — as a driving segment on the
// Driving page, or as a plan item of kind "drive" inside a day — so this
// collapses them into one list of legs with resolvable endpoints.

import type { DrivingSegment, TripDay } from '../types/trip';
import type { Coords } from './geocode';

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

/**
 * Build the list of drives to draw.
 *
 * Driving segments win over plan items for the same from/to pair: they are the
 * dedicated record and carry the distance the route estimator worked out. Only
 * approved plan drives are considered, matching how approved plan items are the
 * ones the map shows at all. Legs whose endpoints cannot be geocoded are
 * dropped rather than drawn somewhere wrong.
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
    seen.add(key);
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
