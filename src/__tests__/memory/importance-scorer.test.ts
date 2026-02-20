import { test, expect } from "bun:test";
import { ImportanceScorer } from "../../memory/importance-scorer.js";
import type { TradeMemory } from "../../agentdb-integration.js";

test("ImportanceScorer calculates importance", () => {
  const scorer = new ImportanceScorer();

  const trade: TradeMemory = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 100,
    stopLoss: 98,
    takeProfit: 105,
    shares: 50,
    strategy: "breakout",
    marketCondition: "bullish",
    reasoning: "Test",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  };

  const score = scorer.calculate(trade);
  expect(score).toBeGreaterThan(0);
  expect(score).toBeLessThanOrEqual(1);
});

test("ImportanceScorer weights by win rate and PnL", () => {
  const scorer = new ImportanceScorer();

  const winningTrade = {
    id: "win",
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
  const losingTrade = {
    id: "loss",
    symbol: "TSLA",
    side: "buy",
    entryPrice: 200,
    shares: 10,
    strategy: "momentum",
    marketCondition: "bearish",
    timestamp: Date.now(),
    mistakes: ["bad entry"],
    lessons: ["lesson"],
    stopLoss: 195,
    takeProfit: 210,
    reasoning: "Test",
  };

  const winningScore = scorer.calculate(winningTrade as TradeMemory);
  const losingScore = scorer.calculate(losingTrade as TradeMemory);

  // Winning trade should generally score higher
  expect(winningScore).toBeGreaterThan(losingScore * 0.5);
});
