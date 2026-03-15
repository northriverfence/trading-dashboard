import { test, expect } from "bun:test";
import { TieredStorage } from "../../memory/tiered-storage.js";
import type { TradeMemory } from "../../agentdb-integration.js";

test("TieredStorage stores trades in hot tier", () => {
  const storage = new TieredStorage({
    hotSize: 1000,
    warmSize: 10000,
  });

  const trade = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 100,
    shares: 10,
    strategy: "breakout",
    marketCondition: "bullish",
    timestamp: Date.now(),
    mistakes: [],
    lessons: [],
    stopLoss: 98,
    takeProfit: 105,
    reasoning: "Test",
  };

  storage.store(trade as TradeMemory);
  expect(storage.getHotCount()).toBe(1);
});

test("TieredStorage moves old trades to warm tier", () => {
  const storage = new TieredStorage({
    hotSize: 2,
    warmSize: 10,
  });

  for (let i = 0; i < 5; i++) {
    const trade = {
      id: `t${i}`,
      symbol: "AAPL",
      side: "buy",
      entryPrice: 100 + i,
      shares: 10,
      strategy: "breakout",
      marketCondition: "bullish",
      timestamp: Date.now() - i * 1000,
      mistakes: [],
      lessons: [],
      stopLoss: 98,
      takeProfit: 105,
      reasoning: "Test",
    };
    storage.store(trade as TradeMemory);
  }

  expect(storage.getHotCount()).toBeLessThanOrEqual(2);
  expect(storage.getWarmCount()).toBeGreaterThan(0);
});
