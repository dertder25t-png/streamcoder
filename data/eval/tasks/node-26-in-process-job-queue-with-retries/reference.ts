export interface JobQueueOptions<T> {
  concurrency: number;
  maxRetries: number;
  processor: (payload: T) => Promise<unknown>;
  onDeadLetter?: (job: { payload: T; attempts: number }, lastError: unknown) => void | Promise<void>;
}

export function createJobQueue<T>(opts: JobQueueOptions<T>) {
  const waiting: { payload: T; attempts: number }[] = [];
  let active = 0;
  let completed = 0;
  let deadLettered = 0;
  let idleWaiters: (() => void)[] = [];

  function checkIdle(): void {
    if (waiting.length === 0 && active === 0) {
      const w = idleWaiters;
      idleWaiters = [];
      w.forEach((r) => r());
    }
  }

  function pump(): void {
    while (active < opts.concurrency && waiting.length > 0) {
      const job = waiting.shift()!;
      active++;
      void run(job);
    }
  }

  async function run(job: { payload: T; attempts: number }): Promise<void> {
    try {
      job.attempts++;
      await opts.processor(job.payload);
      completed++;
    } catch (err) {
      if (job.attempts <= opts.maxRetries) {
        waiting.push(job);
      } else {
        try {
          await opts.onDeadLetter?.(job, err);
        } catch {
          /* ignore */
        }
        deadLettered++;
      }
    } finally {
      active--;
      pump();
      checkIdle();
    }
  }

  return {
    enqueue(payload: T): void {
      waiting.push({ payload, attempts: 0 });
      pump();
    },
    drain(): Promise<void> {
      if (waiting.length === 0 && active === 0) return Promise.resolve();
      return new Promise<void>((r) => idleWaiters.push(r));
    },
    stats() {
      return { queued: waiting.length, active, completed, deadLettered };
    },
  };
}
