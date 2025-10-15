import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { makeKey } from "./_normalize.js";
import { requireStaff } from "./_requireStaff.js";

type Label = "OK" | "NG" | "ABSTAIN";

type Body =
  | { key: string; label?: Label; reason?: string; active?: boolean; limit?: number }
  | { qid: string; answerRaw: string; label?: Label; reason?: string; active?: boolean; limit?: number };

function deriveKey(b: Body): string {
  // @ts-ignore
  if (b.key) return (b as any).key as string;
  // @ts-ignore
  return makeKey((b as any).qid as string, (b as any).answerRaw as string);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { actor } = await requireStaff(req);  // 権限チェック＆actor取得

    const body = req.body as Body;
    const key = deriveKey(body);
    const label = ((body as any).label ?? "OK") as Label;
    const reason = ((body as any).reason ?? "") as string;
    const active = ((body as any).active ?? true) as boolean;
    const limit = Number((body as any).limit ?? 500);

    if (!key) return res.status(400).json({ error: "key(or qid+answerRaw) required" });
    if (!["OK", "NG", "ABSTAIN"].includes(label)) return res.status(400).json({ error: "invalid label" });
    if (reason.length > 500) return res.status(400).json({ error: "reason too long" });

    // upsert override doc (docId=key 推奨でもOK / ここは新規docで履歴も保存)
    const ovDoc = db.collection("overrides").doc(key);
    const now = new Date();
    await db.runTransaction(async tx => {
      const s = await tx.get(ovDoc);
      const cur = s.exists ? s.data() : null;
      const next = {
        key,
        label,
        active,
        reason,
        by: { userId: actor, role: "teacher" },
        createdAt: cur?.createdAt ?? now,
        updatedAt: now,
        history: [
          ...(Array.isArray(cur?.history) ? (cur!.history as any[]) : []),
          { label, at: now, by: actor, note: reason, active },
        ],
      };
      tx.set(ovDoc, next);
    });

    // split key "qid::norm"
    const sep = key.indexOf("::");
    if (sep <= 0) return res.status(400).json({ error: "invalid key format" });
    const qid = key.slice(0, sep);
    const norm = key.slice(sep + 2);

    // batch update attempts (manual があるものは尊重して除外)
    // Require composite index: ["raw.qid" ASC, "curated.answerNorm" ASC]
    const q = db
      .collection("answers")
      .where("raw.qid", "==", qid)
      .where("curated.answerNorm", "==", norm)
      .limit(limit);

    const snap = await q.get();
    const batch = db.batch();
    let updated = 0;

    for (const doc of snap.docs) {
      const a: any = doc.data();
      if (a.manual) continue;

      if (active) {
        batch.update(doc.ref, {
          final: {
            result: label,
            source: "override",
            reason: `override:${key}${reason ? " - " + reason : ""}`,
            by: actor,
            at: now,
          },
        });
      } else {
        const auto = a.raw?.auto ?? { result: "ABSTAIN", reason: "auto_missing" };
        batch.update(doc.ref, { final: { result: auto.result, source: "auto", reason: auto.reason } });
      }
      updated++;
    }

    if (updated) await batch.commit();

    // audit event
    await db.collection("overrides").add({
      ts: now,
      action: active ? "override_apply" : "override_cancel",
      actor,
      key,
      label,
      reason,
      affected: updated,
    });

    res.json({ ok: true, key, active, label, updated });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
