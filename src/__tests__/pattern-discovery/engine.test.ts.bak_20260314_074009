// src/__tests__/pattern-discovery/engine.test.ts
import { test, expect } from "bun:test";
import { PatternDiscoveryEngine } from "../../pattern-discovery/engine.js";
import type { TradeMemory } from "../../agentdb-integration.js";

test("DiscoveryEngine initializes correctly", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 3,
  });

  expect(engine).toBeDefined();
});

test("DiscoveryEngine discovers patterns from trades", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.5,
    minTrades: 2,
  });

  const trades: TradeMemory[] = [
    {
      id: "t1",
      symbol: "AAPL",
      side: "buy",
      entryPrice: 150,
      stopLoss: 145,
      takeProfit: 160,
      shares: 100,
      strategy: "breakout",
      marketCondition: "bullish",
      reasoning: "Strong momentum",
      mistakes: [],
      lessons: [],
      timestamp: Date.now(),
      outcome: "win",
      pnl: 100,
    },
    {
      id: "t2",
      symbol: "AAPL",
      side: "buy",
      entryPrice: 151,
      stopLoss: 146,
      takeProfit: 161,
      shares: 100,
      strategy: "breakout",
      marketCondition: "bullish",
      reasoning: "Strong momentum",
      mistakes: [],
      lessons: [],
      timestamp: Date.now(),
      outcome: "win",
      pnl: 100,
    },
  ];

  // Generate simple embeddings for trades
  const embeddings = trades.map(() => [1, 0, 0.5, 0.5, 1, 0.5, 1, 0, 0, 1, 0, 0]);

  const result = engine.discover(trades, embeddings);
  expect(result).toBeDefined();
  expect(result.patterns).toBeDefined();
  expect(result.clusterCount).toBeGreaterThanOrEqual(0);
});

test("DiscoveryEngine validates patterns", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 3,
  });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.9,
    discoveredAt: Date.now(),
    status: "discovered" as const,
  };

  const validation = engine.validate(pattern, 5);
  expect(validation.valid).toBe(true);
  expect(validation.grade).toBe("A");
});

test("DiscoveryEngine analyzes emerging patterns", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 3,
    fastTrackThreshold: 0.7,
    minTradesForFastTrack: 3,
  });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}] as TradeMemory[],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "discovered" as const,
  };

  const analysis = engine.analyzeEmerging(pattern, 3);
  expect(analysis.fastTrackEligible).toBe(true);
});

test("DiscoveryEngine gets patterns by status", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 2,
  });

  // Initially no patterns
  const activePatterns = engine.getPatternsByStatus("active");
  expect(activePatterns).toEqual([]);
});

test("DiscoveryEngine returns stats", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 3,
  });

  const stats = engine.getStats();
  expect(stats.totalPatterns).toBe(0);
  expect(stats.validatedPatterns).toBe(0);
  expect(stats.activePatterns).toBe(0);
  expect(stats.deprecatedPatterns).toBe(0);
});

test("DiscoveryEngine clears patterns", () => {
  const engine = new PatternDiscoveryEngine({
    minClusterSize: 2,
    minSamples: 1,
    minWinRate: 0.6,
    minTrades: 3,
  });

  engine.clear();
  const patterns = engine.getPatterns();
  expect(patterns.length).toBe(0);
});
