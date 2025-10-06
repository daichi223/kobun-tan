// src/auth/AuthGuard.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// 環境変数で認証の有効/無効を切り替え
const AUTH_ENABLED = import.meta.env.VITE_AUTH_REQUIRED === 'true';
const DOMAIN_CHECK_ENABLED = import.meta.env.VITE_DOMAIN_CHECK_ENABLED !== 'false'; // デフォルトtrue

const ALLOWED = [/@st\.spec\.ed\.jp$/i, /@spec\.ed\.jp$/i];
const isAllowed = (email?: string | null) => {
  if (!DOMAIN_CHECK_ENABLED) return true; // ドメインチェック無効なら全て許可
  return !!email && ALLOWED.some((re) => re.test(email!));
};

// 超簡易UA判定（iOS Safari で redirect を避ける）
const useIsIOS = () =>
  useMemo(
    () =>
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1),
    []
  );

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<null | { email: string | null }>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const isIOS = useIsIOS();

  // 認証が無効な場合は即座に子コンポーネントを表示
  useEffect(() => {
    if (!AUTH_ENABLED) {
      setLoading(false);
      setUser({ email: 'anonymous@example.com' });
      return;
    }
  }, []);

  // リダイレクト戻り値を最優先で回収（iOS以外のみ）
  useEffect(() => {
    if (!AUTH_ENABLED) return; // 認証無効なら何もしない

    let unsub = () => {};
    (async () => {
      try {
        if (!isIOS) {
          const res = await getRedirectResult(auth);
          if (res?.user) {
            if (!isAllowed(res.user.email)) {
              await signOut(auth);
              throw new Error('allowed-domain-only');
            }
            setUser({ email: res.user.email });
          }
        }
      } catch (e: any) {
        console.error('getRedirectResult error:', e);
        setErr(humanize(e?.code || e?.message));
      } finally {
        unsub = onAuthStateChanged(auth, (u) => {
          setUser(u ? { email: u.email } : null);
          setLoading(false);
        });
      }
    })();
    return () => unsub();
  }, [isIOS]);

  const signIn = async () => {
    setErr(null);
    try {
      // iOS は Popup 専用。それ以外は Popup→ダメなら Redirect フォールバック
      if (isIOS) {
        await signInWithPopup(auth, googleProvider);
        return;
      }
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e: any) {
        const code = e?.code || '';
        if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/popup-closed-by-user'].includes(code)) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw e;
      }
    } catch (e: any) {
      console.error('signIn error:', e);
      setErr(humanize(e?.code || e?.message));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-[92%] max-w-sm rounded-xl shadow p-6 bg-white login-card">
          <h1 className="text-xl font-bold text-center mb-2">古文単語帳</h1>
          <p className="text-center text-gray-600 mb-4">ログインして学習を開始してください</p>
          {err && <p className="mb-3 text-red-600 text-sm text-center break-words">{err}</p>}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              signIn();
            }}
            className="w-full rounded bg-blue-600 text-white py-2 active:opacity-80"
            aria-label="Googleアカウントでログイン"
          >
            Googleアカウントでログイン
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">
            Googleアカウント（@st.spec.ed.jp または @spec.ed.jp）のみ利用できます。
          </p>
          <style>{`
            .login-card a[href^="mailto:"] { pointer-events: none !important; }
          `}</style>
        </div>
      </div>
    );

  return <>{children}</>;
}

function humanize(code?: string) {
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Firebaseの「承認済みドメイン」に本番URLが未追加です。';
    case 'auth/operation-not-allowed':
      return 'FirebaseでGoogleログインが有効になっていません。';
    case 'auth/invalid-api-key':
      return 'Vercelの環境変数（APIキー）が正しくありません。';
    case 'allowed-domain-only':
      return '学内アカウント（@st.spec.ed.jp / @spec.ed.jp）のみ利用できます。';
    default:
      return code || 'ログインに失敗しました。もう一度お試しください。';
  }
}
