type Job = {
  payload: unknown;
  retries: number;
  deadline: number;
};

type Processor = (job: Job) => Promise<void>;

type DeadLetterHandler = (job: Job, error: Error) => void;

type JobQueueStats = {
  queued: number;
  active: number;
  completed: number;
  deadLettered: number;
};

class JobQueue {
  private concurrency: number;
  private maxRetries: number;
  private processor: Processor;
  private onDeadLetter: DeadLetterHandler;
  private queue: Job[];
  private activeJobs: Map<number, Job>;
  private completed: number;
  private deadLettered: number;

  constructor({ concurrency, maxRetries, processor, onDeadLetter }: { concurrency: number; maxRetries: number; processor: Processor; onDeadLetter: DeadLetterHandler }) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.processor = processor;
    this.onDeadLetter = onDeadLetter;
    this.queue = [];
    this.activeJobs = new Map();
    this.completed = 0;
    this.deadLettered = 0;
  }

  enqueue(payload: unknown): void {
    this.queue.push({ payload, retries: 0, deadline: Date.now() + 1000 });
    this.processJobs();
  }

  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (this.queue.length === 0 && this.activeJobs.size === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  stats(): JobQueueStats {
    return {
      queued: this.queue.length,
      active: this.activeJobs.size,
      completed: this.completed,
      deadLettered: this.deadLettered,
    };
  }

  private async processJobs(): Promise<void> {
    while (this.queue.length > 0 && this.activeJobs.size < this.concurrency) {
      const job = this.queue.shift()!;
      job.deadline = Date.now() + 1000;
      this.activeJobs.set(job.payload, job);
      try {
        await this.processor(job);
        this.completed++;
      } catch (error) {
        job.retries++;
        if (job.retries <= this.maxRetries) {
          this.queue.push(job);
        } else {
          this.onDeadLetter(job, error);
          this.deadLettered++;
        }
      } finally {
        this.activeJobs.delete(job.payload);
        this.processJobs();
      }
    }
  }
}

export { JobQueue };
