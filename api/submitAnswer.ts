import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { normalize } from "./_normalize.js";
import crypto from "crypto";

type ResultLabel = "OK" | "NG" | "ABSTAIN";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { qid, answerRaw, uid, anonId, autoScore, autoResult, autoReason } = req.body as {
      qid: string;
      answerRaw: string;
      uid?: string | null;
      anonId?: string;
      autoScore: number;
      autoResult: ResultLabel;
      autoReason: string;
    };

    if (!qid || !answerRaw) {
      return res.status(400).json({ error: "qid and answerRaw required" });
    }

    const now = new Date();
    const answerNorm = normalize(answerRaw);
    const dedupeKey = crypto.createHash("sha1").update(`${qid}::${answerNorm}`).digest("hex");

    // Build answer document
    const answerDoc = {
      raw: {
        ts: now,
        qid,
        uid: uid || null,
        anonId: anonId || null,
        answerRaw,
        autoAt: now,
        auto: {
          result: autoResult,
          score: autoScore,
          reason: autoReason,
        },
      },
      curated: {
        v: 1,
        answerNorm,
        dedupeKey,
        flags: {
          pii: false, // TODO: implement PII detection
          tooLong: answerRaw.length > 200,
          regexRisk: /[.*+?^${}()|[\]\\]/.test(answerRaw),
        },
      },
      manual: null,
      final: {
        result: autoResult,
        source: "auto",
        reason: autoReason,
        at: now,
      } as any,
    };

    // Check for existing override
    const overrideKey = `${qid}::${answerNorm}`;
    const overrideSnap = await db.collection("overrides").doc(overrideKey).get();

    if (overrideSnap.exists) {
      const override = overrideSnap.data();
      if (override?.active) {
        answerDoc.final = {
          result: override.label,
          source: "override",
          reason: `override:${overrideKey}${override.reason ? " - " + override.reason : ""}`,
          by: override.by?.userId || "system",
          at: now,
        };
      }
    }

    // Save to answers collection
    const docRef = await db.collection("answers").add(answerDoc);

    return res.json({
      ok: true,
      answerId: docRef.id,
      final: answerDoc.final,
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
