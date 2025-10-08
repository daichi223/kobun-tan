import { normalizeSense } from "./normalizeSense";
import { morphKey } from "./morphTokenizer";

export interface SenseCandidate {
  surface: string; // 例: "〔 思はれ 〕"
  norm: string;    // normalizeSense(surface)
}

export interface MatchResult {
  ok: boolean;
  reason: "exact" | "normalized" | "morph" | "morph-subset" | "approx" | "no_match";
  matchedSurface?: string;
  distance?: number;
}

/** 短文向け Levenshtein（編集距離） */
const levenshtein = (a: string, b: string): number => {
  const n = a.length, m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  if (n > m) return levenshtein(b, a);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let j = 1; j <= m; j++) {
    const cur = [j];
    const bj = b.charCodeAt(j - 1);
    for (let i = 1; i <= n; i++) {
      const cost = a.charCodeAt(i - 1) === bj ? 0 : 1;
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
};

const allowDistance = (len: number): number => {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  if (len <= 10) return 2;
  return 3;
};

/** 生徒解答を candidates (同一qidの正解sense群) と照合 */
export const matchSense = (answer: string, candidates: SenseCandidate[]): MatchResult => {
  if (!answer || candidates.length === 0) return { ok: false, reason: "no_match" };

  // 前処理（括弧/空白などは normalizeSense でも除去されるが、念のため軽く）
  const strip = (s: string) => s.normalize("NFKC").replace(/[〔〕（）\(\)「」『』"'\s]/g, "");
  const ansStripped = strip(answer);
  const ansNorm = normalizeSense(ansStripped);

  // 1) 厳密一致（括弧/空白除去済み）
  for (const c of candidates) {
    const cStripped = strip(c.surface);
    if (ansStripped === cStripped) {
      return { ok: true, reason: "exact", matchedSurface: c.surface, distance: 0 };
    }
  }

  // 2) 正規化一致（旧仮名/波/テンプレ縮約などを吸収）
  for (const c of candidates) {
    if (ansNorm === c.norm) {
      return { ok: true, reason: "normalized", matchedSurface: c.surface, distance: 0 };
    }
  }

  // 3) 形態素キー一致（助詞無視、助動詞は集合比較、ただし「尊敬」は必須一致）
  const ansMorph = morphKey(ansStripped);
  for (const c of candidates) {
    const cMorph = morphKey(c.surface);

    // 完全一致（語幹+助動詞集合=一致）
    if (ansMorph.key === cMorph.key) {
      return { ok: true, reason: "morph", matchedSurface: c.surface, distance: 0 };
    }

    // 尊敬タグの必須一致
    const hasHonorA = ansMorph.aux.includes("尊敬");
    const hasHonorC = cMorph.aux.includes("尊敬");
    if (hasHonorA !== hasHonorC) continue;

    // 尊敬以外の助動詞は部分集合許容（受身/完了/打消など）
    const dropHonor = (arr: string[]) => arr.filter(t => t !== "尊敬");
    const a = new Set(dropHonor(ansMorph.aux));
    const b = new Set(dropHonor(cMorph.aux));

    const subset = [...a].every(t => b.has(t)) || [...b].every(t => a.has(t));
    if (subset && ansMorph.content.lemma === cMorph.content.lemma) {
      return { ok: true, reason: "morph-subset", matchedSurface: c.surface, distance: 0 };
    }
  }

  // 4) 近似一致（最後の保険）：正規化キーで距離判定
  let best: { d: number; c: SenseCandidate } | null = null;
  for (const c of candidates) {
    const d = levenshtein(ansNorm, c.norm);
    if (!best || d < best.d) best = { d, c };
  }
  if (best) {
    const th = allowDistance(Math.max(ansNorm.length, best.c.norm.length));
    if (best.d <= th) {
      return { ok: true, reason: "approx", matchedSurface: best.c.surface, distance: best.d };
    }
  }

  return { ok: false, reason: "no_match" };
};
