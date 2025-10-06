// src/auth/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, // ← 必ず "kotan-25ed1.firebaseapp.com"
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // kotan-25ed1.appspot.com
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let auth: Auth;
try {
  // Safari 対策：永続化を強い順に並べ、Popup用Resolverも指定
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch (e) {
  console.warn('initializeAuth failed, fallback to getAuth()', e);
  auth = getAuth(app);
}

export { auth };

export const googleProvider = new GoogleAuthProvider();
// 共有端末でアカウント選択を確実に出す
googleProvider.setCustomParameters({ prompt: 'select_account' });
