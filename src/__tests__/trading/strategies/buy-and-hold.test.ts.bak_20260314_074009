import { test, expect } from "bun:test";
import { BuyAndHoldStrategy } from "../../../trading/strategies/buy-and-hold.js";
import type { Bar } from "../../../trading/types.js";

test("BuyAndHoldStrategy buys on first bar", () => {
    const strategy = new BuyAndHoldStrategy({ qty: 10 });

    const bar: Bar = {
        timestamp: new Date(),
        open: 150,
        high: 155,
        low: 149,
        close: 154,
        volume: 1000000,
    };

    const ctx = {
        portfolio: {
            cash: 100000,
            equity: 100000,
            buyingPower: 100000,
            positions: [],
            dailyPnl: 0,
            totalPnl: 0,
        },
        getBars: () => [],
        currentTime: new Date(),
    };

    const signal1 = strategy.onBar(bar, ctx);
    expect(signal1?.action).toBe("buy");
    expect(signal1?.qty).toBe(10);

    // Second bar should return null (already holding)
    const signal2 = strategy.onBar(bar, ctx);
    expect(signal2).toBeNull();
});
