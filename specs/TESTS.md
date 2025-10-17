# テスト要件 — TESTS.md

## 概要

本ドキュメントでは、`/api/overrideAnswer` と `/api/upsertOverride` の実装に必要なテスト観点を定義します。

---

## テスト戦略

### テストの種類

1. **単体テスト（Unit Tests）**
   - 個別の関数・ロジックを検証
   - モックを使用して外部依存を排除
   - カバレッジ目標: 80%以上

2. **統合テスト（Integration Tests）**
   - API エンドポイントを実際に呼び出し
   - Firestore Emulator を使用
   - エンドツーエンドのデータフローを検証

3. **回帰テスト（Regression Tests）**
   - 既存機能が壊れていないことを確認
   - `/api/judge` が `final` を即時確定していること
   - UI が常に `answers.final` を参照していること

---

## 1. /api/overrideAnswer のテスト

### 1.1. Happy Path（正常系）

#### TC-OA-001: manual 作成 → final=manual

**目的**: 回答を手動で OK に訂正

**前提条件**:
- `answers/ans_123` が存在
- `final.source = "auto"`, `final.result = "NG"`

**リクエスト**:
```json
{
  "answerId": "ans_123",
  "result": "OK",
  "note": "正解として認める",
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "answerId": "ans_123",
  "final": {
    "result": "OK",
    "source": "manual",
    "reason": "手動訂正: 正解として認める",
    "by": "teacher@example.com",
    "at": "2025-10-14T12:34:56Z"
  },
  "manual": {
    "result": "OK",
    "reason": "手動訂正: 正解として認める",
    "note": "正解として認める",
    "by": "teacher@example.com",
    "at": "2025-10-14T12:34:56Z",
    "version": 1
  }
}
```

**検証項目**:
- [ ] `answers/ans_123.manual` が作成されている
- [ ] `answers/ans_123.final.source` が `"manual"` になっている
- [ ] `answers/ans_123.final.result` が `"OK"` になっている
- [ ] `answers/ans_123.manual.version` が `1` になっている

---

#### TC-OA-002: manual 取消 → final=auto 復帰

**目的**: 手動訂正を取り消し、自動判定に戻す

**前提条件**:
- `answers/ans_123` が存在
- `final.source = "manual"`, `final.result = "OK"`
- `manual.version = 1`

**リクエスト**:
```json
{
  "answerId": "ans_123",
  "result": null,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "answerId": "ans_123",
  "final": {
    "result": "NG",
    "source": "auto",
    "reason": "jaccard<lo",
    "by": null,
    "at": "2025-10-14T12:35:00Z"
  },
  "manual": null
}
```

**検証項目**:
- [ ] `answers/ans_123.manual` が削除されている
- [ ] `answers/ans_123.final.source` が `"auto"` になっている
- [ ] `answers/ans_123.final.result` が元の `auto.result` に戻っている

---

#### TC-OA-003: 連打時の version 増分・競合防止

**目的**: 複数の教員が同時に訂正しても競合しない

**前提条件**:
- `answers/ans_123` が存在
- `final.source = "auto"`

**操作**:
1. 教員A: `result="OK"` で訂正 → `version=1`
2. 教員B: `result="NG"` で訂正 → `version=2`

**期待結果**:
- 教員B の訂正が最終的に反映される
- `manual.version` が `2` になっている

**検証項目**:
- [ ] `manual.version` が増分されている
- [ ] 最後の訂正が有効になっている

---

### 1.2. Edge Cases（エッジケース）

#### TC-OA-004: answerId が存在しない

**リクエスト**:
```json
{
  "answerId": "nonexistent",
  "result": "OK",
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": false,
  "error": {
    "message": "Answer not found",
    "code": "ANSWER_NOT_FOUND"
  }
}
```

---

#### TC-OA-005: result が不正な値

**リクエスト**:
```json
{
  "answerId": "ans_123",
  "result": "INVALID",
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": false,
  "error": {
    "message": "Invalid result value",
    "code": "INVALID_RESULT"
  }
}
```

---

#### TC-OA-006: note が長すぎる

**リクエスト**:
```json
{
  "answerId": "ans_123",
  "result": "OK",
  "note": "..." // 1001文字
}
```

**期待結果**:
```json
{
  "ok": false,
  "error": {
    "message": "Note is too long (max 1000 characters)",
    "code": "NOTE_TOO_LONG"
  }
}
```

---

