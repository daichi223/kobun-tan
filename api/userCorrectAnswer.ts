import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { answerId, userCorrection, userId } = req.body as {
      answerId: string;
      userCorrection: "OK" | "NG" | "PARTIAL" | null;
      userId: string;
    };

    if (!answerId) {
      return res.status(400).json({ error: "answerId required" });
    }

    const answerRef = db.collection("answers").doc(answerId);
    const answerDoc = await answerRef.get();

    if (!answerDoc.exists) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const now = new Date();
    const updateData: any = {};

    if (userCorrection === null) {
      // ユーザー訂正を取り消し
      updateData.manual = null;
      updateData["final.result"] = answerDoc.data()?.raw?.auto?.result || "NG";
      updateData["final.source"] = "auto";
      updateData["final.reason"] = answerDoc.data()?.raw?.auto?.reason || "";
      updateData["final.at"] = now;
    } else {
      // ユーザー訂正を保存
      updateData.manual = {
        result: userCorrection,
        by: {
          userId: userId,
          at: now,
        },
      };
      updateData["final.result"] = userCorrection;
      updateData["final.source"] = "manual";
      updateData["final.reason"] = `user_correction:${userCorrection}`;
      updateData["final.at"] = now;
    }

    await answerRef.update(updateData);

    return res.json({
      ok: true,
      answerId,
      updated: updateData,
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
