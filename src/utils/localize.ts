// Choosing between a record's base text and its Hebrew counterpart.
//
// Every translatable field follows one convention: `name` alongside `nameHe`.
// Reading that pair by hand at each call site is how fields end up rendering in
// English under a Hebrew UI — the map popup and the passport stamp description
// both did. This is the single place that decision is made.

/** The Hebrew counterpart of a field, by convention. */
type HebrewKey<K extends string> = `${K}He`;

/**
 * The text to show for one field.
 *
 * Falls back to the base field whenever Hebrew is missing or blank: a partly
 * translated record should show English rather than nothing. A whitespace-only
 * Hebrew value counts as missing, since that is what an empty form field and a
 * stripped AI response both produce.
 */
export function localized<K extends string, T extends Partial<Record<K | HebrewKey<K>, string>>>(
  item: T | null | undefined,
  field: K,
  isHebrew: boolean
): string {
  if (!item) return '';
  const base = (item[field as keyof T] as string | undefined) ?? '';
  if (!isHebrew) return base;
  const hebrew = (item[`${field}He` as keyof T] as string | undefined) ?? '';
  return hebrew.trim() ? hebrew : base;
}

/** True when this field still needs translating. */
export function needsHebrew<K extends string, T extends Partial<Record<K | HebrewKey<K>, string>>>(
  item: T | null | undefined,
  field: K
): boolean {
  if (!item) return false;
  const base = ((item[field as keyof T] as string | undefined) ?? '').trim();
  if (!base) return false; // nothing to translate
  const hebrew = ((item[`${field}He` as keyof T] as string | undefined) ?? '').trim();
  return !hebrew;
}
