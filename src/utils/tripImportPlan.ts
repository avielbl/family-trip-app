// Works out what a re-imported snapshot would change, so the user can see and
// confirm it — in particular the deletions — before anything is written.

import {
  SNAPSHOT_SECTIONS,
  SECTION_LABELS,
  indexSection,
  rowLabel,
  type SnapshotSection,
  type TripSnapshot,
} from './tripSnapshot';
import type { SnapshotInput } from './tripSnapshot';
import { stripDayEmbeds } from './tripSnapshot';

export interface SectionPlan {
  section: SnapshotSection;
  /** False when the file omitted this section entirely — it is left alone. */
  present: boolean;
  added: Record<string, unknown>[];
  updated: Record<string, unknown>[];
  unchanged: number;
  /** Rows in the app but not in the file. Only deleted in mirror mode. */
  removed: Record<string, unknown>[];
}

export interface ImportPlan {
  snapshot: TripSnapshot;
  mirror: boolean;
  sections: SectionPlan[];
  configChanged: boolean;
  totalWrites: number;
  totalDeletes: number;
  /** Set when the file's tripCode does not match the trip being imported into. */
  tripCodeMismatch: string | null;
}

/** Order-insensitive deep equality, good enough to spot "nothing changed" rows. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    // Treat absent and null as equivalent: Firestore drops undefined fields,
    // and a spreadsheet round trip turns a blank cell into either one.
    return (a ?? null) === (b ?? null);
  }
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => sameValue(v, b[i]));
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
    const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

function currentRows(section: SnapshotSection, current: SnapshotInput): unknown[] {
  switch (section) {
    case 'days':
      return (current.days ?? []).map(stripDayEmbeds);
    case 'flights':
      return current.flights ?? [];
    case 'hotels':
      return current.hotels ?? [];
    case 'driving':
      return current.driving ?? [];
    case 'rentalCars':
      return current.rentalCars ?? [];
    case 'highlights':
      return current.highlights ?? [];
    case 'restaurants':
      return current.restaurants ?? [];
    case 'packing':
      return current.packing ?? [];
  }
}

export function buildImportPlan(
  snapshot: TripSnapshot,
  current: SnapshotInput,
  options: { mirror: boolean }
): ImportPlan {
  const sections: SectionPlan[] = [];
  let totalWrites = 0;
  let totalDeletes = 0;

  for (const section of SNAPSHOT_SECTIONS) {
    const incoming = snapshot[section] as unknown[] | undefined;
    if (incoming === undefined) {
      sections.push({ section, present: false, added: [], updated: [], unchanged: 0, removed: [] });
      continue;
    }
    const incomingByKey = indexSection(section, incoming);
    const existingByKey = indexSection(section, currentRows(section, current));

    const added: Record<string, unknown>[] = [];
    const updated: Record<string, unknown>[] = [];
    let unchanged = 0;

    for (const [key, incomingRow] of incomingByKey) {
      const existing = existingByKey.get(key);
      if (!existing) {
        added.push(incomingRow);
        continue;
      }
      // A spreadsheet row carries only its own columns, so overlay it on the
      // live document; a JSON row is the whole record and replaces it.
      const row = snapshot.partial ? { ...existing, ...incomingRow } : incomingRow;
      if (sameValue(row, existing)) unchanged++;
      else updated.push(row);
    }

    const removed = options.mirror
      ? [...existingByKey.entries()]
          .filter(([key]) => !incomingByKey.has(key))
          .map(([, row]) => row)
      : [];

    totalWrites += added.length + updated.length;
    totalDeletes += removed.length;
    sections.push({ section, present: true, added, updated, unchanged, removed });
  }

  const configChanged =
    !!snapshot.config && !sameValue(snapshot.config, current.config ?? undefined);
  if (configChanged) totalWrites++;

  const tripCodeMismatch =
    snapshot.tripCode && current.tripCode && snapshot.tripCode !== current.tripCode
      ? snapshot.tripCode
      : null;

  return {
    snapshot,
    mirror: options.mirror,
    sections,
    configChanged,
    totalWrites,
    totalDeletes,
    tripCodeMismatch,
  };
}

/** One-line summaries for the confirmation dialog. */
export function describePlan(plan: ImportPlan, isHe: boolean): string[] {
  const lines: string[] = [];
  for (const s of plan.sections) {
    if (!s.present) continue;
    const parts: string[] = [];
    if (s.added.length) parts.push(isHe ? `${s.added.length} חדשים` : `${s.added.length} added`);
    if (s.updated.length) parts.push(isHe ? `${s.updated.length} עודכנו` : `${s.updated.length} updated`);
    if (s.removed.length) parts.push(isHe ? `${s.removed.length} יימחקו` : `${s.removed.length} deleted`);
    if (!parts.length) continue;
    const label = isHe ? SECTION_LABELS[s.section].he : SECTION_LABELS[s.section].en;
    lines.push(`${label}: ${parts.join(', ')}`);
  }
  if (plan.configChanged) {
    lines.push(isHe ? 'הגדרות הטיול: עודכנו' : 'Trip settings: updated');
  }
  return lines;
}

/** Labels of rows that a mirror import would delete, for an explicit warning. */
export function deletionLabels(plan: ImportPlan, isHe: boolean): string[] {
  const out: string[] = [];
  for (const s of plan.sections) {
    const label = isHe ? SECTION_LABELS[s.section].he : SECTION_LABELS[s.section].en;
    for (const row of s.removed) out.push(`${label} — ${rowLabel(s.section, row)}`);
  }
  return out;
}
