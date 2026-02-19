/**
 * ATR Position Sizer
 * Position size based on Average True Range for volatility-based stops
 */

import { BaseSizer } from "./base-sizer.js";
import type { TradeRequest, SizingResult, Portfolio, RiskConfig } from "../types.js";

export class ATRSizer extends BaseSizer {
  private atr: number;
  private atrMultiplier: number;

  constructor(config: RiskConfig, atr: number, multiplier?: number) {
    super(config);
    this.atr = atr;
    this.atrMultiplier = multiplier ?? config.atrMultiplier;
  }

  calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult {
    const accountValue = portfolio.totalValue;
    const riskAmount = accountValue * this.config.riskPerTrade;

    // Calculate stop distance based on ATR
    const stopDistance = this.atr * this.atrMultiplier;

    if (stopDistance <= 0) {
      return this.createResult(0, 0, 0, true, "Invalid ATR value");
    }

    // Calculate shares based on ATR-defined risk
    const shares = Math.floor(riskAmount / stopDistance);
    const positionValue = shares * request.entryPrice;

    // Apply max position limit
    const maxPositionValue = accountValue * this.config.maxPositionPct;
    if (positionValue > maxPositionValue) {
      const adjustedShares = Math.floor(maxPositionValue / request.entryPrice);
      return this.createResult(
        adjustedShares,
        adjustedShares * request.entryPrice,
        riskAmount,
        false,
        "Reduced to max position limit",
      );
    }

    return this.createResult(shares, positionValue, riskAmount);
  }
}
