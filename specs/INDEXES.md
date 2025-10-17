# Firestore インデックス — INDEXES.md

## 概要

Firestore では複合クエリを実行する際、適切なインデックスが必要です。
このドキュメントでは、`/api/overrideAnswer` と `/api/upsertOverride` の実装に必要なインデックスを定義します。

---

## 必要なインデックス

### 1. answers コレクション

#### (1) override一括適用用インデックス

**目的**: `upsertOverride` で同じ `qid` と `answerNorm` を持つ回答を一括更新

```json
{
  "collectionGroup": "answers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "raw.qid", "order": "ASCENDING" },
    { "fieldPath": "curated.answerNorm", "order": "ASCENDING" },
    { "fieldPath": "manual", "order": "ASCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collection('answers')
  .where('raw.qid', '==', '4-2')
  .where('curated.answerNorm', '==', 'はっとめがさめた')
  .where('manual', '==', null)
  .get()
```

#### (2) 時系列表示用インデックス

**目的**: 教員画面で問題ごとの回答を新しい順に表示

```json
{
  "collectionGroup": "answers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "raw.qid", "order": "ASCENDING" },
    { "fieldPath": "raw.ts", "order": "DESCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collection('answers')
  .where('raw.qid', '==', '4-2')
  .orderBy('raw.ts', 'desc')
  .limit(50)
  .get()
```

#### (3) 統計分析用インデックス

**目的**: 判定ソース（auto/manual/override）と結果（OK/NG/ABSTAIN）でフィルタリング

```json
{
  "collectionGroup": "answers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "final.source", "order": "ASCENDING" },
    { "fieldPath": "final.result", "order": "ASCENDING" },
    { "fieldPath": "raw.ts", "order": "DESCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collection('answers')
  .where('final.source', '==', 'auto')
  .where('final.result', '==', 'ABSTAIN')
  .orderBy('raw.ts', 'desc')
  .get()
```

#### (4) ABSTAIN候補抽出用インデックス

**目的**: `/api/top-abstain` で判定保留の回答を抽出

```json
{
  "collectionGroup": "answers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "raw.qid", "order": "ASCENDING" },
    { "fieldPath": "final.result", "order": "ASCENDING" },
    { "fieldPath": "raw.ts", "order": "DESCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collection('answers')
  .where('raw.qid', '==', '4-2')
  .where('final.result', '==', 'ABSTAIN')
  .orderBy('raw.ts', 'desc')
  .get()
```

---

### 2. accepted コレクション

#### (1) 正規化フレーズ検索用インデックス

**目的**: 正解辞書から正規化済みフレーズを検索

```json
{
  "collectionGroup": "accepted",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "phraseNorm", "order": "ASCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collectionGroup('accepted')
  .where('phraseNorm', '==', 'おもわれる')
  .get()
```

---

### 3. negatives コレクション

#### (1) 正規化フレーズ検索用インデックス

**目的**: 不正解辞書から正規化済みフレーズを検索

```json
{
  "collectionGroup": "negatives",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "phraseNorm", "order": "ASCENDING" }
  ]
}
```

**クエリ例**:
```typescript
db.collectionGroup('negatives')
  .where('phraseNorm', '==', 'おもいだされる')
  .get()
```

---

## firestore.indexes.json

Firestore の自動インデックス生成を使う場合、以下のファイルを作成します。

### ファイルパス
```
/mnt/c/Users/daichi/Documents/kobun-tan/firestore.indexes.json
```

### 内容

```json
{
  "indexes": [
    {
      "collectionGroup": "answers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "raw.qid", "order": "ASCENDING" },
        { "fieldPath": "curated.answerNorm", "order": "ASCENDING" },
        { "fieldPath": "manual", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "answers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "raw.qid", "order": "ASCENDING" },
        { "fieldPath": "raw.ts", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "answers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "final.source", "order": "ASCENDING" },
        { "fieldPath": "final.result", "order": "ASCENDING" },
        { "fieldPath": "raw.ts", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "answers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "raw.qid", "order": "ASCENDING" },
        { "fieldPath": "final.result", "order": "ASCENDING" },
        { "fieldPath": "raw.ts", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "accepted",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "phraseNorm", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "negatives",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "phraseNorm", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## デプロイ方法

### Firebase CLI を使う場合

```bash
# Firebase プロジェクトにログイン
firebase login

# インデックスをデプロイ
firebase deploy --only firestore:indexes
```

### GCP Console を使う場合

1. [Firestore Console](https://console.cloud.google.com/firestore) を開く
2. 左メニュー「インデックス」を選択
3. 「複合インデックスを作成」をクリック
4. 上記の定義に従ってインデックスを手動作成

---

## インデックス作成の優先順位

### Phase 1（必須）
1. `answers: [raw.qid, curated.answerNorm, manual]` — upsertOverride の一括更新に必須
2. `answers: [raw.qid, raw.ts]` — 教員画面の回答一覧表示に必須

### Phase 2（推奨）
3. `answers: [final.source, final.result, raw.ts]` — 統計分析とダッシュボード用
4. `answers: [raw.qid, final.result, raw.ts]` — ABSTAIN候補抽出用

### Phase 3（オプショナル）
5. `accepted: [phraseNorm]` — 正解辞書検索の高速化
6. `negatives: [phraseNorm]` — 不正解辞書検索の高速化

---

## パフォーマンス最適化

### クエリ最適化のポイント

1. **limit を活用**
   ```typescript
   // 悪い例（全件取得）
   db.collection('answers').where('raw.qid', '==', '4-2').get()

   // 良い例（ページネーション）
   db.collection('answers')
     .where('raw.qid', '==', '4-2')
     .orderBy('raw.ts', 'desc')
     .limit(50)
     .get()
   ```

2. **バッチ処理**
   ```typescript
   // upsertOverride で一括更新する場合、バッチを使う
   const batch = db.batch();
   snapshot.docs.forEach(doc => {
     batch.update(doc.ref, { 'final.result': 'OK' });
   });
   await batch.commit();
   ```

3. **キャッシュ活用**
   ```typescript
   // 頻繁にアクセスするデータはキャッシュ
   const snapshot = await db.collection('thresholds')
     .doc(qid)
     .get({ source: 'cache' });  // キャッシュ優先
   ```

---

## 監視とアラート

### インデックス使用状況の確認

Firebase Console で以下を確認：
- インデックスのビルド状況
- エラーレート（インデックス不足によるクエリ失敗）

### クエリのパフォーマンス計測

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
const snapshot = await db.collection('answers')
  .where('raw.qid', '==', '4-2')
  .where('curated.answerNorm', '==', 'はっとめがさめた')
  .get();
const end = performance.now();

console.log(`Query took ${end - start}ms`);
// 目標: < 100ms
```

---

## トラブルシューティング

### エラー: "The query requires an index"

**原因**: 必要な複合インデックスが存在しない

**解決策**:
1. エラーメッセージに含まれるリンクをクリックしてインデックスを自動作成
2. または、`firestore.indexes.json` に定義を追加して `firebase deploy --only firestore:indexes`

### パフォーマンスが遅い

**原因**: インデックスは存在するが、クエリが非効率

**解決策**:
1. `limit()` を追加してデータ取得量を制限
2. 必要なフィールドだけを取得（`select()` を使う）
3. キャッシュを活用
