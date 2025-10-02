// 範囲選択ロジックの改善提案

// 1. 統一された範囲検証関数
function validateRange(startValue, endValue, min = 1, max = 330) {
    const start = parseInt(startValue, 10);
    const end = parseInt(endValue, 10);

    if (isNaN(start) || isNaN(end)) {
        return {
            valid: false,
            error: '有効な数値を入力してください。',
            correctedStart: min,
            correctedEnd: Math.min(50, max)
        };
    }

    if (start < min || end > max) {
        return {
            valid: false,
            error: `範囲は${min}〜${max}の間で設定してください。`,
            correctedStart: Math.max(start, min),
            correctedEnd: Math.min(end, max)
        };
    }

    if (start > end) {
        return {
            valid: false,
            error: '開始番号は終了番号以下である必要があります。',
            correctedStart: Math.min(start, end),
            correctedEnd: Math.max(start, end)
        };
    }

    return {
        valid: true,
        start: start,
        end: end
    };
}

// 2. 改善されたsetupWordQuiz関数
function setupWordQuizImproved() {
    const validation = validateRange(
        rangeStartInput.value,
        rangeEndInput.value
    );

    if (!validation.valid) {
        showErrorMessage(validation.error);
        if (validation.correctedStart !== undefined) {
            setProgrammaticValue(rangeStartInput, validation.correctedStart);
            setProgrammaticValue(rangeEndInput, validation.correctedEnd);
        }
        return;
    }

    quizSettings = {
        quizType: quizTypeSelect.value,
        rangeStart: validation.start,
        rangeEnd: validation.end,
        numQuestions: parseInt(numQuestionsInput.value, 10) || 10
    };

    const targetWords = allWords.filter(word =>
        word.group >= quizSettings.rangeStart && word.group <= quizSettings.rangeEnd
    );

    if (targetWords.length < 4) {
        showErrorMessage(
            `選択した範囲（${quizSettings.rangeStart}〜${quizSettings.rangeEnd}）では問題を作成できません。` +
            'より広い範囲を選択してください。'
        );
        return;
    }

    // 残りの処理...
}

// 3. 統一されたイベントハンドラー管理
function createRangeInputHandler(mode, setupFunction) {
    let timeoutId;
    return function() {
        if (ignoreNextInputEvent) return;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            if (appState.currentMode === mode) {
                setupFunction();
            }
        }, 300);
    };
}

// 4. より信頼性の高いプログラマティック値設定
function setProgrammaticValueImproved(element, value) {
    const originalHandler = element.oninput;
    element.oninput = null;
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // 次のイベントループで復元
    setTimeout(() => {
        element.oninput = originalHandler;
    }, 0);
}

// 5. データフィルタリングの安全性向上
function filterWordsByRange(words, rangeStart, rangeEnd) {
    if (!Array.isArray(words) || words.length === 0) {
        return [];
    }

    return words.filter(word => {
        const group = parseInt(word.group, 10);
        return !isNaN(group) && group >= rangeStart && group <= rangeEnd;
    });
}

// 6. エラーハンドリングの改善
function showImprovedErrorMessage(message, type = 'error') {
    const errorElement = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    errorText.textContent = message;
    errorElement.className = `mt-4 p-4 border rounded-lg ${
        type === 'warning'
            ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
            : 'bg-red-100 border-red-400 text-red-700'
    }`;

    errorElement.classList.remove('hidden');

    // 自動で隠す
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 5000);
}