// Snapshot ⇄ Excel workbook, one sheet per section.
//
// A spreadsheet can only carry flat cells, so nested fields (a day's plan
// items, a restaurant's per-member ratings, a highlight's completedBy list)
// cannot be edited here. Rather than drop them, the importer merges each row
// onto the live document, leaving untouched every field the sheet has no
// column for. Use the JSON export when you need to edit those.
//
// Both Excel libraries are loaded on demand — they are large, and most sessions
// never open this screen.

import type { Sheet, SheetData } from 'write-excel-file/browser';

type WriteSheet = Sheet<File | Blob | ArrayBuffer>;
import {
  SNAPSHOT_SECTIONS,
  SECTION_LABELS,
  SNAPSHOT_VERSION,
  SnapshotParseError,
  rowKey,
  type SnapshotSection,
  type TripSnapshot,
} from './tripSnapshot';

type CellType = 'string' | 'number' | 'boolean';

interface ColumnSpec {
  key: string;
  type: CellType;
  width?: number;
}

const col = (key: string, type: CellType = 'string', width?: number): ColumnSpec => ({
  key,
  type,
  width,
});

/**
 * Columns per sheet. `id` (or `dayIndex` for days) must stay intact — it is how
 * a row is matched back to its record. Fields not listed here are preserved
 * from the live document on import, never blanked.
 */
export const SHEET_COLUMNS: Record<SnapshotSection, ColumnSpec[]> = {
  days: [
    col('dayIndex', 'number', 10),
    col('date', 'string', 14),
    col('title', 'string', 28),
    col('titleHe', 'string', 28),
    col('location', 'string', 22),
    col('locationHe', 'string', 22),
  ],
  flights: [
    col('id', 'string', 22),
    col('dayIndex', 'number', 10),
    col('airline', 'string', 18),
    col('flightNumber', 'string', 14),
    col('departureAirport', 'string', 22),
    col('departureAirportCode', 'string', 10),
    col('arrivalAirport', 'string', 22),
    col('arrivalAirportCode', 'string', 10),
    col('departureTime', 'string', 22),
    col('arrivalTime', 'string', 22),
    col('terminal', 'string', 10),
    col('gate', 'string', 10),
    col('confirmationCode', 'string', 16),
    col('notes', 'string', 30),
  ],
  hotels: [
    col('id', 'string', 22),
    col('dayIndexStart', 'number', 12),
    col('dayIndexEnd', 'number', 12),
    col('name', 'string', 26),
    col('address', 'string', 30),
    col('city', 'string', 18),
    col('checkIn', 'string', 22),
    col('checkOut', 'string', 22),
    col('confirmationCode', 'string', 16),
    col('phone', 'string', 16),
    col('email', 'string', 22),
    col('wifiPassword', 'string', 16),
    col('website', 'string', 28),
    col('mapUrl', 'string', 28),
    col('lat', 'number', 12),
    col('lng', 'number', 12),
    col('notes', 'string', 30),
  ],
  driving: [
    col('id', 'string', 22),
    col('dayIndex', 'number', 10),
    col('from', 'string', 28),
    col('to', 'string', 28),
    col('distanceKm', 'number', 12),
    col('durationMinutes', 'number', 14),
    col('mapUrl', 'string', 28),
    col('notes', 'string', 30),
  ],
  rentalCars: [
    col('id', 'string', 22),
    col('company', 'string', 20),
    col('carType', 'string', 16),
    col('confirmationCode', 'string', 16),
    col('pickupLocation', 'string', 24),
    col('pickupTime', 'string', 22),
    col('returnLocation', 'string', 24),
    col('returnTime', 'string', 22),
    col('phone', 'string', 16),
    col('notes', 'string', 30),
  ],
  highlights: [
    col('id', 'string', 22),
    col('dayIndex', 'number', 10),
    col('name', 'string', 26),
    col('nameHe', 'string', 26),
    col('category', 'string', 14),
    col('description', 'string', 36),
    col('descriptionHe', 'string', 36),
    col('address', 'string', 30),
    col('openingHours', 'string', 20),
    col('ticketInfo', 'string', 20),
    col('mapUrl', 'string', 28),
    col('lat', 'number', 12),
    col('lng', 'number', 12),
    col('completed', 'boolean', 12),
  ],
  restaurants: [
    col('id', 'string', 22),
    col('dayIndex', 'number', 10),
    col('name', 'string', 26),
    col('nameHe', 'string', 26),
    col('cuisine', 'string', 16),
    col('address', 'string', 30),
    col('city', 'string', 18),
    col('phone', 'string', 16),
    col('priceRange', 'string', 12),
    col('mapUrl', 'string', 28),
    col('lat', 'number', 12),
    col('lng', 'number', 12),
    col('notes', 'string', 30),
    col('visited', 'boolean', 10),
  ],
  packing: [
    col('id', 'string', 22),
    col('text', 'string', 30),
    col('textHe', 'string', 30),
    col('category', 'string', 16),
    col('checked', 'boolean', 10),
  ],
};

function sheetName(section: SnapshotSection): string {
  return SECTION_LABELS[section].en;
}

