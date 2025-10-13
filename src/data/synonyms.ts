/**
 * 同義語・反義語・助詞同値の辞書
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

export const PARTICLE_EQUIV = {
  SUBJLIKE: new Set(["が", "の"]),
};
