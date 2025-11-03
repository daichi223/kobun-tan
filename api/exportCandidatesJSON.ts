import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_firebaseAdmin.js";
import { requireStaff } from "./_requireStaff.js";
import { promises as fs } from "fs";
import path from "path";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireStaff(req);  // 教師のみ実行可能

    // acceptロールの候補データのみ取得
    const snap = await db
      .collection("candidates")
      .where("proposedRole", "==", "accept")
      .get();

    // qid別に正解候補をグループ化
    const candidatesByQid = new Map<string, Array<{
      answerNorm: string;
      freq: number;
      avgScore: number;
    }>>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const qid = data.qid;
      const answerNorm = data.answerNorm;
      const freq = data.freq || 0;
      const avgScore = data.avgScore || 0;

      if (!qid || !answerNorm) continue;

      if (!candidatesByQid.has(qid)) {
        candidatesByQid.set(qid, []);
      }

      candidatesByQid.get(qid)!.push({
        answerNorm,
        freq,
        avgScore
      });
    }

    // Map を普通のオブジェクトに変換
    const candidatesObject: Record<string, Array<{
      answerNorm: string;
      freq: number;
      avgScore: number;
    }>> = {};

    for (const [qid, candidates] of candidatesByQid.entries()) {
      candidatesObject[qid] = candidates;
    }

    // public/candidates.json に書き込み
    const publicDir = path.join(process.cwd(), "public");
    const jsonPath = path.join(publicDir, "candidates.json");

    // public ディレクトリが存在しない場合は作成
    try {
      await fs.access(publicDir);
    } catch {
      await fs.mkdir(publicDir, { recursive: true });
    }

    await fs.writeFile(
      jsonPath,
      JSON.stringify(candidatesObject, null, 2),
      "utf-8"
    );

    // Vercel自動デプロイトリガー（DEPLOY_HOOKがある場合）
    const deployHook = process.env.VERCEL_DEPLOY_HOOK;
    let deployed = false;

    if (deployHook) {
      try {
        const deployRes = await fetch(deployHook, { method: "POST" });
        deployed = deployRes.ok;
      } catch (e) {
        console.warn("Deploy hook failed:", e);
      }
    }

    return res.json({
      ok: true,
      candidatesCount: snap.docs.length,
      qidsCount: candidatesByQid.size,
      filePath: jsonPath,
      deployed,
      message: deployed
        ? "Candidates exported and deployment triggered"
        : "Candidates exported to JSON (manual deploy needed)"
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    res.status(msg.includes("PERMISSION_DENIED") ? 403 : 500).json({ error: msg });
  }
}
