# API仕様 — API_CONTRACT.md

## 共通仕様

### 実行環境
- **プラットフォーム**: Vercel Serverless Functions（Node.js/TypeScript）
- **認可**: 教員のみ実行可能（管理画面から実行を想定）
- **認証**: Firebase Auth または Vercel の保護ミドルウェア

### レスポンス形式
- **成功時**: `{ "ok": true, ...data }`
- **エラー時**: `{ "ok": false, "error": { "message": "...", "code": "..." } }`

### 共通ヘッダー
```
Content-Type: application/json
Authorization: Bearer <token>  // 教員認証トークン
```

---

## POST /api/overrideAnswer

### 目的
特定の1回答の最終結果を手動で上書き、または自動判定に戻す

### リクエスト

```typescript
POST /api/overrideAnswer

{
  "answerId": "ans_123456",           // 必須: 回答ID
  "result": "OK" | "NG" | null,       // 必須: OK=正解, NG=不正解, null=自動に戻す
  "note": "任意のメモ",                // オプション: 訂正理由
  "actor": "teacher@example.com"      // 必須: 操作者
}
```

### レスポンス（成功時）

```typescript
{
  "ok": true,
  "answerId": "ans_123456",
  "final": {
    "result": "OK" | "NG" | "ABSTAIN",
    "source": "manual" | "auto",
    "reason": "手動訂正: 任意のメモ" | "jaccard>=hi",
    "by": "teacher@example.com",
    "at": "2025-10-14T12:34:56Z"
  },
  "manual": {                         // result=null の場合は null
    "result": "OK",
    "reason": "手動訂正: 任意のメモ",
    "note": "任意のメモ",
    "by": "teacher@example.com",
    "at": "2025-10-14T12:34:56Z",
    "version": 1
  } | null
}
```

### エラーレスポンス

```typescript
{
  "ok": false,
  "error": {
    "message": "Answer not found",
    "code": "ANSWER_NOT_FOUND"
  }
}
```

### 動作仕様

1. **result=OK または NG の場合**
   - `answers/{answerId}.manual` を upsert
   - `answers/{answerId}.final` を manual に更新
   - `final.source = "manual"`
   - version を増分（競合防止）

2. **result=null の場合**
   - `answers/{answerId}.manual` を削除
   - `answers/{answerId}.final` を auto に復帰
   - `final.source = "auto"`

3. **監査ログ**
   - `overrides` コレクションに変更イベントを1件追加

### バリデーション

- `answerId`: 必須、文字列、空でない
- `result`: 必須、"OK" | "NG" | null のいずれか
- `note`: オプション、最大1000文字
- `actor`: 必須、有効なメールアドレス形式

---

## POST /api/upsertOverride

### 目的
同じ正規化キーを持つ回答をまとめて最終修正（辞書ベース一括訂正）

### リクエスト（パターン1: key指定）

```typescript
POST /api/upsertOverride

{
  "key": "4-2::はっとめがさめた",      // 必須: qid::normalize(answerRaw)
  "label": "OK" | "NG" | "ABSTAIN",  // 必須: 適用後の最終ラベル
  "reason": "頻出の同義表現",         // オプション: 訂正理由
  "active": true,                    // 必須: true=適用, false=取消
  "actor": "teacher@example.com"     // 必須: 操作者
}
```

### リクエスト（パターン2: qid + answerRaw指定）

```typescript
POST /api/upsertOverride

{
  "qid": "4-2",                      // 必須: 問題ID
  "answerRaw": "はっと目が覚めた",     // 必須: 生の回答テキスト
  "label": "OK",                     // 必須: 適用後の最終ラベル
  "reason": "頻出の同義表現",         // オプション: 訂正理由
  "active": true,                    // 必須: true=適用, false=取消
  "actor": "teacher@example.com"     // 必須: 操作者
}
```

### レスポンス（成功時）

