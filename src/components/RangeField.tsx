import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';

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

interface StepperProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  label: string;
  fieldDisabled?: boolean;
}

// ステッパーコンポーネント（長押し対応）
function Stepper({ value, onChange, min, max, label, fieldDisabled = false }: StepperProps) {
  const [isPressed, setIsPressed] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clampValue = (val: number) => Math.max(min, Math.min(max, val));

  const increment = useCallback(() => {
    const currentValue = value ?? min;
    onChange(clampValue(currentValue + 1));
  }, [value, min, max, onChange]);

  const decrement = useCallback(() => {
    const currentValue = value ?? min;
    onChange(clampValue(currentValue - 1));
  }, [value, min, max, onChange]);

  const startRepeating = useCallback(() => {
    const action = label === '+' ? increment : decrement;

    // 最初のクリック
    action();

    // 500ms後から連続実行開始
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(action, 100);
    }, 500);
  }, [label, increment, decrement]);

  const stopRepeating = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPressed(false);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault(); // 長押しルーペ機能との干渉防止
    setIsPressed(true);
    startRepeating();
  }, [startRepeating]);

  const handlePointerUp = useCallback(() => {
    stopRepeating();
  }, [stopRepeating]);

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

  const currentValue = value ?? min;
  const isMinDisabled = currentValue <= min;
  const isMaxDisabled = currentValue >= max;
  const isDisabled = fieldDisabled || (label === '-' ? isMinDisabled : isMaxDisabled);

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      disabled={isDisabled}
      className={`w-8 h-8 rounded border text-sm font-medium transition select-none touch-none ${
        isDisabled
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : isPressed
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600 active:bg-blue-700'
      }`}
    >
      {label}
    </button>
  );
}

// 数値入力フィールド（iOS Safari対応）
interface NumberInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  placeholder: string;
  onComplete?: () => void;
  disabled?: boolean;
  onRangeComplete?: () => void;
}

interface NumberInputRef {
  focus: () => void;
}

const NumberInput = forwardRef<NumberInputRef, NumberInputProps>(
  ({ value, onChange, min, max, placeholder, onComplete, disabled = false, onRangeComplete }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    }), []);

  // iOS Safari対応の自動全選択
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    // iOS Safari安定のためpointerDownでも全選択
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (inputValue === '') {
      onChange(undefined);
      return;
    }

    const num = parseInt(inputValue, 10);
    if (!isNaN(num)) {
      const clampedValue = Math.max(min, Math.min(max, num));
      onChange(clampedValue);

      // 三桁入力（100以上）の場合は即座に完了
      if (clampedValue >= 100) {
        if (onComplete) {
          setTimeout(() => onComplete(), 100);
        }
      } else {
        // 三桁未満の場合は1.5秒のタイマー設定
        timeoutRef.current = window.setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 1500);
      }
    }
  }, [onChange, min, max, onComplete]);

  // コンポーネントがアンマウントされる際にタイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(undefined);
    // クリア後はフォーカスを戻さない（チラつき防止）
  }, [onChange]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full p-2 border border-slate-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8 ${
          disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
        }`}
      />
      {value !== undefined && !disabled && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
        >
          ×
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
  const fromInputRef = useRef<NumberInputRef>(null);
  const toInputRef = useRef<NumberInputRef>(null);
  const [isFromConfirmed, setIsFromConfirmed] = useState(false);
  const [isToConfirmed, setIsToConfirmed] = useState(false);
  const [inputPhase, setInputPhase] = useState<'from' | 'to' | 'complete'>('from');

  // from値の変更処理
  const handleFromChange = useCallback((from: number | undefined) => {
    const newValue = { ...value, from };
    onChange(newValue);

    // フェーズが'complete'の場合のみ、相手のロックを解除して新しいサイクルを開始
    if (inputPhase === 'complete') {
      setIsToConfirmed(false);
      setInputPhase('from');
    }
  }, [value, onChange, inputPhase]);

  // to値の変更処理
  const handleToChange = useCallback((to: number | undefined) => {
    const newValue = { ...value, to };
    onChange(newValue);

    // フェーズが'complete'の場合のみ、相手のロックを解除して新しいサイクルを開始
    if (inputPhase === 'complete') {
      setIsFromConfirmed(false);
      setInputPhase('to');
    }
  }, [value, onChange, inputPhase]);

  // from入力完了時の処理（自動フォーカス移動と確定）
  const handleFromComplete = useCallback(() => {
    if (value.from !== undefined && inputPhase === 'from') {
      setIsFromConfirmed(true);
      setInputPhase('to');
      // 少し遅延してtoフィールドにフォーカス
      setTimeout(() => {
        toInputRef.current?.focus();
      }, 100);
    }
  }, [value.from, inputPhase]);

  // to入力完了時の処理（範囲完了）
  const handleToComplete = useCallback(() => {
    if (value.to !== undefined && inputPhase === 'to') {
      setIsToConfirmed(true);
      setInputPhase('complete');

      // 両方の値が設定されている場合、選択肢エリアに移動
      if (value.from !== undefined && onRangeComplete) {
        setTimeout(() => {
          onRangeComplete();
        }, 100);
      }
    }
  }, [value.to, value.from, inputPhase, onRangeComplete]);

  // 範囲をクリア
  const handleClear = useCallback(() => {
    setIsFromConfirmed(false);
    setIsToConfirmed(false);
    setInputPhase('from');
    onChange({ from: undefined, to: undefined });
    // クリア後はfromフィールドにフォーカス
    setTimeout(() => {
      fromInputRef.current?.focus();
    }, 100);
  }, [onChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 入力フィールドエリア */}
      <div className="grid grid-cols-2 gap-3">
        {/* 開始値 */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">
            開始 {isFromConfirmed && <span className="text-green-600">✓</span>}
          </label>
          <NumberInput
            ref={fromInputRef}
            value={value.from}
            onChange={handleFromChange}
            onComplete={handleFromComplete}
            disabled={isFromConfirmed}
            min={min}
            max={max}
            placeholder={`${min}`}
          />
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Stepper
              value={value.from}
              onChange={handleFromChange}
              min={min}
              max={max}
              label="-"
              fieldDisabled={isFromConfirmed}
            />
            <Stepper
              value={value.from}
              onChange={handleFromChange}
              min={min}
              max={max}
              label="+"
              fieldDisabled={isFromConfirmed}
            />
          </div>
        </div>

        {/* 終了値 */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">
            終了 {isToConfirmed && <span className="text-green-600">✓</span>}
          </label>
          <NumberInput
            ref={toInputRef}
            value={value.to}
            onChange={handleToChange}
            onComplete={handleToComplete}
            disabled={isToConfirmed}
            min={min}
            max={max}
            placeholder={`${max}`}
          />
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Stepper
              value={value.to}
              onChange={handleToChange}
              min={min}
              max={max}
              label="-"
              fieldDisabled={isToConfirmed}
            />
            <Stepper
              value={value.to}
              onChange={handleToChange}
              min={min}
              max={max}
              label="+"
              fieldDisabled={isToConfirmed}
            />
          </div>
        </div>
      </div>

      {/* クリアボタン */}
      <div className="flex justify-center">
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
        >
          クリア
        </button>
      </div>

      {/* 現在の選択範囲表示 */}
      {(value.from !== undefined || value.to !== undefined) && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-center text-sm text-blue-800">
          選択中: {value.from ?? '未設定'} 〜 {value.to ?? '未設定'}
        </div>
      )}
    </div>
  );
}