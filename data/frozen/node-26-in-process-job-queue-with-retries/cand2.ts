import { Queue, Worker } from 'bull';

interface Job {
  payload: any;
  retries: number;
  error?: Error;
}

interface JobQueueOptions {
  concurrency: number;
  maxRetries: number;
  processor: (job: Job) => Promise<void>;
  onDeadLetter: (job: Job, error: Error) => void;
}

export function createJobQueue({ concurrency, maxRetries, processor, onDeadLetter }: JobQueueOptions) {
  const queue = new Queue('jobQueue', 'redis://127.0.0.1:6379');

  queue.process(concurrency, async (job) => {
    try {
      await processor({ payload: job.data, retries: job.attempts() });
      job.remove(); // Mark job as completed
    } catch (error) {
      if (job.attempts() < maxRetries) {
        job.retry(); // Retry the job
      } else {
        onDeadLetter({ payload: job.data, retries: job.attempts(), error: error as Error }, error as Error);
        job.remove(); // Remove the job from the queue
      }
    }
  });

  return {
    enqueue: (payload: any) => {
      queue.add({ payload });
    },
    drain: () => {
      return new Promise<void>((resolve) => {
        queue.drain(() => {
          resolve();
        });
      });
    },
    stats: () => {
      const stats = queue.getStats();
      return {
        queued: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        deadLettered: stats.failed,
      };
    },
  };
}
