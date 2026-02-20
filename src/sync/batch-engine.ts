// src/sync/batch-engine.ts
import type { SyncJob, BatchConfig, BatchSyncResult } from "./types.js";

export class BatchEngine {
  private queue: SyncJob[] = [];
  private config: BatchConfig;
  private flushHandler?: (batch: SyncJob[]) => Promise<void>;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: BatchConfig) {
    this.config = config;
  }

  onFlush(handler: (batch: SyncJob[]) => Promise<void>): void {
    this.flushHandler = handler;
  }

  addJob(job: SyncJob): void {
    this.queue.push(job);

    if (this.queue.length >= this.config.maxSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.config.maxWaitMs);
    }
  }

  async flush(): Promise<BatchSyncResult> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0) {
      return { success: true, processed: 0, failed: [], durationMs: 0 };
    }

    const batch = [...this.queue];
    this.queue = [];

    const start = Date.now();

    try {
      await this.flushHandler?.(batch);
      return {
        success: true,
        processed: batch.length,
        failed: [],
        durationMs: Date.now() - start,
      };
    } catch (error) {
      if (this.config.flushOnError) {
        return {
          success: false,
          processed: 0,
          failed: batch.map((j) => j.id),
          durationMs: Date.now() - start,
        };
      }
      this.queue.unshift(...batch);
      throw error;
    }
  }

  getQueueDepth(): number {
    return this.queue.length;
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }
}
