import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, FieldValue } from "./_firebaseAdmin.js";
import { requireStaff } from "./_requireStaff.js";

type ResultLabel = "OK" | "NG";
type FinalSource = "auto" | "manual" | "override";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { actor } = await requireStaff(req);  // 権限チェック＆actor取得

    const { answerId, result, note } = req.body as {
      answerId: string;
      result: ResultLabel | null; // null => revert to auto
      note?: string;
    };

    if (!answerId || typeof result === "undefined") {
      return res.status(400).json({ error: "answerId/result required" });
    }
    if (note && note.length > 500) return res.status(400).json({ error: "note too long" });

    const ref = db.collection("answers").doc(answerId);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("answer not found");
      const cur: any = snap.data();
      const now = new Date();

      // next manual
      const nextManual =
        result === null
          ? null
          : {
              result,
              reason: `teacher_override${note ? ": " + String(note) : ""}`,
              note: note ?? "",
              by: actor,
              at: now,
              version: (cur.manual?.version ?? 0) + 1,
            };

      // next final
      const nextFinal:
        | { result: ResultLabel | "ABSTAIN"; source: FinalSource; reason: string; by?: string; at?: Date }
        = result === null
          ? {
              result: cur.raw?.auto?.result ?? "ABSTAIN",
              source: "auto",
              reason: cur.raw?.auto?.reason ?? "auto_missing",
            }
          : { result, source: "manual", reason: "teacher_override", by: actor, at: now };

      const payload: any = { final: nextFinal };
      if (result === null) payload.manual = FieldValue.delete();
      else payload.manual = nextManual;

      tx.update(ref, payload);

      // audit
      tx.set(db.collection("overrides").doc(), {
        ts: now,
        action: result === null ? "revert" : "teacher_override",
        actor,
        answerId,
        qid: cur.raw?.qid ?? null,
        final: nextFinal,
      });
    });

    const updated = (await ref.get()).data();
    return res.json({ ok: true, final: updated?.final, manual: updated?.manual ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
