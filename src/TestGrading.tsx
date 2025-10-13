/**
 * 採点機能のテストページ
 */
import React, { useEffect, useState } from 'react';
import { loadItems, Item } from './data/loadItems';
import { ScoringPanel } from './components/ScoringPanel';
import { gradeMeaning } from './scoring/gradeMeaning';
import { gradeMeaningSimple } from './scoring/gradeMeaningSimple';

export function TestGrading() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  useEffect(() => {
    loadItems()
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const runTests = async () => {
    const tests: [string, string, number, any?][] = [
      // おぼゆの問題例
      ["祈り", "祈り", 100],                           // 完全一致
      ["祈り", "いのり", 100],                         // 表記ゆれ
      ["がまんし", "がまんする", 90],                  // 活用形違い（正規化で吸収）
      ["思われ", "おもわれる", 90],                    // 平仮名⇔漢字
      ["思われ", "思われる", 90],                      // 連用形⇔終止形
      ["似", "似た", 90],                              // 完了助動詞の有無（-10点）
      ["思い出される", "覚えている", 60],              // 意味は近いが語彙違い

      // ののしるの問題例
      ["大騒ぎする", "大騒ぎ", 60],                    // サ変動詞の名詞形（する補完）
      ["評判になっ", "評判になる", 90],                // 複合動詞の活用形統一
      ["評判になる", "評判になる", 100],               // 完全一致

      // 完了・否定テスト
      ["行かず", "行った", 50],                        // 否定⇔肯定で-30点
      ["行かず", "行かない", 90],                      // 否定一致

      // ba_condition テスト
      ["行けば", "行くなら", 70, { ba_condition: "確定" }], // 確定で「なら」は-20点
      ["行かば", "行くなら", 90, { ba_condition: "仮定" }], // 仮定で「なら」は適切
    ];

    const results: string[] = [];
    console.log("\n=== 新採点システム（シンプル版）===");

    try {
      for (const [gold, answer, expectedMin, opts] of tests) {
        const resultSimple = await gradeMeaningSimple(gold, answer, opts);
        const pass = resultSimple.score >= expectedMin;
        const feedbackStr = resultSimple.feedback[0] || "";

        console.log(`"${gold}" vs "${answer}"`);
        console.log(`  正規化: "${resultSimple.normalized.gold}" vs "${resultSimple.normalized.answer}"`);
        console.log(`  スコア: ${resultSimple.score}点 (類似度: ${resultSimple.breakdown.baseSimilarity}, ペナルティ: ${resultSimple.breakdown.penalty})`);
        console.log(`  判定: ${pass ? '✓' : '✗'} (期待: ${expectedMin}点以上)`);

        results.push(
          `${pass ? '✓' : '✗'} "${gold}" → "${answer}" = ${resultSimple.score}点 (期待: ${expectedMin}以上) ${feedbackStr}`
        );
      }
      setTestResults(results);
    } catch (err) {
      console.error('テスト実行エラー:', err);
      setTestResults([`❌ エラー: ${err instanceof Error ? err.message : String(err)}`]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">データを読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
          <p className="text-red-700">エラー: {error}</p>
          <p className="text-sm text-red-600 mt-2">
            public/out/kobun_sense_window.jsonl が存在することを確認してください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">採点機能テスト</h1>

        {/* テスト実行ボタン */}
        <div className="mb-8">
          <button
            onClick={runTests}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg"
          >
            受け入れテストを実行
          </button>
          {testResults.length > 0 && (
            <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-bold text-slate-800 mb-2">テスト結果</h3>
              <ul className="space-y-1 text-sm font-mono">
                {testResults.map((result, idx) => (
                  <li key={idx} className={result.startsWith('✓') ? 'text-green-600' : 'text-red-600'}>
                    {result}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 採点パネル */}
        {items.length > 0 ? (
          <ScoringPanel item={items[0]} />
        ) : (
          <p className="text-slate-600">データがありません</p>
        )}
      </div>
    </div>
  );
}
