export interface MemoizeOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

export function memoizeAsync<V>(
  fn: (key: string) => Promise<V>,
  options: MemoizeOptions,
): (key: string) => Promise<V> {
  const { ttlMs, maxEntries, now = Date.now } = options;
  const cache = new Map<string, { promise: Promise<V>; at: number }>();
  return (key) => {
    const hit = cache.get(key);
    if (hit) {
      if (now() - hit.at < ttlMs) return hit.promise;
      cache.delete(key);
    }
    const promise = fn(key);
    const entry = { promise, at: now() };
    cache.set(key, entry);
    promise.catch(() => {
      if (cache.get(key) === entry) cache.delete(key);
    });
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value as string;
      cache.delete(oldest);
    }
    return promise;
  };
}
