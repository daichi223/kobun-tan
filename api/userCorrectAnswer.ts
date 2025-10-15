import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, FieldValue } from "./_firebaseAdmin.js";

type ResultLabel = "OK" | "NG";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { answerId, userCorrection, userId } = req.body as {
      answerId: string;
      userCorrection: ResultLabel | null; // null => remove user correction
      userId: string; // anonId or uid
    };

    if (!answerId || typeof userCorrection === "undefined" || !userId) {
      return res.status(400).json({ error: "answerId/userCorrection/userId required" });
    }

    const ref = db.collection("answers").doc(answerId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("answer not found");
      const cur: any = snap.data();

      // verify user ownership
      const owner = cur.raw?.uid || cur.raw?.anonId;
      if (owner !== userId) {
        throw new Error("not authorized");
      }

      const now = new Date();

      // userCorrection
      const nextUserCorrection =
        userCorrection === null
          ? null
          : {
              result: userCorrection,
              at: now,
              version: (cur.userCorrection?.version ?? 0) + 1,
            };

      // update final based on priority: manual > userCorrection > override > auto
      let nextFinal: any;
      if (cur.manual) {
        // teacher override takes priority
        nextFinal = cur.final;
      } else if (userCorrection !== null) {
        // user correction
        nextFinal = {
          result: userCorrection,
          source: "userCorrection",
          reason: "user_corrected",
          at: now,
        };
      } else if (cur.final?.source === "override") {
        // keep override
        nextFinal = cur.final;
      } else {
        // revert to auto
        nextFinal = {
          result: cur.raw?.auto?.result ?? "ABSTAIN",
          source: "auto",
          reason: cur.raw?.auto?.reason ?? "auto_missing",
        };
      }

      const payload: any = { final: nextFinal };
      if (userCorrection === null) {
        payload.userCorrection = FieldValue.delete();
      } else {
        payload.userCorrection = nextUserCorrection;
      }

      tx.update(ref, payload);
    });

    const updated = (await ref.get()).data();
    return res.json({ ok: true, final: updated?.final, userCorrection: updated?.userCorrection ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
