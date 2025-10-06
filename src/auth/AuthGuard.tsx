// src/auth/AuthGuard.tsx
import { useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const ALLOWED = [/@st\.spec\.ed\.jp$/i, /@spec\.ed\.jp$/i];
const isAllowed = (email?: string | null) => !!email && ALLOWED.some((re) => re.test(email!));

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<null | { email: string | null }>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // リダイレクト戻り値を最優先で回収
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          if (!isAllowed(res.user.email)) {
            await signOut(auth);
            throw new Error('allowed-domain-only');
          }
          setUser({ email: res.user.email });
        }
      } catch (e: any) {
        console.error('getRedirectResult error:', e);
        setErr(humanize(e?.code || e?.message));
      } finally {
        // onAuthStateChanged にも繋ぐ
        const unsub = onAuthStateChanged(auth, (u) => {
          setUser(u ? { email: u.email } : null);
          setLoading(false);
        });
        return () => unsub();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async () => {
    setErr(null);
    try {
      // まず Popup、だめなら Redirect
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const code = e?.code || '';
      if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/popup-closed-by-user'].includes(code)) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error('popup error:', e);
      setErr(humanize(code));
    }
  };

  if (loading) return <div className="p-8 text-center">Loading…</div>;
  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-[92%] max-w-sm rounded-xl shadow p-6 bg-white">
          <h1 className="text-xl font-bold text-center mb-2">古文単語帳</h1>
          <p className="text-center text-gray-600 mb-4">ログインして学習を開始してください</p>
          {err && <p className="mb-3 text-red-600 text-sm text-center">{err}</p>}
          <button onClick={signIn} className="w-full rounded bg-blue-600 text-white py-2">
            Googleアカウントでログイン
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">
            Googleアカウント（@st.spec.ed.jp または @spec.ed.jp）のみ利用できます。
          </p>
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
      return 'ログインに失敗しました。もう一度お試しください。';
  }
}
