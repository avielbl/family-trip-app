import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import type { Family, FamilyMember, TripConfig, TripSummary } from '../types/trip';

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, 'families', familyId));
  return snap.exists() ? (snap.data() as Family) : null;
}

export function subscribeFamily(
  familyId: string,
  callback: (family: Family | null) => void,
  onError?: (code: string) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'families', familyId),
    (snap) => {
      callback(snap.exists() ? (snap.data() as Family) : null);
    },
    (err) => {
      console.warn('Family subscription failed:', err);
      onError?.(err.code ?? err.message);
    }
  );
}

// Lowercased member emails, denormalized onto the family doc so a signed-in
// user can find their family again after clearing local data.
function extractMemberEmails(members: FamilyMember[]): string[] {
  return [
    ...new Set(
      members
        .map((m) => m.email?.trim().toLowerCase())
        .filter((e): e is string => !!e)
    ),
  ];
}

export async function createFamily(data: {
  name: string;
  adminUids: string[];
  memberTemplates: FamilyMember[];
  tripCodes?: string[];
  activeTripCode?: string | null;
}): Promise<Family> {
  const ref = doc(collection(db, 'families'));
  const family: Family = {
    id: ref.id,
    name: data.name,
    adminUids: data.adminUids,
    memberTemplates: data.memberTemplates,
    memberEmails: extractMemberEmails(data.memberTemplates),
    tripCodes: data.tripCodes ?? [],
    activeTripCode: data.activeTripCode ?? null,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, family);
  return family;
}

/**
 * Sign-in recovery: find the family a user belongs to when no local pointer
 * and no profile familyId exist — by admin uid first, then by member email.
 */
export async function findFamilyForUser(
  uid: string,
  email: string | null | undefined,
  diag?: string[]
): Promise<Family | null> {
  const byAdmin = await getDocs(
    query(collection(db, 'families'), where('adminUids', 'array-contains', uid), limit(1))
  );
  diag?.push(`admin=${byAdmin.size}`);
  if (!byAdmin.empty) return byAdmin.docs[0].data() as Family;

  const normalized = email?.trim().toLowerCase();
  if (normalized) {
    const byEmail = await getDocs(
      query(
        collection(db, 'families'),
        where('memberEmails', 'array-contains', normalized),
        limit(1)
      )
    );
    diag?.push(`email=${byEmail.size}`);
    if (!byEmail.empty) return byEmail.docs[0].data() as Family;
  }
  return null;
}

export async function setFamilyActiveTrip(
  familyId: string,
  tripCode: string | null
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), { activeTripCode: tripCode });
}

export async function addTripToFamily(
  familyId: string,
  tripCode: string,
  options?: { makeActive?: boolean }
): Promise<void> {
  const updates: Record<string, unknown> = { tripCodes: arrayUnion(tripCode) };
  if (options?.makeActive) updates.activeTripCode = tripCode;
  await updateDoc(doc(db, 'families', familyId), updates);
}

export async function removeTripFromFamily(
  familyId: string,
  tripCode: string
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), {
    tripCodes: arrayRemove(tripCode),
  });
}

export async function updateMemberTemplates(
  familyId: string,
  memberTemplates: FamilyMember[]
): Promise<void> {
  await updateDoc(doc(db, 'families', familyId), {
    memberTemplates,
    memberEmails: extractMemberEmails(memberTemplates),
  });
}

// Lazy backfill for families created before memberEmails was denormalized.
export async function backfillMemberEmails(family: Family): Promise<void> {
  if (family.memberEmails !== undefined) return;
  await updateDoc(doc(db, 'families', family.id), {
    memberEmails: extractMemberEmails(family.memberTemplates ?? []),
  });
}

export async function setTripStatus(
  tripCode: string,
  status: TripConfig['status']
): Promise<void> {
  await updateDoc(doc(db, 'trips', tripCode), { status });
}

