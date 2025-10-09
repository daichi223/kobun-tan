#!/usr/bin/env node
/**
 * CLI デモ：古文記述解答の判定
 * 使い方: npx tsx scripts/demo.ts --jp "悲しきこと" --student "悲しきこと"
 */
import { gradeWithMorph, formatGradeResult, GoldAnswer } from "../src/lib/gradeWithMorph";
import { validateConnections, describeIssues } from "../src/lib/validateConnectionsFromFile";

function parseArgs(): { jp: string; student: string } {
  const args = process.argv.slice(2);
  let jp = "";
  let student = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--jp" && i + 1 < args.length) {
      jp = args[i + 1];
      i++;
    } else if (args[i] === "--student" && i + 1 < args.length) {
      student = args[i + 1];
      i++;
    }
  }

  return { jp, student };
}

function main() {
  const { jp, student } = parseArgs();

  if (!jp || !student) {
    console.error("使い方: npx tsx scripts/demo.ts --jp <例文> --student <生徒解答>");
    console.error('例: npx tsx scripts/demo.ts --jp "悲しきこと" --student "悲しきこと"');
    process.exit(1);
  }

  console.log("=== 古文記述解答判定デモ ===\n");
  console.log(`例文:     ${jp}`);
  console.log(`生徒解答: ${student}\n`);

  // 1. 接続規則チェックのみ
  console.log("--- 接続規則チェック ---");
  const issues = validateConnections(student);
  console.log(describeIssues(issues));
  console.log();

  // 2. 採点（簡易版：語幹を例文から推定）
  console.log("--- 採点結果 ---");
  const gold: GoldAnswer = {
    lemmaNorms: [jp.replace(/[ぁ-ゖ]{1,2}$/, "い")], // 簡易的に語幹を推定
    requiredAux: [],
    optionalAux: [],
    particlesNear: [],
    senseTags: [],
  };

  const result = gradeWithMorph(student, gold);
  console.log(formatGradeResult(result));
}

main();
