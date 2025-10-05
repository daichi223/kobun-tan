import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  isAuthRequired,
  watchAuthState,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  getAuthConfig
} from './firebase';

interface AuthGuardProps {
  children: React.ReactNode;
}

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'domain_error';

function AuthGuard({ children }: AuthGuardProps): JSX.Element {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // 認証が不要な場合はそのまま表示
    if (!isAuthRequired()) {
      setAuthState('authenticated');
      return;
    }

    // 認証状態の監視を開始
    const unsubscribe = watchAuthState(
      // 認証成功
      (authenticatedUser) => {
        setUser(authenticatedUser);
        setAuthState('authenticated');
        setError('');
      },
      // 未認証
      () => {
        setUser(null);
        setAuthState('unauthenticated');
        setError('');
      },
      // ドメインエラー
      (rejectedUser) => {
        setUser(null);
        setAuthState('domain_error');
        setError(`不正なドメイン: ${rejectedUser.email || '不明'}`);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setError('');
      await signInWithGoogle();
    } catch (err) {
      setError('ログインに失敗しました。再試行してください。');
      console.error('ログインエラー:', err);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('ログアウトエラー:', err);
    }
  };

  const handleRetry = () => {
    setError('');
    setAuthState('loading');
    // 一度ログアウトしてから再度ログイン
    signOutUser().then(() => {
      setTimeout(() => {
        setAuthState('unauthenticated');
      }, 1000);
    });
  };

  // 認証が不要な場合またはすでに認証済みの場合
  if (authState === 'authenticated') {
    return <>{children}</>;
  }

  // ローディング画面
  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">認証状態を確認中...</p>
        </div>
      </div>
    );
  }

  // ドメインエラー画面
  if (authState === 'domain_error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">アクセス権限エラー</h2>
            <p className="text-slate-600 mb-1">このアプリは浦和高校のアカウントのみご利用いただけます。</p>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                正しいアカウントでログイン
              </button>
              <p className="text-xs text-slate-500">
                @st.spec.ed.jp または @spec.ed.jp のアカウントを使用してください
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ログイン画面
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">浦和高校 古文単語帳</h1>
          <p className="text-slate-600 mb-6">
            ログインして学習を開始してください
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <button
            onClick={handleSignIn}
            className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Googleアカウントでログイン
          </button>

          <p className="mt-4 text-xs text-slate-500">
            浦和高校のGoogleアカウント（@st.spec.ed.jp または @spec.ed.jp）が必要です
          </p>

          {/* デバッグ情報（開発時のみ表示） */}
          {import.meta.env.DEV && (
            <details className="mt-6 text-left">
              <summary className="text-xs text-slate-400 cursor-pointer">設定情報</summary>
              <pre className="mt-2 text-xs text-slate-400 bg-slate-100 p-2 rounded">
                {JSON.stringify(getAuthConfig(), null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthGuard;