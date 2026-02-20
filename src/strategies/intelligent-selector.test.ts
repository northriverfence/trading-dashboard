import { test, expect, describe } from "bun:test";
import { IntelligentStrategySelector, type MarketCondition } from "./intelligent-selector.js";

describe("IntelligentStrategySelector", () => {
  test("should return strategy recommendation with proper types", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
      condition: "bullish",
      indicators: {
        rsi: 55,
        trend: "up",
        volatility: 0.15,
      },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.confidence).toBeNumber();
    expect(result.expectedWinRate).toBeNumber();
    expect(result.reasoning).toBeString();

    // Should return one of known strategies
    expect(["breakout", "mean_reversion", "trend_following"]).toContain(result.strategy);
  });

  test("should handle bullish market condition", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
      condition: "bullish",
      indicators: {
        rsi: 60,
        trend: "up",
        volatility: 0.1,
      },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.expectedWinRate).toBeGreaterThanOrEqual(0);
    expect(result.expectedWinRate).toBeLessThanOrEqual(1);
  });

  test("should handle bearish market condition", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
      condition: "bearish",
      indicators: {
        rsi: 40,
        trend: "down",
        volatility: 0.2,
      },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.reasoning).toBeString();
    // Reasoning should either contain trade info or fallback message
    expect(
      result.reasoning.includes("trades") ||
        result.reasoning.includes("Defaulting") ||
        result.reasoning.includes("unavailable"),
    ).toBe(true);
  });

  test("should handle neutral market condition", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
      condition: "neutral",
      indicators: {
        rsi: 50,
        trend: "sideways",
        volatility: 0.05,
      },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.reasoning).toBeString();
  });

  test("should handle volatile market condition", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
      condition: "volatile",
      indicators: {
        rsi: 55,
        trend: "up",
        volatility: 0.3,
      },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.confidence).toBeNumber();
  });

  test("getStrategyPerformance should return performance metrics", async () => {
    const selector = new IntelligentStrategySelector();

    const performance = await selector.getStrategyPerformance("breakout");

    expect(performance.totalTrades).toBeNumber();
    expect(performance.winRate).toBeNumber();
    expect(performance.avgPnl).toBeNumber();
    expect(performance.totalTrades).toBeGreaterThanOrEqual(0);
    expect(performance.winRate).toBeGreaterThanOrEqual(0);
    expect(performance.avgPnl).toBeDefined();
  });

  test("getStrategyPerformance should return zeros for unknown strategy", async () => {
    const selector = new IntelligentStrategySelector();

    const performance = await selector.getStrategyPerformance("unknown_strategy");

    expect(performance.totalTrades).toBe(0);
    expect(performance.winRate).toBe(0);
    expect(performance.avgPnl).toBe(0);
  });
});
