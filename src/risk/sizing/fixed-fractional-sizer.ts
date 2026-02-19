/**
 * Fixed Fractional Position Sizer
 * Risks a fixed percentage of account equity per trade
 */

import { BaseSizer } from "./base-sizer.js";
import type { TradeRequest, SizingResult, Portfolio } from "../types.js";

export class FixedFractionalSizer extends BaseSizer {
  calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult {
    const accountValue = portfolio.totalValue;
    const maxPositionValue = accountValue * this.config.maxPositionPct;

    // Calculate risk amount
    const riskAmount = accountValue * this.config.riskPerTrade;

    // Calculate stop distance
    const stopDistance = request.stopLoss ? Math.abs(request.entryPrice - request.stopLoss) : request.entryPrice * 0.02; // Default 2% stop

    if (stopDistance <= 0) {
      return this.createResult(0, 0, 0, true, "Invalid stop loss price");
    }

    // Calculate shares based on risk
    const shares = Math.floor(riskAmount / stopDistance);
    const positionValue = shares * request.entryPrice;

    // Check max position size limit
    if (positionValue > maxPositionValue) {
      const adjustedShares = Math.floor(maxPositionValue / request.entryPrice);
      return this.createResult(
        adjustedShares,
        adjustedShares * request.entryPrice,
        riskAmount,
        false,
        "Position reduced to max position limit",
      );
    }

    return this.createResult(shares, positionValue, riskAmount);
  }
}
