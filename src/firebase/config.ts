import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { initializeAuth, inMemoryPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// True when all required env vars are present
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

const app = initializeApp(firebaseConfig);

function initDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({}),
      });
    } catch {
      return getFirestore(app);
    }
  }
}

function initAuth() {
  // Try browser-local persistence first; fall back to in-memory.
  // In-memory persistence means Firebase will NOT try to restore a cached
  // auth token on page load, which prevents auth/invalid-api-key from
  // crashing the app when secrets are misconfigured.
  try {
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, inMemoryPersistence],
    });
  } catch {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  }
}

export const db = initDb();
export const auth = initAuth();
export const storage = getStorage(app);

export default app;
