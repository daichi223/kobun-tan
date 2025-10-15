// src/pages/Teacher.tsx
import { useEffect, useMemo, useState } from "react";

function getToken(): string | null {
  // URL ?token=... → localStorage 保存（次回からURLに出さなくてOK）
  const u = new URL(window.location.href);
  const q = u.searchParams.get("token");
  if (q) {
    localStorage.setItem("ADMIN_VIEW_TOKEN", q);
    // URLからtokenを消す（戻る対策に replaceState）
    u.searchParams.delete("token");
    window.history.replaceState(null, "", u.toString());
    return q;
  }
  return localStorage.getItem("ADMIN_VIEW_TOKEN");
}

async function callAPI(path: string, body?: any) {
  const tok = getToken();
  if (!tok) throw new Error("NO_TOKEN");
  const headers: any = { "Content-Type": "application/json", "x-admin-token": tok };
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Teacher() {
  const token = useMemo(getToken, []);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<{[qid: string]: any}>({});

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("このページを見るには token が必要です。URL末尾に ?token=xxxx を付けてアクセスしてください。");
        const data = await callAPI("/api/listRecentAnswers?limit=50");
        setRows(data);
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const doOverride = async (id: string, label: "OK" | "NG" | null) => {
    try {
      await callAPI("/api/overrideAnswer", { answerId: id, result: label });
      setRows(rs => rs.map(r => r.id === id ? {
        ...r,
        final: label === null
          ? { ...r.raw?.auto, source: "auto" }
          : { result: label, source: "manual", reason: "teacher_override" }
      } : r));
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };

  const addOverrideRule = async (qid: string, answerRaw: string) => {
    try {
      await callAPI("/api/upsertOverride", { qid, answerRaw, label: "OK", active: true });
      alert("辞書に登録しました（同型を一括置換）");
      // Refresh data
      const data = await callAPI("/api/listRecentAnswers?limit=50");
      setRows(data);
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    }
  };

  const toggleRow = async (id: string, qid: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
      if (!questionData[qid]) {
        try {
          const data = await callAPI(`/api/getQuestion?qid=${qid}`);
          setQuestionData(prev => ({ ...prev, [qid]: data }));
        } catch (e: any) {
          console.error(`Failed to load question data: ${e.message}`);
        }
      }
    }
  };

  if (err) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {err}
      </div>
    </div>
  );

  if (loading) return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="text-center text-slate-600">読み込み中...</div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">教師用管理画面（共有トークン）</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">問題</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">回答</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">判定</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((r: any) => (
              <>
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600 font-mono">
                    <button
                      onClick={() => toggleRow(r.id, r.raw?.qid)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {expandedRow === r.id ? "▼" : "▶"}
                    </button>
                    {" "}{r.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.raw?.qid}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.raw?.answerRaw}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      r.final?.result === "OK" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {r.final?.result}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">({r.final?.source})</span>
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => doOverride(r.id, "OK")}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => doOverride(r.id, "NG")}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition"
                    >
                      NG
                    </button>
                    <button
                      onClick={() => doOverride(r.id, null)}
                      className="px-3 py-1 bg-slate-500 hover:bg-slate-600 text-white text-xs rounded transition"
                    >
                      自動へ
                    </button>
                    <button
                      onClick={() => addOverrideRule(r.raw?.qid, r.raw?.answerRaw)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                    >
                      辞書登録
                    </button>
                  </td>
                </tr>
                {expandedRow === r.id && questionData[r.raw?.qid] && (
                  <tr key={`${r.id}-detail`}>
                    <td colSpan={5} className="px-4 py-4 bg-slate-50">
                      <div className="space-y-3">
                        {/* 基本情報 */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-slate-700">見出し語: </span>
                            <span className="text-slate-900">{questionData[r.raw?.qid].lemma}</span>
                          </div>
                          <div>
                            <span className="font-medium text-slate-700">意味: </span>
                            <span className="text-slate-900">{questionData[r.raw?.qid].sense}</span>
                          </div>
                        </div>

                        {/* 生徒の自己判定 */}
                        {r.userCorrection && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-3">
                            <span className="font-medium text-blue-800">生徒の判定: </span>
                            <span className={`font-bold ${r.userCorrection.result === 'OK' ? 'text-green-700' : 'text-red-700'}`}>
                              {r.userCorrection.result === 'OK' ? '✓ 正解' : '✗ 不正解'}
                            </span>
                            <span className="text-xs text-blue-600 ml-2">
                              ({new Date(r.userCorrection.at._seconds * 1000).toLocaleString('ja-JP')})
                            </span>
                          </div>
                        )}

                        {/* 例文 */}
                        {questionData[r.raw?.qid].examples?.length > 0 && (
                          <div>
                            <span className="font-medium text-slate-700">例文:</span>
                            <div className="ml-4 mt-2 space-y-2">
                              {questionData[r.raw?.qid].examples.map((ex: any, i: number) => (
                                <div key={i} className="bg-white p-3 rounded border border-slate-200">
                                  <div className="text-sm text-slate-800 mb-1">{ex.jp}</div>
                                  <div className="text-xs text-slate-600">{ex.translation}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 自動採点情報 */}
                        {r.raw?.auto && (
                          <div className="text-xs text-slate-500 pt-2 border-t">
                            <span>自動採点: {r.raw.auto.score}点 ({r.raw.auto.reason})</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          回答データがありません
        </div>
      )}
    </div>
  );
}
