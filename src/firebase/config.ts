import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { initializeAuth, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// All three values must be present for Firebase to work at all.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

const app = initializeApp(firebaseConfig);

function initDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    try {
      return initializeFirestore(app, { localCache: persistentLocalCache({}) });
    } catch {
      return getFirestore(app);
    }
  }
}

export const db = initDb();

// Auth and Storage are only initialised when credentials are valid.
// initializeAuth makes an immediate network call to validate the API key;
// calling it with an invalid key throws auth/invalid-api-key and crashes
// the app before React can mount.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: ReturnType<typeof initializeAuth> = isFirebaseConfigured
  ? (() => {
      try {
        return initializeAuth(app, {
          persistence: [browserLocalPersistence, inMemoryPersistence],
        });
      } catch {
        return initializeAuth(app, { persistence: inMemoryPersistence });
      }
    })()
  : (null as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const storage: ReturnType<typeof getStorage> = isFirebaseConfigured
  ? getStorage(app)
  : (null as any);

export default app;
