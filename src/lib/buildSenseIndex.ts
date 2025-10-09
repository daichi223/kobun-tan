import { normalizeSense } from "../utils/normalizeSense";
import type { SenseCandidate } from "../utils/matchSense";

export interface Row {
  qid: string;
  sense: string; // "〔 思はれ 〕" など
  // 他フィールド（lemma/examples 等）は不要
}

/** rows（辞書全体）から qid→SenseCandidate[] を構築 */
export const buildSenseIndex = (rows: Row[]) => {
  const index = new Map<string, SenseCandidate[]>();
  for (const r of rows) {
    const s = (r.sense || "").trim();
    if (!s) continue;
    const norm = normalizeSense(s);
    const arr = index.get(r.qid) ?? [];
    arr.push({ surface: s, norm });
    index.set(r.qid, arr);
  }
  return index;
};
