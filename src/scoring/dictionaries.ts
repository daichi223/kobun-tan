/**
 * 同義語・反義語辞書
 * 運用で発見した言い換えを随時追加
 */

export const SYN_NOUN: Record<string, string[]> = {
  "身分": ["地位", "身の程"],
};

export const SYN_ADJ: Record<string, string[]> = {
  "低い": ["ひくい", "劣った", "卑しい"],
};

export const ANT_ADJ: Record<string, string[]> = {
  "低い": ["高い", "優れた"],
};
