import { test, expect } from "bun:test";
import { AdaptiveMemoryManager } from "../../memory/adaptive-manager.js";
import type { TradeMemory } from "../../agentdb-integration.js";

test("AdaptiveMemoryManager stores and retrieves trades", () => {
  const manager = new AdaptiveMemoryManager({ maxSize: 100 });

  const trade: TradeMemory = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 100,
    stopLoss: 98,
    takeProfit: 105,
    shares: 10,
    strategy: "breakout",
    marketCondition: "bullish",
    reasoning: "Test",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  };

  manager.store(trade);
  const retrieved = manager.get("t1");
  expect(retrieved).toEqual(trade);
});

test("AdaptiveMemoryManager limits memory size", () => {
  const manager = new AdaptiveMemoryManager({ maxSize: 3 });

  for (let i = 0; i < 5; i++) {
    manager.store({
      id: `t${i}`,
      symbol: "AAPL",
      side: "buy",
      entryPrice: 100 + i,
      stopLoss: 98,
      takeProfit: 105,
      shares: 10,
      strategy: "breakout",
      marketCondition: "bullish",
      reasoning: "Test",
      mistakes: [],
      lessons: [],
      timestamp: Date.now() - i * 1000,
    });
  }

  expect(manager.size()).toBeLessThanOrEqual(3);
});

test("AdaptiveMemoryManager evicts low importance trades first", () => {
  const manager = new AdaptiveMemoryManager({ maxSize: 2 });

  // Store low importance trade first
  manager.store({
    id: "low",
    symbol: "XYZ",
    side: "buy",
    entryPrice: 100,
    stopLoss: 98,
    takeProfit: 105,
    shares: 1,
    strategy: "test",
    marketCondition: "neutral",
    reasoning: "Low importance",
    mistakes: [],
    lessons: [],
    timestamp: Date.now() - 10000,
  });

  // Store high importance trades
  manager.store({
    id: "high1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 150,
    stopLoss: 145,
    takeProfit: 160,
    shares: 100,
    strategy: "breakout",
    marketCondition: "bullish",
    reasoning: "High importance",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  });

  manager.store({
    id: "high2",
    symbol: "TSLA",
    side: "buy",
    entryPrice: 200,
    stopLoss: 195,
    takeProfit: 210,
    shares: 100,
    strategy: "momentum",
    marketCondition: "bullish",
    reasoning: "High importance",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  });

  // Low importance trade should be evicted
  expect(manager.get("low")).toBeNull();
  expect(manager.get("high1")).not.toBeNull();
  expect(manager.get("high2")).not.toBeNull();
});
