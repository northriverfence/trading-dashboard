import { test, expect } from "bun:test";
import type { Strategy, StrategyContext, Signal } from "../../trading/strategy.js";
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
