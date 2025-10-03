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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// 認証設定（開発時は強制的に無効化）
const authRequired = false; // 強制的に無効化
const allowedDomain = import.meta.env.VITE_AUTH_ALLOWED_DOMAIN || 'st.spec.ed.jp';

// Firebase初期化（認証が必要な場合のみ）
let app: any = null;
let auth: any = null;
let provider: any = null;

if (authRequired) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
}

// セッション保持設定（ブラウザ再起動後も維持）
if (authRequired && auth) {
  setPersistence(auth, browserLocalPersistence);
}

// Google プロバイダー設定
if (authRequired && provider) {
  provider.setCustomParameters({
    hd: allowedDomain, // ドメインヒント（組織アカウントを優先表示）
  });
}

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
  if (!authRequired || !auth || !provider) {
    console.log('認証が無効化されています');
    return;
  }
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
  if (!authRequired || !auth) {
    console.log('認証が無効化されています');
    return;
  }
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
  if (!authRequired || !auth) {
    // 認証が無効化されている場合は即座に認証済み状態として扱う
    setTimeout(() => onAuthenticated({} as User), 0);
    return () => {}; // 何もしない関数を返す
  }

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
  if (!authRequired || !auth) {
    return {} as User; // 空のユーザーオブジェクトを返す
  }
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