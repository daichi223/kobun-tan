// api/getChoices.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import fs from "fs";
import path from "path";

// キャッシュ用
let QMAP: Map<string, any> | null = null;

function loadQuestionsOnce() {
  if (QMAP) return QMAP;
  const p = path.join(process.cwd(), "data", "kobun_q.jsonl.txt");
  if (!fs.existsSync(p)) throw new Error("Data file not found");

  const lines = fs.readFileSync(p, "utf-8").split(/\r?\n/).filter(Boolean);
  QMAP = new Map();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.qid) QMAP.set(String(obj.qid), obj);
    } catch {}
  }
  return QMAP!;
}

type Choice = {
  qid: string;
  lemma: string;
  sense: string;
  freq?: number;
  isFromCandidates?: boolean;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { qid, correctQid, excludeQids, mode = "word-meaning" } = req.query;

    if (!qid || !correctQid) {
      return res.status(400).json({ error: "qid and correctQid required" });
    }

    const qidStr = String(qid);
    const correctQidStr = String(correctQid);
    const exclude = excludeQids ? String(excludeQids).split(",") : [];

    // 正解データを取得
    const qmap = loadQuestionsOnce();
    const correctData = qmap.get(correctQidStr);
    if (!correctData) {
      console.error(`correctQid not found: ${correctQidStr}, available qids sample:`, Array.from(qmap.keys()).slice(0, 10));
      return res.status(404).json({ error: `correctQid not found: ${correctQidStr}` });
    }

    // 1. candidates から正解・誤答候補を取得
    const correctCandidates = await db
      .collection("candidates")
      .where("qid", "==", qidStr)
      .where("proposedRole", "==", "accept")
      .orderBy("freq", "desc")
      .limit(10)
      .get();

    const wrongCandidates = await db
      .collection("candidates")
      .where("qid", "==", qidStr)
      .where("proposedRole", "==", "negative")
      .orderBy("freq", "desc")
      .limit(15)
      .get();

    // 2. 候補を Choice 形式に変換
    const candidateChoices: Choice[] = [];

    for (const doc of [...correctCandidates.docs, ...wrongCandidates.docs]) {
      const data = doc.data();
      const candidateQid = data.qid;
      const candidateData = qmap.get(candidateQid);

      if (candidateData && candidateData.qid !== correctQidStr && !exclude.includes(candidateData.qid)) {
        candidateChoices.push({
          qid: candidateData.qid,
          lemma: candidateData.lemma || "",
          sense: candidateData.sense || "",
          freq: data.freq || 0,
          isFromCandidates: true,
        });
      }
    }

    // 3. 多様性のためランダム選択肢も追加（フォールバック）
    const allWords = Array.from(qmap.values());
    const randomChoices: Choice[] = [];

    const candidateQids = new Set(candidateChoices.map(c => c.qid));
    const availableRandom = allWords.filter(w =>
      w.qid !== correctQidStr &&
      !exclude.includes(w.qid) &&
      !candidateQids.has(w.qid)
    );

    // ランダムから最大10個選ぶ
    const shuffled = availableRandom.sort(() => Math.random() - 0.5).slice(0, 10);
    for (const w of shuffled) {
      randomChoices.push({
        qid: w.qid,
        lemma: w.lemma || "",
        sense: w.sense || "",
        isFromCandidates: false,
      });
    }

    // 4. 重み付き選択（頻度が高いものを優先しつつランダム性も保つ）
    const pool = [...candidateChoices, ...randomChoices];

    // 候補が多い場合は頻度ベースで絞る（候補70%, ランダム30%）
    const numFromCandidates = Math.min(2, candidateChoices.length);
    const numFromRandom = 3 - numFromCandidates;

    const selectedCandidates = weightedSample(candidateChoices, numFromCandidates);
    const selectedRandom = randomChoices.slice(0, numFromRandom);

    const incorrectOptions = [...selectedCandidates, ...selectedRandom];

    // 5. 正解を含めて4択にする
    const choices: Choice[] = [
      {
        qid: correctData.qid,
        lemma: correctData.lemma || "",
        sense: correctData.sense || "",
      },
      ...incorrectOptions,
    ].slice(0, 4); // 念のため4つに制限

    // シャッフル
    const shuffledChoices = choices.sort(() => Math.random() - 0.5);

    return res.json({
      ok: true,
      choices: shuffledChoices,
      meta: {
        candidatesUsed: selectedCandidates.length,
        randomUsed: selectedRandom.length,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

// 重み付きサンプリング（頻度が高いものを優先）
function weightedSample<T extends { freq?: number }>(items: T[], count: number): T[] {
  if (items.length === 0) return [];
  if (items.length <= count) return items;

  // 頻度の合計を計算
  const totalWeight = items.reduce((sum, item) => sum + (item.freq || 1), 0);

  const selected: T[] = [];
  const remaining = [...items];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    let rand = Math.random() * totalWeight;
    let picked: T | null = null;
    let pickedIndex = -1;

    for (let j = 0; j < remaining.length; j++) {
      rand -= remaining[j].freq || 1;
      if (rand <= 0) {
        picked = remaining[j];
        pickedIndex = j;
        break;
      }
    }

    if (picked) {
      selected.push(picked);
      remaining.splice(pickedIndex, 1);
    }
  }

  return selected;
}
