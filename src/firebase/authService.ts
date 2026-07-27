import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';
import type { UserProfile, FamilyMember, TripConfig } from '../types/trip';

// Installed PWAs (standalone display mode) can't reliably open the Google
// sign-in popup — use the redirect flow there and fall back to it whenever
// the popup is blocked.
function isStandaloneApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function signInWithGoogle(): Promise<void> {
  if (isStandaloneApp()) {
    await signInWithRedirect(auth, googleProvider);
    return;
  }
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw err;
  }
}

/**
 * Completes a pending redirect sign-in after the page reloads. The signed-in
 * user itself arrives via onAuthStateChanged; this call exists to surface
 * redirect errors (e.g. auth/unauthorized-domain). Returns an error message
 * or null.
 */
export async function completeRedirectSignIn(): Promise<string | null> {
  try {
    await getRedirectResult(auth);
    return null;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error('Redirect sign-in failed:', e.code, e.message);
    return e.code ?? e.message ?? 'sign-in failed';
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function upsertUserProfile(profile: Omit<UserProfile, 'createdAt'>): Promise<UserProfile> {
  const ref = doc(db, 'users', profile.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Update mutable fields only
    await updateDoc(ref, {
      displayName: profile.displayName,
      photoURL: profile.photoURL ?? null,
    });
    return snap.data() as UserProfile;
  }
  const newProfile: UserProfile = {
    ...profile,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, newProfile);
  return newProfile;
}

export async function joinTripByCode(
  tripCode: string,
  uid: string
): Promise<TripConfig | null> {
  const tripRef = doc(db, 'trips', tripCode);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return null;

  // Save tripCode to userProfile
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { tripCode });

  return tripSnap.data() as TripConfig;
}

export async function matchMemberByEmail(
  tripCode: string,
  email: string
): Promise<FamilyMember | null> {
  const tripRef = doc(db, 'trips', tripCode);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return null;

  const config = tripSnap.data() as TripConfig;
  return config.familyMembers.find((m) => m.email === email) ?? null;
}

export async function claimAdminUid(tripCode: string, uid: string): Promise<void> {
  const tripRef = doc(db, 'trips', tripCode);
  await updateDoc(tripRef, { adminUid: uid });
}
