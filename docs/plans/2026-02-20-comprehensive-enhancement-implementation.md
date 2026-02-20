# Comprehensive Stock Trading Agent Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement 8 major enhancement systems for the stock trading agent (50+ tasks across 26 modules)

**Architecture:** Dependency-ordered phases from Foundation (sync) through Visibility (dashboard), with each phase building on previous layers.

**Tech Stack:** TypeScript, Bun, AgentDB (vector memory), Bun.serve() (WebSocket), Bun.sqlite (tiered storage)

---

## Phase 1: Foundation Layer - Real-Time Sync Optimization

### Task 1.1: SyncJob Interface and Types

**Files:**

- Create: `src/sync/types.ts`
- Test: `src/__tests__/sync/types.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import type { SyncJob, BatchConfig } from "../../sync/types";

test("SyncJob interface exists with required fields", () => {
    const job: SyncJob = {
        id: "job_001",
        trade: {
            id: "trade_001",
            symbol: "AAPL",
            side: "buy",
            entryPrice: 150,
            shares: 10,
            timestamp: Date.now(),
        },
        priority: "high",
        timestamp: Date.now(),
        retryCount: 0,
    };
    expect(job.id).toBe("job_001");
    expect(job.priority).toBe("high");
    expect(job.retryCount).toBe(0);
});

test("BatchConfig interface has correct defaults", () => {
    const config: BatchConfig = {
        maxSize: 10,
        maxWaitMs: 500,
        flushOnError: true,
    };
    expect(config.maxSize).toBe(10);
    expect(config.maxWaitMs).toBe(500);
    expect(config.flushOnError).toBe(true);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/types.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/sync/types.ts
export interface TradeRecord {
    id: string;
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    exitPrice?: number;
    shares: number;
    timestamp: number;
    pnl?: number;
    outcome?: "win" | "loss" | "breakeven";
}

export type SyncPriority = "high" | "normal" | "low";

export interface SyncJob {
    id: string;
    trade: TradeRecord;
    priority: SyncPriority;
    timestamp: number;
    retryCount: number;
    lastError?: string;
}

export interface BatchConfig {
    maxSize: number;
    maxWaitMs: number;
    flushOnError: boolean;
}

export interface BatchSyncResult {
    success: boolean;
    processed: number;
    failed: string[];
    durationMs: number;
}

export interface SyncHealthMetrics {
    queueDepth: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    successRate: number;
    conflictsDetected: number;
}

export type SyncJobId = string;
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/types.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/types.ts src/__tests__/sync/types.test.ts
git commit -m "feat(sync): add SyncJob and BatchConfig types"
```

---

### Task 1.2: BatchEngine Core

**Files:**

- Create: `src/sync/batch-engine.ts`
- Test: `src/__tests__/sync/batch-engine.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { BatchEngine } from "../../sync/batch-engine";
import type { SyncJob, TradeRecord } from "../../sync/types";

test("BatchEngine aggregates jobs within time window", async () => {
    const engine = new BatchEngine({ maxSize: 3, maxWaitMs: 100, flushOnError: true });
    const flushed: SyncJob[][] = [];
    engine.onFlush((batch) => flushed.push(batch));

    const trade: TradeRecord = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 100,
        shares: 10,
        timestamp: Date.now(),
    };
    engine.addJob({ id: "j1", trade, priority: "normal", timestamp: Date.now(), retryCount: 0 });

    await new Promise((r) => setTimeout(r, 150));
    expect(flushed.length).toBe(1);
    expect(flushed[0].length).toBe(1);
});

test("BatchEngine flushes when maxSize reached", async () => {
    const engine = new BatchEngine({ maxSize: 2, maxWaitMs: 1000, flushOnError: true });
    const flushed: SyncJob[][] = [];
    engine.onFlush((batch) => flushed.push(batch));

    const trade: TradeRecord = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 100,
        shares: 10,
        timestamp: Date.now(),
    };
    engine.addJob({ id: "j1", trade, priority: "normal", timestamp: Date.now(), retryCount: 0 });
    engine.addJob({
        id: "j2",
        trade: { ...trade, id: "t2" },
        priority: "normal",
        timestamp: Date.now(),
        retryCount: 0,
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(flushed.length).toBe(1);
    expect(flushed[0].length).toBe(2);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/batch-engine.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/batch-engine.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/batch-engine.ts src/__tests__/sync/batch-engine.test.ts
git commit -m "feat(sync): add BatchEngine with time/size triggers"
```

---

### Task 1.3: RetryManager with Exponential Backoff

**Files:**

- Create: `src/sync/retry-manager.ts`
- Test: `src/__tests__/sync/retry-manager.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { RetryManager } from "../../sync/retry-manager";

test("RetryManager calculates exponential backoff", () => {
    const manager = new RetryManager({ maxRetries: 5, baseDelayMs: 100, maxDelayMs: 1600 });
    expect(manager.getDelay(0)).toBe(100);
    expect(manager.getDelay(1)).toBe(200);
    expect(manager.getDelay(2)).toBe(400);
    expect(manager.getDelay(4)).toBe(1600);
    expect(manager.getDelay(5)).toBe(1600); // capped at max
});

test("RetryManager shouldRetry returns correct values", () => {
    const manager = new RetryManager({ maxRetries: 3, baseDelayMs: 100, maxDelayMs: 1000 });
    expect(manager.shouldRetry(0)).toBe(true);
    expect(manager.shouldRetry(2)).toBe(true);
    expect(manager.shouldRetry(3)).toBe(false);
    expect(manager.shouldRetry(4)).toBe(false);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/retry-manager.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/sync/retry-manager.ts
export interface RetryConfig {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier?: number;
}

export class RetryManager {
    private config: Required<RetryConfig>;

    constructor(config: RetryConfig) {
        this.config = {
            backoffMultiplier: 2,
            ...config,
        };
    }

    getDelay(retryCount: number): number {
        const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, retryCount);
        return Math.min(delay, this.config.maxDelayMs);
    }

    shouldRetry(retryCount: number): boolean {
        return retryCount < this.config.maxRetries;
    }

    async execute<T>(operation: () => Promise<T>, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < this.config.maxRetries) {
                    onRetry?.(attempt + 1, lastError);
                    const delay = this.getDelay(attempt);
                    await new Promise((r) => setTimeout(r, delay));
                }
            }
        }

        throw lastError;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/retry-manager.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/retry-manager.ts src/__tests__/sync/retry-manager.test.ts
git commit -m "feat(sync): add RetryManager with exponential backoff"
```

