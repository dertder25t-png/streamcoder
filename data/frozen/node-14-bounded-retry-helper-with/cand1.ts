export async function retryWithBackoff(
  fn: () => Promise<any>,
  options: {
    maxAttempts: number;
    baseDelayMs: number;
    shouldRetry?: (err: any) => boolean;
    signal?: AbortSignal;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<any> {
  const { maxAttempts, baseDelayMs, shouldRetry = () => true, signal, sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms)) } = options;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || (signal && signal.aborted)) {
        throw err;
      }
      await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      attempt++;
    }
  }

  throw new Error('Max attempts exceeded');
}
