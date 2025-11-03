import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { requireStaff } from "./_requireStaff.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireStaff(req);  // 教師のみ実行可能

    const minFreq = Number(req.query.minFreq || 3);
    const lookbackDays = Number(req.query.lookbackDays || 7);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    // Aggregate answers by qid + answerNorm (記述式のみ)
    const snap = await db
      .collection("answers")
      .where("raw.ts", ">=", cutoff)
      .where("raw.questionType", "==", "writing")
      .get();

    const aggregated = new Map<string, {
      qid: string;
      answerNorm: string;
      freq: number;
      lastSeen: Date;
      scores: number[];
      sampleRaw: string;
    }>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const qid = data.raw?.qid;
      const answerNorm = data.curated?.answerNorm;
      const answerRaw = data.raw?.answerRaw;

      if (!qid || !answerNorm) continue;

      // ユーザー訂正を優先、なければ自動採点を使用
      let score = data.raw?.auto?.score || 0;
      let finalResult = data.final?.result;

      // ユーザー訂正がある場合はそれを優先
      if (data.manual?.result) {
        finalResult = data.manual.result;
        // PARTIAL（△）は集計対象外
        if (finalResult === 'PARTIAL') {
          continue;
        }
        // ユーザー訂正をスコアに変換
        score = finalResult === 'OK' ? 100 : finalResult === 'NG' ? 0 : 50;
      }

      const key = `${qid}::${answerNorm}`;
      const existing = aggregated.get(key);

      if (existing) {
        existing.freq++;
        existing.scores.push(score);
        if (data.raw.ts.toDate() > existing.lastSeen) {
          existing.lastSeen = data.raw.ts.toDate();
        }
      } else {
        aggregated.set(key, {
          qid,
          answerNorm,
          freq: 1,
          lastSeen: data.raw.ts.toDate(),
          scores: [score],
          sampleRaw: answerRaw,
        });
      }
    }

    // Filter by frequency and save to candidates
    const batch = db.batch();
    let saved = 0;

    for (const [key, agg] of aggregated.entries()) {
      if (agg.freq < minFreq) continue;

      const avgScore = agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length;
      const bandMode = avgScore >= 80 ? "HIGH" : avgScore >= 50 ? "MID" : "LOW";
      const proposedRole = avgScore >= 80 ? "accept" : avgScore < 50 ? "negative" : "review";

      const candidateDoc = {
        qid: agg.qid,
        answerNorm: agg.answerNorm,
        freq: agg.freq,
        lastSeen: agg.lastSeen,
        bandMode,
        proposedRole,
        avgScore: Math.round(avgScore),
        sampleAny: agg.sampleRaw,
        updatedAt: new Date(),
      };

      const ref = db.collection("candidates").doc(key);
      batch.set(ref, candidateDoc, { merge: true });
      saved++;
    }

    if (saved > 0) {
      await batch.commit();
    }

    return res.json({
      ok: true,
      processed: snap.docs.length,
      aggregated: aggregated.size,
      saved,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    res.status(msg.includes("PERMISSION_DENIED") ? 403 : 500).json({ error: msg });
  }
}
