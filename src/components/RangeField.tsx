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

const LeftArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15,18 9,12 15,6"></polyline>
  </svg>
);

const RightArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,18 15,12 9,6"></polyline>
  </svg>
);

// ステッパーボタンコンポーネント（加速リピート付き）
// 要件定義：長押し300ms後からリピート、初期速度150ms、最高速度50ms、毎回10ms加速
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
  const [isPressed, setIsPressed] = React.useState(false);
  const timeoutRef = React.useRef<number | null>(null);
  const intervalRef = React.useRef<number | null>(null);
  const speedRef = React.useRef(150);

  const startRepeating = React.useCallback(() => {
    if (disabled) return;

    onClick(); // 初回タップ/クリックで±1
    setIsPressed(true);
    speedRef.current = 150; // 初期速度150ms

    // 300ms後からリピート開始
    timeoutRef.current = window.setTimeout(() => {
      const repeat = () => {
        onClick();
        // 毎回10ms短縮、最高速度50ms
        speedRef.current = Math.max(50, speedRef.current - 10);
        intervalRef.current = window.setTimeout(repeat, speedRef.current);
      };
      repeat();
    }, 300);
  }, [onClick, disabled]);

  const stopRepeating = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPressed(false);
    speedRef.current = 150;
  }, []);

  // クリーンアップ
  React.useEffect(() => {
    return () => {
      stopRepeating();
    };
  }, [stopRepeating]);

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
      onMouseDown={!disabled ? startRepeating : undefined}
      onMouseUp={stopRepeating}
      onMouseLeave={stopRepeating}
      onTouchStart={!disabled ? (e) => { e.preventDefault(); startRepeating(); } : undefined}
      onTouchEnd={stopRepeating}
      onTouchCancel={stopRepeating}
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

  // from確定処理（要件定義: 開始>終了 → 終了=開始に自動補正）
  const handleFromCommit = useCallback((newFrom: number | "") => {
    const finalFrom = newFrom === "" ? undefined : newFrom;
    let finalValue = { ...value, from: finalFrom };

    // 開始 > 終了の場合、終了を開始に合わせる
    if (typeof finalFrom === 'number' && typeof value.to === 'number' && finalFrom > value.to) {
      finalValue = { from: finalFrom, to: finalFrom };
    }

    onChange(finalValue);
  }, [value, onChange]);

  // to確定処理（要件定義: 終了<開始 → 開始=終了に自動補正）
  const handleToCommit = useCallback((newTo: number | "") => {
    const finalTo = newTo === "" ? undefined : newTo;
    let finalValue = { ...value, to: finalTo };

    // 終了 < 開始の場合、開始を終了に合わせる
    if (typeof value.from === 'number' && typeof finalTo === 'number' && finalTo < value.from) {
      finalValue = { from: finalTo, to: finalTo };
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
          <StepperButton onClick={decrementFrom} disabled={!value.from || value.from <= min}>
            <LeftArrowIcon />
          </StepperButton>
          <NumericField
            value={value.from ?? ""}
            maxDigits={3}
            min={min}
            max={max}
            placeholder={String(min)}
            onChange={handleFromChange}
            onCommit={handleFromCommit}
          />
          <StepperButton onClick={incrementFrom} disabled={!value.from || value.from >= max}>
            <RightArrowIcon />
          </StepperButton>
        </div>

        {/* 終了値 */}
        <div className="flex items-center space-x-1">
          <label className="text-xs text-slate-600 whitespace-nowrap">終了</label>
          <StepperButton onClick={decrementTo} disabled={!value.to || value.to <= min}>
            <LeftArrowIcon />
          </StepperButton>
          <NumericField
            value={value.to ?? ""}
            maxDigits={3}
            min={min}
            max={max}
            placeholder={String(max)}
            onChange={handleToChange}
            onCommit={handleToCommit}
          />
          <StepperButton onClick={incrementTo} disabled={!value.to || value.to >= max}>
            <RightArrowIcon />
          </StepperButton>
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