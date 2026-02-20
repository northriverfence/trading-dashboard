/**
 * SlippageAnalyzer Tests
 */

import { test, expect } from "bun:test";
import { SlippageAnalyzer, TradeExecution } from "./slippage-analyzer.js";

const createMockExecution = (overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  tradeId: `trade-${Date.now()}`,
  symbol: "AAPL",
  side: "buy",
  quantity: 100,
  intendedPrice: 150,
  executedPrice: 150.15,
  timestamp: new Date(),
  timeOfDay: 10,
  marketVolatility: 0.02,
  spread: 0.01,
  orderType: "market",
  ...overrides,
});

test("SlippageAnalyzer adds and analyzes executions", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution());

  const metrics = analyzer.getMetrics();
  expect(metrics.avgSlippage).toBeGreaterThan(0);
});

test("SlippageAnalyzer calculates slippage correctly", () => {
  const analyzer = new SlippageAnalyzer();

  // Buy order with higher executed price = adverse slippage
  const buyExec = createMockExecution({ side: "buy", intendedPrice: 150, executedPrice: 150.15 });
  const buySlippage = analyzer.calculateSlippage(buyExec);
  expect(buySlippage.direction).toBe("adverse");
  expect(buySlippage.slippagePercent).toBeCloseTo(0.001, 4);

  // Sell order with lower executed price = adverse slippage
  const sellExec = createMockExecution({ side: "sell", intendedPrice: 150, executedPrice: 149.85 });
  const sellSlippage = analyzer.calculateSlippage(sellExec);
  expect(sellSlippage.direction).toBe("adverse");
});

test("SlippageAnalyzer detects favorable slippage", () => {
  const analyzer = new SlippageAnalyzer();

  // Buy at lower price = favorable
  const buyExec = createMockExecution({ side: "buy", intendedPrice: 150, executedPrice: 149.9 });
  const slippage = analyzer.calculateSlippage(buyExec);
  expect(slippage.direction).toBe("favorable");
});

test("SlippageAnalyzer gets metrics by symbol", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution({ symbol: "AAPL", executedPrice: 150.2 }));
  analyzer.addExecution(createMockExecution({ symbol: "MSFT", executedPrice: 300.3 }));

  const metrics = analyzer.getMetrics();
  expect(metrics.slippageBySymbol.size).toBe(2);
});

test("SlippageAnalyzer gets metrics by time", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution({ timeOfDay: 9 }));
  analyzer.addExecution(createMockExecution({ timeOfDay: 12 }));
  analyzer.addExecution(createMockExecution({ timeOfDay: 15 }));

  const metrics = analyzer.getMetrics();
  expect(metrics.slippageByTime.size).toBeGreaterThan(0);
});

test("SlippageAnalyzer gets metrics by volatility", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution({ marketVolatility: 0.005 }));
  analyzer.addExecution(createMockExecution({ marketVolatility: 0.02 }));
  analyzer.addExecution(createMockExecution({ marketVolatility: 0.04 }));

  const metrics = analyzer.getMetrics();
  expect(metrics.slippageByVolatility.low).toBeDefined();
  expect(metrics.slippageByVolatility.normal).toBeDefined();
  expect(metrics.slippageByVolatility.high).toBeDefined();
});

test("SlippageAnalyzer identifies worst slippage", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution({ executedPrice: 150.05 }));
  analyzer.addExecution(createMockExecution({ executedPrice: 150.5 }));
  analyzer.addExecution(createMockExecution({ executedPrice: 150.3 }));

  const worst = analyzer.getWorstSlippage(2);
  expect(worst.length).toBe(2);
  expect(worst[0].slippagePercent).toBeGreaterThanOrEqual(worst[1].slippagePercent);
});

test("SlippageAnalyzer analyzes by order type", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution({ orderType: "market" }));
  analyzer.addExecution(createMockExecution({ orderType: "limit" }));
  analyzer.addExecution(createMockExecution({ orderType: "stop" }));

  const byType = analyzer.getSlippageByOrderType();
  expect(byType.market.tradeCount).toBeGreaterThan(0);
});

test("SlippageAnalyzer estimates future slippage", () => {
  const analyzer = new SlippageAnalyzer();

  for (let i = 0; i < 20; i++) {
    analyzer.addExecution(createMockExecution({ symbol: "AAPL" }));
  }

  const estimate = analyzer.estimateSlippage("AAPL", 100, 10);
  expect(estimate.estimatedSlippage).toBeGreaterThanOrEqual(0);
  expect(estimate.confidence).toBeGreaterThan(0);
});

test("SlippageAnalyzer generates recommendations", () => {
  const analyzer = new SlippageAnalyzer();

  for (let i = 0; i < 10; i++) {
    analyzer.addExecution(createMockExecution());
  }

  const recs = analyzer.getRecommendations();
  expect(recs.length).toBeGreaterThan(0);
});

test("SlippageAnalyzer clears old data", () => {
  const analyzer = new SlippageAnalyzer();

  const oldDate = new Date("2024-01-01");
  const recentDate = new Date();

  analyzer.addExecution(createMockExecution({ timestamp: oldDate }));
  analyzer.addExecution(createMockExecution({ timestamp: recentDate }));

  analyzer.clearOld(new Date("2024-02-01"));

  const metrics = analyzer.getMetrics();
  // Should have 1 execution left (the recent one)
  expect(metrics.avgSlippage).toBeGreaterThan(0);
});

test("SlippageAnalyzer clears all data", () => {
  const analyzer = new SlippageAnalyzer();

  analyzer.addExecution(createMockExecution());
  analyzer.clear();

  const metrics = analyzer.getMetrics();
  expect(metrics.avgSlippage).toBe(0);
});
