export async function runTaskPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options?: { signal?: AbortSignal }
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Concurrency must be an integer greater than 0');
  }

  if (items.length === 0) {
    return [];
  }

  const results: (R | null)[] = new Array(items.length).fill(null);
  const activeWorkers: Promise<void>[] = [];
  const signal = options?.signal;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];

    const workerPromise = worker(item, index)
      .then(result => {
        results[index] = result;
        const completedIndex = activeWorkers.indexOf(workerPromise);
        if (completedIndex !== -1) {
          activeWorkers.splice(completedIndex, 1);
        }
      })
      .catch(error => {
        results[index] = null;
        const completedIndex = activeWorkers.indexOf(workerPromise);
        if (completedIndex !== -1) {
          activeWorkers.splice(completedIndex, 1);
        }
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        throw error;
      });

    activeWorkers.push(workerPromise);

    if (activeWorkers.length >= concurrency) {
      await Promise.race(activeWorkers);
    }

    if (signal?.aborted) {
      throw new Error('Aborted');
    }
  }

  return results.filter(result => result !== null) as R[];
}
