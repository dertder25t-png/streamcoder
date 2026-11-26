import { useCallback, useReducer, useRef } from "react";

type H<T> = { past: T[]; present: T; future: T[] };

export function useUndoableState<T>(initialValue: T, maxHistory = 50) {
  const initial = useRef(initialValue);
  const max = useRef(maxHistory);
  max.current = maxHistory;
  const hist = useRef<H<T>>({ past: [], present: initialValue, future: [] });
  const [, force] = useReducer((n: number) => n + 1, 0);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    const h = hist.current;
    const value = typeof next === "function" ? (next as (p: T) => T)(h.present) : next;
    if (Object.is(value, h.present)) return;
    const past = [...h.past, h.present];
    while (past.length > max.current) past.shift();
    hist.current = { past, present: value, future: [] };
    force();
  }, []);
  const undo = useCallback(() => {
    const h = hist.current;
    if (h.past.length === 0) return;
    hist.current = { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    force();
  }, []);
  const redo = useCallback(() => {
    const h = hist.current;
    if (h.future.length === 0) return;
    hist.current = { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    force();
  }, []);
  const reset = useCallback(() => {
    hist.current = { past: [], present: initial.current, future: [] };
    force();
  }, []);

  const h = hist.current;
  return { state: h.present, set, undo, redo, canUndo: h.past.length > 0, canRedo: h.future.length > 0, reset };
}
