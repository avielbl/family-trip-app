import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Family, TripConfig, TripSummary } from '../types/trip';
import {
  subscribeFamily,
  createFamily,
  setFamilyActiveTrip,
  addTripToFamily,
  setTripStatus,
  getTripSummaries,
  migrateLegacyTripToFamily,
} from '../firebase/familyService';
import { getTripConfig, saveTripConfig } from '../firebase/tripService';
import { useAuthContext, isBootstrapAdminEmail } from './AuthContext';

interface FamilyContextType {
  family: Family | null;
  familyId: string | null;
  familyLoading: boolean;
  trips: TripSummary[];
  refreshTrips: () => Promise<void>;
  isFamilyAdmin: boolean;
  setActiveTrip: (code: string) => Promise<void>;
  registerTrip: (config: TripConfig, makeActive: boolean) => Promise<void>;
  archiveTrip: (code: string) => Promise<void>;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- idiomatic context hook export
export function useFamilyContext(): FamilyContextType {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamilyContext must be used within FamilyProvider');
  return ctx;
}

// How often a non-admin device re-checks a legacy trip doc while waiting for
// the admin device to perform the family migration.
const LEGACY_MIGRATION_POLL_MS = 15000;

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, userProfile, authLoading } = useAuthContext();

  const [familyId, setFamilyIdState] = useState<string | null>(
    () => localStorage.getItem('familyId')
  );
  const [family, setFamily] = useState<Family | null>(null);
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [familyLoading, setFamilyLoading] = useState(true);

  // Persist a resolved familyId locally and (best-effort) onto the user profile.
  const adoptFamilyId = useCallback(
    (id: string) => {
      localStorage.setItem('familyId', id);
      setFamilyIdState(id);
      if (firebaseUser) {
        updateDoc(doc(db, 'users', firebaseUser.uid), { familyId: id }).catch((err) => {
          console.warn('Could not persist familyId to user profile:', err);
        });
      }
    },
    [firebaseUser]
  );

  // Resolve the familyId: localStorage → userProfile → legacy tripCode
  // (migrating the legacy trip into a family when this device is allowed to).
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (!cancelled) setFamilyLoading(false);
    };

    const resolve = async () => {
      // 1. Already resolved on this device
      const stored = localStorage.getItem('familyId');
      if (stored) {
        if (!cancelled && familyId !== stored) setFamilyIdState(stored);
        // Best-effort profile sync for users who signed in after resolution
        if (firebaseUser && userProfile && userProfile.familyId !== stored) {
          updateDoc(doc(db, 'users', firebaseUser.uid), { familyId: stored }).catch(() => {
            /* best-effort */
          });
        }
        finish();
        return;
      }

      // 2. From the signed-in user's profile
      if (userProfile?.familyId) {
        if (!cancelled) adoptFamilyId(userProfile.familyId);
        finish();
        return;
      }

      // 3. Legacy single-trip pointer
      const legacyCode = localStorage.getItem('tripCode');
      if (!legacyCode) {
        finish();
        return;
      }

      try {
        const trip = await getTripConfig(legacyCode);
        if (cancelled) return;

        if (trip?.familyId) {
          adoptFamilyId(trip.familyId);
          finish();
          return;
        }

        if (trip && firebaseUser) {
          const bootstrap = isBootstrapAdminEmail(firebaseUser.email);
          const canMigrate =
            trip.adminUid === firebaseUser.uid || (!trip.adminUid && bootstrap);

          if (canMigrate) {
            const migratedId = await migrateLegacyTripToFamily(
              trip,
              firebaseUser.uid,
              bootstrap
            );
            if (cancelled) return;
            if (migratedId) {
              adoptFamilyId(migratedId);
              finish();
              return;
            }
          }

          // This device can't migrate — wait for the admin device to do it
          // and pick up trip.familyId when it appears.
          finish();
          pollTimer = setInterval(() => {
            getTripConfig(legacyCode)
              .then((t) => {
                if (t?.familyId && !cancelled) {
                  if (pollTimer) clearInterval(pollTimer);
                  adoptFamilyId(t.familyId);
                }
              })
              .catch(() => {
                /* keep polling */
              });
          }, LEGACY_MIGRATION_POLL_MS);
          return;
        }

        // Anonymous user with a legacy tripCode (or missing trip doc):
        // no family — TripContext falls back to the legacy code.
        finish();
      } catch (err) {
        console.error('Family resolution failed:', err);
        finish();
      }
    };

    void resolve();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [authLoading, firebaseUser, userProfile, familyId, adoptFamilyId]);

  // Live family document subscription
  useEffect(() => {
    if (!familyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when the family is cleared
      setFamily(null);
      return;
    }
    const unsub = subscribeFamily(familyId, setFamily);
    return unsub;
  }, [familyId]);

  // Trip summaries, reloaded whenever the family's trip list changes
  const tripCodesKey = useMemo(
    () => (family?.tripCodes ?? []).join(','),
    [family?.tripCodes]
  );

  const refreshTrips = useCallback(async () => {
    const codes = tripCodesKey ? tripCodesKey.split(',') : [];
    if (codes.length === 0) {
      setTrips([]);
      return;
    }
    const summaries = await getTripSummaries(codes);
    setTrips(summaries);
  }, [tripCodesKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after await
    refreshTrips().catch((err) => {
      console.error('Failed to load trip summaries:', err);
    });
  }, [refreshTrips]);

  const isFamilyAdmin =
    (!!firebaseUser && !!family?.adminUids?.includes(firebaseUser.uid)) ||
    isBootstrapAdminEmail(firebaseUser?.email) ||
    !family;

  const setActiveTrip = useCallback(
    async (code: string) => {
      if (!familyId) throw new Error('No family to set the active trip on');
      await setFamilyActiveTrip(familyId, code);
    },
    [familyId]
  );

  const registerTrip = useCallback(
    async (config: TripConfig, makeActive: boolean) => {
      await saveTripConfig(config);

      if (familyId) {
        await addTripToFamily(familyId, config.tripCode, { makeActive });
        if (config.familyId !== familyId) {
          await updateDoc(doc(db, 'trips', config.tripCode), { familyId });
        }
        return;
      }

      // First trip ever: create the family around it.
      const created = await createFamily({
        name: config.tripName,
        adminUids: firebaseUser ? [firebaseUser.uid] : [],
        memberTemplates: config.familyMembers ?? [],
        tripCodes: [config.tripCode],
        activeTripCode: makeActive ? config.tripCode : null,
      });
      await updateDoc(doc(db, 'trips', config.tripCode), { familyId: created.id });
      adoptFamilyId(created.id);
    },
    [familyId, firebaseUser, adoptFamilyId]
  );

  const archiveTrip = useCallback(
    async (code: string) => {
      await setTripStatus(code, 'archived');
      if (familyId && family?.activeTripCode === code) {
        await setFamilyActiveTrip(familyId, null);
      }
    },
    [familyId, family?.activeTripCode]
  );

  return (
    <FamilyContext.Provider
      value={{
        family,
        familyId,
        familyLoading,
        trips,
        refreshTrips,
        isFamilyAdmin,
        setActiveTrip,
        registerTrip,
        archiveTrip,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}
