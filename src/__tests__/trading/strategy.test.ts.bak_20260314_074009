import { test, expect } from "bun:test";
import type { Strategy, StrategyContext, Signal } from "../../trading/strategy.js";
import { MovingAverageCrossoverStrategy } from "../../trading/strategy.js";
import type { Bar, Portfolio } from "../../trading/types.js";

test("Strategy interface defines onBar method", () => {
  const mockStrategy: Strategy = {
    name: "TestStrategy",
    onBar: (bar: Bar, ctx: StrategyContext): Signal | null => {
      return {
        action: "buy",
        symbol: bar.symbol,
        qty: 10,
        confidence: 0.8,
      };
    },
  };

  expect(mockStrategy.name).toBe("TestStrategy");
  expect(typeof mockStrategy.onBar).toBe("function");
});

test("StrategyContext provides portfolio and historical data", () => {
  const ctx: StrategyContext = {
    portfolio: {
      cash: 100000,
      equity: 100000,
      buyingPower: 100000,
      positions: [],
      dailyPnl: 0,
      totalPnl: 0,
    },
    getBars: (symbol: string, lookback: number) => [],
    currentTime: new Date(),
  };

  expect(ctx.portfolio.cash).toBe(100000);
  expect(typeof ctx.getBars).toBe("function");
});

test("Signal has required fields", () => {
  const signal: Signal = {
    action: "buy",
    symbol: "AAPL",
    qty: 10,
    confidence: 0.8,
  };

  expect(signal.action).toBe("buy");
  expect(signal.symbol).toBe("AAPL");
  expect(signal.qty).toBe(10);
});

test("MovingAverageCrossover generates buy signal when short crosses above long", () => {
  const strategy = new MovingAverageCrossoverStrategy({
    symbol: "AAPL",
    shortPeriod: 3,
    longPeriod: 5,
  });

  // Create bars where short MA is below long MA, then crosses above
  const bars: Bar[] = [
    // Downtrend to establish short MA below long MA
    { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 100, high: 102, low: 99, close: 100, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 95, high: 97, low: 94, close: 95, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 90, high: 92, low: 89, close: 90, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-04"), open: 85, high: 87, low: 84, close: 85, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-05"), open: 80, high: 82, low: 79, close: 80, volume: 1000 },
    // Slight uptrend - short MA still below long MA
    { symbol: "AAPL", timestamp: new Date("2024-01-06"), open: 85, high: 87, low: 84, close: 85, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-07"), open: 90, high: 92, low: 89, close: 90, volume: 1000 },
  ];

  // Initialize - at this point short MA (85+90)/2 = 87.5, long MA is lower
  strategy.initialize(bars);

  // Now add a bar with much higher price to trigger crossover
  const newBar: Bar = {
    symbol: "AAPL",
    timestamp: new Date("2024-01-08"),
    open: 150,
    high: 152,
    low: 149,
    close: 150, // High close to push short MA above long MA
    volume: 1000,
  };

  const signal = strategy.onBar(newBar);

  expect(signal).not.toBeNull();
  expect(signal?.action).toBe("buy");
});

test("MovingAverageCrossover generates sell signal when short crosses below long", () => {
  const strategy = new MovingAverageCrossoverStrategy({
    symbol: "AAPL",
    shortPeriod: 3,
    longPeriod: 5,
  });

  // Create bars where short MA is above long MA, then crosses below
  const bars: Bar[] = [
    // Uptrend to establish short MA above long MA
    { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 100, high: 102, low: 99, close: 100, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 105, high: 107, low: 104, close: 105, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 110, high: 112, low: 109, close: 110, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-04"), open: 115, high: 117, low: 114, close: 115, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-05"), open: 120, high: 122, low: 119, close: 120, volume: 1000 },
    // Slight downtrend - short MA still above long MA
    { symbol: "AAPL", timestamp: new Date("2024-01-06"), open: 115, high: 117, low: 114, close: 115, volume: 1000 },
    { symbol: "AAPL", timestamp: new Date("2024-01-07"), open: 110, high: 112, low: 109, close: 110, volume: 1000 },
  ];

  // Initialize
  strategy.initialize(bars);

  // Now add a bar with much lower price to trigger crossover
  const newBar: Bar = {
    symbol: "AAPL",
    timestamp: new Date("2024-01-08"),
    open: 50,
    high: 52,
    low: 49,
    close: 50, // Low close to push short MA below long MA
    volume: 1000,
  };

  const signal = strategy.onBar(newBar);

  expect(signal).not.toBeNull();
  expect(signal?.action).toBe("sell");
});
