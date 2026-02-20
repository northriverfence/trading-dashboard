import { test, expect } from "bun:test";
import { TradeValidator, type TradeSignal } from "./trade-validator.js";

test("TradeValidator should return validation result", async () => {
    const validator = new TradeValidator();

    const signal: TradeSignal = {
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish",
        reasoning: "Test validation",
    };

    const result = await validator.validateTrade(signal);

    expect(result.approved).toBeBoolean();
    expect(result.confidence).toBeNumber();
    expect(result.recommendation).toBeOneOf(["proceed", "caution", "avoid"]);
    expect(result.reasoning).toBeString();
    expect(Array.isArray(result.similarTrades)).toBe(true);
});
