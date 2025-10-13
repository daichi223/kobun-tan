/**
 * シンプルな意味採点エンジン
 * 品詞判定に依存せず、正規化と文字列類似度ベースで採点
 */
import moji from "moji";
import * as kuromoji from "kuromoji";
import { getTokenizer, Morpheme, toM } from "./gradeMeaning";

export type GradeResultSimple = {
  score: number;
  breakdown: {
    baseSimilarity: number;  // 基本類似度
    penalty: number;         // ペナルティ
  };
  feedback: string[];
  normalized: {
    gold: string;
    answer: string;
  };
};

// ---- 正規化関数（強化版）----
function normalizeText(s: string): string {
  return moji(s)
    .convert("ZE", "HE")
    .convert("ZS", "HS")
    .toString()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeForGrading(text: string, tokens: kuromoji.IpadicFeatures[]): string {
  let normalized = text;

  // 1) 動詞・形容詞の活用形を基本形に統一
  for (const token of tokens) {
    if ((token.pos === "動詞" || token.pos === "形容詞") && token.basic_form !== "*") {
      normalized = normalized.replace(token.surface_form, token.basic_form);
    }
  }

  // 2) 複合動詞の活用形統一（〜になる、〜する）
  normalized = normalized
    .replace(/([ぁ-んァ-ヶ一-龠]+)になっ/, "$1になる")    // 評判になっ → 評判になる
    .replace(/([ぁ-んァ-ヶ一-龠]+)になり/, "$1になる")    // 評判になり → 評判になる
    .replace(/([ぁ-んァ-ヶ一-龠]+)にな[らりるれろ]/, "$1になる") // 全活用形
    .replace(/([ぁ-んァ-ヶ一-龠]+)し([てた])/, "$1する")  // 大騒ぎして/した → 大騒ぎする
    .replace(/([ぁ-んァ-ヶ一-龠]+)すれ/, "$1する");      // 大騒ぎすれ → 大騒ぎする

  // 3) 連用形→終止形の変換パターン
  normalized = normalized
    .replace(/([ぁ-ん])り$/, "$1る")       // 祈り → 祈る
    .replace(/([ぁ-ん])し$/, "$1する")     // がまんし → がまんする
    .replace(/([ぁ-ん])れ$/, "$1れる")     // 思われ → 思われる
    .replace(/([ぁ-ん])せ$/, "$1せる")     // 見せ → 見せる
    .replace(/([ぁ-ん])って$/, "$1る")     // 騒いで → 騒ぐ（不完全だが簡易対応）
    .replace(/([ぁ-ん])て$/, "$1る")       // 似て → 似る
    .replace(/([ぁ-ん])た$/, "$1る");      // 似た → 似る

  // 4) サ変動詞の名詞形に「する」を補完
  // 名詞で終わる場合、一般的なサ変動詞パターンなら「する」を追加
  const sahenNouns = [
    "大騒ぎ", "評判", "心配", "勉強", "散歩", "結婚", "連絡", "説明",
    "議論", "発表", "参加", "出発", "到着", "準備", "練習", "案内"
  ];
  for (const noun of sahenNouns) {
    const regex = new RegExp(`${noun}$`);
    if (regex.test(normalized) && !normalized.endsWith("する")) {
      normalized = normalized.replace(regex, `${noun}する`);
    }
  }

  // 5) 平仮名→漢字の統一（よく使われるもの）
  normalized = normalized
    .replace(/おも(う|われる|い)/g, (match) => {
      if (match === "おもう") return "思う";
      if (match === "おもわれる") return "思われる";
      if (match === "おもい") return "思い";
      return match;
    })
    .replace(/おぼ(える|え)/g, (match) => {
      if (match === "おぼえる") return "覚える";
      if (match === "おぼえ") return "覚え";
      return match;
    })
    .replace(/にる/, "似る")
    .replace(/いのる/, "祈る")
    .replace(/ひょうばん/, "評判");

  return normalizeText(normalized);
}

// ---- 文字列類似度（Levenshtein距離ベース）----
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(a, b);
  return 1.0 - distance / maxLen;
}

