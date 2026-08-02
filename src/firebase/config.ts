import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Serve the auth helpers from the app's own origin when deployed on Firebase
// Hosting (which exposes /__/auth on every hosting domain). Same-origin auth
// is required for the redirect sign-in flow to survive third-party-storage
// blocking in installed PWAs (iOS/Android standalone mode).
// Preview-channel hosts (name--channel-hash.web.app) aren't registered as
// OAuth redirect origins — fall back to the canonical auth domain there.
const isPreviewChannel = window.location.hostname.includes('--');
const isLocalDev =
  ['localhost', '127.0.0.1'].includes(window.location.hostname) || isPreviewChannel;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: isLocalDev
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''
    : window.location.host,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const app = initializeApp(firebaseConfig);

// Use the modern persistent cache API (replaces deprecated enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
