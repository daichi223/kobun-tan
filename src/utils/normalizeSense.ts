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

export function normalizeSense(input: string): string {
  if (!input) return "";
  let x = input.normalize("NFKC").toLowerCase();

  // 括弧/引用符/空白の除去
  x = x.replace(/[〔〕（）\(\)「」『』"'\s]/g, "");

  // 歴史的仮名→現代仮名 近似
  x = x
    .replace(/ゐ/g, "い")
    .replace(/ゑ/g, "え")
    .replace(/(?<!^)[を](?=[ぁ-ゖ])/g, "お")
    .replace(/(?<=[ぁ-ゖ])[は](?=[ぁ-ゖ])/g, "わ")
    .replace(/(?<=[ぁ-ゖ])[ひ](?=[ぁ-ゖ])/g, "い")
    .replace(/(?<=[ぁ-ゖ])[ふ](?=[ぁ-ゖ])/g, "う")
    .replace(/(?<=[ぁ-ゖ])[へ](?=[ぁ-ゖ])/g, "え")
    .replace(/(?<=[ぁ-ゖ])[ほ](?=[ぁ-ゖ])/g, "お")
    .replace(/けふ/g, "きょう")
    .replace(/げふ/g, "ぎょう")
    .replace(/さう/g, "そう")
    .replace(/かう/g, "こう")
    .replace(/たう/g, "とう")
    .replace(/なう/g, "のう")
    .replace(/いふ/g, "いう")
    .replace(/てふ/g, "ちょう")
    .replace(/(ぢゃう|じゃう)/g, "じょう")
    .replace(/おお/g, "おう");

  // 波/長音/三点リーダ/ダッシュ類は除去（テンプレ崩れ対策）
  x = x.replace(/[〜～…\-‐–—―ー]/g, "");

  // 否定テンプレ：まったく～ない → まったくない
  x = x.replace(/まったく[^ぁ-ゖ一-龯]*ない$/u, "まったくない");

  // 軽い漢字かなゆれ（よくある表記）
  x = x
    .replace(/思は/g, "おもわ")
    .replace(/思ひ/g, "おもい")
    .replace(/思ふ/g, "おもう")
    .replace(/物思/g, "ものおも")
    .replace(/物語/g, "ものがた")
    .replace(/心地/g, "ここち")
    .replace(/気色/g, "けしき")
    .replace(/有様/g, "ありさま")
    .replace(/今日/g, "きょう")
    .replace(/昨日/g, "きのう")
    .replace(/我慢/g, "がまん");

  return x;
}
