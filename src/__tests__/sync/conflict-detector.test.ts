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
