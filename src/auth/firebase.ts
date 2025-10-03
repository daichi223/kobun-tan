import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  User,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
};

// 認証設定
const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true';
const allowedDomain = import.meta.env.VITE_AUTH_ALLOWED_DOMAIN || 'st.spec.ed.jp';

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// セッション保持設定（ブラウザ再起動後も維持）
setPersistence(auth, browserLocalPersistence);

// Google プロバイダー設定
provider.setCustomParameters({
  hd: allowedDomain, // ドメインヒント（組織アカウントを優先表示）
});

/**
 * ドメイン制限チェック
 */
function isAllowedDomain(user: User): boolean {
  if (!user.email) return false;
  return user.email.endsWith(`@${allowedDomain}`);
}

/**
 * Google ログイン実行
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error('ログインエラー:', error);
    throw error;
  }
}

/**
 * ログアウト実行
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('ログアウトエラー:', error);
    throw error;
  }
}

/**
 * 認証状態監視とドメイン制限チェック
 */
export function watchAuthState(
  onAuthenticated: (user: User) => void,
  onUnauthenticated: () => void,
  onDomainError: (user: User) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      // ドメイン制限チェック
      if (isAllowedDomain(user)) {
        onAuthenticated(user);
      } else {
        // 不正なドメインの場合はサインアウトして再ログイン要求
        console.warn(`不正なドメイン: ${user.email}`);
        signOutUser().then(() => {
          onDomainError(user);
        });
      }
    } else {
      onUnauthenticated();
    }
  });
}

/**
 * 認証が必要かどうかを判定
 */
export function isAuthRequired(): boolean {
  return authRequired;
}

/**
 * 現在のユーザー情報を取得
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * 認証システムの設定情報を取得（デバッグ用）
 */
export function getAuthConfig() {
  return {
    authRequired,
    allowedDomain,
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
  };
}

export { auth };