export interface MemoizeOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

export function memoizeAsync<V>(
  fn: (key: string) => Promise<V>,
  options: MemoizeOptions,
): (key: string) => Promise<V> {
  const { maxEntries, now = Date.now } = options;
  const cache = new Map<string, { promise: Promise<V>; at: number; resolve?: (value: V) => void; reject?: (error: any) => void }>();

  return (key) => {
    const hit = cache.get(key);
    if (hit) {
      if (now() - hit.at >= options.ttlMs) {
        cache.delete(key);
        return memoizeAsync(fn, options)(key);
      }
      return hit.promise;
    }

    const promise = new Promise<V>((resolve, reject) => {
      const entry = { promise, at: now(), resolve, reject };
      cache.set(key, entry);

      fn(key)
        .then(
          (value) => {
            entry.resolve?.(value);
            cache.delete(key);
          },
          (error) => {
            entry.reject?.(error);
            cache.delete(key);
          },
        )
        .finally(() => {
          if (cache.size > maxEntries) {
            const oldestEntry = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            cache.delete(oldestEntry[0]);
          }
        });
    });

    return promise;
  };
}
