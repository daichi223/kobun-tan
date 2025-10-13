/**
 * シンプルな意味採点エンジン
 * 品詞判定に依存せず、正規化と文字列類似度ベースで採点
 */
import moji from "moji";

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

function normalizeForGrading(text: string): string {
  // まず基本的な正規化を適用
  let normalized = normalizeText(text);

  // 1) 複合動詞の活用形統一（〜になる、〜する）
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
    .replace(/([ぁ-ん])た$/, "$1る")       // 似た → 似る
    .replace(/([ぁ-ん])ず$/, "$1ない")     // 行かず → 行かない
    .replace(/([ぁ-ん])ば$/, "$1なら")     // 行けば → 行くなら (簡易)
    .replace(/([ぁ-ん])なら$/, "$1なら");  // 統一

  // 4) サ変動詞の名詞形は補完しない（類似度で評価）

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
    .replace(/にる/g, "似る")
    .replace(/にた/g, "似た")
    .replace(/いのる/g, "祈る")
    .replace(/いのり/g, "祈り")
    .replace(/ひょうばん/g, "評判")
    .replace(/いく/g, "行く")
    .replace(/いか/g, "行か")
    .replace(/いけ/g, "行け")
    .replace(/いこ/g, "行こ");

  return normalized;
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

function detectTagsSimple(text: string): SentenceTags {
  const normalized = normalizeText(text);

  return {
    completed: /[ぬつたり]$|た$/.test(normalized),
    negated: /ず$|ない$|ん$/.test(normalized),
    past: /けり$|き$/.test(normalized),
    conditional: /ば$|たら$|なら$/.test(normalized)
  };
}

// ---- シンプル採点本体 ----
export async function gradeMeaningSimple(
  gold: string,
  answer: string,
  opts?: {
    ba_condition?: "" | "確定" | "仮定";
  }
): Promise<GradeResultSimple> {
  const goldNorm = normalizeForGrading(gold);
  const answerNorm = normalizeForGrading(answer);

  const goldTags = detectTagsSimple(gold);
  const answerTags = detectTagsSimple(answer);

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
