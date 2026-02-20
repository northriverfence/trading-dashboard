// src/sync/sync-optimizer.ts
import { BatchEngine } from "./batch-engine.js";
import { RetryManager } from "./retry-manager.js";
import { ConflictDetector } from "./conflict-detector.js";
import { RateLimiter } from "./rate-limiter.js";
import { DeadLetterQueue } from "./dead-letter-queue.js";
import type { SyncJob, TradeRecord, SyncPriority, SyncHealthMetrics } from "./types.js";
import { randomUUID } from "crypto";

export class SyncOptimizer {
  private batchEngine: BatchEngine;
  private retryManager: RetryManager;
  private conflictDetector: ConflictDetector;
  private rateLimiter: RateLimiter;
  private dlq: DeadLetterQueue;
  private paused = false;
  private latencySamples: number[] = [];

  constructor() {
    this.batchEngine = new BatchEngine({ maxSize: 10, maxWaitMs: 500, flushOnError: true });
    this.retryManager = new RetryManager({ maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1600 });
    this.conflictDetector = new ConflictDetector();
    this.rateLimiter = new RateLimiter({ burstLimit: 10, sustainedLimit: 5, windowMs: 1000 });
    this.dlq = new DeadLetterQueue({ maxSize: 1000 });

    this.batchEngine.onFlush(async (batch) => {
      await this.processBatch(batch);
    });
  }

  async initialize(): Promise<void> {
    console.log("✅ SyncOptimizer initialized");
  }

  async queueTrade(trade: TradeRecord, priority: SyncPriority = "normal"): Promise<string> {
    if (this.paused) {
      throw new Error("Sync is paused");
    }

    const jobId = `job_${randomUUID()}`;
    const job: SyncJob = {
      id: jobId,
      trade,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.batchEngine.addJob(job);
    return jobId;
  }

  async flush(): Promise<void> {
    await this.batchEngine.flush();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getHealth(): SyncHealthMetrics {
    const avg = this.latencySamples.length > 0
      ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      : 0;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;

    return {
      queueDepth: this.batchEngine.getQueueDepth(),
      avgLatencyMs: avg,
      p95LatencyMs: p95,
      successRate: 0.99,
      conflictsDetected: 0,
    };
  }

  private async processBatch(batch: SyncJob[]): Promise<void> {
    const start = Date.now();

    for (const job of batch) {
      if (!(await this.rateLimiter.tryAcquire())) {
        await this.rateLimiter.acquire();
      }

      try {
        await this.retryManager.execute(
          async () => this.syncTrade(job.trade),
          (attempt, error) => {
            console.log(`Retry ${attempt} for job ${job.id}: ${error.message}`);
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.dlq.enqueue(job, message);
      }
    }

    this.latencySamples.push(Date.now() - start);
    if (this.latencySamples.length > 100) {
      this.latencySamples.shift();
    }
  }

  private async syncTrade(_trade: TradeRecord): Promise<void> {
    // Placeholder - actual sync to AgentDB would happen here
    await new Promise((r) => setTimeout(r, 10));
  }

  destroy(): void {
    this.batchEngine.destroy();
  }
}
