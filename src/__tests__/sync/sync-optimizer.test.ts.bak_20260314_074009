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
