// src/auth/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  inMemoryPersistence,
  type Auth,
  GoogleAuthProvider,
} from 'firebase/auth';

// Firebase設定
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let auth: Auth;
try {
  // iOS Safari 対策：IndexedDBが使えない場合は inMemory に自動フォールバック
  auth = initializeAuth(app, {
    persistence: [browserLocalPersistence, inMemoryPersistence],
  });
} catch (e) {
  console.warn('initializeAuth failed, fallback to getAuth()', e);
  auth = getAuth(app);
}

export { auth };

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
