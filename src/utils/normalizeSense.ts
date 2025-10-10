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

// Pre-compiled regex patterns (compiled once, reused across calls)
const patterns = {
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

export function normalizeSense(input: string): string {
  if (!input) return "";
  let x = input.normalize("NFKC").toLowerCase();

  // 括弧/引用符/空白の除去
  x = x.replace(patterns.brackets, "");

  // 歴史的仮名→現代仮名 近似
  x = x
    .replace(patterns.wi, "い")
    .replace(patterns.we, "え")
    .replace(patterns.wo, "お")
    .replace(patterns.ha, "わ")
    .replace(patterns.hi, "い")
    .replace(patterns.fu, "う")
    .replace(patterns.he, "え")
    .replace(patterns.ho, "お")
    .replace(patterns.kefu, "きょう")
    .replace(patterns.gefu, "ぎょう")
    .replace(patterns.sau, "そう")
    .replace(patterns.kau, "こう")
    .replace(patterns.tau, "とう")
    .replace(patterns.nau, "のう")
    .replace(patterns.ifu, "いう")
    .replace(patterns.tefu, "ちょう")
    .replace(patterns.jau, "じょう")
    .replace(patterns.oo, "おう");

  // 波/長音/三点リーダ/ダッシュ類は除去（テンプレ崩れ対策）
  x = x.replace(patterns.dashes, "");

  // 否定テンプレ：まったく～ない → まったくない
  x = x.replace(patterns.negation, "まったくない");

  // 軽い漢字かなゆれ（よくある表記）
  x = x
    .replace(patterns.omoha, "おもわ")
    .replace(patterns.omohi, "おもい")
    .replace(patterns.omofu, "おもう")
    .replace(patterns.monoomo, "ものおも")
    .replace(patterns.monogata, "ものがた")
    .replace(patterns.kokochi, "ここち")
    .replace(patterns.keshiki, "けしき")
    .replace(patterns.arisama, "ありさま")
    .replace(patterns.kyou, "きょう")
    .replace(patterns.kinou, "きのう")
    .replace(patterns.gaman, "がまん");

  return x;
}
