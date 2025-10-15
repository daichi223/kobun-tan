// api/listRecentAnswers.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { requireStaff } from "./_requireStaff.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireStaff(req);  // 共有トークン or 教師のみ
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const snap = await db.collection("answers").orderBy("raw.ts", "desc").limit(limit).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(rows);
  } catch (e: any) {
    const msg = String(e?.message || e);
    res.status(msg.includes("PERMISSION_DENIED") ? 403 : 500).json({ error: msg });
  }
}
