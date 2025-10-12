/**
 * kuromoji.jsベースの意味採点エンジン
 * 生成AIなし・フロントのみで堅く採点
 */
import moji from "moji";
import * as kuromoji from "kuromoji";
import { SYN_NOUN, SYN_ADJ, ANT_ADJ } from "./dictionaries";

export type Morpheme = {
  surface: string;
  base: string;
  pos0: string;      // 大分類: 名詞/動詞/形容詞/助詞/助動詞…
  pos1?: string;     // pos_detail_1（必要なら）
  pos4?: string;     // 活用型（例: 五段-カ行, シク活用 など）
  pos5?: string;     // 活用形（例: 連体形-一般, 已然形-一般 など）
};

export type GradeConfig = {
  weights: { concept: number; predicate: number; pattern: number; ant_penalty: number };
  allow: {
    adj_end_equiv: boolean;       // 形容詞の 終止/連体 を同値扱い
    subj_particle_equiv: boolean; // が/の を同値扱い
    ignore_copula: boolean;       // だ/です/である を無視
  };
};

export type GradeResult = {
  score: number;
  breakdown: { concept: number; predicate: number; pattern: number; penalty: number };
  feedback: string[];
};

const DEFAULT_CONFIG: GradeConfig = {
  weights: { concept: 60, predicate: 30, pattern: 10, ant_penalty: 50 },
  allow: { adj_end_equiv: true, subj_particle_equiv: true, ignore_copula: true },
};

// ---- tokenizer (singleton) ----
let _tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null;
export function getTokenizer() {
  if (!_tokenizerPromise) {
    const builder = kuromoji.builder({ dicPath: "/kuromoji/dict" });
    _tokenizerPromise = new Promise((resolve, reject) => {
      builder.build((err, tk) => (err ? reject(err) : resolve(tk)));
    });
  }
  return _tokenizerPromise!;
}

// ---- utils ----
const normalize = (s: string) =>
  moji(s)
    .convert("ZE", "HE")
    .convert("ZS", "HS")
    .toString()
    .normalize("NFKC")
    .replace(/\s+/g, "");

const toM = (t: kuromoji.IpadicFeatures): Morpheme => ({
  surface: t.surface_form,
  base: t.basic_form === "*" ? t.surface_form : t.basic_form,
  pos0: t.pos,
  pos1: t.pos_detail_1,
  pos4: t.conjugated_type || undefined,
  pos5: t.conjugated_form || undefined,
});

const isParticle = (m: Morpheme) => m.pos0 === "助詞";
const isCopula = (m: Morpheme) =>
  m.base === "だ" || m.base === "です" || m.base === "である" || m.base === "なり";
const isNoun = (m: Morpheme) => m.pos0 === "名詞";
const isAdj  = (m: Morpheme) => m.pos0 === "形容詞";
const isVerb = (m: Morpheme) => m.pos0 === "動詞";
const isAux  = (m: Morpheme) => m.pos0 === "助動詞";

const eqWithSyn = (a: string, b: string, dict: Record<string,string[]>) =>
  a === b || new Set([a, ...(dict[a] || [])]).has(b);

const ADJ_END_EQ = new Set(["終止形", "連体形"]); // 形態素の値が "連体形-一般" などの場合、`includes` で判定

// ---- 抽出: 名詞 + （が/の） + 形容詞（or 述語形）----
function extractNPAdj(ms: Morpheme[], cfg: GradeConfig) {
  const xs = cfg.allow.ignore_copula ? ms.filter(m => !isCopula(m)) : ms.slice();

  // 名詞 + 助詞(が|の) + 形容詞
  for (let i = 0; i < xs.length - 2; i++) {
    const a = xs[i], b = xs[i+1], c = xs[i+2];
    if (isNoun(a) && isParticle(b) && (b.base === "が" || b.base === "の") && isAdj(c)) {
      return { noun: a.base, particle: b.base, pred: c, predType: "ADJ" as const };
    }
  }
  // 述語文: 名詞 + が + （…）+ 形容詞
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i+1];
    if (isNoun(a) && isParticle(b) && b.base === "が") {
      const pred = xs.slice(i+2).find(isAdj);
      if (pred) return { noun: a.base, particle: "が", pred, predType: "ADJ" as const };
    }
  }
  // 名詞 + の + 形容詞（連体）
  for (let i = 0; i < xs.length - 2; i++) {
    const a = xs[i], b = xs[i+1], c = xs[i+2];
    if (isNoun(a) && isParticle(b) && b.base === "の" && isAdj(c)) {
      return { noun: a.base, particle: "の", pred: c, predType: "ADJ" as const };
    }
  }
  // （将来）名詞 + が + 動詞/形容動詞にも拡張可
  return null;
}

