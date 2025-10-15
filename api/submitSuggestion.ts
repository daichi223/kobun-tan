import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { answerId, userId, proposed, comment } = req.body as {
      answerId: string;
      userId: string;
      proposed: "OK" | "NG";
      comment?: string;
    };

    if (!answerId || !userId || !proposed) {
      return res.status(400).json({ error: "answerId, userId, and proposed required" });
    }

    if (!["OK", "NG"].includes(proposed)) {
      return res.status(400).json({ error: "proposed must be OK or NG" });
    }

    const now = new Date();

    // Create suggestion document
    const suggestionDoc = {
      answerId,
      userId,
      proposed,
      comment: comment || "",
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("suggestions").add(suggestionDoc);

    return res.json({
      ok: true,
      suggestionId: docRef.id,
    });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
