import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutUser as firebaseSignOut,
  completeRedirectSignIn,
  upsertUserProfile,
} from '../firebase/authService';
import type { UserProfile, FamilyMember } from '../types/trip';

// Bootstrap admin email — legacy fallback used until family adminUids are
// stamped everywhere (see docs/MULTI_TRIP_PLAN.md phase 7).
export const ADMIN_EMAIL = 'avielbl@gmail.com';

// eslint-disable-next-line react-refresh/only-export-components -- shared auth helper, not a component
export function isBootstrapAdminEmail(email?: string | null): boolean {
  return !!email && email === ADMIN_EMAIL;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  // For virtual members on shared tablets
  virtualMember: FamilyMember | null;
  selectVirtualMember: (member: FamilyMember) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- idiomatic context hook export
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [virtualMember, setVirtualMember] = useState<FamilyMember | null>(() => {
    const saved = localStorage.getItem('virtualMember');
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

  // Complete a pending redirect sign-in (installed-PWA flow) and surface
  // any error it produced — the user state itself arrives via
  // onAuthStateChanged below.
  useEffect(() => {
    completeRedirectSignIn().then((err) => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async result
      if (err) setAuthError(err);
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const profile = await upsertUserProfile({
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? '',
          photoURL: user.photoURL ?? undefined,
        });
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await firebaseSignInWithGoogle();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      // User closing the popup isn't an error worth showing.
      if (e.code !== 'auth/popup-closed-by-user') {
        setAuthError(e.code ?? e.message ?? 'sign-in failed');
      }
      throw err;
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await firebaseSignOut();
    setUserProfile(null);
  }, []);

  const selectVirtualMember = useCallback((member: FamilyMember) => {
    setVirtualMember(member);
    localStorage.setItem('virtualMember', JSON.stringify(member));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isAdmin,
        authLoading,
        authError,
        signInWithGoogle,
        signOutUser,
        virtualMember,
        selectVirtualMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
