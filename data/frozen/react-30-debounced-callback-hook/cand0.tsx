import { useEffect, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delayMs: number): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useRef<T>(() => {
    const args = arguments;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delayMs);
  }).current;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
