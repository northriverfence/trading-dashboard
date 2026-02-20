import { test, expect } from "bun:test";
import { BacktestRunner } from "../../trading/backtest-runner.js";
import { MovingAverageCrossoverStrategy } from "../../trading/strategy.js";
import type { Bar } from "../../adapters/types.js";

test("BacktestRunner runs strategy on historical data", async () => {
  const runner = new BacktestRunner({ initialCash: 100000 });

  // Generate test bars
  const bars: Bar[] = [];
  let price = 150;
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 5;
    bars.push({
      symbol: "AAPL",
      timestamp: new Date(2024, 0, i + 1),
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  const strategy = new MovingAverageCrossoverStrategy({
    symbol: "AAPL",
    shortPeriod: 5,
    longPeriod: 10,
  });

  const results = await runner.run({
    strategy,
    bars,
    symbol: "AAPL",
  });

  expect(results).toBeDefined();
  expect(results.metrics).toBeDefined();
  expect(results.equityCurve).toBeDefined();
  expect(results.trades).toBeDefined();
});

test("BacktestRunner respects start and end dates", async () => {
  const runner = new BacktestRunner({ initialCash: 100000 });

  const bars: Bar[] = [];
  let price = 150;
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 5;
    bars.push({
      symbol: "AAPL",
      timestamp: new Date(2024, 0, i + 1),
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  const strategy = new MovingAverageCrossoverStrategy({
    symbol: "AAPL",
    shortPeriod: 5,
    longPeriod: 10,
  });

  const results = await runner.run({
    strategy,
    bars,
    symbol: "AAPL",
    startDate: new Date(2024, 0, 10),
    endDate: new Date(2024, 0, 20),
  });

  expect(results.barsProcessed).toBeLessThanOrEqual(11); // 10-20 inclusive
});
