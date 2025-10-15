// api/getQuestion.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireStaff } from "./_requireStaff.js";
import fs from "fs";
import path from "path";

// 1回だけ読み込んでメモリにキャッシュ
let QMAP: Map<string, any> | null = null;

function loadQuestionsOnce() {
  if (QMAP) return QMAP;
  const p = path.join(process.cwd(), "data", "kobun_q.jsonl.txt");
  if (!fs.existsSync(p)) throw new Error("Data file not found: kobun_q.jsonl.txt");

  const lines = fs.readFileSync(p, "utf-8").split(/\r?\n/).filter(Boolean);
  QMAP = new Map();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.qid) QMAP.set(String(obj.qid), obj);
    } catch {
      // 無視（壊れた行）
    }
  }
  return QMAP!;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireStaff(req);  // 教師のみ

    const q = String(req.query.qid || "");
    if (!q) return res.status(400).json({ error: "qid required (e.g. 4-2 or 4-2:1)" });

    // 形式: "4-2" or "4-2:1"（:以降は例文/サブインデックス想定）
    const [qid, sub] = q.split(":");
    const map = loadQuestionsOnce();
    const base = map.get(qid);
    if (!base) return res.status(404).json({ error: `qid not found: ${qid}` });

    // 必要ならサブ選択（なければ丸ごと返す）
    let payload = base;
    if (sub && base.examples && Array.isArray(base.examples)) {
      const idx = Number(sub);
      if (!Number.isNaN(idx) && base.examples[idx]) {
        payload = { ...base, exampleIndex: idx, example: base.examples[idx] };
      }
    }

    return res.status(200).json(payload);
  } catch (e: any) {
    const msg = String(e?.message || e);
    res.status(msg.includes("PERMISSION_DENIED") ? 403 : 500).json({ error: msg });
  }
}
