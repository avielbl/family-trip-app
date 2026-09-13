/**
 * One-off migration: plan items scheduled by clock time → parts of day.
 *
 * Reads every day document of a trip, moves each plan item's startTime to the
 * part of day it fell in, and leaves durations untouched. Dry-run by default —
 * nothing is written until you pass --write.
 *
 * Usage:
 *   node scripts/migrate-day-parts.mjs --trip=YOURCODE              # preview
 *   node scripts/migrate-day-parts.mjs --trip=YOURCODE --write      # apply
 *
 * Needs ./serviceAccountKey.json (Firebase Console → Project settings →
 * Service accounts → Generate new private key). The Admin SDK bypasses
 * Firestore security rules, so no signed-in admin user is required.
 *
 * Safe to run twice: an item with no startTime is never rewritten.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const TRIP_CODE = args.trip;
const WRITE = args.write === true;
const KEY_PATH = typeof args.key === 'string' ? args.key : './serviceAccountKey.json';

if (!TRIP_CODE || typeof TRIP_CODE !== 'string') {
  console.error('Missing --trip=YOURCODE (the trip code, e.g. the one in your invite link).');
  process.exit(1);
}

/**
 * Must stay in step with dayPartFromTime() in src/utils/dayParts.ts — the app's
 * Admin button uses that one, this script is the offline equivalent.
 */
function dayPartFromTime(startTime) {
  if (typeof startTime !== 'string') return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime.trim());
  if (!m) return undefined;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return undefined;
  }
  const total = hours * 60 + minutes;
  if (total < 11 * 60 + 30) return 'morning';
  if (total < 14 * 60) return 'noon';
  if (total < 17 * 60 + 30) return 'afternoon';
  return 'evening';
}

const app = initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore(app);

const snap = await db.collection(`trips/${TRIP_CODE}/days`).get();
if (snap.empty) {
  console.error(`No day documents under trips/${TRIP_CODE}/days — check the trip code.`);
  process.exit(1);
}

let daysChanged = 0;
let itemsConverted = 0;
let missingDuration = 0;

for (const doc of snap.docs.sort((a, b) => Number(a.id) - Number(b.id))) {
  const day = doc.data();
  const items = day?.plan?.items;
  if (!Array.isArray(items) || !items.length) continue;

  let converted = 0;
  const next = items.map((item) => {
    if (!item?.startTime) return item;
    const { startTime, ...rest } = item;
    converted++;
    return { ...rest, dayPart: item.dayPart ?? dayPartFromTime(startTime) ?? 'morning' };
  });

  missingDuration += next.filter((i) => !i?.durationMinutes).length;
  if (!converted) continue;

  daysChanged++;
  itemsConverted += converted;

  console.log(`\nDay ${Number(doc.id) + 1}  (${day.title ?? ''})`);
  for (let i = 0; i < items.length; i++) {
    if (!items[i]?.startTime) continue;
    const dur = next[i].durationMinutes ? `${next[i].durationMinutes} min` : 'NO DURATION';
    console.log(`   ${items[i].startTime}  →  ${next[i].dayPart.padEnd(9)} ${next[i].name}  [${dur}]`);
  }

  if (WRITE) {
    // Dotted path replaces only the items array; summary/tips on the plan stay.
    await doc.ref.update({ 'plan.items': next });
  }
}

console.log(
  `\n${WRITE ? 'Wrote' : 'Would write'}: ${itemsConverted} items across ${daysChanged} days.`
);
if (missingDuration) {
  console.log(
    `${missingDuration} items have no duration. With clock times gone that is the ` +
    `detail each item is read for, so they will show nothing — worth filling in.`
  );
}
if (!WRITE) console.log('\nDry run — nothing was written. Re-run with --write to apply.');

process.exit(0);
