// api/pingFirestore.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const now = new Date();
    const ref = db.collection("healthcheck").doc("vercel");
    await ref.set({ ok: true, at: now });
    const got = await ref.get();
    return res.status(200).json({ ok: got.exists, at: now.toISOString() });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
