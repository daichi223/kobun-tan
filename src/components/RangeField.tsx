import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

interface RangeValue {
  from?: number;
  to?: number;
}

interface RangeFieldProps {
  value: RangeValue;
  onChange: (value: RangeValue) => void;
  min?: number;
  max?: number;
  className?: string;
  onRangeComplete?: () => void;
}

interface NumberInputProps {
  value?: number;
  localValue: string;
  onLocalChange: (value: string) => void;
  onConfirm: () => void;
  min: number;
  max: number;
  placeholder: string;
  readOnly: boolean;
  showNextButton: boolean;
  nextButtonText: string;
}

interface NumberInputRef {
  focus: () => void;
  select: () => void;
}

// アイコンコンポーネント
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,18 15,12 9,6"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20,6 9,17 4,12"></polyline>
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const MinusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

// ステッパーボタンコンポーネント
function StepperButton({
  onClick,
  disabled,
  children,
  className = ""
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startRepeating = useCallback(() => {
    if (disabled) return;

    onClick(); // 初回実行
    setIsPressed(true);

    // 300ms後から連続実行開始（初期速度：150ms間隔）
    timeoutRef.current = window.setTimeout(() => {
      let interval = 150;
      const accelerate = () => {
        intervalRef.current = window.setInterval(() => {
          onClick();
          // 1秒後から徐々に高速化（最低50ms間隔まで）
          if (interval > 50) {
            clearInterval(intervalRef.current!);
            interval = Math.max(50, interval - 20);
            accelerate();
          }
        }, interval);
      };
      accelerate();
    }, 300);
  }, [onClick, disabled]);

  const stopRepeating = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPressed(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startRepeating();
  }, [startRepeating]);

  const handlePointerUp = useCallback(() => {
    stopRepeating();
  }, [stopRepeating]);

  const handlePointerCancel = useCallback(() => {
    stopRepeating();
  }, [stopRepeating]);

  const handleBlur = useCallback(() => {
    stopRepeating();
  }, [stopRepeating]);

  // グローバルイベントでのクリーンアップ
  useEffect(() => {
    const handleGlobalPointerUp = () => stopRepeating();

    if (isPressed) {
      document.addEventListener('pointerup', handleGlobalPointerUp);
      document.addEventListener('pointercancel', handleGlobalPointerUp);
    }

    return () => {
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerUp);
      stopRepeating();
    };
  }, [isPressed, stopRepeating]);

  return (
    <button
      type="button"
      className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium transition select-none ${
        disabled
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : isPressed
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50 hover:border-blue-400 active:bg-blue-100'
      } ${className}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onBlur={handleBlur}
      disabled={disabled}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
}

