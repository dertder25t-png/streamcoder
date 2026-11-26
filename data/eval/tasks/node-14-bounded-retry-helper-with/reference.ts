export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry?: (err: unknown) => boolean;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, baseDelayMs, shouldRetry, signal } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const abortError = () => (signal?.reason ?? new Error("aborted"));
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || (shouldRetry && !shouldRetry(err))) throw err;
    }
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      if (!signal) return;
      onAbort = () => reject(abortError());
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      await Promise.race([sleep(baseDelayMs * 2 ** (attempt - 1)), aborted]);
    } finally {
      if (onAbort) signal?.removeEventListener("abort", onAbort);
    }
  }
}
