import { describe, it, expect } from "bun:test";
import { RiskOrchestrator } from "../../risk/orchestrator.js";
import { loadRiskConfig } from "../../risk/config.js";
import type { TradeRequest, Portfolio } from "../../risk/types.js";

describe("RiskOrchestrator", () => {
  const config = loadRiskConfig();

  it("should approve valid trade", async () => {
    const orchestrator = new RiskOrchestrator(config);
    const request: TradeRequest = {
      symbol: "AAPL",
      side: "buy",
      entryPrice: 10,
      stopLoss: 9.8,
      takeProfit: 10.4,
      confidence: 0.7,
      strategy: "breakout",
    };
    const portfolio: Portfolio = {
      cash: 10000,
      positions: [],
      totalValue: 10000,
      dailyPnl: 0,
      totalPnl: 0,
    };

    const result = await orchestrator.validateTrade(request, portfolio);

    expect(result.approved).toBe(true);
    expect(result.shares).toBeGreaterThan(0);
    expect(result.stopLevel).toBeDefined();
  });

  it("should reject trade exceeding daily loss", async () => {
    const orchestrator = new RiskOrchestrator(config);
    const request: TradeRequest = {
      symbol: "AAPL",
      side: "buy",
      entryPrice: 10,
      stopLoss: 9.8,
      takeProfit: 10.4,
      confidence: 0.7,
      strategy: "breakout",
    };
    const portfolio: Portfolio = {
      cash: 10000,
      positions: [],
      totalValue: 10000,
      dailyPnl: -15, // Exceeds $10 limit
      totalPnl: -15,
    };

    const result = await orchestrator.validateTrade(request, portfolio);

    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Daily loss");
  });
});