// 数値入力コンポーネント
const NumberInput = forwardRef<NumberInputRef, NumberInputProps>(function NumberInput({
  value,
  localValue,
  onLocalChange,
  onConfirm,
  min,
  max,
  placeholder,
  readOnly,
  showNextButton,
  nextButtonText
}, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    select: () => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  }), []);

  // 300msデバウンスで再選択を抑制
  const selectWithDebounce = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    const input = e.currentTarget;

    // まだactiveElementでない場合のみpreventDefault
    if (document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      // 次フレームで全選択
      requestAnimationFrame(() => {
        selectWithDebounce();
      });
    }
  }, [selectWithDebounce]);

  const handleFocus = useCallback(() => {
    // フォーカス時は必ず全選択
    selectWithDebounce();
  }, [selectWithDebounce]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    onLocalChange(inputValue);
  }, [onLocalChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }

    // PCのホイール対策は別途onWheelで処理
  }, [onConfirm]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    // PCでのホイールによる値変更を防ぐ
    e.preventDefault();
  }, []);

  const increment = useCallback(() => {
    const currentNum = parseInt(localValue) || 0;
    const newValue = Math.min(currentNum + 1, max);
    onLocalChange(String(newValue));
  }, [localValue, max, onLocalChange]);

  const decrement = useCallback(() => {
    const currentNum = parseInt(localValue) || 0;
    const newValue = Math.max(currentNum - 1, min);
    onLocalChange(String(newValue));
  }, [localValue, min, onLocalChange]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const currentNum = parseInt(localValue) || 0;
  const isMinDisabled = currentNum <= min;
  const isMaxDisabled = currentNum >= max;

  return (
    <div className="flex items-center space-x-1">
      {/* 入力フィールド */}
      <div className="relative">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="done"
          value={localValue}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-12 h-8 px-1 text-center text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            readOnly
              ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
              : 'bg-white text-slate-900 border-slate-300'
          }`}
          style={{
            MozAppearance: 'textfield', // Firefox でのスピンボタンを非表示
            WebkitAppearance: 'none' // Chrome/Safari でのスピンボタンを非表示
          }}
        />
      </div>

      {/* ±ボタン */}
      <div className="flex space-x-1">
        <StepperButton onClick={decrement} disabled={readOnly || isMinDisabled}>
          <MinusIcon />
        </StepperButton>
        <StepperButton onClick={increment} disabled={readOnly || isMaxDisabled}>
          <PlusIcon />
        </StepperButton>
      </div>

      {/* 次へ/確定ボタン */}
      {showNextButton && (
        <button
          type="button"
          onClick={onConfirm}
          className="w-6 h-6 flex items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 transition"
          title={nextButtonText}
        >
          {nextButtonText === '次へ' ? <ChevronRightIcon /> : <CheckIcon />}
        </button>
      )}
    </div>
  );
});

// メインのRangeFieldコンポーネント
export default function RangeField({
  value,
  onChange,
  min = 1,
  max = 330,
  className = '',
  onRangeComplete
}: RangeFieldProps) {
  // ローカル文字列状態
  const [fromLocal, setFromLocal] = useState('');
  const [toLocal, setToLocal] = useState('');

  // 確定状態
  const [fromConfirmed, setFromConfirmed] = useState(false);
  const [toConfirmed, setToConfirmed] = useState(false);

  // フォーカス参照
  const toInputRef = useRef<NumberInputRef>(null);

  // 非アクティブ時の同期（親状態の変更を反映）
  useEffect(() => {
    // from が確定されていない場合のみ同期
    if (!fromConfirmed) {
      setFromLocal(value.from !== undefined ? String(value.from) : '');
    }
  }, [value.from, fromConfirmed]);

  useEffect(() => {
    // to が確定されていない場合のみ同期
    if (!toConfirmed) {
      setToLocal(value.to !== undefined ? String(value.to) : '');
    }
  }, [value.to, toConfirmed]);

  // from確定処理
  const handleFromConfirm = useCallback(() => {
    const num = parseInt(fromLocal);
    if (!isNaN(num)) {
      const clampedValue = Math.max(min, Math.min(max, num));
      setFromLocal(String(clampedValue));
      setFromConfirmed(true);

      // 親にfromをコミット
      onChange({ ...value, from: clampedValue });

      // 次フレームでtoにフォーカス&全選択
      requestAnimationFrame(() => {
        if (toInputRef.current) {
          toInputRef.current.focus();
          toInputRef.current.select();
        }
      });
    }
  }, [fromLocal, min, max, value, onChange]);

  // to確定処理
  const handleToConfirm = useCallback(() => {
    const num = parseInt(toLocal);
    if (!isNaN(num)) {
      const clampedValue = Math.max(min, Math.min(max, num));
      setToLocal(String(clampedValue));
      setToConfirmed(true);

      // 親にtoをコミット（まだswapしない）
      const newValue = { ...value, to: clampedValue };
      onChange(newValue);

      // 最終確定処理
      handleFinalConfirm(value.from, clampedValue);
    }
  }, [toLocal, min, max, value, onChange]);

  // 最終確定処理
  const handleFinalConfirm = useCallback((fromVal?: number, toVal?: number) => {
    if (fromVal !== undefined && toVal !== undefined) {
      // from > to の場合のみ入替
      const finalFrom = fromVal > toVal ? toVal : fromVal;
      const finalTo = fromVal > toVal ? fromVal : toVal;

      // 親に最終値をコミット
      onChange({ from: finalFrom, to: finalTo });

      // fromのreadOnlyを解除
      setFromConfirmed(false);
      setToConfirmed(false);

      // ローカル状態も更新
      setFromLocal(String(finalFrom));
      setToLocal(String(finalTo));

      // 範囲完了コールバック（選択肢エリアに移動）
      if (onRangeComplete) {
        setTimeout(() => onRangeComplete(), 100);
      }
    }
  }, [onChange, onRangeComplete]);

  // 手動最終確定ボタン（to入力後に表示）
  const handleManualFinalConfirm = useCallback(() => {
    handleFinalConfirm(value.from, value.to);
  }, [handleFinalConfirm, value.from, value.to]);

  return (
    <div className={`${className}`}>
      {/* 横並びレイアウト */}
      <div className="flex flex-wrap items-center gap-2 justify-start">
        {/* 開始値 */}
        <div className="flex items-center space-x-1">
          <label className="text-xs text-slate-600 whitespace-nowrap">開始</label>
          <NumberInput
            value={value.from}
            localValue={fromLocal}
            onLocalChange={setFromLocal}
            onConfirm={handleFromConfirm}
            min={min}
            max={max}
            placeholder={String(min)}
            readOnly={fromConfirmed}
            showNextButton={!fromConfirmed && fromLocal.trim() !== ''}
            nextButtonText="次へ"
          />
        </div>

        {/* 終了値 */}
        <div className="flex items-center space-x-1">
          <label className="text-xs text-slate-600 whitespace-nowrap">終了</label>
          <NumberInput
            ref={toInputRef}
            value={value.to}
            localValue={toLocal}
            onLocalChange={setToLocal}
            onConfirm={handleToConfirm}
            min={min}
            max={max}
            placeholder={String(max)}
            readOnly={toConfirmed}
            showNextButton={fromConfirmed && !toConfirmed && toLocal.trim() !== ''}
            nextButtonText="確定"
          />
        </div>

        {/* 手動最終確定ボタン（toが確定済みで表示） */}
        {toConfirmed && !fromConfirmed && (
          <button
            type="button"
            onClick={handleManualFinalConfirm}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
          >
            確定
          </button>
        )}
      </div>

    </div>
  );
}