## 2. /api/upsertOverride のテスト

### 2.1. Happy Path（正常系）

#### TC-UO-001: active=true → 対象N件の final=override

**目的**: 同じ正規化キーを持つ回答を一括で OK に変更

**前提条件**:
- `answers/ans_001`: `qid="4-2"`, `answerNorm="はっとめがさめた"`, `final.source="auto"`, `final.result="NG"`
- `answers/ans_002`: `qid="4-2"`, `answerNorm="はっとめがさめた"`, `final.source="auto"`, `final.result="NG"`
- `answers/ans_003`: `qid="4-2"`, `answerNorm="はっとめがさめた"`, `manual={result:"NG"}` （除外対象）

**リクエスト**:
```json
{
  "qid": "4-2",
  "answerRaw": "はっと目が覚めた",
  "label": "OK",
  "reason": "頻出の同義表現",
  "active": true,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "key": "4-2::はっとめがさめた",
  "label": "OK",
  "active": true,
  "updated": 2
}
```

**検証項目**:
- [ ] `overrides/4-2::はっとめがさめた` が作成されている
- [ ] `answers/ans_001.final.result` が `"OK"` になっている
- [ ] `answers/ans_001.final.source` が `"override"` になっている
- [ ] `answers/ans_002.final.result` が `"OK"` になっている
- [ ] `answers/ans_002.final.source` が `"override"` になっている
- [ ] `answers/ans_003` は変更されていない（manual があるため）

---

#### TC-UO-002: active=false → 対象N件の final=auto 復帰

**目的**: override を取り消し、自動判定に戻す

**前提条件**:
- `overrides/4-2::はっとめがさめた` が存在（`active=true`, `label="OK"`）
- `answers/ans_001`: `final.source="override"`, `final.result="OK"`
- `answers/ans_002`: `final.source="override"`, `final.result="OK"`

**リクエスト**:
```json
{
  "key": "4-2::はっとめがさめた",
  "label": "OK",
  "active": false,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "key": "4-2::はっとめがさめた",
  "active": false,
  "updated": 2
}
```

**検証項目**:
- [ ] `overrides/4-2::はっとめがさめた.active` が `false` になっている
- [ ] `answers/ans_001.final.source` が `"auto"` に戻っている
- [ ] `answers/ans_001.final.result` が元の `auto.result` に戻っている
- [ ] `answers/ans_002.final.source` が `"auto"` に戻っている
- [ ] `answers/ans_002.final.result` が元の `auto.result` に戻っている

---

#### TC-UO-003: key 正規化の一致

**目的**: カナ/全角半角/空白の違いを同一キーとして扱う

**前提条件**:
- `answers/ans_001`: `answerRaw="はっと目が覚めた"` → `answerNorm="はっとめがさめた"`
- `answers/ans_002`: `answerRaw="ハット目が覚めた"` → `answerNorm="はっとめがさめた"`
- `answers/ans_003`: `answerRaw="はっと　目が　覚めた"` → `answerNorm="はっとめがさめた"`

**リクエスト**:
```json
{
  "qid": "4-2",
  "answerRaw": "はっと目が覚めた",
  "label": "OK",
  "active": true,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "key": "4-2::はっとめがさめた",
  "updated": 3
}
```

**検証項目**:
- [ ] 3件すべてが同一キーとして扱われている
- [ ] すべての回答の `final.result` が `"OK"` になっている

---

### 2.2. Edge Cases（エッジケース）

#### TC-UO-004: key が不正な形式

**リクエスト**:
```json
{
  "key": "invalid_key",
  "label": "OK",
  "active": true,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": false,
  "error": {
    "message": "Invalid key format (expected 'qid::norm')",
    "code": "INVALID_KEY"
  }
}
```

---

#### TC-UO-005: 対象回答が0件

**リクエスト**:
```json
{
  "qid": "999-999",
  "answerRaw": "存在しない回答",
  "label": "OK",
  "active": true,
  "actor": "teacher@example.com"
}
```

**期待結果**:
```json
{
  "ok": true,
  "key": "999-999::存在しない回答",
  "updated": 0
}
```

**検証項目**:
- [ ] `overrides/999-999::存在しない回答` は作成される
- [ ] ただし、対象回答が0件なので実際の更新は発生しない

---

## 3. 回帰テスト

### 3.1. 既存機能の動作確認

#### TC-REG-001: /api/judge が final を即時確定

**目的**: 生徒が回答を提出した瞬間に final が確定する

