/**
 * Kelly Criterion Position Sizer
 * Optimal position sizing based on win rate and win/loss ratio
 */

import { BaseSizer } from "./base-sizer.js";
import type { TradeRequest, SizingResult, Portfolio, RiskConfig } from "../types.js";

export interface KellyData {
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export class KellyCriterionSizer extends BaseSizer {
  private kellyData: KellyData;

  constructor(config: RiskConfig, kellyData: KellyData) {
    super(config);
    this.kellyData = kellyData;
  }

  calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult {
    const { winRate, avgWin, avgLoss } = this.kellyData;

    if (avgLoss === 0) {
      return this.createResult(0, 0, 0, true, "Average loss is zero");
    }

    const b = avgWin / avgLoss; // Win/Loss ratio
    const q = 1 - winRate;

    // Full Kelly percentage
    const fullKelly = (b * winRate - q) / b;

    // Apply Kelly fraction (Half-Kelly for safety)
    const kellyPercent = fullKelly * this.config.kellyFraction;

    if (kellyPercent <= 0) {
      return this.createResult(0, 0, 0, true, "Kelly criterion suggests no trade");
    }

    const accountValue = portfolio.totalValue;
    const positionValue = accountValue * Math.min(kellyPercent, this.config.maxPositionPct);
    const shares = Math.floor(positionValue / request.entryPrice);
    const riskAmount = accountValue * this.config.riskPerTrade;

    return this.createResult(shares, shares * request.entryPrice, riskAmount);
  }
}
