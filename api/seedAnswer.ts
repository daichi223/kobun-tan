// api/seedAnswer.ts（任意：一度だけ使えばOK）
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const now = new Date();
  const doc = await db.collection("answers").add({
    raw: {
      ts: now,
      qid: "4-2",
      uid: null,
      anonId: "anon_seed",
      answerRaw: "はっと目が覚めた",
      autoAt: now,
      auto: { result: "NG", score: 0.58, band: "MID", reason: "jaccard_mid" }
    },
    curated: {
      v: 1,
      answerNorm: "はっとめがさめた",
      dedupeKey: "dummy",
      flags: { pii: false, tooLong: false, regexRisk: false }
    },
    final: { result: "NG", source: "auto", reason: "jaccard_mid" }
  });
  res.json({ ok: true, answerId: doc.id });
}
