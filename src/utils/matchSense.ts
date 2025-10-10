/**
 * 採点エンジン matchSense.ts
 * Ver. 5.0 (実装用完全版)
 *
 * 思想:
 * 1. 語幹（lemma）が合っているかを最重要事項として判定
 * 2. 付属語（aux）のニュアンスをどれだけ正確に再現できているかを評価
 *
 * 評価は上から順に行われ、一度条件に合致した時点で評価値を返し、処理を終了する。
 */

if (import.meta.env.DEV) {
  console.log('[LOAD] utils/matchSense.ts');
}

import { normalizeSense } from "./normalizeSense";
import { morphKey } from "./morphTokenizer";

export interface SenseCandidate {
  surface: string; // 例: "〔 思はれ 〕"
  norm: string;    // normalizeSense(surface)
}

export interface MatchResult {
  ok: boolean;
  reason: "perfect" | "lemma_only" | "connection_missing" | "extra_interpretation" | "essential_missing" | "synonym_error" | "context_mismatch";
  matchedSurface?: string;
  score: number; // 0, 60, 65, 75, 85, 90, 100
  detail?: string; // 詳細な評価理由
}

/**
 * 語幹が類義語関係にあるかチェック
 */
function isSimilarButWrong(ansLemma: string, correctLemma: string): boolean {
  /**
   * 類義語誤用のパターン定義
   * 語幹は異なるが、意味的に近い単語のペア
   */
  const similarButWrongPairs = new Map<string, Set<string>>([
    ["心苦しい", new Set(["つらい", "苦しい"])],
    ["気の毒", new Set(["つらい", "かわいそう"])],
    ["気づく", new Set(["目を覚ます", "起きる"])],
    ["驚く", new Set(["目を覚ます", "起きる"])],
    ["あはれ", new Set(["悲しい", "かわいそう"])],
    ["いとおしい", new Set(["かわいい", "愛らしい"])],
  ]);
  // 正規化して比較
  const ansNorm = normalizeSense(ansLemma);
  const correctNorm = normalizeSense(correctLemma);

  for (const [correct, wrongs] of similarButWrongPairs.entries()) {
    const correctKey = normalizeSense(correct);
    if (correctKey === correctNorm) {
      for (const wrong of wrongs) {
        if (normalizeSense(wrong) === ansNorm) return true;
      }
    }
  }
  return false;
}

/**
 * 複合タグをSetに展開
 * 例: ["完了-存続", "過去"] → Set {"完了", "存続", "過去"}
 */
function createTagSet(tags: string[]): Set<string> {
  const set = new Set<string>();
  for (const tag of tags) {
    tag.split('-').forEach(t => set.add(t.trim()));
  }
  return set;
}

/**
 * 生徒解答を candidates (同一qidの正解sense群) と照合
 *
 * 採点アルゴリズム:
 * 1. 語幹（lemma）の一致度を評価
 * 2. 付属語（aux）の一致度を評価
 * 3. 総合的なスコアを算出
 */
export function matchSense(answer: string, candidates: SenseCandidate[]): MatchResult {
  if (!answer || candidates.length === 0) {
    return { ok: false, reason: "context_mismatch", score: 0, detail: "解答が空です" };
  }

  // 前処理
  const strip = (s: string) => s.normalize("NFKC").replace(/[〔〕（）\(\)「」『』"'\s]/g, "");
  const ansStripped = strip(answer);

  // 最良の候補を見つけるために全候補を評価
  let bestResult: MatchResult = { ok: false, reason: "context_mismatch", score: 0 };

  for (const c of candidates) {
    const cStripped = strip(c.surface);

    // --- 初期化フェーズ ---
    const ansMorph = morphKey(ansStripped);
    const correctMorph = morphKey(cStripped);

    const ansLemma = ansMorph.content.lemma;
    const correctLemma = correctMorph.content.lemma;

    const ansTags = createTagSet(ansMorph.aux);
    const correctTags = createTagSet(correctMorph.aux);

    // --- 評価フェーズ ---

    // ステップ1: 語幹 (lemma) の評価
    const ansLemmaNorm = normalizeSense(ansLemma);
    const correctLemmaNorm = normalizeSense(correctLemma);
    const lemmaMatches = ansLemmaNorm === correctLemmaNorm;

    if (!lemmaMatches) {
      // 60点評価: 類義語の誤用
      if (isSimilarButWrong(ansLemma, correctLemma)) {
        const result: MatchResult = {
          ok: true,
          reason: "synonym_error",
          matchedSurface: c.surface,
          score: 60,
          detail: `意味的に近いが、文脈に合わない単語を使用（${ansLemma} ≠ ${correctLemma}）`
        };
        if (result.score > bestResult.score) bestResult = result;
        continue;
      } else {
        // 0点評価: 文脈違い
        const result: MatchResult = {
          ok: false,
          reason: "context_mismatch",
          matchedSurface: c.surface,
          score: 0,
          detail: `語幹が文脈に合っていない（${ansLemma} ≠ ${correctLemma}）`
        };
        if (result.score > bestResult.score) bestResult = result;
        continue;
      }
    }

    // ステップ2: 付属語 (aux) の評価 (語幹が一致していることが前提)

    // 90点評価: 両者に付属語が一切ない場合
    if (ansTags.size === 0 && correctTags.size === 0) {
      return {
        ok: true,
        reason: "lemma_only",
        matchedSurface: c.surface,
        score: 90,
        detail: "語幹のみ正解（付属語なし）"
      };
    }

    // 差分集合の計算
    const missingTags = new Set([...correctTags].filter(t => !ansTags.has(t)));
    const extraTags = new Set([...ansTags].filter(t => !correctTags.has(t)));

    // 100点評価: 付属語が完全に一致する場合
    if (missingTags.size === 0 && extraTags.size === 0) {
      return {
        ok: true,
        reason: "perfect",
        matchedSurface: c.surface,
        score: 100,
        detail: "語幹と付属語が完全に一致"
      };
    }

    // 85点評価: 接続部分の欠落
    if (missingTags.size === 1 && missingTags.has("接続")) {
      const result: MatchResult = {
        ok: true,
        reason: "connection_missing",
        matchedSurface: c.surface,
        score: 85,
        detail: "接続部分（〜て、〜で）のみ訳し忘れ"
      };
      if (result.score > bestResult.score) bestResult = result;
      continue;
    }

    // 75点評価: 過剰な解釈 (必須要素は満たしている)
    if (missingTags.size === 0 && extraTags.size > 0) {
      const result: MatchResult = {
        ok: true,
        reason: "extra_interpretation",
        matchedSurface: c.surface,
        score: 75,
        detail: `余分な意味を付け加えている（${Array.from(extraTags).join(", ")}）`
      };
      if (result.score > bestResult.score) bestResult = result;
      continue;
    }

    // 65点評価: 必須要素の欠落
    // 上記のいずれにも当てはまらない場合、それは必須要素の欠落とみなす
    const result: MatchResult = {
      ok: true,
      reason: "essential_missing",
      matchedSurface: c.surface,
      score: 65,
      detail: `必須要素が欠落（${Array.from(missingTags).join(", ")}）`
    };
    if (result.score > bestResult.score) bestResult = result;
  }

  // どの候補とも一致しなかった場合
  if (bestResult.score === 0 && bestResult.reason === "context_mismatch") {
    return {
      ok: false,
      reason: "context_mismatch",
      score: 0,
      detail: "語幹が文脈に合っていない"
    };
  }

  return bestResult;
};