// ---- 助動詞タグ検知（gradeMeaning.tsから流用）----
type SentenceTags = {
  completed: boolean;
  negated: boolean;
  past: boolean;
  conditional: boolean;
};

function detectTags(tokens: kuromoji.IpadicFeatures[]): SentenceTags {
  const tags: SentenceTags = {
    completed: false,
    negated: false,
    past: false,
    conditional: false
  };

  for (const t of tokens) {
    const base = t.basic_form === "*" ? t.surface_form : t.basic_form;

    // 完了助動詞
    if (t.pos === "助動詞" && ["ぬ", "つ", "たり", "り", "た"].includes(base)) {
      tags.completed = true;
    }

    // 否定助動詞
    if (t.pos === "助動詞" && ["ず", "ない", "ん"].includes(base)) {
      tags.negated = true;
    }

    // 過去助動詞
    if (t.pos === "助動詞" && ["けり", "き"].includes(base)) {
      tags.past = true;
    }

    // 条件助詞
    if (t.pos === "助詞" && ["ば", "たら", "なら"].includes(base)) {
      tags.conditional = true;
    }
  }

  return tags;
}

// ---- シンプル採点本体 ----
export async function gradeMeaningSimple(
  gold: string,
  answer: string,
  opts?: {
    ba_condition?: "" | "確定" | "仮定";
  }
): Promise<GradeResultSimple> {
  const tk = await getTokenizer();

  const goldTokens = tk.tokenize(normalizeText(gold));
  const answerTokens = tk.tokenize(normalizeText(answer));

  const goldNorm = normalizeForGrading(gold, goldTokens);
  const answerNorm = normalizeForGrading(answer, answerTokens);

  const goldTags = detectTags(goldTokens);
  const answerTags = detectTags(answerTokens);

  // 1) 基本類似度（0-100点）
  const similarity = stringSimilarity(goldNorm, answerNorm);
  let score = Math.round(similarity * 100);

  const feedback: string[] = [];
  let penalty = 0;

  // 完全一致チェック
  if (goldNorm === answerNorm) {
    score = 100;
    feedback.push("完全一致！");
  } else if (similarity >= 0.9) {
    feedback.push("ほぼ正解（表記ゆれ）");
  } else if (similarity >= 0.7) {
    feedback.push("概ね正解");
  } else if (similarity >= 0.5) {
    feedback.push("部分的に正解");
  } else {
    feedback.push("意味が異なります");
  }

  // 2) 意味的なペナルティ
  if (goldTags.negated !== answerTags.negated) {
    penalty += 30;
    score = Math.max(0, score - 30);
    feedback.push(goldTags.negated
      ? "❌ 否定の意味を見落としています（ず・ない など）"
      : "❌ 否定ではありません");
  }

  // 完了の有無（軽めのペナルティ）
  if (goldTags.completed && !answerTags.completed) {
    penalty += 10;
    score = Math.max(0, score - 10);
    feedback.push("⚠️ 完了の意味が欠けています（ぬ・つ・たり・り など）");
  }

  // ba_condition判定
  if (opts?.ba_condition === "確定" && answerTags.conditional) {
    penalty += 20;
    score = Math.max(0, score - 20);
    feedback.push("❌ 確定条件です。「〜なら」「〜たら」は不適切です");
  } else if (opts?.ba_condition === "仮定" && answerTags.conditional) {
    feedback.push("✓ 仮定条件「〜なら」の使用は適切です");
  }

  return {
    score,
    breakdown: {
      baseSimilarity: Math.round(similarity * 100),
      penalty
    },
    feedback,
    normalized: {
      gold: goldNorm,
      answer: answerNorm
    }
  };
}
