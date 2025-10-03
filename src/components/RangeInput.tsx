import React from 'react';

interface RangeInputProps {
  startValue: number | undefined;
  endValue: number | undefined;
  onStartChange: (value: number | undefined) => void;
  onEndChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  className?: string;
  onFocusChange?: (isFocused: boolean) => void;
  onValidationError?: (message: string) => void;
}

export default function RangeInput({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  min = 1,
  max = 330,
  className = '',
  onFocusChange,
  onValidationError
}: RangeInputProps) {

  // 50刻みの範囲オプションを生成
  const generateRangeOptions = () => {
    const options = [];
    for (let i = min; i <= max; i += 50) {
      const end = Math.min(i + 49, max);
      options.push({ start: i, end });
    }
    return options;
  };

  const rangeOptions = generateRangeOptions();

  const handleRangeSelect = (start: number, end: number) => {
    onStartChange(start);
    onEndChange(end);
  };

  const clearRange = () => {
    onStartChange(undefined);
    onEndChange(undefined);
  };

  const getCurrentRangeLabel = () => {
    if (startValue !== undefined && endValue !== undefined) {
      return `${startValue} 〜 ${endValue}`;
    }
    return '範囲を選択';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-2">
        {/* 現在選択中の範囲表示 */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 p-2 bg-slate-100 border border-slate-200 rounded text-center text-sm text-slate-700">
            {getCurrentRangeLabel()}
          </div>
          <button
            onClick={clearRange}
            className="px-2 py-2 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
          >
            クリア
          </button>
        </div>

        {/* 50刻みの範囲選択ボタン */}
        <div className="grid grid-cols-2 gap-2">
          {rangeOptions.map((option, index) => (
            <button
              key={index}
              onClick={() => handleRangeSelect(option.start, option.end)}
              className={`p-2 text-xs border rounded transition ${
                startValue === option.start && endValue === option.end
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {option.start} 〜 {option.end}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}