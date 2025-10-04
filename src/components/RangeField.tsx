import React, { useCallback } from 'react';
import { NumericField } from './forms/NumericField';

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

// アイコンコンポーネント
const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,18 15,12 9,6"></polyline>
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

// ステッパーボタンコンポーネント（簡略化）
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
  return (
    <button
      type="button"
      className={`w-6 h-6 flex items-center justify-center rounded border text-xs font-medium transition select-none ${
        disabled
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : 'bg-white text-slate-600 border-slate-300 hover:bg-blue-50 hover:border-blue-400 active:bg-blue-100'
      } ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </button>
  );
}

// メインのRangeFieldコンポーネント
export default function RangeField({
  value,
  onChange,
  min = 1,
  max = 330,
  className = '',
  onRangeComplete
}: RangeFieldProps) {

  // from値の変更処理
  const handleFromChange = useCallback((newFrom: number | "") => {
    onChange({ ...value, from: newFrom === "" ? undefined : newFrom });
  }, [value, onChange]);

  // to値の変更処理
  const handleToChange = useCallback((newTo: number | "") => {
    onChange({ ...value, to: newTo === "" ? undefined : newTo });
  }, [value, onChange]);

  // from確定処理
  const handleFromCommit = useCallback((newFrom: number | "") => {
    const finalFrom = newFrom === "" ? undefined : newFrom;
    onChange({ ...value, from: finalFrom });
  }, [value, onChange]);

  // to確定処理
  const handleToCommit = useCallback((newTo: number | "") => {
    const finalTo = newTo === "" ? undefined : newTo;
    let finalValue = { ...value, to: finalTo };

    // from > to の場合の入替処理
    if (typeof value.from === 'number' && typeof finalTo === 'number' && value.from > finalTo) {
      finalValue = { from: finalTo, to: value.from };
    }

    onChange(finalValue);

    // 両方が入力済みなら範囲完了
    if (typeof finalValue.from === 'number' && typeof finalValue.to === 'number' && onRangeComplete) {
      setTimeout(() => onRangeComplete(), 100);
    }
  }, [value, onChange, onRangeComplete]);

  // ステッパーボタンの処理
  const incrementFrom = useCallback(() => {
    const current = value.from || min;
    const newValue = Math.min(current + 1, max);
    onChange({ ...value, from: newValue });
  }, [value, min, max, onChange]);

  const decrementFrom = useCallback(() => {
    const current = value.from || min;
    const newValue = Math.max(current - 1, min);
    onChange({ ...value, from: newValue });
  }, [value, min, max, onChange]);

  const incrementTo = useCallback(() => {
    const current = value.to || max;
    const newValue = Math.min(current + 1, max);
    onChange({ ...value, to: newValue });
  }, [value, min, max, onChange]);

  const decrementTo = useCallback(() => {
    const current = value.to || max;
    const newValue = Math.max(current - 1, min);
    onChange({ ...value, to: newValue });
  }, [value, min, max, onChange]);

  // 次へボタンの表示判定
  const showNextButton = typeof value.from === 'number' && typeof value.to === 'number';

  return (
    <div className={`${className}`}>
      {/* 横並びレイアウト */}
      <div className="flex flex-wrap items-center gap-2 justify-start">
        {/* 開始値 */}
        <div className="flex items-center space-x-1">
          <label className="text-xs text-slate-600 whitespace-nowrap">開始</label>
          <NumericField
            value={value.from ?? ""}
            maxDigits={3}
            min={min}
            max={max}
            placeholder={String(min)}
            onChange={handleFromChange}
            onCommit={handleFromCommit}
          />
          {/* ±ボタン */}
          <div className="flex space-x-1">
            <StepperButton onClick={decrementFrom} disabled={!value.from || value.from <= min}>
              <MinusIcon />
            </StepperButton>
            <StepperButton onClick={incrementFrom} disabled={!value.from || value.from >= max}>
              <PlusIcon />
            </StepperButton>
          </div>
        </div>

        {/* 終了値 */}
        <div className="flex items-center space-x-1">
          <label className="text-xs text-slate-600 whitespace-nowrap">終了</label>
          <NumericField
            value={value.to ?? ""}
            maxDigits={3}
            min={min}
            max={max}
            placeholder={String(max)}
            onChange={handleToChange}
            onCommit={handleToCommit}
          />
          {/* ±ボタン */}
          <div className="flex space-x-1">
            <StepperButton onClick={decrementTo} disabled={!value.to || value.to <= min}>
              <MinusIcon />
            </StepperButton>
            <StepperButton onClick={incrementTo} disabled={!value.to || value.to >= max}>
              <PlusIcon />
            </StepperButton>
          </div>
        </div>

        {/* 次へボタン */}
        {showNextButton && onRangeComplete && (
          <button
            type="button"
            onClick={onRangeComplete}
            className="w-6 h-6 flex items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 transition"
            title="次へ"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </div>
  );
}