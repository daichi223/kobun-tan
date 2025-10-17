# データ設計 — DATA_SCHEMAS.md

## Firestore コレクション構造

```
/questions/{qid}                  // 問題マスタ
/accepted/{qid}/{entryId}         // 正解辞書（許容される回答）
/negatives/{qid}/{entryId}        // 不正解辞書（明確に誤りとする回答）
/thresholds/{qid}                 // 問題ごとの閾値設定
/answers/{answerId}               // 生徒の回答と判定
/overrides/{key}                  // 辞書ベース一括訂正ルール
/history/{id}                     // accepted/negatives の変更履歴（オプショナル）
```

---

## questions/{qid}

### 目的
クイズ問題のマスタデータ

### スキーマ

```typescript
{
  qid: string;                    // 問題ID（例: "4-2"）
  lemma: string;                  // 見出し語（例: "おぼゆ"）
  sense: string;                  // 意味（例: "思われる"）
  meaning_idx: number;            // 意味番号
  group: number;                  // グループ番号
  examples: Array<{
    jp: string;                   // 古文例文
    translation: string;          // 現代語訳
  }>;
  examples_kobun?: string[];      // 追加例文（古文）
  examples_modern?: string[];     // 追加例文（現代語）
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## accepted/{qid}/{entryId}

### 目的
正解として許容される回答の辞書

### スキーマ

```typescript
{
  phrase: string;                 // 正解フレーズ（例: "思われる"）
  phraseNorm: string;             // 正規化後（検索用）
  addedBy: string;                // 追加者のユーザーID
  addedAt: Timestamp;             // 追加日時
  note?: string;                  // 備考
}
```

### インデックス
- `phraseNorm` (ASC)

---

## negatives/{qid}/{entryId}

### 目的
明確に誤りとする回答の辞書

### スキーマ

```typescript
{
  phrase: string;                 // 不正解フレーズ（例: "思い出される"）
  phraseNorm: string;             // 正規化後（検索用）
  addedBy: string;                // 追加者のユーザーID
  addedAt: Timestamp;             // 追加日時
  note?: string;                  // 備考（なぜ誤りか）
}
```

### インデックス
- `phraseNorm` (ASC)

---

## thresholds/{qid}

### 目的
問題ごとの自動採点閾値設定

### スキーマ

```typescript
{
  hi: number;                     // 正解閾値（例: 0.75）
  lo: number;                     // 不正解閾値（例: 0.25）
  autoResolve?: boolean;          // true: MID時に auto で NG 判定
  updatedBy: string;              // 更新者
  updatedAt: Timestamp;           // 更新日時
}
```

### 判定ロジック
- `score >= hi` → OK
- `score < lo` → NG
- `lo <= score < hi` → ABSTAIN（または autoResolve=true なら NG）

---

## answers/{answerId}

### 目的
生徒の回答と自動判定、手動訂正、最終判定を保存

### スキーマ

```typescript
{
  // === raw: 生データ ===
  raw: {
    ts: Timestamp;                // 回答提出日時
    qid: string;                  // 問題ID
    uid: string | null;           // ユーザーID（認証済みの場合）
    anonId: string;               // 匿名ID（認証なしの場合）
    answerRaw: string;            // 生の回答テキスト

    // 自動採点結果
    autoAt: Timestamp;            // 自動採点実行日時
    auto: {
      result: "OK" | "NG" | "ABSTAIN";
      score: number;              // 類似度スコア（0〜1）
      band: "HI" | "MID" | "LO";  // スコア帯
      reason: string;             // 判定理由（例: "jaccard_mid"）
    };
  };

  // === curated: 正規化データ ===
  curated: {
    v: number;                    // 正規化バージョン
    answerNorm: string;           // 正規化後の回答
    dedupeKey: string;            // 重複排除キー（sha1(qid::answerNorm)）
    flags: {
      pii: boolean;               // 個人情報含有フラグ
      tooLong: boolean;           // 長すぎる回答フラグ
      regexRisk: boolean;         // 不正な文字パターンフラグ
    };
  };

  // === manual: 手動訂正 ===
  manual: {
    result: "OK" | "NG";          // 手動判定結果
    reason: string;               // 訂正理由
    note?: string;                // 追加メモ
    by: string;                   // 訂正者（教員ID）
    at: Timestamp;                // 訂正日時
    version: number;              // 訂正バージョン（競合防止）
  } | null;

  // === final: 最終判定（UI表示用） ===
  final: {
    result: "OK" | "NG" | "ABSTAIN";
    source: "auto" | "manual" | "override";  // 判定の由来
    reason: string;               // 判定理由
    by: string | null;            // 判定者（manual/override の場合）
    at: Timestamp;                // 判定確定日時
  };
}
```

### インデックス
1. `raw.qid` (ASC), `curated.answerNorm` (ASC) — override一括適用用
2. `raw.qid` (ASC), `raw.ts` (DESC) — 時系列表示用
3. `final.source` (ASC), `final.result` (ASC) — 統計分析用

### データフロー

```
[生徒が回答]
  ↓
