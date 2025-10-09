/**
 * 採点エンジン：形態素ベースのスコアリング＋接続規則違反ペナルティ
 */
import { tokenizeSense, morphKey } from "../utils/morphTokenizer";
import { validateConnections, ConnIssue } from "./validateConnectionsFromFile";

export interface GoldAnswer {
  /** 語幹の正規化形（lemma） */
  lemmaNorms: string[];
  /** 必須助動詞タグ（例: ["尊敬", "過去"]） */
  requiredAux: string[];
  /** 任意助動詞タグ（部分集合許容） */
  optionalAux: string[];
  /** 助詞のヒント（部分一致） */
  particlesNear: string[];
  /** 訳文ヒント（現代語訳に含まれるキーワード） */
  senseTags: string[];
}

export interface GradeResult {
  /** 正誤判定 */
  correct: boolean;
  /** スコア（0〜1） */
  score: number;
  /** スコア内訳 */
  breakdown: Record<string, number>;
  /** 説明メモ */
  notes: string[];
  /** 接続規則違反 */
  connIssues?: ConnIssue[];
}

/** スコア係数（カスタマイズ可能） - IIFE to avoid TDZ */
export const WEIGHTS = (() => {
  return {
    /** 語幹一致 */
    lemma: 0.5,
    /** 必須助動詞一致 */
    requiredAux: 0.25,
    /** 任意助動詞 */
    optionalAux: 0.15,
    /** 助詞ヒント */
    particles: 0.05,
    /** 訳文ヒント */
    sense: 0.05,
    /** 接続違反ペナルティ（最大0.3） */
    connPenaltyPerIssue: 0.1,
    connPenaltyMax: 0.3,
  };
})();

/**
 * 記述解答を採点
 */
export function gradeWithMorph(
  student: string,
  gold: GoldAnswer,
  modernHints: string[] = []
): GradeResult {
  const breakdown: Record<string, number> = {
    lemma: 0,
    requiredAux: 0,
    optionalAux: 0,
    particles: 0,
    sense: 0,
    connPenalty: 0,
  };
  const notes: string[] = [];

  // 生徒解答のトークン化
  const studentTokens = tokenizeSense(student, {
    ignoreParticles: false,
    allowAuxSubset: true,
  });
  const studentKey = morphKey(student);
  const studentAux = studentKey.aux;

  // 1. 語幹一致チェック
  const studentLemma = studentKey.content.lemma;
  if (gold.lemmaNorms.includes(studentLemma)) {
    breakdown.lemma = WEIGHTS.lemma;
    notes.push(`✓ 語幹一致: ${studentLemma}`);
  } else {
    notes.push(`✗ 語幹不一致: ${studentLemma} (期待: ${gold.lemmaNorms.join(", ")})`);
  }

  // 2. 必須助動詞チェック（すべて含む必要）
  const missingRequired = gold.requiredAux.filter((tag) => !studentAux.includes(tag));
  if (missingRequired.length === 0) {
    breakdown.requiredAux = WEIGHTS.requiredAux;
    notes.push(`✓ 必須助動詞すべて含む: ${gold.requiredAux.join(", ")}`);
  } else {
    const foundCount = gold.requiredAux.length - missingRequired.length;
    const ratio = gold.requiredAux.length > 0 ? foundCount / gold.requiredAux.length : 0;
    breakdown.requiredAux = WEIGHTS.requiredAux * ratio;
    notes.push(`✗ 必須助動詞不足: ${missingRequired.join(", ")}`);
  }

  // 3. 任意助動詞チェック（部分集合許容）
  const extraAux = studentAux.filter(
    (tag) => !gold.requiredAux.includes(tag) && !gold.optionalAux.includes(tag)
  );
  const matchedOptional = studentAux.filter((tag) => gold.optionalAux.includes(tag));
  if (extraAux.length === 0 && matchedOptional.length > 0) {
    breakdown.optionalAux = WEIGHTS.optionalAux;
    notes.push(`✓ 任意助動詞適切: ${matchedOptional.join(", ")}`);
  } else if (extraAux.length > 0) {
    notes.push(`△ 不要な助動詞: ${extraAux.join(", ")}`);
    breakdown.optionalAux = WEIGHTS.optionalAux * 0.5;
  }

  // 4. 助詞ヒントチェック
  const studentParticles = studentTokens
    .filter((t) => t.pos === "prt")
    .map((t) => t.surface);
  const matchedParticles = gold.particlesNear.filter((p) =>
    studentParticles.some((sp) => sp.includes(p))
  );
  if (matchedParticles.length > 0) {
    breakdown.particles = WEIGHTS.particles;
    notes.push(`✓ 助詞ヒント一致: ${matchedParticles.join(", ")}`);
  }

  // 5. 訳文ヒントチェック
  const matchedSense = gold.senseTags.filter((tag) =>
    modernHints.some((hint) => hint.includes(tag))
  );
  if (matchedSense.length > 0) {
    breakdown.sense = WEIGHTS.sense;
    notes.push(`✓ 訳文ヒント一致: ${matchedSense.join(", ")}`);
  }

  // 6. 接続規則違反チェック
  const connIssues = validateConnections(student);
  if (connIssues.length > 0) {
    const penalty = Math.min(
      connIssues.length * WEIGHTS.connPenaltyPerIssue,
      WEIGHTS.connPenaltyMax
    );
    breakdown.connPenalty = -penalty;
    notes.push(`✗ 接続規則違反: ${connIssues.length}件（-${(penalty * 100).toFixed(0)}%）`);
  } else {
    notes.push(`✓ 接続規則: 違反なし`);
  }

  // 7. 合計スコア計算
  const totalScore = Math.max(
    0,
    Object.values(breakdown).reduce((sum, val) => sum + val, 0)
  );

  // 8. 正誤判定（スコア0.7以上 かつ 接続違反なし）
  const correct = totalScore >= 0.7 && connIssues.length === 0;

  return {
    correct,
    score: totalScore,
    breakdown,
    notes,
    connIssues: connIssues.length > 0 ? connIssues : undefined,
  };
}

/**
 * 採点結果を人間が読みやすいテキストに整形
 */
export function formatGradeResult(result: GradeResult): string {
  const lines: string[] = [];

  lines.push(`判定: ${result.correct ? "✓ 正解" : "✗ 不正解"}`);
  lines.push(`スコア: ${(result.score * 100).toFixed(1)}%`);
  lines.push("");
  lines.push("内訳:");
  for (const [key, value] of Object.entries(result.breakdown)) {
    const percent = (value * 100).toFixed(1);
    const sign = value >= 0 ? "+" : "";
    lines.push(`  ${key}: ${sign}${percent}%`);
  }
  lines.push("");
  lines.push("詳細:");
  for (const note of result.notes) {
    lines.push(`  ${note}`);
  }

  if (result.connIssues && result.connIssues.length > 0) {
    lines.push("");
    lines.push("接続規則違反:");
    for (const issue of result.connIssues) {
      lines.push(`  • ${issue.token}: ${issue.rule}`);
      lines.push(`    期待: ${issue.where.expected || "—"}`);
      lines.push(`    実際: ${issue.where.found || "—"}`);
      if (issue.where.note) {
        lines.push(`    備考: ${issue.where.note}`);
      }
    }
  }

  return lines.join("\n");
}
