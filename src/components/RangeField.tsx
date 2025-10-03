import React, { useState, useRef, useCallback, useEffect } from 'react';

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
}

interface StepperProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  label: string;
}

// ステッパーコンポーネント（長押し対応）
function Stepper({ value, onChange, min, max, label }: StepperProps) {
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
  const isDisabled = label === '-' ? isMinDisabled : isMaxDisabled;

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
}

function NumberInput({ value, onChange, min, max, placeholder }: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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

    if (inputValue === '') {
      onChange(undefined);
      return;
    }

    const num = parseInt(inputValue, 10);
    if (!isNaN(num)) {
      const clampedValue = Math.max(min, Math.min(max, num));
      onChange(clampedValue);
    }
  }, [onChange, min, max]);

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
        className="w-full p-2 border border-slate-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
      />
      {value !== undefined && (
        <button
          onClick={handleClear}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
        >
          ×
        </button>
      )}
    </div>
  );
}

// メインのRangeFieldコンポーネント
export default function RangeField({
  value,
  onChange,
  min = 1,
  max = 330,
  className = ''
}: RangeFieldProps) {
  // プリセット範囲の生成
  const presets = [
    { label: '1〜50', from: 1, to: 50 },
    { label: '51〜100', from: 51, to: 100 },
    { label: '101〜150', from: 101, to: 150 },
    { label: '151〜200', from: 151, to: 200 },
    { label: '201〜250', from: 201, to: 250 },
    { label: '251〜300', from: 251, to: 300 },
    { label: '301〜330', from: 301, to: 330 },
  ];

  // 値の変更処理（自動並べ替え付き）
  const handleValueChange = useCallback((newValue: RangeValue) => {
    let finalValue = { ...newValue };

    // from > to の場合は並べ替え
    if (finalValue.from !== undefined && finalValue.to !== undefined && finalValue.from > finalValue.to) {
      finalValue = { from: finalValue.to, to: finalValue.from };
    }

    onChange(finalValue);
  }, [onChange]);

  // プリセット選択
  const handlePresetSelect = useCallback((preset: typeof presets[0]) => {
    const newValue = { from: preset.from, to: preset.to };
    onChange(newValue);
  }, [onChange]);

  // 範囲をクリア
  const handleClear = useCallback(() => {
    onChange({ from: undefined, to: undefined });
  }, [onChange]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 入力フィールドエリア */}
      <div className="grid grid-cols-2 gap-3">
        {/* 開始値 */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">開始</label>
          <NumberInput
            value={value.from}
            onChange={(from) => handleValueChange({ ...value, from })}
            min={min}
            max={max}
            placeholder={`${min}`}
          />
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Stepper
              value={value.from}
              onChange={(from) => handleValueChange({ ...value, from })}
              min={min}
              max={max}
              label="-"
            />
            <Stepper
              value={value.from}
              onChange={(from) => handleValueChange({ ...value, from })}
              min={min}
              max={max}
              label="+"
            />
          </div>
        </div>

        {/* 終了値 */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">終了</label>
          <NumberInput
            value={value.to}
            onChange={(to) => handleValueChange({ ...value, to })}
            min={min}
            max={max}
            placeholder={`${max}`}
          />
          <div className="flex items-center justify-center space-x-2 mt-2">
            <Stepper
              value={value.to}
              onChange={(to) => handleValueChange({ ...value, to })}
              min={min}
              max={max}
              label="-"
            />
            <Stepper
              value={value.to}
              onChange={(to) => handleValueChange({ ...value, to })}
              min={min}
              max={max}
              label="+"
            />
          </div>
        </div>
      </div>

      {/* プリセット選択 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-600">プリセット範囲</p>
          <button
            onClick={handleClear}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
          >
            クリア
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetSelect(preset)}
              className={`p-2 text-xs border rounded transition ${
                value.from === preset.from && value.to === preset.to
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
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