const SECTION_BY_SHEET = new Map<string, SnapshotSection>(
  SNAPSHOT_SECTIONS.map((s) => [sheetName(s).toLowerCase(), s])
);

/** Render a snapshot as an .xlsx workbook. */
export async function snapshotToWorkbook(snapshot: TripSnapshot): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const readme: WriteSheet = {
    sheet: 'README',
    columns: [{ width: 78 }],
    data: [
      ['TripIt export — how to edit this file'],
      [`Format version ${SNAPSHOT_VERSION}.  Trip code: ${snapshot.tripCode}`],
      [`Exported: ${snapshot.exportedAt}`],
      [],
      ['Do NOT change the "id" column (or "dayIndex" on the Days sheet).'],
      ['It is how each row is matched back to its record. A row with a new,'],
      ['unique id is added as a new record; a row you delete is removed from'],
      ['the trip on import — you will see a confirmation listing what goes'],
      ['before anything is written.'],
      [],
      ['Do not rename or reorder the sheets, and keep the header row as is.'],
      [],
      ['Fields with no column here — day plan items, restaurant ratings, who'],
      ['completed an attraction — are left exactly as they are. Use the JSON'],
      ['export if you need to edit those.'],
    ].map((row) =>
      row.length ? row.map((v) => ({ value: String(v), type: String as never })) : [null]
    ) as SheetData,
  };

  const sheets: WriteSheet[] = [readme];

  for (const section of SNAPSHOT_SECTIONS) {
    const rows = (snapshot[section] as Record<string, unknown>[] | undefined) ?? [];
    const cols = SHEET_COLUMNS[section];

    const header = cols.map((c) => ({
      value: c.key,
      type: String as never,
      fontWeight: 'bold' as const,
      backgroundColor: '#e8edf5',
    }));

    const body = rows.map((row) =>
      cols.map((c) => {
        const value = row[c.key];
        if (value === undefined || value === null || value === '') return null;
        if (c.type === 'number') {
          const n = typeof value === 'number' ? value : Number(value);
          return Number.isFinite(n)
            ? { value: n, type: Number as never }
            : { value: String(value), type: String as never };
        }
        if (c.type === 'boolean') return { value: Boolean(value), type: Boolean as never };
        return { value: String(value), type: String as never };
      })
    );

    sheets.push({
      sheet: sheetName(section),
      columns: cols.map((c) => ({ width: c.width })),
      // Header stays visible while scrolling a long list.
      stickyRowsCount: 1,
      data: [header, ...body] as SheetData,
    });
  }

  return writeXlsxFile(sheets).toBlob();
}

function coerce(value: unknown, type: CellType): unknown {
  if (value === null || value === undefined || value === '') return undefined;
  if (type === 'number') {
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    const s = String(value).trim().toLowerCase();
    if (['true', 'yes', '1', 'v', 'x', 'כן'].includes(s)) return true;
    if (['false', 'no', '0', '', 'לא'].includes(s)) return false;
    return undefined;
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * Read an edited workbook back into a snapshot. Only sheets that are present
 * become sections — a workbook missing a sheet leaves that section untouched
 * rather than deleting everything in it.
 */
export async function workbookToSnapshot(
  file: File,
  tripCode: string
): Promise<TripSnapshot> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');

  let workbook: { sheet: string; data: unknown[][] }[];
  try {
    workbook = (await readXlsxFile(file)) as unknown as {
      sheet: string;
      data: unknown[][];
    }[];
  } catch (err) {
    throw new SnapshotParseError(`Could not read the workbook: ${(err as Error).message}`);
  }

  const snapshot: TripSnapshot = {
    formatVersion: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    tripCode,
    partial: true,
  };

  let matched = 0;
  for (const { sheet: name, data: grid } of workbook) {
    const section = SECTION_BY_SHEET.get(String(name).trim().toLowerCase());
    if (!section) continue;
    matched++;

    if (!grid?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (snapshot as any)[section] = [];
      continue;
    }

    const header = (grid[0] ?? []).map((h) => String(h ?? '').trim());
    const specs = SHEET_COLUMNS[section];
    // Only columns the sheet actually still has are authoritative. Delete a
    // whole column and that field is left alone; blank a cell in a column that
    // is present and the field is cleared.
    const present = specs
      .map((spec) => ({ spec, index: header.indexOf(spec.key) }))
      .filter((c) => c.index >= 0);
    const rows: Record<string, unknown>[] = [];

    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r] ?? [];
      if (cells.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

      const row: Record<string, unknown> = {};
      for (const { spec, index } of present) {
        row[spec.key] = coerce(cells[index], spec.type);
      }

      if (!rowKey(section, row)) {
        throw new SnapshotParseError(
          section === 'days'
            ? `Sheet "${name}" row ${r + 1}: missing or non-numeric dayIndex.`
            : `Sheet "${name}" row ${r + 1}: missing "id". Keep the id column intact.`
        );
      }
      rows.push(row);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (snapshot as any)[section] = rows;
  }

  if (!matched) {
    throw new SnapshotParseError(
      'No recognisable sheets in this workbook. Export a fresh copy and edit that.'
    );
  }
  return snapshot;
}
