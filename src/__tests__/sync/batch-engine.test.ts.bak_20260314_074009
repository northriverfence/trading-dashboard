import { test, expect } from "bun:test";
import { BatchEngine } from "../../sync/batch-engine";
import type { SyncJob, TradeRecord } from "../../sync/types";

test("BatchEngine aggregates jobs within time window", async () => {
  const engine = new BatchEngine({ maxSize: 3, maxWaitMs: 100, flushOnError: true });
  const flushed: SyncJob[][] = [];
  engine.onFlush((batch) => flushed.push(batch));

  const trade: TradeRecord = { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: Date.now() };
  engine.addJob({ id: "j1", trade, priority: "normal", timestamp: Date.now(), retryCount: 0 });

  await new Promise((r) => setTimeout(r, 150));
  expect(flushed.length).toBe(1);
  expect(flushed[0].length).toBe(1);
});

test("BatchEngine flushes when maxSize reached", async () => {
  const engine = new BatchEngine({ maxSize: 2, maxWaitMs: 1000, flushOnError: true });
  const flushed: SyncJob[][] = [];
  engine.onFlush((batch) => flushed.push(batch));

  const trade: TradeRecord = { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, timestamp: Date.now() };
  engine.addJob({ id: "j1", trade, priority: "normal", timestamp: Date.now(), retryCount: 0 });
  engine.addJob({ id: "j2", trade: { ...trade, id: "t2" }, priority: "normal", timestamp: Date.now(), retryCount: 0 });

  await new Promise((r) => setTimeout(r, 50));
  expect(flushed.length).toBe(1);
  expect(flushed[0].length).toBe(2);
});
