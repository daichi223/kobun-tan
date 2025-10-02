import React, { useState, useRef, useCallback, useEffect } from 'react';

interface RangePreset {
  label: string;
  start: number;
  end: number;
}

interface RangeInputProps {
  startValue: number | undefined;
  endValue: number | undefined;
  onStartChange: (value: number | undefined) => void;
  onEndChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  presets?: RangePreset[];
  className?: string;
}

const defaultPresets: RangePreset[] = [
  { label: '1-50', start: 1, end: 50 },
  { label: '51-100', start: 51, end: 100 },
  { label: '101-150', start: 101, end: 150 },
  { label: '151-200', start: 151, end: 200 },
  { label: '201-250', start: 201, end: 250 },
  { label: '251-300', start: 251, end: 300 },
  { label: '301-330', start: 301, end: 330 },
  { label: '全範囲', start: 1, end: 330 }
];

interface StepperButtonProps {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled: boolean;
  label: string;
}

function StepperButton({ value, onDecrease, onIncrease, disabled, label }: StepperButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const startRepeating = useCallback(() => {
    if (disabled) return;

    const action = label === '+' ? onIncrease : onDecrease;

    // 最初のクリック
    action();

    // 500ms後から連続実行開始
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(action, 100);
    }, 500);
  }, [label, onIncrease, onDecrease, disabled]);

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

  const handleMouseDown = useCallback(() => {
    if (disabled) return;
    setIsPressed(true);
    startRepeating();
  }, [disabled, startRepeating]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsPressed(true);
    startRepeating();
  }, [disabled, startRepeating]);

  useEffect(() => {
    const handleMouseUp = () => stopRepeating();
    const handleTouchEnd = () => stopRepeating();

    if (isPressed) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      stopRepeating();
    };
  }, [isPressed, stopRepeating]);

  return (
    <button
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      disabled={disabled}
      className={`w-10 h-10 rounded border transition select-none ${
        disabled
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

export default function RangeInput({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  min = 1,
  max = 330,
  presets = defaultPresets,
  className = ''
}: RangeInputProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [tempStart, setTempStart] = useState<number | undefined>(startValue);
  const [tempEnd, setTempEnd] = useState<number | undefined>(endValue);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const clampValue = (value: number): number => {
    return Math.max(min, Math.min(max, value));
  };

  const autoSwapIfNeeded = (start: number | undefined, end: number | undefined) => {
    if (start !== undefined && end !== undefined && start > end) {
      onStartChange(end);
      onEndChange(start);
    }
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onStartChange(undefined);
      return;
    }
    const num = parseInt(value);
    if (!isNaN(num)) {
      const clampedValue = clampValue(num);
      onStartChange(clampedValue);
      autoSwapIfNeeded(clampedValue, endValue);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onEndChange(undefined);
      return;
    }
    const num = parseInt(value);
    if (!isNaN(num)) {
      const clampedValue = clampValue(num);
      onEndChange(clampedValue);
      autoSwapIfNeeded(startValue, clampedValue);
    }
  };

  const handleStartBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
      onStartChange(undefined);
    }
  };

  const handleEndBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
      onEndChange(undefined);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const clearRange = () => {
    onStartChange(undefined);
    onEndChange(undefined);
  };

  const applyPreset = (preset: RangePreset) => {
    onStartChange(preset.start);
    onEndChange(preset.end);
    setIsPopoverOpen(false);
  };

  const openPopover = () => {
    setTempStart(startValue);
    setTempEnd(endValue);
    setIsPopoverOpen(true);
  };

  const applyTempRange = () => {
    if (tempStart !== undefined && tempEnd !== undefined) {
      const clampedStart = clampValue(tempStart);
      const clampedEnd = clampValue(tempEnd);

      if (clampedStart <= clampedEnd) {
        onStartChange(clampedStart);
        onEndChange(clampedEnd);
      } else {
        onStartChange(clampedEnd);
        onEndChange(clampedStart);
      }
      setIsPopoverOpen(false);
    }
  };

  const cancelPopover = () => {
    setTempStart(startValue);
    setTempEnd(endValue);
    setIsPopoverOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-2">
        {/* プリセットボタン */}
        <div className="flex flex-wrap gap-1">
          {presets.slice(0, 4).map((preset, index) => (
            <button
              key={index}
              onClick={() => applyPreset(preset)}
              className={`px-2 py-1 text-xs rounded border transition ${
                startValue === preset.start && endValue === preset.end
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={openPopover}
            className="px-2 py-1 text-xs rounded border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition"
          >
            詳細...
          </button>
        </div>

        {/* 範囲入力フィールド */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              ref={startInputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={startValue ?? ''}
              onChange={handleStartChange}
              onBlur={handleStartBlur}
              onFocus={handleFocus}
              min={min}
              max={max}
              placeholder="未設定"
              className={`w-full p-1.5 border rounded text-center text-xs pr-6 ${
                startValue === undefined
                  ? 'bg-slate-50 border-slate-300 text-slate-400'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            />
            <button
              onClick={() => onStartChange(undefined)}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          </div>
          <span className="text-slate-500 text-xs">〜</span>
          <div className="relative flex-1">
            <input
              ref={endInputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={endValue ?? ''}
              onChange={handleEndChange}
              onBlur={handleEndBlur}
              onFocus={handleFocus}
              min={min}
              max={max}
              placeholder="未設定"
              className={`w-full p-1.5 border rounded text-center text-xs pr-6 ${
                endValue === undefined
                  ? 'bg-slate-50 border-slate-300 text-slate-400'
                  : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            />
            <button
              onClick={() => onEndChange(undefined)}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          </div>
          <button
            onClick={clearRange}
            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
          >
            クリア
          </button>
        </div>
      </div>

      {/* ポップオーバー */}
      {isPopoverOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={cancelPopover}
          />
          <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
            <h3 className="text-sm font-medium text-slate-700 mb-3">範囲を選択</h3>

            {/* プリセット一覧 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 text-sm rounded border transition ${
                    startValue === preset.start && endValue === preset.end
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* カスタム範囲入力 */}
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-600 mb-3">カスタム範囲</p>

              {/* 開始値ステッパー */}
              <div className="mb-4">
                <label className="block text-xs text-slate-600 mb-1">開始</label>
                <div className="flex items-center space-x-2">
                  <StepperButton
                    value={tempStart ?? min}
                    onDecrease={() => setTempStart(Math.max(min, (tempStart ?? min) - 1))}
                    onIncrease={() => setTempStart(Math.min(max, (tempStart ?? min) + 1))}
                    disabled={false}
                    label="-"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempStart ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setTempStart(undefined);
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num)) {
                          setTempStart(clampValue(num));
                        }
                      }
                    }}
                    onFocus={handleFocus}
                    min={min}
                    max={max}
                    placeholder={`${min}`}
                    className="flex-1 p-2 border border-slate-200 rounded text-center text-sm"
                  />
                  <StepperButton
                    value={tempStart ?? min}
                    onDecrease={() => setTempStart(Math.max(min, (tempStart ?? min) - 1))}
                    onIncrease={() => setTempStart(Math.min(max, (tempStart ?? min) + 1))}
                    disabled={false}
                    label="+"
                  />
                </div>
              </div>

              {/* 終了値ステッパー */}
              <div className="mb-4">
                <label className="block text-xs text-slate-600 mb-1">終了</label>
                <div className="flex items-center space-x-2">
                  <StepperButton
                    value={tempEnd ?? max}
                    onDecrease={() => setTempEnd(Math.max(min, (tempEnd ?? max) - 1))}
                    onIncrease={() => setTempEnd(Math.min(max, (tempEnd ?? max) + 1))}
                    disabled={false}
                    label="-"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={tempEnd ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setTempEnd(undefined);
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num)) {
                          setTempEnd(clampValue(num));
                        }
                      }
                    }}
                    onFocus={handleFocus}
                    min={min}
                    max={max}
                    placeholder={`${max}`}
                    className="flex-1 p-2 border border-slate-200 rounded text-center text-sm"
                  />
                  <StepperButton
                    value={tempEnd ?? max}
                    onDecrease={() => setTempEnd(Math.max(min, (tempEnd ?? max) - 1))}
                    onIncrease={() => setTempEnd(Math.min(max, (tempEnd ?? max) + 1))}
                    disabled={false}
                    label="+"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={cancelPopover}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={applyTempRange}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                >
                  適用
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}