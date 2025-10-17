# 実装完了サマリー

## 実装内容

Phase 1〜3 のすべてのコードを実装しました。

### Phase 1: 基盤構築 ✅

#### api/_firebaseAdmin.ts
- Firebase Admin SDK の初期化
- Firestore インスタンスのエクスポート
- 環境変数からの認証情報読み込み

#### api/_normalize.ts
- 正規化処理（カナ統一、空白削除など）
- キー生成関数（qid::norm 形式）
- ReDoS 対策の安全性チェック

### Phase 2: API 実装 ✅

#### api/overrideAnswer.ts
- **機能**: 個別回答の手動訂正
- **エンドポイント**: POST /api/overrideAnswer
- **主な処理**:
  - result=OK/NG → manual を upsert、final=manual に更新
  - result=null → manual 削除、final=auto に復帰
  - version 増分による競合防止
  - 監査ログの自動記録

#### api/upsertOverride.ts
- **機能**: 同型回答の一括訂正
- **エンドポイント**: POST /api/upsertOverride
- **主な処理**:
  - override 辞書の作成・更新（履歴保存）
  - qid と answerNorm でフィルタして一括更新
  - manual 付き回答は除外（個別訂正を尊重）
  - active=false で一括取消

#### firestore.indexes.json
- 必要な Firestore 複合インデックス定義
- [raw.qid, curated.answerNorm] — 一括更新用
- [raw.qid, raw.ts] — 時系列表示用

### Phase 3: テスト ✅

#### api/overrideAnswer.test.ts
- manual override のテスト
- revert（自動に戻す）のテスト
- Firestore モックによる単体テスト

#### api/upsertOverride.test.ts
- override 一括適用のテスト
- manual 付き回答の除外テスト
- Firestore モックによる単体テスト

### 設定ファイル更新 ✅

#### package.json
- `firebase-admin` を dependencies に追加
- `@vercel/node` を devDependencies に追加

#### vercel.json
- API ルーティング設定を追加（nodejs20.x）

---

## 次のステップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebase プロジェクトのセットアップ

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成
2. Firestore を有効化
3. サービスアカウントキーを生成（プロジェクト設定 → サービスアカウント）

### 3. 環境変数の設定

Vercel プロジェクトの Environment Variables に以下を設定：

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**重要**: `FIREBASE_PRIVATE_KEY` は `\n` を実際の改行ではなく、文字列リテラル `\n` として保存してください。

### 4. Firestore インデックスのデプロイ

```bash
# Firebase CLI をインストール
npm install -g firebase-tools

# ログイン
firebase login

# プロジェクト初期化（すでに初期化済みの場合はスキップ）
firebase init firestore

# インデックスをデプロイ
firebase deploy --only firestore:indexes
```

または、Firestore Console で手動作成：
1. Firestore Console → インデックス
2. 「複合インデックスを作成」
3. `firestore.indexes.json` の定義に従って作成

### 5. テストの実行

```bash
# 単体テストを実行
npm test

# または特定のテストファイルのみ
npx vitest run api/overrideAnswer.test.ts
npx vitest run api/upsertOverride.test.ts
```

### 6. Vercel へのデプロイ

```bash
# Vercel CLI をインストール（まだの場合）
npm i -g vercel

# デプロイ
vercel

# 本番環境へ
vercel --prod
```

---

## API の使い方

### 個別訂正（overrideAnswer）

```bash
# 回答を OK に訂正
curl -X POST https://your-domain.vercel.app/api/overrideAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "answerId": "ans_123",
    "result": "OK",
    "note": "正解として認める",
    "actor": "teacher@example.com"
  }'

# 自動判定に戻す
curl -X POST https://your-domain.vercel.app/api/overrideAnswer \
  -H "Content-Type: application/json" \
  -d '{
    "answerId": "ans_123",
    "result": null,
    "actor": "teacher@example.com"
  }'
```

### 一括訂正（upsertOverride）

```bash
# 同型回答を一括で OK に変更
curl -X POST https://your-domain.vercel.app/api/upsertOverride \
  -H "Content-Type: application/json" \
  -d '{
    "qid": "4-2",
    "answerRaw": "はっと目が覚めた",
    "label": "OK",
    "reason": "頻出の同義表現",
    "active": true,
    "actor": "teacher@example.com"
  }'

# override を取り消し
curl -X POST https://your-domain.vercel.app/api/upsertOverride \
  -H "Content-Type: application/json" \
  -d '{
    "key": "4-2::はっとめがさめた",
    "label": "OK",
    "active": false,
    "actor": "teacher@example.com"
  }'
```

---

## データ構造の確認

### answers コレクション

```javascript
{
  raw: {
    ts: Timestamp,
    qid: "4-2",
    anonId: "anon_123",
    answerRaw: "はっと目が覚めた",
    autoAt: Timestamp,
    auto: {
      result: "NG",
      score: 0.3,
      band: "LO",
      reason: "jaccard<lo"
    }
  },
  curated: {
    v: 1,
    answerNorm: "はっとめがさめた",
    dedupeKey: "sha1(...)",
    flags: { pii: false, tooLong: false, regexRisk: false }
  },
  manual: null,  // または { result: "OK", by: "teacher@example.com", ... }
  final: {
    result: "NG",
    source: "auto",  // "auto" | "manual" | "override"
    reason: "jaccard<lo",
    by: null,
    at: Timestamp
  }
}
```

### overrides コレクション

```javascript
{
  key: "4-2::はっとめがさめた",
  label: "OK",
  active: true,
  reason: "頻出の同義表現",
  by: { userId: "teacher@example.com", role: "teacher" },
  history: [
    {
      label: "OK",
      at: Timestamp,
      by: "teacher@example.com",
      note: "初回登録",
      active: true
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## トラブルシューティング

### エラー: "The query requires an index"

**原因**: Firestore の複合インデックスが未作成

**解決策**:
1. エラーメッセージのリンクをクリックして自動作成
2. または `firebase deploy --only firestore:indexes`

### エラー: "Firebase service account credentials not found"

**原因**: 環境変数が未設定

**解決策**:
1. Vercel プロジェクトの Settings → Environment Variables
2. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` を設定
3. 再デプロイ

### テストが失敗する

**原因**: Firestore モックの問題

**解決策**:
```bash
# キャッシュをクリア
rm -rf node_modules/.vite
npx vitest run --no-cache
```

---

## 今後の拡張

### オプショナル機能（優先度: 低）

1. **再採点 API（/api/rejudge）**
   - ルール更新後の一括再採点
   - manual なし回答のみ対象

2. **要確認候補抽出（/api/top-abstain）**
   - ABSTAIN 回答を頻度順で表示
   - override 登録の効率化

3. **教員向け管理画面**
   - 回答一覧表示
   - 訂正ボタン UI
   - override 辞書管理

---

## 参考資料

- [PRD（要件定義）](./PRD.md)
- [API仕様](./API_CONTRACT.md)
- [データ設計](./DATA_SCHEMAS.md)
- [インデックス要件](./INDEXES.md)
- [セキュリティ](./SECURITY.md)
- [テスト要件](./TESTS.md)
