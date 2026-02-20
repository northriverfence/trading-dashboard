import { test, expect } from "bun:test";
import { DynamicRiskAdjuster, type TradeRequest } from "./dynamic-risk-adjuster.js";

test("DynamicRiskAdjuster should return risk adjustment", async () => {
    const adjuster = new DynamicRiskAdjuster();

    const request: TradeRequest = {
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
    };

    const result = await adjuster.adjustRisk(request);

    expect(result.positionSizeMultiplier).toBeNumber();
    expect(result.stopLossMultiplier).toBeNumber();
    expect(result.confidence).toBeNumber();
    expect(result.reasoning).toBeString();

    // Bounds checking
    expect(result.positionSizeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(result.positionSizeMultiplier).toBeLessThanOrEqual(2.0);
    expect(result.stopLossMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(result.stopLossMultiplier).toBeLessThanOrEqual(1.5);
});
