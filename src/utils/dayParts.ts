// Plans are organised by part of day rather than clock time. This module owns
// that vocabulary: the ordered parts, how a legacy "09:00" maps onto one, and
// how a duration reads in each language.

import type { DayPart, PlanItem } from '../types/trip';

/** The parts of a day, in the order they happen. */
export const DAY_PARTS: DayPart[] = ['morning', 'noon', 'afternoon', 'evening'];

export const DAY_PART_LABELS: Record<DayPart, { en: string; he: string; emoji: string }> = {
  morning: { en: 'Morning', he: 'בוקר', emoji: '🌅' },
  noon: { en: 'Noon', he: 'צהריים', emoji: '☀️' },
  afternoon: { en: 'Afternoon', he: 'אחר הצהריים', emoji: '🌤️' },
  evening: { en: 'Evening', he: 'ערב', emoji: '🌙' },
};

export function dayPartLabel(part: DayPart, isRTL: boolean): string {
  const meta = DAY_PART_LABELS[part];
  return isRTL ? meta.he : meta.en;
}

/**
 * Map a legacy "HH:MM" onto a part of day. Boundaries follow how a day is
 * actually spoken about rather than even quarters: late morning runs to ~11:30,
 * "noon" is the lunch window, and evening starts once dinner is plausible.
 */
export function dayPartFromTime(startTime?: string): DayPart | undefined {
  if (!startTime) return undefined;
  const match = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }
  const total = hours * 60 + minutes;
  if (total < 11 * 60 + 30) return 'morning';
  if (total < 14 * 60) return 'noon';
  if (total < 17 * 60 + 30) return 'afternoon';
  return 'evening';
}

/**
 * The part of day an item belongs to. Falls back to a legacy start time, then
 * to morning so an item can never vanish from a grouped view.
 */
export function itemDayPart(item: PlanItem): DayPart {
  return item.dayPart ?? dayPartFromTime(item.startTime) ?? 'morning';
}

/** Items grouped into the parts of the day, in order, skipping empty parts. */
export function groupByDayPart(items: PlanItem[]): Array<{ part: DayPart; items: PlanItem[] }> {
  const groups = new Map<DayPart, PlanItem[]>(DAY_PARTS.map((part) => [part, []]));
  for (const item of items) {
    groups.get(itemDayPart(item))!.push(item);
  }
  // Within a part, keep the order the planner chose; a legacy start time is the
  // only ordering signal we have, so use it when present.
  for (const list of groups.values()) {
    list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }
  return DAY_PARTS.map((part) => ({ part, items: groups.get(part)! })).filter(
    (group) => group.items.length > 0
  );
}

/** "45 min", "2 hr", "1 hr 30 min" — and their Hebrew equivalents. */
export function formatDuration(minutes?: number, isRTL = false): string {
  if (!minutes || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (isRTL) {
    if (!hours) return `${mins} דק׳`;
    const hoursPart = hours === 1 ? 'שעה' : hours === 2 ? 'שעתיים' : `${hours} שעות`;
    return mins ? `${hoursPart} ו-${mins} דק׳` : hoursPart;
  }
  if (!hours) return `${mins} min`;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

/**
 * A duration phrased for the kind of item it belongs to — "30 min drive",
 * "2 hr visit" — so the number reads as time to allow, not a departure time.
 */
export function describeDuration(item: PlanItem, isRTL = false): string {
  const duration = formatDuration(item.durationMinutes, isRTL);
  if (!duration) return '';
  if (item.kind === 'drive') return isRTL ? `נסיעה ${duration}` : `${duration} drive`;
  if (item.kind === 'activity') return isRTL ? `ביקור ${duration}` : `${duration} visit`;
  return duration;
}

/**
 * Convert plan items that still carry a clock time. Returns the rewritten items
 * and how many changed, so a caller can preview the migration before saving.
 */
export function migratePlanTimesToDayParts(items: PlanItem[]): {
  items: PlanItem[];
  converted: number;
  /**
   * Items left with no durationMinutes. Duration is the headline detail once
   * clock times are gone, so a caller should surface this rather than let the
   * gaps pass unnoticed.
   */
  missingDuration: number;
} {
  let converted = 0;
  const next = items.map((item) => {
    if (!item.startTime) return item;
    const { startTime, ...rest } = item;
    converted++;
    return { ...rest, dayPart: item.dayPart ?? dayPartFromTime(startTime) ?? 'morning' };
  });
  const missingDuration = next.filter((item) => !item.durationMinutes).length;
  return { items: next, converted, missingDuration };
}
