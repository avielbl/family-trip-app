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
  getFamily,
  findFamilyForUser,
  recoverFromLegacyTrips,
  backfillMemberEmails,
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
  recoveryError: string | null;
  recoveryDiag: string | null;
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
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryDiag, setRecoveryDiag] = useState<string | null>(null);

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

    // Re-resolving (e.g. right after sign-in) counts as loading so the UI can
    // show a "restoring your trips" state instead of the setup screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gate re-resolution
    setFamilyLoading(true);

    const finish = () => {
      if (!cancelled) setFamilyLoading(false);
    };

    const resolve = async () => {
      // Every step falls through (recording why) instead of dead-ending, so a
      // stale local pointer can never mask server-side recovery. The trail is
      // shown on the setup screen when resolution comes up empty.
      const diag: string[] = [];

      // 1. Already resolved on this device — trust it only after verifying
      // the family still exists (signed-in users can check server-side).
      // A family that exists but owns no trips is kept only as a last resort —
      // recovery may find the user's real (trip-bearing) family elsewhere.
      let fallbackFamilyId: string | null = null;

      const stored = localStorage.getItem('familyId');
      if (stored) {
        let storedOk = true;
        let storedFam: Family | null = null;
        if (firebaseUser) {
          try {
            storedFam = await getFamily(stored);
            storedOk = storedFam !== null;
          } catch (err) {
            const e = err as { code?: string };
            // Permission failure means the pointer is unusable right now —
            // fall through to recovery (which will surface the same error
            // visibly) but keep the pointer in case rules get fixed.
            if (e.code === 'permission-denied') {
              storedOk = false;
              diag.push(`stored-denied=${stored}`);
            } else {
              // Transient error — don't destroy the pointer.
              storedOk = true;
            }
          }
        }
        if (cancelled) return;
        const storedEmpty = storedFam !== null && (storedFam.tripCodes?.length ?? 0) === 0;
        if (storedOk && !storedEmpty) {
          if (familyId !== stored) setFamilyIdState(stored);
          // Best-effort profile sync for users who signed in after resolution
          if (firebaseUser && userProfile && userProfile.familyId !== stored) {
            updateDoc(doc(db, 'users', firebaseUser.uid), { familyId: stored }).catch(() => {
              /* best-effort */
            });
          }
          finish();
          return;
        }
        if (storedEmpty) {
          diag.push(`stored-empty=${stored}`);
          fallbackFamilyId = stored;
        } else if (!diag.some((d) => d.startsWith('stored-denied'))) {
          diag.push(`stale-local=${stored}`);
          localStorage.removeItem('familyId');
        }
      }

      // 2. From the signed-in user's profile — verify it too.
      if (userProfile?.familyId) {
        try {
          if ((await getFamily(userProfile.familyId)) !== null) {
            if (!cancelled) adoptFamilyId(userProfile.familyId);
            finish();
            return;
          }
          diag.push(`stale-profile=${userProfile.familyId}`);
        } catch {
          diag.push(`profile-check-failed=${userProfile.familyId}`);
        }
        if (cancelled) return;
      }

      // 3. Legacy single-trip pointer → adopt its family or migrate it.
      const legacyCode = localStorage.getItem('tripCode');
      if (legacyCode) {
        try {
          const trip = await getTripConfig(legacyCode);
          if (cancelled) return;

          if (trip?.familyId) {
            adoptFamilyId(trip.familyId);
            finish();
            return;
          }

          if (!trip) {
            diag.push(`legacy-trip-missing=${legacyCode}`);
          } else if (firebaseUser) {
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
          } else {
            // Anonymous user with a legacy tripCode: no family —
            // TripContext falls back to the legacy code.
            finish();
            return;
          }
        } catch (err) {
          console.error('Legacy trip resolution failed:', err);
          const e = err as { code?: string; message?: string };
          diag.push(`legacy=${e.code ?? e.message}`);
        }
      }

      // 4. Sign-in recovery (e.g. after clearing app data): look the family
      // up server-side by admin uid or member email; if no family references
      // the user, fall back to scanning trips (covers legacy trips that were
      // never migrated into a family).
      if (firebaseUser) {
        try {
          const found = await findFamilyForUser(firebaseUser.uid, firebaseUser.email, diag);
          if (!cancelled && found && (found.tripCodes?.length ?? 0) > 0) {
            adoptFamilyId(found.id);
            finish();
            return;
          }
          if (found) {
            diag.push(`found-empty=${found.id}`);
            fallbackFamilyId = fallbackFamilyId ?? found.id;
          }
          const recoveredId = await recoverFromLegacyTrips(
            firebaseUser.uid,
            firebaseUser.email,
            isBootstrapAdminEmail(firebaseUser.email),
            diag
          );
          if (!cancelled && recoveredId) {
            adoptFamilyId(recoveredId);
            finish();
            return;
          }
        } catch (err) {
          console.warn('Family recovery lookup failed:', err);
          const e = err as { code?: string; message?: string };
          if (!cancelled) setRecoveryError(e.code ?? e.message ?? 'lookup failed');
        }
      }
      // Nothing better found — a trip-less family beats no family.
      if (!cancelled && fallbackFamilyId) adoptFamilyId(fallbackFamilyId);
      if (!cancelled) setRecoveryDiag(diag.join(' · ') || 'no-pointers');
      finish();
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
    const unsub = subscribeFamily(familyId, setFamily, (code) =>
      setRecoveryError(`family-sub: ${code}`)
    );
    return unsub;
  }, [familyId]);

  // Backfill memberEmails on families created before it was denormalized —
  // only an admin device can write the family doc.
  useEffect(() => {
    if (!family || family.memberEmails !== undefined) return;
    if (!firebaseUser || !family.adminUids?.includes(firebaseUser.uid)) return;
    backfillMemberEmails(family).catch((err) => {
      console.warn('memberEmails backfill failed:', err);
    });
  }, [family, firebaseUser]);

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
        recoveryError,
        recoveryDiag,
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
