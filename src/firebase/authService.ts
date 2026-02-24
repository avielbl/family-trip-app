import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './config';
import type { UserProfile, FamilyMember, TripConfig } from '../types/trip';

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
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
