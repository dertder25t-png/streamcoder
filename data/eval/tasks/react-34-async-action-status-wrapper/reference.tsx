import { useCallback, useRef, useState } from "react";

export function useAsyncAction<T>(action: () => Promise<T>): {
  execute: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ref = useRef(action);
  ref.current = action;
  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await ref.current();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);
  return { execute, isLoading, error };
}
