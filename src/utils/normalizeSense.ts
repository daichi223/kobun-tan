/**
 * 記述解答(sense)の表記ゆれを吸収して比較用キーを返す軽量正規化。
 * 方針:
 *  - NFKC, 小文字化
 *  - 括弧/引用符/空白の除去
 *  - 歴史的仮名遣い→現代仮名の近似（ゐ/ゑ, 語中ハ行, けふ/さう など）
 *  - 「～/〜/…/—/ー」等のプレースホルダは除去
 *  - 「まったく～ない」→「まったくない」に縮約
 *  - ※ 現代語「ない」はそのまま（ず に寄せない）
 *  - 一部の漢字かなゆれ（思は/思ひ/思ふ）を緩く吸収
 *
 * NOTE: Regex patterns are compiled once on first call and cached for performance
 */

if (import.meta.env.DEV) {
  console.log('[LOAD] utils/normalizeSense.ts');
}

// Pre-compiled regex patterns (compiled once, reused across calls)
// Lazy initialization to avoid TDZ in circular imports
let patternsCache: {
  brackets: RegExp;
  wi: RegExp;
  we: RegExp;
  wo: RegExp;
  ha: RegExp;
  hi: RegExp;
  fu: RegExp;
  he: RegExp;
  ho: RegExp;
  kefu: RegExp;
  gefu: RegExp;
  sau: RegExp;
  kau: RegExp;
  tau: RegExp;
  nau: RegExp;
  ifu: RegExp;
  tefu: RegExp;
  jau: RegExp;
  oo: RegExp;
  dashes: RegExp;
  negation: RegExp;
  omoha: RegExp;
  omohi: RegExp;
  omofu: RegExp;
  monoomo: RegExp;
  monogata: RegExp;
  kokochi: RegExp;
  keshiki: RegExp;
  arisama: RegExp;
  kyou: RegExp;
  kinou: RegExp;
  gaman: RegExp;
} | null = null;

function getPatterns() {
  if (patternsCache) return patternsCache;
  patternsCache = {
    brackets: /[〔〕（）\(\)「」『』"'\s]/g,
    wi: /ゐ/g,
    we: /ゑ/g,
    wo: /(?<!^)[を](?=[ぁ-ゖ])/g,
    ha: /(?<=[ぁ-ゖ])[は](?=[ぁ-ゖ])/g,
    hi: /(?<=[ぁ-ゖ])[ひ](?=[ぁ-ゖ])/g,
    fu: /(?<=[ぁ-ゖ])[ふ](?=[ぁ-ゖ])/g,
    he: /(?<=[ぁ-ゖ])[へ](?=[ぁ-ゖ])/g,
    ho: /(?<=[ぁ-ゖ])[ほ](?=[ぁ-ゖ])/g,
    kefu: /けふ/g,
    gefu: /げふ/g,
    sau: /さう/g,
    kau: /かう/g,
    tau: /たう/g,
    nau: /なう/g,
    ifu: /いふ/g,
    tefu: /てふ/g,
    jau: /(ぢゃう|じゃう)/g,
    oo: /おお/g,
    dashes: /[〜～…\-‐–—―ー]/g,
    negation: /まったく[^ぁ-ゖ一-龯]*ない$/u,
    omoha: /思は/g,
    omohi: /思ひ/g,
    omofu: /思ふ/g,
    monoomo: /物思/g,
    monogata: /物語/g,
    kokochi: /心地/g,
    keshiki: /気色/g,
    arisama: /有様/g,
    kyou: /今日/g,
    kinou: /昨日/g,
    gaman: /我慢/g
  };
  return patternsCache;
}

export function normalizeSense(input: string): string {
  if (!input) return "";
  let x = input.normalize("NFKC").toLowerCase();
  const p = getPatterns();

  // 括弧/引用符/空白の除去
  x = x.replace(p.brackets, "");

  // 歴史的仮名→現代仮名 近似
  x = x
    .replace(p.wi, "い")
    .replace(p.we, "え")
    .replace(p.wo, "お")
    .replace(p.ha, "わ")
    .replace(p.hi, "い")
    .replace(p.fu, "う")
    .replace(p.he, "え")
    .replace(p.ho, "お")
    .replace(p.kefu, "きょう")
    .replace(p.gefu, "ぎょう")
    .replace(p.sau, "そう")
    .replace(p.kau, "こう")
    .replace(p.tau, "とう")
    .replace(p.nau, "のう")
    .replace(p.ifu, "いう")
    .replace(p.tefu, "ちょう")
    .replace(p.jau, "じょう")
    .replace(p.oo, "おう");

  // 波/長音/三点リーダ/ダッシュ類は除去（テンプレ崩れ対策）
  x = x.replace(p.dashes, "");

  // 否定テンプレ：まったく～ない → まったくない
  x = x.replace(p.negation, "まったくない");

  // 軽い漢字かなゆれ（よくある表記）
  x = x
    .replace(p.omoha, "おもわ")
    .replace(p.omohi, "おもい")
    .replace(p.omofu, "おもう")
    .replace(p.monoomo, "ものおも")
    .replace(p.monogata, "ものがた")
    .replace(p.kokochi, "ここち")
    .replace(p.keshiki, "けしき")
    .replace(p.arisama, "ありさま")
    .replace(p.kyou, "きょう")
    .replace(p.kinou, "きのう")
    .replace(p.gaman, "がまん");

  return x;
}
