import { test, expect } from "bun:test";
import { BacktestEngine } from "../../trading/backtest-engine.js";
import type { Strategy } from "../../trading/strategy.js";
import type { Bar } from "../../trading/types.js";

test("BacktestEngine initializes with config", () => {
    const engine = new BacktestEngine({
        initialCash: 100000,
        symbols: ["AAPL"],
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
    });

    expect(engine).toBeDefined();
});

test("BacktestEngine runs strategy on historical data", async () => {
    const engine = new BacktestEngine({
        initialCash: 100000,
        symbols: ["AAPL"],
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-05"),
    });

    // Mock historical data
    const mockBars: Bar[] = [
        { timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 154, volume: 1000000 },
        { timestamp: new Date("2024-01-02"), open: 154, high: 156, low: 153, close: 155, volume: 1200000 },
        { timestamp: new Date("2024-01-03"), open: 155, high: 158, low: 154, close: 157, volume: 1100000 },
    ];

    const strategy: Strategy = {
        name: "BuyAndHold",
        onBar: (bar) => {
            if (bar.timestamp.getTime() === mockBars[0].timestamp.getTime()) {
                return { action: "buy", symbol: "AAPL", qty: 10, confidence: 1.0 };
            }
            return null;
        },
    };

    const results = await engine.run(strategy, { AAPL: mockBars });

    expect(results.totalReturn).toBeGreaterThan(0);
    expect(results.trades.length).toBeGreaterThan(0);
});

test("BacktestEngine calculates total return", async () => {
    const engine = new BacktestEngine({
        initialCash: 10000,
        symbols: ["AAPL"],
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-02"),
    });

    const mockBars: Bar[] = [
        { timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 150, volume: 1000000 },
        { timestamp: new Date("2024-01-02"), open: 150, high: 160, low: 150, close: 160, volume: 1000000 },
    ];

    const strategy: Strategy = {
        name: "BuyAtOpen",
        onBar: (bar, ctx) => {
            if (bar.timestamp.getTime() === mockBars[0].timestamp.getTime()) {
                return { action: "buy", symbol: "AAPL", qty: 10, confidence: 1.0 };
            }
            return null;
        },
    };

    const results = await engine.run(strategy, { AAPL: mockBars });

    // Bought 10 shares at 150 = $1500
    // Price went to 160 = $1600 value
    // Portfolio: $8500 cash + $1600 position = $10100
    // Return = (10100 - 10000) / 10000 = 1%
    expect(results.totalReturn).toBeCloseTo(1.0, 0);
});
