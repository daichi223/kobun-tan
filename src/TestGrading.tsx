/**
 * 採点機能のテストページ
 */
import React, { useEffect, useState } from 'react';
import { loadItems, Item } from './data/loadItems';
import { ScoringPanel } from './components/ScoringPanel';
import { gradeMeaning } from './scoring/gradeMeaning';

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
      ["身分が低い", "身分の低い", 100],
      ["身分が低い", "地位が低い", 100],
      ["身分が低い", "身分が高い", 60], // 反義で減点

      // 完了・否定テスト
      ["行きぬ", "行った", 80], // 完了同義
      ["行かず", "行った", 50], // 否定⇔肯定で大幅減点
      ["行かず", "行かない", 80], // 否定一致

      // ba_condition テスト
      ["行けば", "行くなら", 70, { ba_condition: "確定" }], // 確定なのに「なら」で減点
      ["行かば", "行くなら", 90, { ba_condition: "仮定" }], // 仮定で「なら」は適切
    ];

    const results: string[] = [];
    for (const [gold, answer, expectedMin, opts] of tests) {
      const result = await gradeMeaning(gold, answer, opts);
      const pass = result.score >= expectedMin;
      const feedbackStr = result.feedback.length > 0 ? ` (${result.feedback[0]})` : '';
      results.push(
        `${pass ? '✓' : '✗'} "${answer}" → ${result.score}点 (期待: ${expectedMin}点以上)${feedbackStr}`
      );
    }
    setTestResults(results);
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
