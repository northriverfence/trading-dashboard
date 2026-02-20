// src/sync/dead-letter-queue.ts
import type { SyncJob } from "./types.js";

export interface DLQConfig {
  maxSize: number;
  persistPath?: string;
}

export interface DeadLetterJob {
  job: SyncJob;
  error: string;
  failedAt: number;
}

export class DeadLetterQueue {
  private queue: DeadLetterJob[] = [];
  private config: DLQConfig;

  constructor(config: DLQConfig) {
    this.config = config;
  }

  enqueue(job: SyncJob, error: string): void {
    const dlqJob: DeadLetterJob = {
      job,
      error,
      failedAt: Date.now(),
    };

    this.queue.push(dlqJob);

    // Evict oldest if over limit
    if (this.queue.length > this.config.maxSize) {
      this.queue.shift();
    }
  }

  dequeue(): DeadLetterJob | undefined {
    return this.queue.shift();
  }

  peek(): DeadLetterJob[] {
    return [...this.queue];
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  async reprocess(handler: (job: SyncJob) => Promise<boolean>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const toReprocess = [...this.queue];
    this.queue = [];

    for (const dlqJob of toReprocess) {
      try {
        const ok = await handler(dlqJob.job);
        if (ok) {
          success++;
        } else {
          this.enqueue(dlqJob.job, "Reprocess failed");
          failed++;
        }
      } catch {
        this.enqueue(dlqJob.job, "Reprocess exception");
        failed++;
      }
    }

    return { success, failed };
  }
}
