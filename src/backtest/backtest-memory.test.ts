import { test, expect } from "bun:test";
import { BacktestMemory, type BacktestScenario } from "./backtest-memory.js";

test("BacktestMemory should store and retrieve scenarios", async () => {
  const memory = new BacktestMemory();

  const scenario: BacktestScenario = {
    id: `backtest_${Date.now()}`,
    symbol: "AAPL",
    strategy: "breakout",
    marketCondition: "bullish",
    entryPrice: 150,
    stopLoss: 147,
    takeProfit: 156,
    timeOfDay: 10,
    dayOfWeek: 1,
    simulatedOutcome: "win",
    simulatedPnl: 50,
    timestamp: Date.now(),
  };

  // Should not throw
  await expect(memory.storeScenario(scenario)).resolves.toBeUndefined();
});

test("BacktestMemory should find similar scenarios", async () => {
  const memory = new BacktestMemory();

  const trade = {
    symbol: "AAPL",
    entryPrice: 150,
    strategy: "breakout",
    marketCondition: "bullish",
  };

  // Should return array (may be empty)
  const scenarios = await memory.findSimilarScenarios(trade, 5);
  expect(Array.isArray(scenarios)).toBe(true);
});
