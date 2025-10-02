# 範囲入力欄値混在問題 - 包括的テスト計画

## 1. 基本機能テスト

### 1.1 単独入力テスト
- **テスト1**: 範囲開始欄に正常値（1-100）を入力
- **テスト2**: 範囲終了欄に正常値（1-100）を入力
- **テスト3**: 問題数欄に正常値（1-50）を入力
- **期待結果**: 入力値が他の欄に混在しないこと

### 1.2 連続入力テスト
- **テスト4**: 開始→終了→問題数の順で連続入力
- **テスト5**: 終了→開始→問題数の順で連続入力
- **テスト6**: 問題数→開始→終了の順で連続入力
- **期待結果**: 各入力が正しい欄に保持されること

### 1.3 高速入力テスト（値混在再現テスト）
- **テスト7**: 開始欄に50入力後、即座に終了欄に200入力
- **テスト8**: 終了欄に40設定後、開始欄に200の「2」まで入力
- **期待結果**: 問題報告のシナリオが発生しないこと

## 2. ブラウザ間互換性テスト

### 2.1 Chrome
- バージョン: 最新安定版
- 特記事項: `input`イベント発火タイミング

### 2.2 Firefox
- バージョン: 最新安定版
- 特記事項: `requestAnimationFrame`実行順序

### 2.3 Safari
- バージョン: 最新安定版
- 特記事項: `setTimeout`最小遅延差異

### 2.4 Edge
- バージョン: 最新安定版
- 特記事項: DOM操作の並行処理

## 3. パフォーマンステスト

### 3.1 応答性テスト
- 入力後のクイズ再生成時間: 500ms以内
- デバウンス処理の適切性
- UIフリーズの有無

### 3.2 メモリリークテスト
- 長時間使用での状態管理メモリ使用量
- イベントリスナーの適切な管理

## 4. ユーザビリティテスト

### 4.1 操作性テスト
- タブ切り替え時の値保持
- フォーカス移動時の挙動
- キーボードナビゲーション

### 4.2 エラーハンドリングテスト
- 無効値入力時の処理
- 範囲外値の自動調整
- エラーメッセージの適切性

## 5. セキュリティテスト

### 5.1 入力検証テスト
- XSS攻撃耐性
- 異常値投入テスト
- DOM操作の安全性

## 6. 回帰テスト

### 6.1 既存機能確認
- クイズ機能の正常動作
- 多義語モードの動作
- 結果表示の正確性

## 7. 自動テストスクリプト

```javascript
// 自動テスト実行用スクリプト（ブラウザコンソールで実行）
function runAutomatedTests() {
    console.log('=== 範囲入力欄テスト開始 ===');

    // テスト1: 基本入力テスト
    function testBasicInput() {
        const startInput = document.getElementById('range-start');
        const endInput = document.getElementById('range-end');
        const numInput = document.getElementById('num-questions');

        // 値をクリア
        startInput.value = '';
        endInput.value = '';
        numInput.value = '';

        // 値を設定
        startInput.value = '10';
        startInput.dispatchEvent(new Event('input', { bubbles: true }));

        setTimeout(() => {
            endInput.value = '50';
            endInput.dispatchEvent(new Event('input', { bubbles: true }));

            setTimeout(() => {
                numInput.value = '15';
                numInput.dispatchEvent(new Event('input', { bubbles: true }));

                // 検証
                setTimeout(() => {
                    const results = {
                        start: startInput.value,
                        end: endInput.value,
                        num: numInput.value
                    };

                    console.log('基本入力テスト結果:', results);
                    const passed = results.start === '10' &&
                                  results.end === '50' &&
                                  results.num === '15';
                    console.log('基本入力テスト:', passed ? 'PASS' : 'FAIL');

                    if (!passed) {
                        console.error('値混在が発生しました:', results);
                    }
                }, 500);
            }, 100);
        }, 100);
    }

    // テスト2: 高速入力テスト（問題再現テスト）
    function testRapidInput() {
        console.log('高速入力テスト開始');
        const startInput = document.getElementById('range-start');
        const endInput = document.getElementById('range-end');

        startInput.value = '';
        endInput.value = '';

        // 問題報告のシナリオを再現
        startInput.value = '50';
        startInput.dispatchEvent(new Event('input', { bubbles: true }));

        // 即座に終了欄に入力
        setTimeout(() => {
            endInput.value = '2'; // 200の途中
            endInput.dispatchEvent(new Event('input', { bubbles: true }));

            setTimeout(() => {
                endInput.value = '20';
                endInput.dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                    endInput.value = '200';
                    endInput.dispatchEvent(new Event('input', { bubbles: true }));

                    // 結果確認
                    setTimeout(() => {
                        const results = {
                            start: startInput.value,
                            end: endInput.value
                        };

                        console.log('高速入力テスト結果:', results);
                        const passed = results.start === '50' && results.end === '200';
                        console.log('高速入力テスト:', passed ? 'PASS' : 'FAIL');

                        if (!passed) {
                            console.error('値混在が検出されました:', results);
                        }
                    }, 1000);
                }, 50);
            }, 50);
        }, 10);
    }

    // テスト実行
    testBasicInput();
    setTimeout(testRapidInput, 2000);

    console.log('テスト実行中... 結果は数秒後に表示されます');
}

// テスト実行コマンド
// runAutomatedTests();
```

## 8. 将来的問題防止策

### 8.1 開発プロセス改善
- コードレビュー時の状態管理チェック
- 入力処理の設計パターン標準化
- 継続的インテグレーション導入

### 8.2 監視・アラート
- ユーザー入力異常の検出システム
- パフォーマンス監視
- エラーログ分析

### 8.3 ドキュメント整備
- 状態管理設計書の作成
- トラブルシューティングガイド
- 開発者向けベストプラクティス