raw.answerRaw → 正規化 → curated.answerNorm
  ↓
自動採点 → raw.auto → final (source=auto)
  ↓
[教員が個別訂正]
  ↓
manual.result → final (source=manual)
  ↓
[辞書ベース一括訂正]
  ↓
overrides/{key}.label → final (source=override)
```

---

## overrides/{key}

### 目的
同じ正規化キーを持つ回答を一括で訂正するルール辞書

### ドキュメントID
`key = qid::normalize(answerRaw)`（例: `"4-2::はっとめがさめた"`）

### スキーマ

```typescript
{
  key: string;                    // qid::answerNorm
  label: "OK" | "NG" | "ABSTAIN"; // 適用後の最終ラベル
  active: boolean;                // true=有効, false=無効
  reason: string;                 // 訂正理由（例: "頻出の同義表現"）

  by: {
    userId: string;               // 登録者ID
    role: "teacher";              // 権限
  };

  history: Array<{
    label: "OK" | "NG" | "ABSTAIN";
    at: Timestamp;                // 変更日時
    by: string;                   // 変更者ID
    note: string;                 // 変更メモ
    active: boolean;              // 当時の状態
  }>;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 動作

#### 1. override を追加/更新（active=true）
```typescript
// overrides/{key} を upsert
// 対象: answers where raw.qid==qid AND curated.answerNorm==norm AND manual==null
// 更新: final.result=label, final.source="override"
```

#### 2. override を取消（active=false）
```typescript
// overrides/{key} を更新（active=false, history追記）
// 対象: answers where raw.qid==qid AND curated.answerNorm==norm AND manual==null
// 更新: final.result=auto.result, final.source="auto"
```

### インデックス
不要（ドキュメントIDで直接アクセス）

---

## history/{id}（オプショナル）

### 目的
accepted/negatives の変更履歴を記録（監査用）

### スキーマ

```typescript
{
  collection: "accepted" | "negatives";
  qid: string;
  entryId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  before: any;                    // 変更前のデータ
  after: any;                     // 変更後のデータ
  by: string;                     // 操作者
  at: Timestamp;                  // 操作日時
}
```

---

## 正規化処理（normalize）

### 目的
回答のゆれを吸収し、同一回答として扱う

### 処理内容

```typescript
function normalize(text: string): string {
  return text
    .toLowerCase()                // 小文字化
    .replace(/[\u3000\s]/g, '')   // 空白削除（全角/半角）
    .replace(/[ぁ-ん]/g, c =>     // ひらがな→カタカナ
      String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c =>  // 全角→半角
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .trim();
}
```

### 例

| 入力 | 出力 |
|------|------|
| "はっと目が覚めた" | "はっとめがさめた" |
| "ハット目が覚めた" | "はっとめがさめた" |
| "はっと　目が　覚めた" | "はっとめがさめた" |

---

## セキュリティルール（Firestore Rules）

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // questions, accepted, negatives, thresholds は読み取り専用
    match /questions/{qid} {
      allow read: if true;
      allow write: if request.auth.token.role == 'teacher';
    }

    // answers は教員のみアクセス可能（生徒は API経由のみ）
    match /answers/{answerId} {
      allow read, write: if request.auth.token.role == 'teacher';
    }

    // overrides は教員のみ
    match /overrides/{key} {
      allow read, write: if request.auth.token.role == 'teacher';
    }
  }
}
```

---

## データ容量見積もり

### 前提
- 生徒数: 1000人
- 問題数: 500問
- 1人あたり平均回答数: 100回
- 総回答数: 100,000件

### 容量

| コレクション | 件数 | サイズ/件 | 合計 |
|-------------|------|----------|------|
| questions | 500 | 1KB | 500KB |
| accepted | 5,000 | 200B | 1MB |
| negatives | 1,000 | 200B | 200KB |
| thresholds | 500 | 100B | 50KB |
| answers | 100,000 | 500B | 50MB |
| overrides | 1,000 | 500B | 500KB |

**合計: 約52MB**（Firestoreの無料枠: 1GB）

### コスト（月額）
- 読み取り: 10万回 × $0.06/10万回 = $0.06
- 書き込み: 10万回 × $0.18/10万回 = $0.18
- **合計: 約$0.24/月**（無料枠内）
