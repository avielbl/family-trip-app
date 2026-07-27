import {
  collection,
  doc,
  setDoc,
  getDoc,
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
  callback: (family: Family | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'families', familyId), (snap) => {
    callback(snap.exists() ? (snap.data() as Family) : null);
  });
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
    tripCodes: data.tripCodes ?? [],
    activeTripCode: data.activeTripCode ?? null,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, family);
  return family;
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
  await updateDoc(doc(db, 'families', familyId), { memberTemplates });
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
