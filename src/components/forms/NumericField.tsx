import React, { useState, useEffect, useRef, useCallback } from "react";

type NumericFieldProps = {
  value: number | "";
  onChange?: (v: number | "") => void;
  onCommit?: (v: number | "") => void;
  min?: number;
  max?: number;
  maxDigits?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

// 全角数字→半角数字変換
const normalizeFullWidthDigits = (s: string): string =>
  s.replace(/[０-９]/g, (d) => String("０１２３４５６７８９".indexOf(d)));

// 数字のみ抽出・桁数制限
const sanitize = (s: string, maxDigits: number): string => {
  const digits = normalizeFullWidthDigits(s).replace(/\D+/g, "");
  return digits.slice(0, maxDigits);
};

// 範囲制限
const clamp = (n: number, min?: number, max?: number): number =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

export const NumericField: React.FC<NumericFieldProps> = ({
  value,
  onChange,
  onCommit,
  min,
  max,
  maxDigits = 3,
  placeholder,
  disabled,
  className = "",
}) => {
  const [raw, setRaw] = useState<string>(value === "" ? "" : String(value));
  const fromPointerRef = useRef(false);
  const composingRef = useRef(false);

  // 外部valueと同期（数値として同じなら更新しない）
  useEffect(() => {
    const currentNum = raw === "" ? "" : Number(raw);
    if (currentNum !== value) {
      setRaw(value === "" ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // クリック時の全選択
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    fromPointerRef.current = true;
    e.currentTarget.focus();
    requestAnimationFrame(() => {
      e.currentTarget.select();
    });
  }, [disabled]);

  // フォーカス時の全選択（Tab経路）
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (!fromPointerRef.current) {
      requestAnimationFrame(() => {
        e.currentTarget.select();
      });
    }
    setTimeout(() => {
      fromPointerRef.current = false;
    }, 0);
  }, []);

  // IME開始
  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  // IME終了
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    const s = sanitize(e.currentTarget.value, maxDigits);
    setRaw(s);
  }, [maxDigits]);

  // 入力変更
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (composingRef.current) return;
    const s = sanitize(e.target.value, maxDigits);
    setRaw(s);
    // 入力中は親に通知しない（選択が解除されるため）
  }, [maxDigits]);

  // 確定
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const s = sanitize(e.currentTarget.value, maxDigits);
    const n = s === "" ? "" : clamp(Number(s), min, max);
    setRaw(n === "" ? "" : String(n));
    onCommit?.(n);
  }, [maxDigits, min, max, onCommit]);

  // キー操作
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setRaw(value === "" ? "" : String(value));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const cur = raw === "" ? (min ?? 1) : Number(raw);
      const delta = e.key === "ArrowUp" ? 1 : -1;
      const next = clamp(cur + delta, min, max);
      setRaw(String(next));
      onCommit?.(next);
    }
  }, [value, raw, min, max, onCommit]);

  // ペースト
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const s = sanitize(e.clipboardData.getData("text"), maxDigits);
    setRaw(s);
  }, [maxDigits]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      maxLength={maxDigits}
      value={raw}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-12 h-8 px-1 text-center text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
        disabled
          ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
          : "bg-white text-slate-900 border-slate-300"
      } ${className}`}
      style={{
        MozAppearance: "textfield",
        WebkitAppearance: "none",
      }}
      onPointerDown={handlePointerDown}
      onFocus={handleFocus}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onPaste={handlePaste}
      onDrop={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    />
  );
};
