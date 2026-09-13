// Where the trip is, and when.
//
// The weather page needs two things the hotel list does not give directly: the
// places in the order they are visited, and for each place the dates actually
// spent there. Both are derived here so the page can stay presentational.

import type { Hotel } from '../types/trip';

/** An inclusive span of calendar dates, as YYYY-MM-DD. */
export interface Stay {
  from: string;
  to: string;
}

export interface TripLocation {
  label: string;
  lat?: number;
  lng?: number;
  /** Every span spent here — more than one when a place is revisited. */
  stays: Stay[];
  /** First date spent here, which is what orders the list. */
  firstArrival: string;
}

/** Calendar date of an ISO datetime, without shifting across time zones. */
export function isoDate(value?: string): string {
  return (value ?? '').slice(0, 10);
}

/** Whole days from the trip's first date; 0 for the first day. */
export function dayOffset(date: string, tripStart: string): number {
  const a = Date.parse(`${isoDate(date)}T00:00:00Z`);
  const b = Date.parse(`${isoDate(tripStart)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Places the trip visits, in arrival order, each with the dates spent there.
 *
 * A stay runs from check-in to check-out inclusive: you wake up in that city on
 * check-out morning, so its weather still matters. That deliberately makes a
 * transition date belong to both cities — on that day you really are in both.
 *
 * A city visited more than once keeps its earliest arrival for ordering and
 * collects every span, rather than appearing twice.
 */
export function buildTripLocations(hotels: Hotel[]): TripLocation[] {
  const byKey = new Map<string, TripLocation>();

  const sorted = [...hotels].sort(
    (a, b) => Date.parse(a.checkIn ?? '') - Date.parse(b.checkIn ?? '')
  );

  for (const hotel of sorted) {
    const label = (hotel.city || hotel.name || '').trim();
    const key = label.toLowerCase();
    if (!key) continue;

    const from = isoDate(hotel.checkIn);
    const to = isoDate(hotel.checkOut) || from;
    if (!from) continue;

    const existing = byKey.get(key);
    if (existing) {
      existing.stays.push({ from, to });
      if (from < existing.firstArrival) existing.firstArrival = from;
      // A later hotel may carry coordinates an earlier one lacked.
      if (existing.lat === undefined && hotel.lat !== undefined) {
        existing.lat = hotel.lat;
        existing.lng = hotel.lng;
      }
      continue;
    }
    byKey.set(key, {
      label,
      lat: hotel.lat,
      lng: hotel.lng,
      stays: [{ from, to }],
      firstArrival: from,
    });
  }

  return [...byKey.values()].sort((a, b) => a.firstArrival.localeCompare(b.firstArrival));
}

/** True when a calendar date falls inside any of these stays. */
export function isStayDate(stays: Stay[], date: string): boolean {
  const d = isoDate(date);
  return stays.some((s) => d >= s.from && d <= s.to);
}

/**
 * Trip day numbers (1-based) covered by these stays, collapsed into ranges:
 * [1,2,3,6] becomes "1-3, 6". Empty when the stays fall outside the trip.
 */
export function stayDayLabel(stays: Stay[], tripStart: string, totalDays: number): string {
  const numbers = new Set<number>();
  for (const stay of stays) {
    const start = dayOffset(stay.from, tripStart);
    const end = dayOffset(stay.to, tripStart);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    for (let d = Math.max(0, start); d <= Math.min(end, totalDays - 1); d++) {
      numbers.add(d + 1);
    }
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  if (!sorted.length) return '';

  const parts: string[] = [];
  let runStart = sorted[0];
  let previous = sorted[0];
  for (const n of sorted.slice(1)) {
    if (n === previous + 1) {
      previous = n;
      continue;
    }
    parts.push(runStart === previous ? `${runStart}` : `${runStart}-${previous}`);
    runStart = n;
    previous = n;
  }
  parts.push(runStart === previous ? `${runStart}` : `${runStart}-${previous}`);
  return parts.join(', ');
}
