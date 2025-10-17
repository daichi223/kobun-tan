# セキュリティガイドライン — SECURITY.md

## 概要

本システムでは、生徒が回答を提出し、教員が訂正を行います。
セキュリティは以下の原則に基づいて設計されます：

1. **最小権限の原則**: ユーザーは必要最低限の権限のみを持つ
2. **認証と認可の分離**: 認証（誰か）と認可（何ができるか）を明確に分離
3. **データの完全性**: すべての変更は追跡可能で、不正な変更を防ぐ
4. **プライバシー保護**: 生徒の個人情報を適切に保護

---

## ユーザーロールと権限

### 1. 生徒（Student）

#### 権限
- **回答提出**: `/api/judge` のみアクセス可能
- **閲覧**: 自分の回答結果のみ閲覧可能（実装は将来検討）

#### 認証方式
- **匿名認証**: `anonId` のみ（Firebase Anonymous Auth）
- **ユーザー登録（オプション）**: Firebase Authentication（メール/パスワード）

#### セキュリティ対策
- Firestore へ直接アクセス不可（すべて API 経由）
- `/api/judge` は認証不要だが、`anonId` 必須
- レート制限: 5 req/sec/anonId

### 2. 教員（Teacher）

#### 権限
- **回答管理**: すべての回答の閲覧・訂正
- **辞書管理**: accepted/negatives/overrides の編集
- **問題管理**: questions/thresholds の編集

#### 認証方式
- Firebase Authentication（メール/パスワード）
- カスタムクレーム: `role: "teacher"`

#### セキュリティ対策
- 教員専用 API は Firebase Auth トークンで保護
- カスタムクレームで `role == "teacher"` を検証
- レート制限: 10 req/sec/user

### 3. 管理者（Admin）

#### 権限
- 教員の権限に加えて
- **ユーザー管理**: 教員の追加・削除
- **システム設定**: 全体設定の変更

#### 認証方式
- Firebase Authentication + カスタムクレーム `role: "admin"`

---

## API エンドポイントの認証・認可

### 公開エンドポイント（認証不要）

#### POST /api/judge
- **目的**: 生徒が回答を提出
- **認証**: 不要
- **バリデーション**:
  - `anonId` 必須（匿名ユーザー識別用）
  - `qid` 必須（問題ID）
  - `answerRaw` 必須（回答テキスト）
- **レート制限**: 5 req/sec/anonId

```typescript
// リクエスト例
POST /api/judge
{
  "anonId": "anon_123",
  "qid": "4-2",
  "answerRaw": "はっと目が覚めた"
}
```

### 教員専用エンドポイント（認証必須）

#### POST /api/overrideAnswer
#### POST /api/upsertOverride
#### POST /api/rejudge
#### GET /api/top-abstain

- **認証**: Firebase Auth トークン必須
- **認可**: カスタムクレーム `role == "teacher"`
- **レート制限**: 10 req/sec/user

```typescript
// リクエスト例
POST /api/overrideAnswer
Authorization: Bearer <firebase-id-token>

{
  "answerId": "ans_123",
  "result": "OK",
  "note": "正解として認める",
  "actor": "teacher@example.com"
}
```

---

## Firebase Authentication 設定

### カスタムクレームの設定

教員ユーザーには `role: "teacher"` クレームを付与します。

```typescript
// Admin SDK で実行（サーバーサイド）
import { getAuth } from 'firebase-admin/auth';

async function setTeacherRole(uid: string) {
  await getAuth().setCustomUserClaims(uid, { role: 'teacher' });
  console.log(`User ${uid} is now a teacher`);
}
```

### クレームの検証（API側）

```typescript
import { getAuth } from 'firebase-admin/auth';

export async function verifyTeacher(idToken: string): Promise<string> {
  const decodedToken = await getAuth().verifyIdToken(idToken);

  if (decodedToken.role !== 'teacher' && decodedToken.role !== 'admin') {
    throw new Error('Unauthorized: Teacher role required');
  }

  return decodedToken.uid;
}
```

---

## Firestore Security Rules

### 基本方針
- 生徒は API 経由のみアクセス（Firestore Rules で read/write 拒否）
- 教員は Admin SDK 経由でアクセス（Rules で read/write 許可）