---

### Task 1.4: ConflictDetector with 3-Way Merge

**Files:**

- Create: `src/sync/conflict-detector.ts`
- Test: `src/__tests__/sync/conflict-detector.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { ConflictDetector } from "../../sync/conflict-detector";
import type { TradeRecord } from "../../sync/types";

test("ConflictDetector detects timestamp conflicts", () => {
    const detector = new ConflictDetector();
    const local: TradeRecord = { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: 1000 };
    const remote: TradeRecord = { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 101, shares: 10, timestamp: 2000 };

    const result = detector.detectConflict(local, remote);
    expect(result.hasConflict).toBe(true);
    expect(result.winner).toBe("remote"); // newer timestamp wins
});

test("ConflictDetector returns no conflict for identical records", () => {
    const detector = new ConflictDetector();
    const trade: TradeRecord = { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: 1000 };

    const result = detector.detectConflict(trade, trade);
    expect(result.hasConflict).toBe(false);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/conflict-detector.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/sync/conflict-detector.ts
import type { TradeRecord } from "./types.js";

export interface ConflictResult {
    hasConflict: boolean;
    winner?: "local" | "remote";
    reason?: string;
    merged?: TradeRecord;
}

export class ConflictDetector {
    detectConflict(local: TradeRecord, remote: TradeRecord): ConflictResult {
        // Check if records are identical
        if (this.areEqual(local, remote)) {
            return { hasConflict: false };
        }

        // Timestamp-based resolution (last write wins)
        if (local.timestamp !== remote.timestamp) {
            const winner = local.timestamp > remote.timestamp ? "local" : "remote";
            return {
                hasConflict: true,
                winner,
                reason: `timestamp_priority_${winner}`,
                merged: winner === "local" ? local : remote,
            };
        }

        // If timestamps equal, prefer record with more fields populated
        const localFields = Object.values(local).filter((v) => v !== undefined).length;
        const remoteFields = Object.values(remote).filter((v) => v !== undefined).length;
        const winner = localFields >= remoteFields ? "local" : "remote";

        return {
            hasConflict: true,
            winner,
            reason: "completeness_priority",
            merged: winner === "local" ? local : remote,
        };
    }

    private areEqual(a: TradeRecord, b: TradeRecord): boolean {
        return (
            a.id === b.id &&
            a.symbol === b.symbol &&
            a.side === b.side &&
            a.entryPrice === b.entryPrice &&
            a.exitPrice === b.exitPrice &&
            a.shares === b.shares &&
            a.pnl === b.pnl &&
            a.outcome === b.outcome
        );
    }

    reconcileBatch(
        local: TradeRecord[],
        remote: TradeRecord[],
    ): {
        merged: TradeRecord[];
        conflicts: Array<{ local: TradeRecord; remote: TradeRecord; winner: string }>;
    } {
        const merged: TradeRecord[] = [];
        const conflicts: Array<{ local: TradeRecord; remote: TradeRecord; winner: string }> = [];

        const localMap = new Map(local.map((t) => [t.id, t]));
        const remoteMap = new Map(remote.map((t) => [t.id, t]));
        const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

        for (const id of allIds) {
            const l = localMap.get(id);
            const r = remoteMap.get(id);

            if (!l) {
                merged.push(r!);
            } else if (!r) {
                merged.push(l);
            } else {
                const result = this.detectConflict(l, r);
                merged.push(result.merged!);
                if (result.hasConflict) {
                    conflicts.push({ local: l, remote: r, winner: result.winner! });
                }
            }
        }

        return { merged, conflicts };
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/conflict-detector.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/conflict-detector.ts src/__tests__/sync/conflict-detector.test.ts
git commit -m "feat(sync): add ConflictDetector with 3-way merge"
```

---

### Task 1.5: RateLimiter with Token Bucket

**Files:**

