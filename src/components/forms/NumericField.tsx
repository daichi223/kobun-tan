import React, { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  label?: string;
  value: number | "";
  maxDigits?: number;           // default 3
  min?: number;                 // optional
  max?: number;                 // optional
  placeholder?: string;
  autoFocus?: boolean;
  onChange?: (v: number | "") => void;  // 入力途中も通知（空もあり） - オプショナル
  onCommit?: (v: number | "") => void; // 確定時（Enter/完了/blur）
  className?: string;
  disabled?: boolean;
  // commit時に空/不正を許さない場合はこの関数で判定
  validate?: (v: number | "") => string | null; // 戻り値: エラーメッセージ or null
};

const toHalfWidthDigits = (s: string) =>
  s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

export const NumericField: React.FC<Props> = ({
  label,
  value,
  maxDigits = 3,
  min,
  max,
  placeholder,
  autoFocus,
  onChange,
  onCommit,
  className,
  disabled,
  validate,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<string>(value === "" ? "" : String(value));
  const [error, setError] = useState<string | null>(null);

  // 外部からvalueが変わったら同期（ユーザー入力中は更新しない）
  useEffect(() => {
    const next = value === "" ? "" : String(value);
    // 数値として同じ場合は更新しない（例: "50" と 50 は同じ）
    const currentNum = raw === "" ? "" : Number(raw);
    if (currentNum !== value) {
      setRaw(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // サニタイズ（入力途中用）
  const sanitize = useCallback((input: string) => {
    const half = toHalfWidthDigits(input);
    const onlyDigits = half.replace(/\D/g, "").slice(0, maxDigits);
    return onlyDigits;
  }, [maxDigits]);

  const commit = useCallback((s: string) => {
    // 空はそのまま許容するかどうか
    const onlyDigits = sanitize(s);
    const n = onlyDigits === "" ? "" : Number(onlyDigits);

    // 範囲チェック
    let err: string | null = null;
    if (validate) {
      err = validate(n);
    } else if (n !== "" && ((min != null && n < min) || (max != null && n > max))) {
      err = `値は${min ?? "-∞"}〜${max ?? "∞"}の範囲で入力してください`;
    }
    setError(err);

    onChange?.(n);
    onCommit?.(n);
  }, [sanitize, validate, min, max, onChange, onCommit]);

  // フォーカス時全選択（要件定義に従いrequestAnimationFrame使用）
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    requestAnimationFrame(() => {
      if (e.currentTarget) {
        e.currentTarget.select();
      }
    });
  }, []);

  // ポインタダウン時の処理（クリック時の全選択を確実にする）
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    // フォーカス状態に関わらず、クリック時は常に全選択
    e.preventDefault();
    e.currentTarget.focus();
    requestAnimationFrame(() => {
      if (e.currentTarget) {
        e.currentTarget.select();
      }
    });
  }, []);

  // 入力変更処理
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    const sanitized = sanitize(s);
    setRaw(sanitized);
    // 入力途中も親へ反映（onChangeがある場合のみ）
    onChange?.(sanitized === "" ? "" : Number(sanitized));
  }, [sanitize, onChange]);

  // キーダウン処理
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur(); // 「完了」でblur→onBlurでcommit
    }
  }, []);

  // ブラー処理（確定）
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    commit(e.currentTarget.value);
  }, [commit]);

  return (
    <div className={`${className ?? ""}`}>
      <input
        ref={ref}
        type="text"               // ← number禁止（要件定義準拠）
        inputMode="numeric"       // 数字キーパッド
        pattern="[0-9]*"          // 数字のみのパターン
        enterKeyHint="done"       // 右下「完了」
        autoComplete="off"        // オートコンプリート無効
        autoCorrect="off"         // 自動修正無効
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        value={raw}
        maxLength={maxDigits}     // 3桁制限
        className={`w-12 h-8 px-1 text-center text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error
            ? "border-red-500 focus:ring-red-300"
            : disabled
            ? "bg-slate-100 text-slate-600 border-slate-200 cursor-default"
            : "bg-white text-slate-900 border-slate-300"
        }`}
        style={{
          MozAppearance: 'textfield',
          WebkitAppearance: 'none'
        }}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        onWheel={(e) => e.preventDefault()}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};