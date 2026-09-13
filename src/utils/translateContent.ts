// Filling in the Hebrew a trip's content is missing.
//
// Records carry a base field and a Hebrew counterpart (`name` / `nameHe`).
// Content added in English — typed by hand, parsed from a booking, or produced
// by a generator that skipped the Hebrew — leaves the Hebrew side empty, and
// the UI then falls back to English however the language is set.
//
// This collects what is missing, asks the model to translate it, and reports
// what came back. Existing Hebrew is never overwritten: a human translation
// outranks a machine one.

import { needsHebrew } from './localize';
import type { Highlight, PlanItem, Restaurant, TripDay } from '../types/trip';
import type { PassportStamp } from '../types/ai';

/** A single piece of text to translate, addressed back to its record. */
export interface TranslationRequest {
  collection: 'highlights' | 'restaurants' | 'passportStamps' | 'planItems';
  recordId: string;
  /** Day the plan item belongs to; only set for planItems. */
  dayIndex?: number;
  field: string;
  text: string;
}

/** Fields worth translating, per collection. All are prose a guest reads. */
const HIGHLIGHT_FIELDS = ['name', 'description', 'ticketInfo'] as const;
const RESTAURANT_FIELDS = ['name', 'cuisine', 'notes'] as const;
const STAMP_FIELDS = ['title', 'description'] as const;
const PLAN_ITEM_FIELDS = ['name', 'notes'] as const;

export interface TranslatableContent {
  highlights: Highlight[];
  restaurants: Restaurant[];
  passportStamps: PassportStamp[];
  days: TripDay[];
}

/** Everything still missing a Hebrew counterpart, in a stable order. */
export function collectMissingHebrew(content: TranslatableContent): TranslationRequest[] {
  const requests: TranslationRequest[] = [];

  const scan = <T extends Record<string, unknown>>(
    collection: TranslationRequest['collection'],
    records: T[],
    fields: readonly string[],
    idOf: (r: T) => string,
    dayIndex?: (r: T) => number | undefined
  ) => {
    for (const record of records) {
      for (const field of fields) {
        if (!needsHebrew(record as never, field)) continue;
        requests.push({
          collection,
          recordId: idOf(record),
          dayIndex: dayIndex?.(record),
          field,
          text: String(record[field]),
        });
      }
    }
  };

  scan('highlights', content.highlights as never[], HIGHLIGHT_FIELDS, (r) => (r as Highlight).id);
  scan('restaurants', content.restaurants as never[], RESTAURANT_FIELDS, (r) => (r as Restaurant).id);
  scan('passportStamps', content.passportStamps as never[], STAMP_FIELDS, (r) => (r as PassportStamp).id);

  for (const day of content.days) {
    for (const item of day.plan?.items ?? []) {
      for (const field of PLAN_ITEM_FIELDS) {
        if (!needsHebrew(item as never, field)) continue;
        requests.push({
          collection: 'planItems',
          recordId: item.id,
          dayIndex: day.dayIndex,
          field,
          text: String((item as unknown as Record<string, unknown>)[field]),
        });
      }
    }
  }
  return requests;
}

/** Split into batches small enough to survive one model response intact. */
export function batchRequests(
  requests: TranslationRequest[],
  size = 25
): TranslationRequest[][] {
  const batches: TranslationRequest[][] = [];
  for (let i = 0; i < requests.length; i += size) {
    batches.push(requests.slice(i, i + size));
  }
  return batches;
}

export function buildTranslationPrompt(batch: TranslationRequest[]): string {
  const lines = batch.map((r, i) => `${i + 1}. ${JSON.stringify(r.text)}`).join('\n');
  return `Translate each of these travel-app strings from English into natural, modern Hebrew.

RULES:
- Return ONLY a JSON array of strings, same length and order as the input.
- Translate meaning, not word-for-word. These are read by a family on holiday.
- Keep proper nouns in their commonly used Hebrew form; if a place has no
  established Hebrew name, transliterate it.
- Preserve numbers, prices, times and URLs exactly as they appear.
- Keep each translation about the same length as its original.
- If a string is already Hebrew, return it unchanged.

STRINGS:
${lines}

Return exactly ${batch.length} strings as a JSON array.`;
}

/**
 * Match a model response back to its requests.
 *
 * A response of the wrong length means the batch cannot be trusted to line up —
 * pairing them anyway would write one item's Hebrew onto another. In that case
 * nothing from the batch is applied.
 */
export function pairTranslations(
  batch: TranslationRequest[],
  raw: unknown
): Array<{ request: TranslationRequest; hebrew: string }> {
  if (!Array.isArray(raw) || raw.length !== batch.length) return [];
  const paired: Array<{ request: TranslationRequest; hebrew: string }> = [];
  raw.forEach((value, i) => {
    const hebrew = typeof value === 'string' ? value.trim() : '';
    if (hebrew) paired.push({ request: batch[i], hebrew });
  });
  return paired;
}

/** Group the Hebrew back onto each record, ready to write. */
export function groupByRecord(
  results: Array<{ request: TranslationRequest; hebrew: string }>
): Map<string, { request: TranslationRequest; fields: Record<string, string> }> {
  const byRecord = new Map<
    string,
    { request: TranslationRequest; fields: Record<string, string> }
  >();
  for (const { request, hebrew } of results) {
    const key = `${request.collection}:${request.dayIndex ?? ''}:${request.recordId}`;
    const entry = byRecord.get(key) ?? { request, fields: {} };
    entry.fields[`${request.field}He`] = hebrew;
    byRecord.set(key, entry);
  }
  return byRecord;
}

/** Apply translated fields onto a plan item without disturbing the rest. */
export function applyToPlanItem(item: PlanItem, fields: Record<string, string>): PlanItem {
  return { ...item, ...fields };
}
