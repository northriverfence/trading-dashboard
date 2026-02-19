import { describe, it, expect } from "bun:test";
import { FixedFractionalSizer } from "../../../risk/sizing/fixed-fractional-sizer.js";
import type { RiskConfig, TradeRequest, Portfolio } from "../../../risk/types.js";

const baseConfig: RiskConfig = {
  sizingType: "fixed_fractional",
  maxPositionPct: 0.1,
  kellyFraction: 0.5,
  riskPerTrade: 0.02,
  maxSectorExposure: 0.3,
  maxPortfolioHeat: 0.5,
  maxCorrelation: 0.7,
  dailyLossLimit: 10,
  consecutiveLosses: 3,
  drawdownThresholds: [5, 10, 15],
  volatilityThreshold: 2.0,
  stopType: "trailing",
  atrMultiplier: 2.0,
  trailingActivation: 1.02,
  timeLimit: 3600,
};

const portfolio: Portfolio = {
  cash: 1000,
  positions: [],
  totalValue: 1000,
  dailyPnl: 0,
  totalPnl: 0,
};

describe("FixedFractionalSizer", () => {
  it("should calculate correct position size with stop loss", () => {
    const sizer = new FixedFractionalSizer(baseConfig);
    const request: TradeRequest = {
      symbol: "AAPL",
      side: "buy",
      entryPrice: 10, // Lower price so position fits within 10% limit
      stopLoss: 9.8,
      takeProfit: 10.4,
      confidence: 0.7,
      strategy: "breakout",
    };

    const result = sizer.calculateSize(request, portfolio);

    expect(result.rejected).toBe(false);
    expect(result.shares).toBe(10); // $20 risk / $0.2 stop distance
    expect(result.riskAmount).toBe(20); // 2% of $1000
  });

  it("should reject trade with invalid stop loss", () => {
    const sizer = new FixedFractionalSizer(baseConfig);
    const request: TradeRequest = {
      symbol: "AAPL",
      side: "buy",
      entryPrice: 100,
      stopLoss: 100, // Same as entry
      takeProfit: 104,
      confidence: 0.7,
      strategy: "breakout",
    };

    const result = sizer.calculateSize(request, portfolio);

    expect(result.rejected).toBe(true);
    expect(result.rejectionReason).toBe("Invalid stop loss price");
  });

  it("should limit position to max position size", () => {
    const sizer = new FixedFractionalSizer(baseConfig);
    const request: TradeRequest = {
      symbol: "AAPL",
      side: "buy",
      entryPrice: 50,
      stopLoss: 49,
      takeProfit: 55,
      confidence: 0.7,
      strategy: "breakout",
    };

    const result = sizer.calculateSize(request, portfolio);

    // Max position is $100 (10% of $1000)
    expect(result.shares).toBe(2); // Limited to 2 shares ($100)
  });
});