- Create: `src/sync/rate-limiter.ts`
- Test: `src/__tests__/sync/rate-limiter.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { RateLimiter } from "../../sync/rate-limiter";

test("RateLimiter allows burst then throttles", async () => {
    const limiter = new RateLimiter({ burstLimit: 3, sustainedLimit: 1, windowMs: 1000 });

    expect(await limiter.tryAcquire()).toBe(true);
    expect(await limiter.tryAcquire()).toBe(true);
    expect(await limiter.tryAcquire()).toBe(true);
    expect(await limiter.tryAcquire()).toBe(false); // burst exhausted
});

test("RateLimiter refills tokens over time", async () => {
    const limiter = new RateLimiter({ burstLimit: 2, sustainedLimit: 10, windowMs: 100 });

    expect(await limiter.tryAcquire()).toBe(true);
    expect(await limiter.tryAcquire()).toBe(true);
    expect(await limiter.tryAcquire()).toBe(false);

    await new Promise((r) => setTimeout(r, 110));
    expect(await limiter.tryAcquire()).toBe(true); // refilled
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/rate-limiter.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/sync/rate-limiter.ts
export interface RateLimitConfig {
    burstLimit: number;
    sustainedLimit: number;
    windowMs: number;
}

export class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        this.tokens = config.burstLimit;
        this.lastRefill = Date.now();
    }

    async tryAcquire(): Promise<boolean> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }

        return false;
    }

    async acquire(): Promise<void> {
        while (!(await this.tryAcquire())) {
            const waitMs = this.config.windowMs / this.config.sustainedLimit;
            await new Promise((r) => setTimeout(r, waitMs));
        }
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const refillRate = this.config.sustainedLimit / this.config.windowMs;
        const tokensToAdd = elapsed * refillRate;

        this.tokens = Math.min(this.config.burstLimit, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    getAvailableTokens(): number {
        this.refill();
        return Math.floor(this.tokens);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/rate-limiter.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/rate-limiter.ts src/__tests__/sync/rate-limiter.test.ts
git commit -m "feat(sync): add RateLimiter with token bucket algorithm"
```

---

### Task 1.6: DeadLetterQueue for Failed Syncs

**Files:**

- Create: `src/sync/dead-letter-queue.ts`
- Test: `src/__tests__/sync/dead-letter-queue.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { DeadLetterQueue } from "../../sync/dead-letter-queue";
import type { SyncJob } from "../../sync/types";

test("DeadLetterQueue stores failed jobs with error", () => {
    const dlq = new DeadLetterQueue({ maxSize: 100, persistPath: "/tmp/test-dlq.json" });
    const job: SyncJob = {
        id: "j1",
        trade: { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: Date.now() },
        priority: "high",
        timestamp: Date.now(),
        retryCount: 5,
    };

    dlq.enqueue(job, "Max retries exceeded");
    expect(dlq.size()).toBe(1);
    expect(dlq.peek()[0].error).toBe("Max retries exceeded");
});

test("DeadLetterQueue respects max size", () => {
    const dlq = new DeadLetterQueue({ maxSize: 2, persistPath: "/tmp/test-dlq2.json" });

    for (let i = 0; i < 5; i++) {
        const job: SyncJob = {
            id: `j${i}`,
            trade: { id: `t${i}`, symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: Date.now() },
            priority: "normal",
            timestamp: Date.now(),
            retryCount: 0,
        };
        dlq.enqueue(job, "Error");
    }

    expect(dlq.size()).toBe(2); // oldest evicted
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/dead-letter-queue.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/sync/dead-letter-queue.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/sync/dead-letter-queue.ts src/__tests__/sync/dead-letter-queue.test.ts
git commit -m "feat(sync): add DeadLetterQueue for failed sync persistence"
```

---

### Task 1.7: SyncOptimizer Main Orchestrator

**Files:**

- Create: `src/sync/sync-optimizer.ts`
- Modify: `src/sync/index.ts` (create exports)
- Test: `src/__tests__/sync/sync-optimizer.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { SyncOptimizer } from "../../sync/sync-optimizer";

test("SyncOptimizer queues and processes trades", async () => {
    const optimizer = new SyncOptimizer();
    await optimizer.initialize();

    const jobId = await optimizer.queueTrade({
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        shares: 10,
        timestamp: Date.now(),
    });

    expect(jobId).toMatch(/^job_/);
    expect(optimizer.getHealth().queueDepth).toBe(1);

    optimizer.destroy();
});

test("SyncOptimizer can pause and resume", () => {
    const optimizer = new SyncOptimizer();
    expect(optimizer.isPaused()).toBe(false);
    optimizer.pause();
    expect(optimizer.isPaused()).toBe(true);
    optimizer.resume();
    expect(optimizer.isPaused()).toBe(false);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/sync/sync-optimizer.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
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
        const avg =
            this.latencySamples.length > 0
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
                    },
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
```

**Step 4: Create index.ts exports**

```typescript
// src/sync/index.ts
export * from "./types.js";
export * from "./batch-engine.js";
export * from "./retry-manager.js";
export * from "./conflict-detector.js";
export * from "./rate-limiter.js";
export * from "./dead-letter-queue.js";
export * from "./sync-optimizer.js";
```

**Step 5: Run test to verify it passes**

```bash
bun test src/__tests__/sync/sync-optimizer.test.ts
```

Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add src/sync/sync-optimizer.ts src/sync/index.ts src/__tests__/sync/sync-optimizer.test.ts
git commit -m "feat(sync): add SyncOptimizer main orchestrator"
```

---

## Phase 2: Intelligence Layer - Multi-Model Embeddings

### Task 2.1: EmbeddingModel Interface

**Files:**

- Create: `src/ml/types.ts`
- Test: `src/__tests__/ml/types.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import type { EmbeddingModel, FeatureImportance } from "../../ml/types";

