/**
 * Volatility Adjusted Position Sizer
 * Reduces position size in volatile markets
 */

import { BaseSizer } from "./base-sizer.js";
import type { TradeRequest, SizingResult, Portfolio, RiskConfig } from "../types.js";

export class VolatilityAdjustedSizer extends BaseSizer {
  private volatility: number; // Annualized volatility (e.g., 0.20 for 20%)

  constructor(config: RiskConfig, volatility: number) {
    super(config);
    this.volatility = volatility;
  }

  calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult {
    const accountValue = portfolio.totalValue;

    // Base position size
    const basePositionValue = accountValue * this.config.maxPositionPct;

    // Volatility adjustment factor (higher vol = smaller size)
    // Target: Full size at 10% vol, half size at 40% vol
    const volAdjustment = Math.max(0.25, 0.1 / Math.max(0.05, this.volatility));

    // Adjusted position value
    const adjustedPositionValue = basePositionValue * volAdjustment;

    // Risk amount also adjusted for volatility
    const baseRisk = accountValue * this.config.riskPerTrade;
    const adjustedRisk = baseRisk * volAdjustment;

    const shares = Math.floor(adjustedPositionValue / request.entryPrice);

    return this.createResult(
      shares,
      shares * request.entryPrice,
      adjustedRisk,
      false,
      `Vol adjustment: ${(volAdjustment * 100).toFixed(1)}%`,
    );
  }
}
