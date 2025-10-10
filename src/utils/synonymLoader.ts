/**
 * synonymLoader.ts - 類義語・表記揺れ辞書ローダー
 *
 * synonym-dictionary.jsonを安全に読み込み、
 * 採点エンジンで使用可能な形式に変換する
 *
 * TDZ対策: JSON importをmodule-levelで行わず、動的importで遅延ロード
 */

// NO module-level JSON import to avoid TDZ
let synonymDataCache: any = null;

export interface SynonymGroup {
  correct: string;
  similar: string[];
  note: string;
}

export interface SynonymDictionary {
  /** 類義語グループ: 正解語 → 類似語リスト */
  synonymGroups: SynonymGroup[];
  /** 表記揺れ: 正規形 → 異表記リスト */
  variations: Record<string, string[]>;
  /** 助動詞の意味別表現: タグ → 現代語表現リスト */
  auxiliaryMeanings: Record<string, string[]>;
  /** 接続表現の揺れ: 代表形 → 異形リスト */
  connectionVariations: Record<string, string[]>;
}

let cachedDictionary: SynonymDictionary | null = null;

/**
 * 類義語辞書を読み込む（TDZ回避: インラインデータ使用）
 * TEMPORARY: JSON import/requireがTDZを引き起こすため、データを直接埋め込み
 */
export function loadSynonymDictionary(): SynonymDictionary {
  if (cachedDictionary) return cachedDictionary;

  // Inline data to completely avoid TDZ from any JSON imports
  cachedDictionary = {
    synonymGroups: [
      { correct: "気づく", similar: ["目を覚ます", "起きる", "驚く"], note: "" },
      { correct: "心苦しい", similar: ["つらい", "苦しい", "かわいそう"], note: "" },
      { correct: "気の毒", similar: ["つらい", "かわいそう", "申し訳ない"], note: "" },
    ],
    variations: {
      "座る": ["すわる", "座る", "すわ"],
      "見る": ["みる", "見る", "み"],
      "思う": ["おもう", "思ふ", "思は", "思ひ", "思ふ"],
    },
    auxiliaryMeanings: {},
    connectionVariations: {},
  };

  return cachedDictionary;
}

/**
 * 2つの語幹が類義語関係にあるかチェック
 */
export function isSimilarButWrong(ansLemma: string, correctLemma: string): boolean {
  if (!ansLemma || !correctLemma) return false;

  const dict = loadSynonymDictionary();

  for (const group of dict.synonymGroups) {
    if (group.correct === correctLemma) {
      return group.similar.includes(ansLemma);
    }
  }

  return false;
}

/**
 * 表記揺れを正規化（例: "おもふ" → "思う"）
 */
export function normalizeVariation(surface: string): string {
  if (!surface) return '';

  const dict = loadSynonymDictionary();

  for (const [canonical, variants] of Object.entries(dict.variations)) {
    if (variants.includes(surface)) {
      return canonical;
    }
    if (canonical === surface) {
      return canonical;
    }
  }

  return surface;
}

/**
 * 助動詞タグを現代語表現に展開
 * 例: "打消" → ["ない", "ず", "ぬ", "ざり", "じ"]
 */
export function getAuxiliaryMeanings(tag: string): string[] {
  const dict = loadSynonymDictionary();
  return dict.auxiliaryMeanings[tag] || [];
}

/**
 * 接続表現の揺れを吸収
 * 例: "で" → "て" （代表形に正規化）
 */
export function normalizeConnection(surface: string): string {
  if (!surface) return '';

  const dict = loadSynonymDictionary();

  for (const [canonical, variants] of Object.entries(dict.connectionVariations)) {
    if (variants.includes(surface)) {
      return canonical;
    }
  }

  return surface;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearSynonymCache() {
  cachedDictionary = null;
}
