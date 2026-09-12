// Canonical, portable representation of a trip plan — the shape used for both
// the JSON and Excel export/import round trip.
//
// Only the *planning* sections travel: config, days (with their plan items),
// flights, hotels, driving, rental cars, highlights, restaurants and packing.
// Trip activity — photos, quiz answers, the travel log, passport stamps — is
// deliberately excluded: it is generated inside the app by the family, not
// something you would edit in a spreadsheet, and round-tripping it would risk
// destroying it.

import type {
  DrivingSegment,
  Flight,
  Highlight,
  Hotel,
  PackingItem,
  RentalCar,
  Restaurant,
  TripConfig,
  TripDay,
} from '../types/trip';

export const SNAPSHOT_VERSION = 1;

/**
 * A day as it travels in an export. The embedded record arrays are dropped —
 * see `stripDayEmbeds` — so the subcollections stay the single source of truth.
 */
export type ExportedDay = Omit<
  TripDay,
  'flights' | 'hotels' | 'driving' | 'highlights' | 'restaurants'
>;

export interface TripSnapshot {
  formatVersion: number;
  exportedAt: string;
  tripCode: string;
  /**
   * True for a snapshot read from a spreadsheet, whose rows carry only the
   * columns the sheet defines. Such rows are merged onto the live document so
   * that nested fields with no column — day plans, restaurant ratings, who
   * completed an attraction — survive the round trip instead of being erased.
   */
  partial?: boolean;
  tripName?: string;
  config?: TripConfig;
  days?: ExportedDay[];
  flights?: Flight[];
  hotels?: Hotel[];
  driving?: DrivingSegment[];
  rentalCars?: RentalCar[];
  highlights?: Highlight[];
  restaurants?: Restaurant[];
  packing?: PackingItem[];
}

/** The list sections, in the order they appear in the file and the UI. */
export const SNAPSHOT_SECTIONS = [
  'days',
  'flights',
  'hotels',
  'driving',
  'rentalCars',
  'highlights',
  'restaurants',
  'packing',
] as const;

export type SnapshotSection = (typeof SNAPSHOT_SECTIONS)[number];

/** Firestore subcollection backing each section. */
export const SECTION_COLLECTION: Record<SnapshotSection, string> = {
  days: 'days',
  flights: 'flights',
  hotels: 'hotels',
  driving: 'driving',
  rentalCars: 'rentalCars',
  highlights: 'highlights',
  restaurants: 'restaurants',
  packing: 'packing',
};

export const SECTION_LABELS: Record<SnapshotSection, { en: string; he: string }> = {
  days: { en: 'Days', he: 'ימים' },
  flights: { en: 'Flights', he: 'טיסות' },
  hotels: { en: 'Hotels', he: 'מלונות' },
  driving: { en: 'Driving', he: 'מסלולי נסיעה' },
  rentalCars: { en: 'Rental cars', he: 'רכבי שכירות' },
  highlights: { en: 'Attractions', he: 'אטרקציות' },
  restaurants: { en: 'Restaurants', he: 'מסעדות' },
  packing: { en: 'Packing', he: 'ציוד' },
};

/**
 * Document id for a row. Days are keyed by their day index (that is their
 * Firestore doc id); everything else carries its own `id`.
 */
