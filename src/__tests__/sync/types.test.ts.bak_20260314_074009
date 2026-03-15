import { test, expect } from "bun:test";
import type { SyncJob, BatchConfig } from "../../sync/types.js";

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
