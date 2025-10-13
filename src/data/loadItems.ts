/**
 * データ読み込み：out/kobun_sense_window.jsonl
 */

export type Morpheme = {
  surface: string;
  base: string;
  pos: [string, string, string, string, string, string];
};

export type Item = {
  lemma: string;
  sense_id: string;
  sense_gloss: string;
  jp: string;
  translation: string;
  ba_condition?: "" | "確定" | "仮定";
  focus?: { start: number; end: number };
  window: {
    startIndex: number;
    endIndex: number;
    tokens: Morpheme[];
  };
  gold_tokens: Morpheme[];
};

/**
 * JSONLファイルを読み込んでItem配列を返す
 */
export async function loadItems(path: string = "/out/kobun_sense_window.jsonl"): Promise<Item[]> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
    }
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => JSON.parse(line) as Item);
  } catch (error) {
    console.error('Error loading items:', error);
    throw error;
  }
}