// Family trip counts are tiny, so one getDoc per code is fine.
export async function getTripSummaries(tripCodes: string[]): Promise<TripSummary[]> {
  const summaries = await Promise.all(
    tripCodes.map(async (code): Promise<TripSummary | null> => {
      const snap = await getDoc(doc(db, 'trips', code));
      if (!snap.exists()) return null;
      const cfg = snap.data() as TripConfig;
      return {
        tripCode: cfg.tripCode,
        tripName: cfg.tripName,
        destination: cfg.destination,
        destinationHe: cfg.destinationHe,
        flagEmoji: cfg.flagEmoji,
        startDate: cfg.startDate,
        endDate: cfg.endDate,
        status: cfg.status ?? 'upcoming',
        memberCount: cfg.familyMembers?.length ?? 0,
      };
    })
  );
  return summaries.filter((s): s is TripSummary => s !== null);
}

/**
 * Last-resort sign-in recovery: scan the trips collection (tiny for a family
 * app) for a trip this user belongs to, when no family document references
 * them — e.g. app data was cleared before the legacy trip was ever migrated
 * into a family. Matches by trip adminUid or member email; the bootstrap
 * admin may also claim legacy trips that predate adminUid stamping.
 * Returns the trip's familyId, migrating the legacy trip into a fresh family
 * when this user is allowed to.
 */
export async function recoverFromLegacyTrips(
  uid: string,
  email: string | null | undefined,
  isBootstrapAdmin: boolean,
  diag?: string[]
): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'trips'), limit(25)));
  // Doc ID is the canonical trip code — legacy docs may lack the field.
  const trips = snap.docs.map((d) => ({ ...(d.data() as TripConfig), tripCode: d.id }));
  diag?.push(`trips=${trips.length}`);
  const normalized = email?.trim().toLowerCase();

  const isMember = (trip: TripConfig) =>
    trip.adminUid === uid ||
    (!!normalized &&
      (trip.familyMembers ?? []).some(
        (m) => m.email?.trim().toLowerCase() === normalized
      ));

  let candidates = trips.filter(isMember);
  diag?.push(`member-of=${candidates.length}`);
  if (candidates.length === 0 && isBootstrapAdmin) candidates = trips;

  const withFamily = candidates.find((t) => t.familyId);
  if (withFamily) return withFamily.familyId!;

  for (const legacy of candidates) {
    try {
      const migratedId = await migrateLegacyTripToFamily(legacy, uid, isBootstrapAdmin);
      if (migratedId) {
        diag?.push(`migrated=${legacy.tripCode}`);
        return migratedId;
      }
      diag?.push(`skip=${legacy.tripCode}`);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      diag?.push(`migrate ${legacy.tripCode}: ${e.code ?? e.message}`);
    }
  }
  return null;
}

/**
 * Lazy, idempotent migration for a legacy single-trip install: wraps the
 * existing trip into a new family document and stamps `familyId` onto the
 * trip. Only the device whose user may write the trip config (the trip admin,
 * or anyone while no adminUid is claimed) performs it; other devices simply
 * wait for `trip.familyId` to appear.
 * Returns the familyId, or null if this device cannot migrate.
 */
export async function migrateLegacyTripToFamily(
  trip: TripConfig,
  uid: string,
  isBootstrapAdmin: boolean
): Promise<string | null> {
  if (trip.familyId) return trip.familyId;

  const canWrite = trip.adminUid === uid || (!trip.adminUid && isBootstrapAdmin);
  if (!canWrite) return null;

  const family = await createFamily({
    name: trip.tripName || 'My Family',
    adminUids: [uid],
    memberTemplates: trip.familyMembers ?? [],
    tripCodes: [trip.tripCode],
    activeTripCode: trip.tripCode,
  });

  await updateDoc(doc(db, 'trips', trip.tripCode), {
    familyId: family.id,
    status: trip.status ?? 'active',
    destination: trip.destination ?? 'Greece',
    destinationHe: trip.destinationHe ?? 'יוון',
    countryCode: trip.countryCode ?? 'GR',
    flagEmoji: trip.flagEmoji ?? '🇬🇷',
    createdAt: trip.createdAt ?? new Date().toISOString(),
  });

  return family.id;
}
