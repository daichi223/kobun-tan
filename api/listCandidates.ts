// api/listCandidates.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { requireStaff } from "./_requireStaff.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireStaff(req);

    const limit = Number(req.query.limit || 100);
    const qid = req.query.qid ? String(req.query.qid) : null;
    const role = req.query.role ? String(req.query.role) : null; // "accept", "negative", "review"

    let query: any = db.collection("candidates");

    if (qid) {
      query = query.where("qid", "==", qid);
    }

    if (role) {
      query = query.where("proposedRole", "==", role);
    }

    const snap = await query
      .orderBy("freq", "desc")
      .limit(limit)
      .get();

    const candidates = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      ok: true,
      candidates,
      total: candidates.length,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    res.status(msg.includes("PERMISSION_DENIED") ? 403 : 500).json({ error: msg });
  }
}
