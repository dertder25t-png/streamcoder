export function runTaskPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  options: { signal?: AbortSignal } = {},
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("concurrency must be a positive integer");
  }
  const { signal } = options;
  return new Promise<R[]>((resolve, reject) => {
    const results = new Array<R>(items.length);
    let next = 0;
    let active = 0;
    let finished = false;

    const fail = (err: unknown) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    };
    const onAbort = () => fail(signal!.reason);
    if (signal?.aborted) return fail(signal.reason);
    signal?.addEventListener("abort", onAbort, { once: true });

    const launch = () => {
      if (finished) return;
      if (next === items.length && active === 0) {
        finished = true;
        signal?.removeEventListener("abort", onAbort);
        return resolve(results);
      }
      while (!finished && active < concurrency && next < items.length) {
        const i = next++;
        active++;
        worker(items[i], i).then(
          (r) => {
            results[i] = r;
            active--;
            launch();
          },
          (e) => {
            active--;
            fail(e);
          },
        );
      }
    };
    launch();
  });
}