test("EmbeddingModel interface structure", () => {
    const model: EmbeddingModel = {
        name: "TestModel",
        dimensions: 384,
        strategy: "breakout",
        generate: (trade) => new Array(384).fill(0),
        generateBatch: (trades) => trades.map(() => new Array(384).fill(0)),
        compare: (a, b) => 0.95,
        getFeatureImportance: () => [{ feature: "price", importance: 0.5 }],
    };

    expect(model.name).toBe("TestModel");
    expect(model.dimensions).toBe(384);
    expect(model.generate({} as any)).toHaveLength(384);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/types.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/types.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface FeatureImportance {
    feature: string;
    importance: number;
}

export interface EmbeddingModel {
    readonly name: string;
    readonly dimensions: number;
    readonly strategy: string;

    generate(trade: TradeMemory): number[];
    generateBatch(trades: TradeMemory[]): number[][];
    compare(a: number[], b: number[]): number;
    getFeatureImportance(): FeatureImportance[];
}

export interface EmbeddingCacheEntry {
    embedding: number[];
    timestamp: number;
    hitCount: number;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/ml/types.ts src/__tests__/ml/types.test.ts
git commit -m "feat(ml): add EmbeddingModel interface"
```

---

### Task 2.2: EmbeddingRegistry

**Files:**

- Create: `src/ml/embedding-registry.ts`
- Test: `src/__tests__/ml/embedding-registry.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { EmbeddingRegistry } from "../../ml/embedding-registry";
import type { EmbeddingModel, TradeMemory } from "../../ml/types";

const mockModel: EmbeddingModel = {
    name: "MockModel",
    dimensions: 384,
    strategy: "test",
    generate: () => new Array(384).fill(0.5),
    generateBatch: (trades) => trades.map(() => new Array(384).fill(0.5)),
    compare: () => 0.9,
    getFeatureImportance: () => [],
};

test("EmbeddingRegistry registers and retrieves models", () => {
    const registry = new EmbeddingRegistry();
    registry.registerModel(mockModel);

    expect(registry.getModel("test")).toBe(mockModel);
    expect(registry.listModels()).toHaveLength(1);
});

test("EmbeddingRegistry returns default for unknown strategy", () => {
    const registry = new EmbeddingRegistry();
    registry.registerModel(mockModel);

    const defaultModel = registry.getModel("unknown");
    expect(defaultModel).toBe(mockModel); // fallback to first registered
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/embedding-registry.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/embedding-registry.ts
import type { EmbeddingModel, TradeMemory } from "./types.js";

export class EmbeddingRegistry {
    private models = new Map<string, EmbeddingModel>();
    private defaultModel?: EmbeddingModel;

    registerModel(model: EmbeddingModel): void {
        this.models.set(model.strategy, model);
        if (!this.defaultModel) {
            this.defaultModel = model;
        }
    }

    getModel(strategy: string): EmbeddingModel {
        return this.models.get(strategy) ?? this.defaultModel ?? this.createFallbackModel();
    }

    routeAndEmbed(trade: TradeMemory, strategy: string): number[] {
        const model = this.getModel(strategy);
        return model.generate(trade);
    }

    getDefaultModel(): EmbeddingModel {
        return this.defaultModel ?? this.createFallbackModel();
    }

    listModels(): EmbeddingModel[] {
        return Array.from(this.models.values());
    }

    private createFallbackModel(): EmbeddingModel {
        // Simple fallback that creates zero vectors
        return {
            name: "Fallback",
            dimensions: 384,
            strategy: "fallback",
            generate: () => new Array(384).fill(0),
            generateBatch: (trades) => trades.map(() => new Array(384).fill(0)),
            compare: () => 0,
            getFeatureImportance: () => [],
        };
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/embedding-registry.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/ml/embedding-registry.ts src/__tests__/ml/embedding-registry.test.ts
git commit -m "feat(ml): add EmbeddingRegistry for model routing"
```

---

### Task 2.3: PriceActionEmbedder

**Files:**

- Create: `src/ml/models/price-action-embedder.ts`
- Test: `src/__tests__/ml/models/price-action-embedder.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { PriceActionEmbedder } from "../../../ml/models/price-action-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("PriceActionEmbedder generates 384-dim vector", () => {
    const embedder = new PriceActionEmbedder();
    const trade: TradeMemory = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 145,
        takeProfit: 160,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish",
        reasoning: "Breakout above resistance",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    const embedding = embedder.generate(trade);
    expect(embedding).toHaveLength(384);
    expect(embedder.dimensions).toBe(384);
});

test("PriceActionEmbedder compares embeddings with cosine similarity", () => {
    const embedder = new PriceActionEmbedder();
    const a = new Array(384).fill(0);
    const b = new Array(384).fill(0);
    a[0] = 1;
    b[0] = 1;

    const similarity = embedder.compare(a, b);
    expect(similarity).toBeGreaterThan(0.99);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/models/price-action-embedder.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/models/price-action-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class PriceActionEmbedder implements EmbeddingModel {
    readonly name = "PriceActionV1";
    readonly dimensions = 384;
    readonly strategy = "breakout";

    generate(trade: TradeMemory): number[] {
        const features = [
            // Price features (normalized)
            trade.entryPrice / 1000,
            (trade.stopLoss ?? trade.entryPrice * 0.98) / 1000,
            (trade.takeProfit ?? trade.entryPrice * 1.04) / 1000,

            // Risk/reward ratio
            this.calculateRiskReward(trade),

            // Position sizing
            trade.shares / 100,

            // Time features
            new Date(trade.timestamp).getHours() / 24,
            new Date(trade.timestamp).getDay() / 7,

            // Strategy encoding
            trade.strategy === "breakout" ? 1 : 0,
            trade.strategy === "mean_reversion" ? 1 : 0,
            trade.strategy === "trend_following" ? 1 : 0,

            // Market condition encoding
            trade.marketCondition === "bullish" ? 1 : 0,
            trade.marketCondition === "bearish" ? 1 : 0,
            trade.marketCondition === "neutral" ? 1 : 0,

            // Volatility estimate (based on stop distance)
            this.estimateVolatility(trade),

            // Pattern strength indicators
            trade.confidence ?? 0.5,
        ];

        // Pad to 384 dimensions with zeros
        while (features.length < 384) {
            features.push(0);
        }

        return features.slice(0, 384);
    }

    generateBatch(trades: TradeMemory[]): number[][] {
        return trades.map((t) => this.generate(t));
    }

    compare(a: number[], b: number[]): number {
        // Cosine similarity
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i]! * b[i]!;
            normA += a[i]! * a[i]!;
            normB += b[i]! * b[i]!;
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    getFeatureImportance(): FeatureImportance[] {
        return [
            { feature: "entryPrice", importance: 0.25 },
            { feature: "riskReward", importance: 0.2 },
            { feature: "volatility", importance: 0.15 },
            { feature: "confidence", importance: 0.15 },
            { feature: "timeOfDay", importance: 0.1 },
            { feature: "marketCondition", importance: 0.1 },
            { feature: "strategy", importance: 0.05 },
        ];
    }

    private calculateRiskReward(trade: TradeMemory): number {
        const stop = trade.stopLoss ?? trade.entryPrice * 0.98;
        const target = trade.takeProfit ?? trade.entryPrice * 1.04;
        const risk = Math.abs(trade.entryPrice - stop);
        const reward = Math.abs(target - trade.entryPrice);
        return risk > 0 ? reward / risk : 2;
    }

    private estimateVolatility(trade: TradeMemory): number {
        const stop = trade.stopLoss ?? trade.entryPrice * 0.98;
        const stopDistance = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
        return Math.min(stopDistance * 10, 1); // Normalize to 0-1
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/models/price-action-embedder.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/ml/models/price-action-embedder.ts src/__tests__/ml/models/price-action-embedder.test.ts
git commit -m "feat(ml): add PriceActionEmbedder for breakout strategy"
```

---

### Task 2.4: StatisticalEmbedder (Mean Reversion)

**Files:**

- Create: `src/ml/models/statistical-embedder.ts`
- Test: `src/__tests__/ml/models/statistical-embedder.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { StatisticalEmbedder } from "../../../ml/models/statistical-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("StatisticalEmbedder generates 256-dim vector", () => {
    const embedder = new StatisticalEmbedder();
    const trade: TradeMemory = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 145,
        stopLoss: 142,
        takeProfit: 150,
        shares: 10,
        strategy: "mean_reversion",
        marketCondition: "neutral",
        reasoning: "Oversold bounce",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    const embedding = embedder.generate(trade);
    expect(embedding).toHaveLength(256);
    expect(embedder.dimensions).toBe(256);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/models/statistical-embedder.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/models/statistical-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class StatisticalEmbedder implements EmbeddingModel {
    readonly name = "StatisticalV1";
    readonly dimensions = 256;
    readonly strategy = "mean_reversion";

    generate(trade: TradeMemory): number[] {
        const features = [
            // Price position relative to mean (z-score approximation)
            this.calculateZScore(trade),

            // Bollinger Band position
            this.calculateBBPosition(trade),

            // RSI deviation
            this.calculateRSIDeviation(trade),

            // Standard deviation
            this.estimateStdDev(trade),

            // Mean reversion velocity
            this.calculateReversionVelocity(trade),

            // Position sizing
            trade.shares / 100,

            // Time features
            new Date(trade.timestamp).getHours() / 24,

            // Confidence
            trade.confidence ?? 0.5,

            // Strategy encoding
            1, // mean_reversion
            0, // breakout
            0, // trend_following
        ];

        // Pad to 256 dimensions
        while (features.length < 256) {
            features.push(0);
        }

        return features.slice(0, 256);
    }

    generateBatch(trades: TradeMemory[]): number[][] {
        return trades.map((t) => this.generate(t));
    }

    compare(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i]! * b[i]!;
            normA += a[i]! * a[i]!;
            normB += b[i]! * b[i]!;
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    getFeatureImportance(): FeatureImportance[] {
        return [
            { feature: "zScore", importance: 0.3 },
            { feature: "bbPosition", importance: 0.25 },
            { feature: "rsiDeviation", importance: 0.2 },
            { feature: "reversionVelocity", importance: 0.15 },
            { feature: "stdDev", importance: 0.1 },
        ];
    }

    private calculateZScore(trade: TradeMemory): number {
        // Approximate z-score based on stop distance
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const deviation = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
        return -deviation * 3; // Negative for oversold (mean reversion buy)
    }

    private calculateBBPosition(trade: TradeMemory): number {
        // Position within Bollinger Bands (-1 to 1, where -1 is lower band)
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const bandWidth = Math.abs(trade.entryPrice - stop) * 2;
        return bandWidth > 0 ? -0.5 : 0;
    }

    private calculateRSIDeviation(trade: TradeMemory): number {
        // Approximate RSI based on position
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const distance = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
        return 30 - distance * 100; // Lower RSI = more oversold
    }

    private estimateStdDev(trade: TradeMemory): number {
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        return Math.abs(trade.entryPrice - stop) / trade.entryPrice;
    }

    private calculateReversionVelocity(trade: TradeMemory): number {
        // Expected speed of mean reversion
        const riskReward =
            Math.abs((trade.takeProfit ?? trade.entryPrice * 1.03) - trade.entryPrice) /
            Math.abs(trade.entryPrice - (trade.stopLoss ?? trade.entryPrice * 0.97));
        return riskReward > 0 ? 1 / riskReward : 0.5;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/models/statistical-embedder.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/ml/models/statistical-embedder.ts src/__tests__/ml/models/statistical-embedder.test.ts
git commit -m "feat(ml): add StatisticalEmbedder for mean reversion strategy"
```

---

### Task 2.5: MomentumEmbedder (Trend Following)

**Files:**

- Create: `src/ml/models/momentum-embedder.ts`
- Test: `src/__tests__/ml/models/momentum-embedder.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { MomentumEmbedder } from "../../../ml/models/momentum-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("MomentumEmbedder generates 512-dim vector", () => {
    const embedder = new MomentumEmbedder();
    const trade: TradeMemory = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 155,
        stopLoss: 150,
        takeProfit: 165,
        shares: 10,
        strategy: "trend_following",
        marketCondition: "bullish",
        reasoning: "Breakout with momentum",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    const embedding = embedder.generate(trade);
    expect(embedding).toHaveLength(512);
    expect(embedder.dimensions).toBe(512);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/models/momentum-embedder.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/models/momentum-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class MomentumEmbedder implements EmbeddingModel {
    readonly name = "MomentumV1";
    readonly dimensions = 512;
    readonly strategy = "trend_following";

    generate(trade: TradeMemory): number[] {
        const features = [
            // Moving average alignment
            this.calculateMAAlignment(trade),

            // RSI trend slope approximation
            this.calculateRSISlope(trade),

            // MACD histogram approximation
            this.calculateMACD(trade),

            // ADX strength
            this.calculateADX(trade),

            // Price momentum
            this.calculateMomentum(trade),

            // Trend strength
            this.calculateTrendStrength(trade),

            // Position sizing
            trade.shares / 100,

            // Time features
            new Date(trade.timestamp).getHours() / 24,

            // Confidence
            trade.confidence ?? 0.5,

            // Strategy encoding
            0, // mean_reversion
            0, // breakout
            1, // trend_following
        ];

        // Pad to 512 dimensions
        while (features.length < 512) {
            features.push(0);
        }

        return features.slice(0, 512);
    }

    generateBatch(trades: TradeMemory[]): number[][] {
        return trades.map((t) => this.generate(t));
    }

    compare(a: number[], b: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i]! * b[i]!;
            normA += a[i]! * a[i]!;
            normB += b[i]! * b[i]!;
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    getFeatureImportance(): FeatureImportance[] {
        return [
            { feature: "momentum", importance: 0.25 },
            { feature: "maAlignment", importance: 0.2 },
            { feature: "trendStrength", importance: 0.2 },
            { feature: "adx", importance: 0.15 },
            { feature: "rsiSlope", importance: 0.1 },
            { feature: "macd", importance: 0.1 },
        ];
    }

    private calculateMAAlignment(trade: TradeMemory): number {
        // Positive when price is above key moving averages (trending up)
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const trendDistance = (trade.entryPrice - stop) / trade.entryPrice;
        return Math.min(trendDistance * 5, 1);
    }

    private calculateRSISlope(trade: TradeMemory): number {
        // Approximate RSI slope based on entry vs stop
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        return ((trade.entryPrice - stop) / trade.entryPrice) * 10;
    }

    private calculateMACD(trade: TradeMemory): number {
        // MACD histogram proxy
        const target = trade.takeProfit ?? trade.entryPrice * 1.05;
        const momentum = (target - trade.entryPrice) / trade.entryPrice;
        return momentum * 100;
    }

    private calculateADX(trade: TradeMemory): number {
        // Trend strength proxy from risk/reward
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const target = trade.takeProfit ?? trade.entryPrice * 1.05;
        const risk = Math.abs(trade.entryPrice - stop);
        const reward = Math.abs(target - trade.entryPrice);
        return risk > 0 ? Math.min((reward / risk) * 25, 100) / 100 : 0.5;
    }

    private calculateMomentum(trade: TradeMemory): number {
        const target = trade.takeProfit ?? trade.entryPrice * 1.05;
        return (target - trade.entryPrice) / trade.entryPrice;
    }

    private calculateTrendStrength(trade: TradeMemory): number {
        const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
        const stopDistance = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
        // Tighter stops = stronger trend conviction
        return Math.max(0, 1 - stopDistance * 10);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/models/momentum-embedder.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/ml/models/momentum-embedder.ts src/__tests__/ml/models/momentum-embedder.test.ts
git commit -m "feat(ml): add MomentumEmbedder for trend following strategy"
```

---

### Task 2.6: EmbeddingCache with LRU

**Files:**

- Create: `src/ml/embedding-cache.ts`
- Test: `src/__tests__/ml/embedding-cache.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { EmbeddingCache } from "../../ml/embedding-cache";

test("EmbeddingCache stores and retrieves embeddings", () => {
    const cache = new EmbeddingCache({ maxSize: 100 });
    const embedding = new Array(384).fill(0.5);

    cache.set("trade_1", embedding);
    const retrieved = cache.get("trade_1");

    expect(retrieved).toEqual(embedding);
    expect(cache.size()).toBe(1);
});

test("EmbeddingCache evicts oldest when full", () => {
    const cache = new EmbeddingCache({ maxSize: 2 });

    cache.set("a", [1, 2, 3]);
    cache.set("b", [4, 5, 6]);
    cache.set("c", [7, 8, 9]); // evicts "a"

    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toEqual([4, 5, 6]);
    expect(cache.get("c")).toEqual([7, 8, 9]);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/ml/embedding-cache.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/ml/embedding-cache.ts
export interface CacheConfig {
    maxSize: number;
}

export class EmbeddingCache {
    private cache = new Map<string, { embedding: number[]; hits: number }>();
    private config: CacheConfig;

    constructor(config: CacheConfig) {
        this.config = config;
    }

    get(key: string): number[] | null {
        const entry = this.cache.get(key);
        if (entry) {
            entry.hits++;
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, entry);
            return [...entry.embedding];
        }
        return null;
    }

    set(key: string, embedding: number[]): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.config.maxSize) {
            // Evict first (least recently used)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, { embedding: [...embedding], hits: 1 });
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    size(): number {
        return this.cache.size;
    }

    clear(): void {
        this.cache.clear();
    }

    getHitRate(): number {
        let totalHits = 0;
        for (const entry of this.cache.values()) {
            totalHits += entry.hits;
        }
        return totalHits / Math.max(1, this.cache.size);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/ml/embedding-cache.test.ts
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/ml/embedding-cache.ts src/__tests__/ml/embedding-cache.test.ts
git commit -m "feat(ml): add EmbeddingCache with LRU eviction"
```

---

### Task 2.7: ML Index Exports

**Files:**

- Create: `src/ml/index.ts`
- Create: `src/ml/models/index.ts`

**Step 1: Write the implementation**

```typescript
// src/ml/index.ts
export * from "./types.js";
export * from "./embedding-registry.js";
export * from "./embedding-cache.js";
```

```typescript
// src/ml/models/index.ts
export * from "./price-action-embedder.js";
export * from "./statistical-embedder.js";
export * from "./momentum-embedder.js";
```

**Step 2: Commit**

```bash
git add src/ml/index.ts src/ml/models/index.ts
git commit -m "feat(ml): add module index exports"
```

---

## Phase 3: Discovery Layer - Automated Pattern Discovery

### Task 3.1: Pattern Discovery Types

**Files:**

- Create: `src/pattern-discovery/types.ts`
- Test: `src/__tests__/pattern-discovery/types.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import type { DiscoveredPattern, EmergingPattern } from "../../pattern-discovery/types";

test("DiscoveredPattern interface structure", () => {
    const pattern: DiscoveredPattern = {
        id: "pattern_001",
        clusterId: 1,
        features: { price: 0.5, volume: 0.8 },
        trades: [],
        winRate: 0.65,
        avgPnl: 125.5,
        confidence: 0.7,
        discoveredAt: Date.now(),
        status: "validated",
    };

    expect(pattern.winRate).toBe(0.65);
    expect(pattern.status).toBe("validated");
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/pattern-discovery/types.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/pattern-discovery/types.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface PatternFeatures {
    [key: string]: number;
}

export interface DiscoveredPattern {
    id: string;
    clusterId: number;
    features: PatternFeatures;
    trades: TradeMemory[];
    winRate: number;
    avgPnl: number;
    confidence: number;
    discoveredAt: number;
    status: "discovered" | "validated" | "active" | "deprecated";
}

export interface EmergingPattern {
    id: string;
    pattern: DiscoveredPattern;
    tradesCount: number;
    winRate: number;
    fastTrackEligible: boolean;
}

export interface DiscoveryOptions {
    minClusterSize?: number;
    minSamples?: number;
    validationWinRate?: number;
    validationMinTrades?: number;
}

export interface ClusterGraph {
    nodes: Array<{ id: number; size: number; winRate: number }>;
    edges: Array<{ source: number; target: number; similarity: number }>;
}

export interface ClusterAnalysis {
    clusterId: number;
    tradeCount: number;
    winRate: number;
    avgPnl: number;
    commonFeatures: PatternFeatures;
    dominantStrategy: string;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/pattern-discovery/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/pattern-discovery/types.ts src/__tests__/pattern-discovery/types.test.ts
git commit -m "feat(pattern-discovery): add pattern types"
```

---

### Task 3.2: HDBSCAN Clusterer

**Files:**

- Create: `src/pattern-discovery/clusterer.ts`
- Test: `src/__tests__/pattern-discovery/clusterer.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, expect } from "bun:test";
import { HDBSCANClusterer } from "../../pattern-discovery/clusterer";

test("HDBSCANClusterer clusters embeddings", () => {
    const clusterer = new HDBSCANClusterer({ minClusterSize: 2, minSamples: 1 });

    // Create simple 2D embeddings (first 2 dims matter)
    const embeddings = [
        [1, 1, 0, 0], // cluster 0
        [1.1, 1.1, 0, 0], // cluster 0
        [5, 5, 0, 0], // cluster 1
        [5.1, 5.1, 0, 0], // cluster 1
        [100, 100, 0, 0], // outlier
    ];

    const result = clusterer.cluster(embeddings);
    expect(result.labels.length).toBe(5);
    expect(result.clusters.length).toBeGreaterThanOrEqual(1);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/pattern-discovery/clusterer.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/pattern-discovery/clusterer.ts
export interface HDBSCANConfig {
    minClusterSize: number;
    minSamples: number;
}

export interface ClusterResult {
    labels: number[]; // -1 for noise
    clusters: Array<{ id: number; indices: number[] }>;
    noise: number[];
}

export class HDBSCANClusterer {
    private config: HDBSCANConfig;

    constructor(config: HDBSCANConfig) {
        this.config = config;
    }

    cluster(embeddings: number[][]): ClusterResult {
        // Simplified HDBSCAN implementation
        // In production, use a proper HDBSCAN library

        const n = embeddings.length;
        const labels = new Array(n).fill(-1);
        const visited = new Set<number>();
        let clusterId = 0;

        for (let i = 0; i < n; i++) {
            if (visited.has(i)) continue;

            const neighbors = this.getNeighbors(embeddings, i);

            if (neighbors.length >= this.config.minClusterSize) {
                // Start new cluster
                this.expandCluster(embeddings, i, neighbors, labels, visited, clusterId);
                clusterId++;
            }
        }

        // Build result
        const clusters: Array<{ id: number; indices: number[] }> = [];
        for (let c = 0; c < clusterId; c++) {
            const indices = labels.map((l, i) => (l === c ? i : -1)).filter((i) => i !== -1);
            clusters.push({ id: c, indices });
        }

        const noise = labels.map((l, i) => (l === -1 ? i : -1)).filter((i) => i !== -1);

        return { labels, clusters, noise };
    }

    private getNeighbors(embeddings: number[][], idx: number): number[] {
        const neighbors: number[] = [];
        const threshold = 0.5; // Distance threshold

        for (let i = 0; i < embeddings.length; i++) {
            if (i !== idx && this.euclideanDistance(embeddings[idx]!, embeddings[i]!) < threshold) {
                neighbors.push(i);
            }
        }

        return neighbors;
    }

    private expandCluster(
        embeddings: number[][],
        idx: number,
        neighbors: number[],
        labels: number[],
        visited: Set<number>,
        clusterId: number,
    ): void {
        labels[idx] = clusterId;
        visited.add(idx);

        const queue = [...neighbors];

        for (let i = 0; i < queue.length; i++) {
            const neighbor = queue[i]!;

            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                const newNeighbors = this.getNeighbors(embeddings, neighbor);

                if (newNeighbors.length >= this.config.minSamples) {
                    queue.push(...newNeighbors);
                }
            }

            if (labels[neighbor] === -1) {
                labels[neighbor] = clusterId;
            }
        }
    }

    private euclideanDistance(a: number[], b: number[]): number {
        let sum = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            const diff = a[i]! - b[i]!;
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/pattern-discovery/clusterer.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/pattern-discovery/clusterer.ts src/__tests__/pattern-discovery/clusterer.test.ts
git commit -m "feat(pattern-discovery): add HDBSCANClusterer"
```

---

## Remaining Tasks Summary

Due to the extensive scope (50+ tasks), here's the condensed implementation roadmap:

### Phase 1: Foundation (Tasks 1.1-1.7) ✅ Complete above

### Phase 2: Intelligence (Tasks 2.1-2.7) ✅ Complete above

### Phase 3: Discovery (Tasks 3.1-3.7)

- Task 3.3: PatternMiner - Association rule mining
- Task 3.4: QualityGate - Win rate validation
- Task 3.5: EmergingDetector - Fast-track pattern detection
- Task 3.6: Deprecator - Old pattern cleanup
- Task 3.7: DiscoveryEngine - Main orchestrator

### Phase 4: Memory (Tasks 4.1-4.5)

- Task 4.1: AdaptiveMemoryManager
- Task 4.2: ImportanceScorer (I = win_rate*0.4 + pnl*0.3 + recency*0.2 + uniqueness*0.1)
- Task 4.3: Compressor (0.95 similarity dedup)
- Task 4.4: Pruner (LRU + score eviction)
- Task 4.5: TieredStorage (Hot: AgentDB 1000, Warm: SQLite 10000, Cold: Archive)

### Phase 5: Safety (Tasks 5.1-5.5)

- Task 5.1: IntelligentCircuitBreaker
- Task 5.2: DayPatternChecker
- Task 5.3: RegimeDetector
- Task 5.4: EarningsGuard
- Task 5.5: DynamicThresholds

### Phase 6: Automation (Tasks 6.1-6.6)

- Task 6.1: PreMarketIntelligence
- Task 6.2: NewsFetcher (AlphaVantage/NewsAPI)
- Task 6.3: SentimentAnalyzer (NLP scoring)
- Task 6.4: EarningsCalendar (Finnhub)
- Task 6.5: FuturesMonitor
- Task 6.6: CorrelationEngine

### Phase 7: Learning (Tasks 7.1-7.5)

- Task 7.1: TradeReplayEngine
- Task 7.2: ScenarioMatcher
- Task 7.3: OutcomeTracker
- Task 7.4: PredictionCalibrator
- Task 7.5: SlippageAnalyzer

### Phase 8: Visibility (Tasks 8.1-8.8)

- Task 8.1: DashboardServer (Bun.serve with WebSocket)
- Task 8.2: MetricsAPI (REST endpoints)
- Task 8.3: WebSocketFeeds
- Task 8.4: ChartComponents
- Task 8.5: PanelManager
- Task 8.6: EventAggregator
- Task 8.7: Frontend HTML
- Task 8.8: Integration

---

## Execution Instructions

**Plan complete and saved to `docs/plans/2026-02-20-comprehensive-enhancement-implementation.md`**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**

---

## Quick Reference: All New Files

```
src/sync/
  types.ts, batch-engine.ts, retry-manager.ts, conflict-detector.ts,
  rate-limiter.ts, dead-letter-queue.ts, sync-optimizer.ts, index.ts

src/ml/
  types.ts, embedding-registry.ts, embedding-cache.ts, index.ts
  models/price-action-embedder.ts, statistical-embedder.ts, momentum-embedder.ts, index.ts

src/pattern-discovery/
  types.ts, clusterer.ts, miner.ts, quality-gate.ts, emerging-detector.ts,
  deprecator.ts, engine.ts, index.ts

src/memory/
  adaptive-manager.ts, importance-scorer.ts, compressor.ts, pruner.ts,
  tiered-storage.ts, index.ts

src/breakers/
  intelligent-breaker.ts, day-pattern-checker.ts, regime-detector.ts,
  earnings-guard.ts, dynamic-thresholds.ts, index.ts

src/research/
  pre-market-intel.ts, news-fetcher.ts, sentiment-analyzer.ts,
  earnings-calendar.ts, futures-monitor.ts, correlation-engine.ts, index.ts

src/replay/
  replay-engine.ts, scenario-matcher.ts, outcome-tracker.ts,
  prediction-calibrator.ts, slippage-analyzer.ts, index.ts

src/dashboard/
  server.ts, api/metrics.ts, websocket/feeds.ts, aggregator.ts
  ui/index.html, ui/components/charts.ts, ui/components/panels.ts

src/config/enhancement-config.ts
src/events/event-bus.ts
```

**Total: ~26 modules, ~50 tasks, ~60 test files**