### Rules 定義

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ヘルパー関数: 教員かどうか
    function isTeacher() {
      return request.auth != null &&
             (request.auth.token.role == 'teacher' ||
              request.auth.token.role == 'admin');
    }

    // ヘルパー関数: 管理者かどうか
    function isAdmin() {
      return request.auth != null && request.auth.token.role == 'admin';
    }

    // questions: 読み取りは全員、書き込みは教員のみ
    match /questions/{qid} {
      allow read: if true;
      allow write: if isTeacher();
    }

    // accepted, negatives: 読み取りは全員、書き込みは教員のみ
    match /accepted/{qid}/{entryId} {
      allow read: if true;
      allow write: if isTeacher();
    }

    match /negatives/{qid}/{entryId} {
      allow read: if true;
      allow write: if isTeacher();
    }

    // thresholds: 読み取りは全員、書き込みは教員のみ
    match /thresholds/{qid} {
      allow read: if true;
      allow write: if isTeacher();
    }

    // answers: 教員のみアクセス可能（生徒は API 経由のみ）
    match /answers/{answerId} {
      allow read, write: if isTeacher();
    }

    // overrides: 教員のみアクセス可能
    match /overrides/{key} {
      allow read, write: if isTeacher();
    }

    // history: 教員のみアクセス可能
    match /history/{id} {
      allow read: if isTeacher();
      allow write: if false;  // 自動生成のみ、手動編集不可
    }
  }
}
```

---

## 入力バリデーション

### 共通バリデーション

すべての API で以下をバリデーション：

```typescript
function validateInput(input: any) {
  // XSS 対策: HTML タグを除去
  if (typeof input === 'string') {
    return input.replace(/<[^>]*>/g, '');
  }

  // オブジェクトの場合、再帰的にバリデーション
  if (typeof input === 'object') {
    const cleaned: any = {};
    for (const key in input) {
      cleaned[key] = validateInput(input[key]);
    }
    return cleaned;
  }

  return input;
}
```

### 回答テキストのバリデーション

```typescript
function validateAnswerRaw(answerRaw: string): void {
  // 長さチェック
  if (answerRaw.length === 0) {
    throw new Error('Answer cannot be empty');
  }

  if (answerRaw.length > 1000) {
    throw new Error('Answer is too long (max 1000 characters)');
  }

  // 危険な文字パターンのチェック
  const dangerousPatterns = [
    /<script/i,           // XSS
    /javascript:/i,       // XSS
    /on\w+\s*=/i,        // イベントハンドラ
    /\{.*\}/,            // テンプレート構文
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(answerRaw)) {
      throw new Error('Answer contains potentially dangerous content');
    }
  }
}
```

### 個人情報の検出

```typescript
function detectPII(text: string): boolean {
  // メールアドレス
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
    return true;
  }

  // 電話番号（日本）
  if (/\d{2,4}-\d{2,4}-\d{4}/.test(text)) {
    return true;
  }

  // 郵便番号
  if (/\d{3}-\d{4}/.test(text)) {
    return true;
  }

  return false;
}
```

---

## レート制限

### Vercel Functions でのレート制限

```typescript
import rateLimit from 'express-rate-limit';

// 生徒用（匿名）
export const studentLimiter = rateLimit({
  windowMs: 1000,           // 1秒
  max: 5,                   // 5リクエスト
  keyGenerator: (req) => req.body.anonId || req.ip,
  message: 'Too many requests, please try again later'
});

// 教員用
export const teacherLimiter = rateLimit({
  windowMs: 1000,           // 1秒
  max: 10,                  // 10リクエスト
  keyGenerator: (req) => req.user?.uid || req.ip,
  message: 'Too many requests, please try again later'
});
```

### 使用例

```typescript
import { studentLimiter } from './rateLimiter';

export default async function handler(req, res) {
  // レート制限を適用
  await studentLimiter(req, res, () => {});

  // API ロジック
  // ...
}
```

---

## データの暗号化

### 保存時の暗号化
- Firestore は自動的にデータを暗号化（AES-256）
- 追加の暗号化は不要

### 通信の暗号化
- すべての API は HTTPS 経由（Vercel が自動提供）
- Firebase も HTTPS を強制

---

## 監査ログ

### 記録対象

すべての教員操作を記録：

```typescript
interface AuditLog {
  userId: string;           // 操作者
  action: string;           // 操作内容（例: "OVERRIDE_ANSWER"）
  resource: string;         // 対象リソース（例: "answers/ans_123"）
  before: any;              // 変更前の値
  after: any;               // 変更後の値
  timestamp: Timestamp;     // 操作日時
  ip: string;               // IPアドレス
  userAgent: string;        // ユーザーエージェント
}
```

### 実装例

```typescript
async function auditLog(log: AuditLog) {
  await db.collection('auditLogs').add(log);
}

// 使用例
await auditLog({
  userId: 'teacher@example.com',
  action: 'OVERRIDE_ANSWER',
  resource: 'answers/ans_123',
  before: { final: { result: 'NG' } },
  after: { final: { result: 'OK' } },
  timestamp: Timestamp.now(),
  ip: req.ip,
  userAgent: req.headers['user-agent']
});
```

---

## セキュリティチェックリスト

### デプロイ前のチェック

- [ ] すべての教員 API で Firebase Auth トークンを検証
- [ ] カスタムクレーム `role == "teacher"` を検証
- [ ] Firestore Rules をデプロイ
- [ ] レート制限を設定
- [ ] 入力バリデーションを実装
- [ ] XSS 対策（HTML タグ除去）
- [ ] CSRF 対策（Vercel が自動提供）
- [ ] 個人情報検出を実装
- [ ] 監査ログを実装
- [ ] HTTPS を強制（Vercel が自動提供）

### 定期的なチェック

- [ ] 監査ログの確認（不正アクセスがないか）
- [ ] レート制限の閾値を調整
- [ ] Firebase Auth ユーザーの棚卸し（不要なアカウント削除）
- [ ] Firestore Rules の定期見直し

---

## インシデント対応

### 不正アクセスが疑われる場合

1. **即時対応**
   - 該当ユーザーのトークンを無効化
   ```typescript
   await getAuth().revokeRefreshTokens(uid);
   ```

2. **調査**
   - 監査ログを確認
   - 影響範囲を特定

3. **復旧**
   - 不正な変更を元に戻す
   - ユーザーに通知

4. **再発防止**
   - セキュリティルールを強化
   - レート制限を厳格化

---

## 参考資料

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Vercel Security Best Practices](https://vercel.com/docs/concepts/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
