import { AbortSignal } from 'node:events';

export async function runTaskPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options?: { signal?: AbortSignal }
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Concurrency must be a positive integer');
  }

  if (items.length === 0) {
    return [];
  }

  const results: (R | null)[] = new Array(items.length).fill(null);
  const activeWorkers: Promise<void>[] = [];
  const signal = options?.signal;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const workerPromise = worker(item, i)
      .then(result => {
        results[i] = result;
      })
      .catch(error => {
        results[i] = error;
        if (signal?.aborted) {
          throw signal.reason;
        }
        throw error;
      })
      .finally(() => {
        const index = activeWorkers.indexOf(workerPromise);
        if (index !== -1) {
          activeWorkers.splice(index, 1);
        }
      });

    activeWorkers.push(workerPromise);

    if (activeWorkers.length >= concurrency) {
      await Promise.race(activeWorkers);
    }

    if (signal?.aborted) {
      throw signal.reason;
    }
  }

  return results as R[];
}
