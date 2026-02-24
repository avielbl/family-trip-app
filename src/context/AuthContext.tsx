import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutUser as firebaseSignOut,
  upsertUserProfile,
} from '../firebase/authService';
import type { UserProfile, FamilyMember } from '../types/trip';

const ADMIN_EMAIL = 'avielbl@gmail.com';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  // For virtual members on shared tablets
  virtualMember: FamilyMember | null;
  selectVirtualMember: (member: FamilyMember) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [virtualMember, setVirtualMember] = useState<FamilyMember | null>(() => {
    const saved = localStorage.getItem('virtualMember');
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

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
    await firebaseSignInWithGoogle();
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
