// src/__tests__/sync/dead-letter-queue.test.ts
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
