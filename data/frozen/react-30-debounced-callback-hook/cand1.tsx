import { useEffect, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delayMs: number): T {
  const callbackRef = useRef<T>(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useRef<T | null>(null);
  if (!debouncedCallback.current) {
    debouncedCallback.current = ((...args: Parameters<T>) => {
      const handler = () => {
        callbackRef.current?.(...args);
      };
      const timeoutId = setTimeout(handler, delayMs);
      return () => clearTimeout(timeoutId);
    }) as T;
  }

  useEffect(() => {
    return () => debouncedCallback.current?.();
  }, []);

  return debouncedCallback.current!;
}
