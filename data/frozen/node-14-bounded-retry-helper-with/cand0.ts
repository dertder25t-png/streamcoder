import { AbortController, AbortSignal } from 'node:events';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry?: (err: unknown) => boolean;
  signal?: AbortSignal;
}

export async function retryWithBackoff(
  fn: () => Promise<void>,
  options: RetryOptions,
  sleep: (ms: number) => Promise<void> = async (ms) => new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  const { maxAttempts, baseDelayMs, shouldRetry = () => true, signal } = options;
  let attempt = 1;

  const controller = new AbortController();
  const abortSignal = signal ?? controller.signal;

  try {
    while (attempt <= maxAttempts) {
      try {
        await fn();
        return; // Success, exit immediately
      } catch (err) {
        if (!shouldRetry(err) || abortSignal.aborted) {
          throw err; // Re-throw if should not retry or signal is aborted
        }
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
        attempt++;
      }
    }
    throw new Error('Max attempts reached');
  } finally {
    if (abortSignal.aborted) {
      controller.abort(); // Clean up if signal was aborted
    }
  }
}