**リクエスト**:
```json
POST /api/judge
{
  "anonId": "anon_123",
  "qid": "4-2",
  "answerRaw": "思われる"
}
```

**検証項目**:
- [ ] `answers/{answerId}.final` が即座に作成されている
- [ ] `final.source` が `"auto"` になっている
- [ ] `final.result` が `"OK" | "NG" | "ABSTAIN"` のいずれかになっている

---

#### TC-REG-002: UI が常に answers.final を参照

**目的**: UI は常に final を表示する

**検証項目**:
- [ ] 生徒画面: `final.result` を表示
- [ ] 教員画面: `final.result` と `final.source` を表示
- [ ] バッジ表示: `auto` | `manual` | `override`

---

## 4. テストの実装

### 4.1. モックの準備

```typescript
// Firestore のモック
import { Firestore } from '@google-cloud/firestore';

const mockFirestore = new Firestore({
  projectId: 'test-project',
  keyFilename: 'test-credentials.json'
});

// テスト用データの準備
async function setupTestData() {
  await mockFirestore.collection('answers').doc('ans_123').set({
    raw: {
      ts: new Date(),
      qid: '4-2',
      anonId: 'anon_123',
      answerRaw: 'はっと目が覚めた',
      autoAt: new Date(),
      auto: {
        result: 'NG',
        score: 0.3,
        band: 'LO',
        reason: 'jaccard<lo'
      }
    },
    curated: {
      v: 1,
      answerNorm: 'はっとめがさめた',
      dedupeKey: 'sha1(4-2::はっとめがさめた)',
      flags: { pii: false, tooLong: false, regexRisk: false }
    },
    manual: null,
    final: {
      result: 'NG',
      source: 'auto',
      reason: 'jaccard<lo',
      by: null,
      at: new Date()
    }
  });
}
```

### 4.2. 単体テストの例

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { overrideAnswer } from './api/overrideAnswer';

describe('/api/overrideAnswer', () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it('TC-OA-001: should create manual and update final', async () => {
    const result = await overrideAnswer({
      answerId: 'ans_123',
      result: 'OK',
      note: '正解として認める',
      actor: 'teacher@example.com'
    });

    expect(result.ok).toBe(true);
    expect(result.final.result).toBe('OK');
    expect(result.final.source).toBe('manual');
    expect(result.manual.version).toBe(1);
  });

  it('TC-OA-002: should delete manual and restore auto', async () => {
    // まず manual を作成
    await overrideAnswer({
      answerId: 'ans_123',
      result: 'OK',
      actor: 'teacher@example.com'
    });

    // manual を取り消し
    const result = await overrideAnswer({
      answerId: 'ans_123',
      result: null,
      actor: 'teacher@example.com'
    });

    expect(result.ok).toBe(true);
    expect(result.final.source).toBe('auto');
    expect(result.manual).toBeNull();
  });

  it('TC-OA-004: should return error if answer not found', async () => {
    const result = await overrideAnswer({
      answerId: 'nonexistent',
      result: 'OK',
      actor: 'teacher@example.com'
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('ANSWER_NOT_FOUND');
  });
});
```

### 4.3. 統合テストの例

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from './app';

describe('Integration: /api/overrideAnswer', () => {
  let authToken: string;

  beforeAll(async () => {
    // Firebase Emulator を起動
    // テストユーザーでログイン
    authToken = await getTestAuthToken();
  });

  afterAll(async () => {
    // クリーンアップ
  });

  it('should override answer to OK', async () => {
    const response = await request(app)
      .post('/api/overrideAnswer')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        answerId: 'ans_123',
        result: 'OK',
        note: '正解として認める',
        actor: 'teacher@example.com'
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.final.result).toBe('OK');
  });
});
```

---

## 5. カバレッジ目標

| 種類 | 目標カバレッジ |
|------|---------------|
| 行カバレッジ（Line Coverage） | 80%以上 |
| 分岐カバレッジ（Branch Coverage） | 75%以上 |
| 関数カバレッジ（Function Coverage） | 90%以上 |

---

## 6. CI/CD での自動テスト

### GitHub Actions の設定例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration

      - name: Check coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

---

## 7. テスト実行コマンド

```bash
# 単体テストのみ
npm test

# 統合テストのみ
npm run test:integration

# カバレッジ付き
npm run test:coverage

# ウォッチモード（開発中）
npm run test:watch
```