```typescript
{
  "ok": true,
  "key": "4-2::はっとめがさめた",
  "label": "OK",
  "active": true,
  "updated": 37,                    // 一括更新された回答数
  "override": {
    "key": "4-2::はっとめがさめた",
    "label": "OK",
    "active": true,
    "reason": "頻出の同義表現",
    "by": {
      "userId": "teacher@example.com",
      "role": "teacher"
    },
    "history": [
      {
        "label": "OK",
        "at": "2025-10-14T12:34:56Z",
        "by": "teacher@example.com",
        "note": "初回登録",
        "active": true
      }
    ],
    "createdAt": "2025-10-14T12:34:56Z",
    "updatedAt": "2025-10-14T12:34:56Z"
  }
}
```

### エラーレスポンス

```typescript
{
  "ok": false,
  "error": {
    "message": "Invalid key format",
    "code": "INVALID_KEY"
  }
}
```

### 動作仕様

1. **key の正規化**
   - パターン2の場合、`qid` と `answerRaw` から key を生成
   - `key = qid + "::" + normalize(answerRaw)`
   - 正規化処理: カナ統一、全角/半角統一、空白削除

2. **override の upsert**
   - `overrides/{key}` を作成または更新
   - `history` 配列に履歴を追記

3. **一括更新（active=true の場合）**
   - 対象: `answers` コレクション
   - 条件: `raw.qid == qid` AND `curated.answerNorm == norm` AND `manual == null`
   - 更新: `final.result = label`, `final.source = "override"`

4. **一括取消（active=false の場合）**
   - 対象: `answers` コレクション
   - 条件: `raw.qid == qid` AND `curated.answerNorm == norm` AND `manual == null`
   - 更新: `final.result = auto.result`, `final.source = "auto"`

5. **manual 付き回答の除外**
   - `manual` が存在する回答は一括更新の対象外（個別訂正を優先）

### バリデーション

- `key` または `(qid + answerRaw)`: いずれか必須
- `label`: 必須、"OK" | "NG" | "ABSTAIN" のいずれか
- `active`: 必須、boolean
- `reason`: オプション、最大1000文字
- `actor`: 必須、有効なメールアドレス形式

---

## POST /api/rejudge（オプショナル）

### 目的
ルールや辞書の更新後、manual のない回答を再採点

### リクエスト

```typescript
POST /api/rejudge

{
  "qid": "4-2",                      // オプション: 特定の問題のみ再採点
  "dryRun": false,                   // オプション: true=変更せず結果のみ返す
  "actor": "teacher@example.com"     // 必須: 操作者
}
```

### レスポンス（成功時）

```typescript
{
  "ok": true,
  "rejudged": 1234,                  // 再採点された回答数
  "changed": 567,                    // 判定が変わった回答数
  "preview": [                       // dryRun=true の場合のみ
    {
      "answerId": "ans_123",
      "before": "OK",
      "after": "NG"
    }
  ]
}
```

---

## GET /api/top-abstain（オプショナル）

### 目的
判定保留（ABSTAIN）となった回答を頻度順で抽出

### リクエスト

```typescript
GET /api/top-abstain?qid=4-2&limit=20
```

### レスポンス（成功時）

```typescript
{
  "ok": true,
  "candidates": [
    {
      "key": "4-2::はっとめがさめた",
      "count": 15,
      "answerRaw": "はっと目が覚めた",
      "answerNorm": "はっとめがさめた",
      "sampleAnswerIds": ["ans_123", "ans_456"]
    }
  ]
}
```

### 用途
教員が override 辞書に登録する候補を効率的に発見できる

---

## セキュリティ

### 認証・認可
- すべてのエンドポイントは教員のみアクセス可能
- Firebase Auth カスタムクレーム `role=teacher` または Vercel 保護ミドルウェア
- 生徒は `/api/judge`（回答提出）のみアクセス可能

### レート制限
- 教員API: 10 req/sec/user
- `/api/judge`: 5 req/sec/anonId

### バリデーション
- すべての入力値を厳密にバリデーション
- SQL/NoSQL インジェクション対策
- XSS対策（出力時のエスケープ）
