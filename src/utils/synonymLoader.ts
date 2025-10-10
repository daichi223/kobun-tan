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
      // 基本的な類義語の誤用
      { correct: "気づく", similar: ["目を覚ます", "起きる", "驚く"], note: "おどろく" },
      { correct: "心苦しい", similar: ["つらい", "苦しい", "かわいそう"], note: "相手への気の毒さ vs 自分のつらさ" },
      { correct: "気の毒", similar: ["つらい", "かわいそう", "申し訳ない"], note: "相手への同情" },

      // おぼゆ系（自発 vs 意志）
      { correct: "思われる", similar: ["思う", "思った", "感じる"], note: "自発の「思われる」vs 単純な「思う」" },
      { correct: "思い出される", similar: ["覚えている", "思い出す", "記憶している"], note: "自発の「思い出される」vs 意志" },
      { correct: "似る", similar: ["にている", "似ている", "似通う"], note: "表記の揺れ" },

      // あり系（敬語 vs 存在）
      { correct: "いらっしゃる", similar: ["いる", "ある", "存在する"], note: "おはす・おはします（尊敬）" },
      { correct: "おられる", similar: ["いる", "ある"], note: "尊敬表現" },

      // 聞こゆ系（謙譲 vs 自発）
      { correct: "申し上げる", similar: ["言う", "話す", "伝える"], note: "謙譲の「聞こゆ」" },
      { correct: "聞こえる", similar: ["聞く", "耳に入る"], note: "自発の「聞こゆ」" },
      { correct: "評判である", similar: ["有名だ", "知られている"], note: "「聞こゆ」の別の意味" },

      // あはれ系
      { correct: "しみじみと感じる", similar: ["悲しい", "かわいそう", "感動する"], note: "あはれ（情趣）" },

      // ありがたし系
      { correct: "めったにない", similar: ["感謝する", "ありがたい", "珍しい"], note: "本来の意味 vs 現代語の誤用" },

      // いとほし系
      { correct: "いとおしい", similar: ["かわいい", "愛らしい", "大切だ", "かわいそう"], note: "深い愛情" },

      // おろかなり系
      { correct: "言うまでもない", similar: ["ばかだ", "愚かだ", "当然だ"], note: "本来の意味 vs 現代語" },
    ],
    variations: {
      // 基本動詞
      "座る": ["すわる", "座る", "すわ", "すわっ", "すわり"],
      "見る": ["みる", "見る", "み", "見", "みえ"],
      "聞く": ["きく", "聞く", "聞", "き"],
      "言う": ["いう", "言ふ", "いふ", "言", "いい", "いっ"],
      "する": ["する", "為る", "せ", "し", "す"],
      "来る": ["くる", "来る", "き", "こ", "来"],
      "行く": ["ゆく", "行く", "いく", "行", "ゆき"],

      // 思う系
      "思う": ["おもう", "思ふ", "思は", "思ひ", "思ふ", "思った", "思っ", "思い"],
      "思われる": ["思われ", "おもわれ", "思はれ", "思われる"],
      "思い出される": ["思い出され", "おもいだされ", "思い出される"],
      "感じる": ["感じ", "かんじ", "感じる"],

      // 似る系
      "似る": ["似", "にる", "に", "にている", "似ている", "似た"],

      // ある・いる系
      "ある": ["ある", "有る", "あり", "あっ"],
      "いる": ["いる", "居る", "ゐる", "い"],
      "いらっしゃる": ["いらっしゃる", "いらっしゃっ", "いらっしゃい"],
      "おられる": ["おられ", "おられる"],

      // 聞こゆ系
      "申し上げる": ["申し上げ", "もうしあげ", "申しあげる"],
      "聞こえる": ["聞こえ", "きこえ", "聞こえる"],
      "評判である": ["評判", "ひょうばん"],

      // 覚える系
      "覚える": ["おぼえる", "覚え", "おぼえ"],
      "記憶する": ["記憶", "きおく"],

      // 形容詞・形容動詞
      "しみじみと感じる": ["しみじみ", "しみじみと"],
      "めったにない": ["めったにない", "滅多にない"],
      "いとおしい": ["いとおしい", "愛おしい", "いとほしい"],
      "言うまでもない": ["言うまでもない", "いうまでもない"],
      "かわいそう": ["可哀想", "かはいさう", "かわいそう"],
      "ありがたい": ["ありがたい", "有難い"],
      "珍しい": ["珍しい", "めずらしい"],

      // その他重要語
      "心苦しい": ["心苦しい", "こころぐるしい", "心ぐるし"],
      "気の毒": ["気の毒", "きのどく"],
      "気づく": ["気づく", "きづく", "気付く"],
      "目を覚ます": ["目を覚ます", "めをさます"],
      "驚く": ["驚く", "おどろく", "をどろく"],
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
