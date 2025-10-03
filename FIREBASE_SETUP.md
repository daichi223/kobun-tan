# Firebase Authentication セットアップ手順

## 1. Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `urawa-kobun-tan`）
4. Google Analytics は不要なので無効化
5. プロジェクトを作成

## 2. Web アプリの追加

1. Firebase プロジェクトの概要ページで「Web」アイコン（`</>`）をクリック
2. アプリのニックネームを入力（例: `urawa-kobun-web`）
3. 「Firebase Hosting も設定する」は**チェックしない**（Vercel を使用するため）
4. 「アプリを登録」をクリック
5. 設定情報（apiKey, authDomain, projectId）をメモ

## 3. Authentication の設定

### 3.1 Authentication を有効化
1. 左サイドバーの「Authentication」をクリック
2. 「始める」をクリック

### 3.2 Google プロバイダーの設定
1. 「Sign-in method」タブをクリック
2. 「Google」を選択
3. 「有効にする」をオンにする
4. プロジェクトのサポートメール（浦和高校のアドレス）を入力
5. 「保存」をクリック

### 3.3 承認済みドメインの設定
1. 「Sign-in method」タブの「承認済みドメイン」セクション
2. 本番ドメイン（Vercel のドメイン）を追加
   - 例: `urawa-kobun-tan.vercel.app`
3. 開発用に `localhost` が既に追加されていることを確認

## 4. Google Cloud Console での OAuth 設定

### 4.1 Google Cloud Console にアクセス
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. Firebase で作成したプロジェクトを選択

### 4.2 OAuth 同意画面の設定
1. 左サイドバーの「APIとサービス」→「OAuth 同意画面」
2. User Type で「Internal」を選択（**重要：組織内ユーザーのみ**）
3. 「作成」をクリック
4. 必要事項を入力：
   - アプリ名: `浦和高校 古文単語帳`
   - ユーザーサポートメール: 管理者のメールアドレス
   - デベロッパーの連絡先情報: 管理者のメールアドレス
5. 「保存して次へ」を3回クリックして完了

### 4.3 OAuth クライアント ID の確認
1. 「認証情報」タブをクリック
2. Firebase が自動作成したクライアント ID を確認
3. 必要に応じて承認済み JavaScript 生成元を追加
   - `https://your-domain.vercel.app`

## 5. 環境変数の設定

### 5.1 Vercel での設定
1. Vercel ダッシュボードでプロジェクトを選択
2. 「Settings」→「Environment Variables」
3. 以下の変数を追加：

```bash
VITE_FB_API_KEY=your_firebase_api_key_here
VITE_FB_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FB_PROJECT_ID=your_project_id_here
VITE_AUTH_REQUIRED=false
VITE_AUTH_ALLOWED_DOMAIN=st.spec.ed.jp
```

### 5.2 ローカル開発用の設定
1. プロジェクトルートに `.env` ファイルを作成
2. `.env.example` を参考に値を設定

```bash
# .env
VITE_FB_API_KEY=your_firebase_api_key_here
VITE_FB_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FB_PROJECT_ID=your_project_id_here
VITE_AUTH_REQUIRED=false
VITE_AUTH_ALLOWED_DOMAIN=st.spec.ed.jp
```

## 6. 段階的デプロイ手順

### 6.1 初期デプロイ（認証無効）
1. `VITE_AUTH_REQUIRED=false` でデプロイ
2. 既存機能が正常動作することを確認

### 6.2 認証テスト
1. ローカル環境で `VITE_AUTH_REQUIRED=true` に変更
2. 浦和高校のテストアカウントでログインテスト
3. 他のドメインのアカウントでアクセス拒否を確認

### 6.3 本番有効化
1. Vercel で `VITE_AUTH_REQUIRED=true` に変更
2. 再デプロイして本番環境で確認

## 7. セキュリティ確認事項

- [ ] OAuth 同意画面が「Internal」に設定されている
- [ ] 承認済みドメインに本番ドメインが追加されている
- [ ] Firebase の「Authentication」→「Users」でドメイン制限が機能している
- [ ] 外部ドメインのアカウントでアクセスが拒否される
- [ ] ブラウザ再起動後もログイン状態が保持される

## 8. トラブルシューティング

### ログインできない場合
1. ブラウザの開発者ツールでコンソールエラーを確認
2. Firebase Console の「Authentication」→「Users」でユーザーが作成されているか確認
3. 環境変数が正しく設定されているか確認

### ドメイン制限が効かない場合
1. `VITE_AUTH_ALLOWED_DOMAIN` の値を確認
2. Google Cloud Console の OAuth 設定を確認
3. Firebase の設定で `hd` パラメータが正しく設定されているか確認

### iOS PWA でログインできない場合
1. リダイレクト方式（`signInWithRedirect`）を使用していることを確認
2. PWA のマニフェストファイルでドメインが正しく設定されているか確認