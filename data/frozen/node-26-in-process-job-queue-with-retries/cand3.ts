import { Queue, Worker, QueueAddOptions, QueueJob, QueueProcessOptions } from 'bull';

interface JobQueueOptions {
  concurrency: number;
  maxRetries: number;
  processor: (job: QueueJob) => Promise<void>;
  onDeadLetter: (job: QueueJob, lastError: Error) => void;
}

interface JobQueueStats {
  queued: number;
  active: number;
  completed: number;
  deadLettered: number;
}

class JobQueue {
  private queue: Queue;
  private options: JobQueueOptions;

  constructor(options: JobQueueOptions) {
    this.options = options;
    this.queue = new Queue('jobQueue', {
      concurrency: options.concurrency,
      defaultJobOptions: {
        attempts: options.maxRetries,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });

    this.queue.on('completed', (job) => {
      this.onJobCompleted(job);
    });

    this.queue.on('failed', (job, err) => {
      this.onJobFailed(job, err);
    });

    this.queue.on('drained', () => {
      this.onQueueDrained();
    });
  }

  public enqueue(payload: unknown, options?: QueueAddOptions): Promise<QueueJob> {
    return this.queue.add(payload, options);
  }

  public async drain(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.drain(() => {
        resolve();
      });
    });
  }

  public stats(): JobQueueStats {
    return {
      queued: this.queue.getWaitingCount(),
      active: this.queue.getActiveCount(),
      completed: this.queue.getCompletedCount(),
      deadLettered: this.queue.getFailedCount(),
    };
  }

  private onJobCompleted(job: QueueJob): void {
    // Job completed successfully
  }

  private onJobFailed(job: QueueJob, err: Error): void {
    if (job.attemptsLeft > 0) {
      // Retry the job
    } else {
      // Job failed after max retries
      this.options.onDeadLetter(job, err);
    }
  }

  private onQueueDrained(): void {
    // Queue has been drained
  }
}

export { JobQueue, JobQueueOptions, JobQueueStats };