export function rowKey(section: SnapshotSection, row: unknown): string | null {
  const item = row as Record<string, unknown>;
  if (section === 'days') {
    const idx = item?.dayIndex;
    return typeof idx === 'number' && Number.isFinite(idx) ? String(idx) : null;
  }
  const id = item?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/** Human-readable label for a row, used in the "will be deleted" preview. */
export function rowLabel(section: SnapshotSection, row: unknown): string {
  const item = row as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  switch (section) {
    case 'days':
      return `Day ${(item.dayIndex as number) + 1}${str(item.title) ? ` — ${str(item.title)}` : ''}`;
    case 'flights':
      return `${str(item.airline)} ${str(item.flightNumber)} ${str(item.departureAirportCode)}→${str(item.arrivalAirportCode)}`.trim();
    case 'driving':
      return `${str(item.from)} → ${str(item.to)}`;
    case 'rentalCars':
      return str(item.company) || str(item.id);
    case 'packing':
      return str(item.text) || str(item.id);
    default:
      return str(item.name) || str(item.id);
  }
}

export interface SnapshotInput {
  tripCode: string;
  config?: TripConfig | null;
  days?: TripDay[];
  flights?: Flight[];
  hotels?: Hotel[];
  driving?: DrivingSegment[];
  rentalCars?: RentalCar[];
  highlights?: Highlight[];
  restaurants?: Restaurant[];
  packing?: PackingItem[];
}

/**
 * Days carry vestigial embedded arrays (`flights`, `hotels`, …) that no screen
 * reads — the subcollections are the source of truth. Exporting them would
 * duplicate every record and invite the two copies to disagree, so they are
 * stripped here and restored from the live document on import.
 */
export function stripDayEmbeds(day: TripDay): ExportedDay {
  const { flights, hotels, driving, highlights, restaurants, ...rest } = day;
  void flights; void hotels; void driving; void highlights; void restaurants;
  return rest;
}

export function buildSnapshot(input: SnapshotInput): TripSnapshot {
  return {
    formatVersion: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    tripCode: input.tripCode,
    tripName: input.config?.tripName,
    config: input.config ?? undefined,
    days: (input.days ?? []).map(stripDayEmbeds),
    flights: input.flights ?? [],
    hotels: input.hotels ?? [],
    driving: input.driving ?? [],
    rentalCars: input.rentalCars ?? [],
    highlights: input.highlights ?? [],
    restaurants: input.restaurants ?? [],
    packing: input.packing ?? [],
  };
}

export function snapshotToJson(snapshot: TripSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export class SnapshotParseError extends Error {}

/**
 * Parse and sanity-check an edited JSON export. Rejects anything that would
 * silently destroy data on a mirror import — a non-object, an unknown format
 * version, a section that is not an array, or rows without a usable id.
 */
export function parseSnapshotJson(text: string): TripSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new SnapshotParseError(`Not valid JSON: ${(err as Error).message}`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SnapshotParseError('Expected a JSON object at the top level.');
  }
  const obj = raw as Record<string, unknown>;

  const version = obj.formatVersion;
  if (version !== undefined && version !== SNAPSHOT_VERSION) {
    throw new SnapshotParseError(
      `Unsupported formatVersion ${String(version)} — this app reads version ${SNAPSHOT_VERSION}.`
    );
  }

  const snapshot: TripSnapshot = {
    formatVersion: SNAPSHOT_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    tripCode: typeof obj.tripCode === 'string' ? obj.tripCode : '',
  };

  if (obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)) {
    snapshot.config = obj.config as TripConfig;
  }

  for (const section of SNAPSHOT_SECTIONS) {
    const value = obj[section];
    if (value === undefined || value === null) continue; // section omitted — left untouched
    if (!Array.isArray(value)) {
      throw new SnapshotParseError(`"${section}" must be a list, got ${typeof value}.`);
    }
    value.forEach((row, i) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new SnapshotParseError(`"${section}" entry ${i + 1} is not an object.`);
      }
      if (!rowKey(section, row)) {
        throw new SnapshotParseError(
          section === 'days'
            ? `"days" entry ${i + 1} is missing a numeric dayIndex.`
            : `"${section}" entry ${i + 1} is missing an "id".`
        );
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (snapshot as any)[section] = value;
  }

  return snapshot;
}

/** Rows in a section, keyed by document id, rejecting duplicates. */
export function indexSection(
  section: SnapshotSection,
  rows: unknown[]
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = rowKey(section, row);
    if (!key) continue;
    if (map.has(key)) {
      throw new SnapshotParseError(
        `"${section}" has two entries with the same ${section === 'days' ? 'dayIndex' : 'id'} "${key}".`
      );
    }
    map.set(key, row as Record<string, unknown>);
  }
  return map;
}