// ---- 述語の正規化 ----
function normalizePredicate(pred: Morpheme, tail: Morpheme[], cfg: GradeConfig) {
  if (pred.pos0 === "形容詞") {
    const form = pred.pos5 || "";
    if (cfg.allow.adj_end_equiv && (ADJ_END_EQ.has(form.split("-")[0] || form))) {
      return `ADJ:${pred.base}`; // 終止/連体は同値
    }
    return `ADJ:${pred.base}+${form}`;
  }
  if (pred.pos0 === "動詞") {
    let tag = `VERB:${pred.base}`;
    const aux = tail.filter(isAux).map(a => a.base);
    if (aux.some(a => ["つ","ぬ","たり","り"].includes(a))) tag += "+PERF"; // 完了/存続
    if (aux.some(a => a === "ず"))                 tag += "+NEG";  // 打消
    return tag;
  }
  return `${pred.pos0}:${pred.base}`;
}

function particleClass(p: string, cfg: GradeConfig) {
  if (cfg.allow.subj_particle_equiv && (p === "が" || p === "の")) return "SUBJLIKE";
  return p;
}

// ---- 採点本体 ----
export async function gradeMeaningTS(
  gold: string,   // 例: 「身分が低い」
  answer: string, // 例: 「身分の低い」
  cfg: GradeConfig = DEFAULT_CONFIG
): Promise<GradeResult> {
  const tk = await getTokenizer();
  const G = tk.tokenize(normalize(gold)).map(toM);
  const A = tk.tokenize(normalize(answer)).map(toM);

  const g = extractNPAdj(G, cfg);
  const a = extractNPAdj(A, cfg);

  const breakdown = { concept: 0, predicate: 0, pattern: 0, penalty: 0 };
  const fb: string[] = [];
  let score = 0;

  if (!g) {
    // 最低限のフォールバック：完全一致のみ
    const exact = normalize(gold) === normalize(answer);
    return {
      score: exact ? 100 : 0,
      breakdown,
      feedback: [exact ? "完全一致" : "比較パターン抽出に失敗（辞書/ルールを拡張してください）"],
    };
  }
  if (!a) {
    return {
      score: 0, breakdown,
      feedback: ["回答から『名詞＋（が/の）＋形容詞』パターンを抽出できませんでした。表現を簡潔に。"],
    };
  }

  // 1) 概念（名詞）
  if (g.noun === a.noun || eqWithSyn(g.noun, a.noun, SYN_NOUN)) {
    breakdown.concept = cfg.weights.concept; score += breakdown.concept;
  } else {
    fb.push(`名詞が不一致：期待「${g.noun}」/ 回答「${a.noun}」`);
  }

  // 2) 述語（形容詞）— 同値化（終止/連体）＋同義/反義
  const gPredNorm = normalizePredicate(g.pred, G.slice(G.indexOf(g.pred)+1), cfg);
  const aPredNorm = normalizePredicate(a.pred, A.slice(A.indexOf(a.pred)+1), cfg);

  const gBase = g.pred.base, aBase = a.pred.base;
  if (gBase === aBase || eqWithSyn(gBase, aBase, SYN_ADJ)) {
    breakdown.predicate = cfg.weights.predicate; score += breakdown.predicate;
  } else if ((ANT_ADJ[gBase] || []).includes(aBase)) {
    breakdown.penalty -= cfg.weights.ant_penalty;
    score = Math.max(0, score - cfg.weights.ant_penalty);
    fb.push(`反義の可能性：期待「${gBase}」↔ 回答「${aBase}」`);
  } else {
    fb.push(`形容詞が不一致：期待「${gBase}」/ 回答「${aBase}」`);
  }

  // 3) 構文（助詞ゆれ）
  const pOK =
    particleClass(g.particle, cfg) === particleClass(a.particle, cfg);
  if (pOK) {
    breakdown.pattern = cfg.weights.pattern; score += breakdown.pattern;
  } else {
    fb.push(`助詞の違い：期待「${g.particle}」/ 回答「${a.particle}」`);
  }

  if (score === 100) fb.push("助詞（が/の）のゆれを許容：満点");
  return { score, breakdown, feedback: fb };
}
