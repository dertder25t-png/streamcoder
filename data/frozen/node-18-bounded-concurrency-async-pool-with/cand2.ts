import { AbortSignal } from 'node:events';

interface RunTaskPoolOptions {
  signal?: AbortSignal;
}

export async function runTaskPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options?: RunTaskPoolOptions
): Promise<R[]> {
  if (concurrency < 1 || !Number.isInteger(concurrency)) {
    throw new RangeError('Concurrency must be a positive integer');
  }

  if (items.length === 0) {
    return [];
  }

  const results: (R | undefined)[] = new Array(items.length).fill(undefined);
  const activeWorkers: Promise<void>[] = [];
  let index = 0;

  const runWorker = async () => {
    if (index >= items.length) {
      return;
    }

    try {
      const item = items[index++];
      const result = await worker(item, index - 1);
      results[index - 1] = result;
    } catch (error) {
      results[index - 1] = error as R;
      throw error;
    } finally {
      activeWorkers.splice(activeWorkers.indexOf(runWorker), 1);
    }
  };

  for (let i = 0; i < concurrency; i++) {
    activeWorkers.push(runWorker());
  }

  while (activeWorkers.length > 0) {
    await Promise.race(activeWorkers);
  }

  if (options?.signal?.aborted) {
    throw new Error('Aborted');
  }

  return results.filter(result => result !== undefined) as R[];
}
