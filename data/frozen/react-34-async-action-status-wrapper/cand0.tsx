import React, { useState, useCallback } from 'react';

export function useAsyncAction<T>(action: () => Promise<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [action]);

  return { execute, isLoading, error };
}
