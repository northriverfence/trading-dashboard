import { test, expect, beforeEach } from "bun:test";
import { SimulationEngine } from "../../trading/simulation-engine.js";
import type { Bar } from "../../adapters/types.js";

let engine: SimulationEngine;

beforeEach(() => {
  engine = new SimulationEngine({ initialCash: 100000 });
});

test("SimulationEngine loads historical bars", () => {
  const bars: Bar[] = [
    { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 152, volume: 1000000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 152, high: 157, low: 151, close: 156, volume: 1200000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 156, high: 158, low: 154, close: 155, volume: 900000 },
  ];

  engine.loadBars("AAPL", bars);
  const loadedBars = engine.getBars("AAPL");

  expect(loadedBars).toHaveLength(3);
  expect(loadedBars[0]?.close).toBe(152);
});

test("SimulationEngine runs fast backtest", async () => {
  const bars: Bar[] = [
    { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 152, volume: 1000000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 152, high: 157, low: 151, close: 156, volume: 1200000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 156, high: 158, low: 154, close: 155, volume: 900000 },
  ];

  engine.loadBars("AAPL", bars);

  // Buy on first bar, sell on last bar
  const results = await engine.runFastSimulation({
    symbol: "AAPL",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-03"),
    strategy: (ctx) => {
      if (ctx.currentBarIndex === 0) {
        ctx.buy(10);
      } else if (ctx.currentBarIndex === 2) {
        ctx.sell(10);
      }
    },
  });

  expect(results.trades).toHaveLength(2); // Buy and sell
  expect(results.finalEquity).toBeGreaterThan(0);
});

test("SimulationEngine calculates performance metrics", async () => {
  const bars: Bar[] = [];
  let price = 150;
  for (let i = 0; i < 30; i++) {
    price += (Math.random() - 0.5) * 5;
    bars.push({
      symbol: "AAPL",
      timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
      open: price - 1,
      high: price + 2,
      low: price - 2,
      close: price,
      volume: 1000000,
    });
  }

  engine.loadBars("AAPL", bars);

  const results = await engine.runFastSimulation({
    symbol: "AAPL",
    strategy: (ctx) => {
      if (ctx.currentBarIndex === 5) ctx.buy(10);
      if (ctx.currentBarIndex === 25) ctx.sell(10);
    },
  });

  expect(results.metrics).toBeDefined();
  expect(results.metrics.totalReturn).toBeDefined();
  expect(results.metrics.totalTrades).toBe(2);
});
