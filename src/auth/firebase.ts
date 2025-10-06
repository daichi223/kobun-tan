// src/auth/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';

// .env / Vercel から値を取得
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, // ← vercel側に設定した値
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// iOS/Safari 対策：localStorage が使えない場合は inMemory に自動フォールバック
export const auth: Auth = initializeAuth(app, {
  persistence: [browserLocalPersistence, inMemoryPersistence],
});

export const googleProvider = new GoogleAuthProvider();
// アカウント選択を毎回出す（共有端末対策）
googleProvider.setCustomParameters({ prompt: 'select_account' });
