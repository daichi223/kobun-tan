import { useRef, useCallback } from "react";

export function useFullSelectInput() {
  const fromPointerRef = useRef(false);

  const selectAll = (el: HTMLInputElement) => {
    // rAF でも setTimeout 0 でも OK。両方保険。
    requestAnimationFrame(() => {
      try {
        el.select();
        // 一部端末で select() が無視される事があるので保険
        if (typeof el.setSelectionRange === "function") {
          el.setSelectionRange(0, el.value.length);
        }
      } catch {}
    });
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    e.preventDefault();                // 既定キャレット移動を完全停止
    fromPointerRef.current = true;
    e.currentTarget.focus();
    selectAll(e.currentTarget);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    // 古い環境で PointerEvent が来ない保険
    if ((e as any).nativeEvent?.pointerType === undefined) {
      e.preventDefault();
      fromPointerRef.current = true;
      (e.currentTarget as HTMLInputElement).focus();
      selectAll(e.currentTarget as HTMLInputElement);
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    // 一部 iOS 端末で pointerdown 不着火の保険
    e.preventDefault();
    fromPointerRef.current = true;
    (e.currentTarget as HTMLInputElement).focus();
    selectAll(e.currentTarget as HTMLInputElement);
  }, []);

  const onFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Tab フォーカスでも必ず全選択
    if (!fromPointerRef.current) selectAll(e.currentTarget);
    // 同期フレーム衝突回避
    setTimeout(() => (fromPointerRef.current = false), 0);
  }, []);

  return { onPointerDown, onMouseDown, onTouchStart, onFocus };
}
