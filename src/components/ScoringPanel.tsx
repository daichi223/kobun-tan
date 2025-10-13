/**
 * 採点パネルUI
 */
import React, { useState } from 'react';
import { Item } from '../data/loadItems';
import { gradeMeaning, GradeResult } from '../scoring/gradeMeaning';

interface ScoringPanelProps {
  item: Item;
}

export function ScoringPanel({ item }: ScoringPanelProps) {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const handleGrade = async () => {
    if (!answer.trim()) {
      alert('回答を入力してください');
      return;
    }

    setIsGrading(true);
    try {
      const gradeResult = await gradeMeaning(item.translation, answer);
      setResult(gradeResult);
    } catch (error) {
      console.error('採点エラー:', error);
      alert('採点中にエラーが発生しました');
    } finally {
      setIsGrading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBaConditionNote = () => {
    if (item.ba_condition === '確定') {
      return '⚠️ 已然形＋ば（確定）の用法です';
    }
    if (item.ba_condition === '仮定') {
      return 'ℹ️ 未然形＋ば（仮定）の用法です';
    }
    return null;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* 問題表示 */}
      <div className="mb-6">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">見出し語</h3>
          <p className="text-2xl font-bold text-slate-800">{item.lemma}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">古文例文</h3>
          <p className="text-lg text-slate-700">{item.jp}</p>
        </div>

        {getBaConditionNote() && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">{getBaConditionNote()}</p>
          </div>
        )}

        <div className="mb-4">
          <h3 className="text-sm font-medium text-slate-600 mb-2">正解（参考用）</h3>
          <p className="text-base text-slate-600 italic">{item.translation}</p>
        </div>
      </div>

      {/* 回答入力 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          あなたの回答（意味を記述してください）
        </label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full p-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          placeholder="この古文の意味を現代語で記述してください"
          disabled={isGrading}
        />
      </div>

      {/* 採点ボタン */}
      <div className="mb-6">
        <button
          onClick={handleGrade}
          disabled={isGrading || !answer.trim()}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-lg transition"
        >
          {isGrading ? '採点中...' : '採点する'}
        </button>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">採点結果</h3>

          {/* スコア */}
          <div className="text-center mb-6">
            <p className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
              {result.score}点
            </p>
          </div>

          {/* 内訳 */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-700 mb-2">スコア内訳</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>概念（名詞）:</span>
                <span className="font-medium">{result.breakdown.concept}点</span>
              </div>
              <div className="flex justify-between">
                <span>述語（形容詞）:</span>
                <span className="font-medium">{result.breakdown.predicate}点</span>
              </div>
              <div className="flex justify-between">
                <span>構文パターン:</span>
                <span className="font-medium">{result.breakdown.pattern}点</span>
              </div>
              {result.breakdown.penalty !== 0 && (
                <div className="flex justify-between text-red-600">
                  <span>ペナルティ:</span>
                  <span className="font-medium">{result.breakdown.penalty}点</span>
                </div>
              )}
            </div>
          </div>

          {/* フィードバック */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">フィードバック</h4>
            <ul className="space-y-1 text-sm text-slate-600">
              {result.feedback.map((fb, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{fb}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
