# 古文記述解答判定エンジン

文法規則ファイル駆動の古文記述解答採点システム。

## 概要

`kobun-grammar.json` を唯一のソースオブトゥルースとして、以下の機能を提供：

1. **表記ゆれ正規化** (`normalizeSense.ts`)
2. **軽量形態素解析** (`morphTokenizer.ts`)
3. **活用形推定** (`formGuesser.ts`)
4. **接続規則検証** (`validateConnectionsFromFile.ts`)
5. **採点スコアリング** (`gradeWithMorph.ts`)

## ファイル構成

```
src/
├── assets/
│   └── kobun-grammar.json      # 文法規則データ
├── lib/
│   ├── grammarLoader.ts        # JSON読み込み＆インデックス化
│   ├── validateConnectionsFromFile.ts  # 接続規則検証
│   └── gradeWithMorph.ts       # 採点エンジン
├── utils/
│   ├── normalizeSense.ts       # 表記ゆれ正規化
│   ├── morphTokenizer.ts       # 形態素解析
│   └── formGuesser.ts          # 活用形推定
└── tests/
    └── grammar.test.ts         # ユニットテスト

scripts/
└── demo.ts                     # CLIデモ
```

## インストール

```bash
npm install
```

## テスト実行

```bash
# すべてのテスト
npm test

# UI付き
npm run test:ui
```

## デモ実行

```bash
npm run demo -- --jp "悲しきこと" --student "悲しきこと"
npm run demo -- --jp "悲しきこと" --student "悲しくけり"
npm run demo -- --jp "行きしこと" --student "行きしこと"
```

## 主要機能

### 1. 接続規則検証

助動詞の左接続、係り結びの呼応を自動チェック：

- `けり` は連用形に接続
- `ぞ/なむ/や/か` は連体形で結ぶ
- `こそ` は已然形で結ぶ

### 2. 曖昧形の識別

右文脈と左接続から曖昧形を解決：

- `し` → 過去『き』連体形 vs 形容詞終止形
- `けれ` → 助動詞『けり』已然形 vs 形容詞已然形

### 3. 採点スコアリング

重み付けスコア計算：

- 語幹一致: 50%
- 必須助動詞: 25%
- 任意助動詞: 15%
- 助詞ヒント: 5%
- 訳文ヒント: 5%
- 接続違反ペナルティ: -10%/件（最大-30%）

正誤判定: スコア70%以上 かつ 接続違反なし

## テストケース

1. `悲しきこと` → 正（形容詞連体形）
2. `悲しきけり` → 違反（けりは連用形接続）
3. `悲しくけり` → 正
4. `行きしこと` → 正（過去『き』連体形）
5. `ぞ...連体形` → 正（係り結び）
6. `ぞ...終止形` → 違反
7. `こそ...已然形` → 正
8. `こそ...連体形` → 違反
9. `お〜になる` → 尊敬タグ付与
10. `ない` → 打消タグ

## 拡張方法

### 文法規則の追加

`src/assets/kobun-grammar.json` を編集：

```json
{
  "auxiliaries": [
    {"語": "けり", "意味": ["過去"], "接続": "連用形", "訳例": ["〜た"]}
  ],
  "particles": [
    {"種類": "係助詞", "語": "ぞ", "意味": ["強調"], "呼応": "連体形"}
  ],
  "identification_rules": [
    {
      "語": "し",
      "パターン": [
        {"品詞": "助動詞「き」", "接続": "連用形", "意味": "過去の連体形"},
        {"品詞": "形容詞", "接続": "語幹", "意味": "形容詞の終止形"}
      ]
    }
  ]
}
```

### スコア係数の調整

`src/lib/gradeWithMorph.ts` の `WEIGHTS` を変更：

```typescript
export const WEIGHTS = {
  lemma: 0.5,           // 語幹一致
  requiredAux: 0.25,    // 必須助動詞
  optionalAux: 0.15,    // 任意助動詞
  particles: 0.05,      // 助詞
  sense: 0.05,          // 訳文
  connPenaltyPerIssue: 0.1,  // 接続違反/件
  connPenaltyMax: 0.3,       // 最大ペナルティ
};
```

## API使用例

```typescript
import { gradeWithMorph, GoldAnswer } from "@/lib/gradeWithMorph";

const gold: GoldAnswer = {
  lemmaNorms: ["悲しい"],
  requiredAux: [],
  optionalAux: [],
  particlesNear: [],
  senseTags: [],
};

const result = gradeWithMorph("悲しきこと", gold);
console.log(result.correct);  // true
console.log(result.score);    // 0.5
console.log(result.notes);    // ["✓ 語幹一致: 悲しい", ...]
```

## ライセンス

MIT
