/**
 * Portfolio Heat Monitor
 * Tracks total portfolio risk and warns when heat is too high
 */

import { BaseAnalyzer } from "./base-analyzer.js";
import type { Position, Portfolio, PortfolioCheckResult } from "../types.js";

export class PortfolioHeatMonitor extends BaseAnalyzer {
  check(trade: Position, portfolio: Portfolio): PortfolioCheckResult {
    const currentHeat = this.calculatePortfolioHeat(portfolio);

    // Calculate additional heat from new trade
    const tradeRisk = trade.stopLoss
      ? Math.abs(trade.entryPrice - trade.stopLoss) * trade.qty
      : trade.entryPrice * trade.qty * 0.02; // Default 2% risk
    const additionalHeat = tradeRisk / portfolio.totalValue;

    const totalHeat = currentHeat + additionalHeat;

    if (totalHeat > this.config.maxPortfolioHeat) {
      return {
        allowed: false,
        reason: `Portfolio heat ${(totalHeat * 100).toFixed(1)}% exceeds max ${(this.config.maxPortfolioHeat * 100).toFixed(0)}%`,
        riskContribution: totalHeat,
      };
    }

    return {
      allowed: true,
      riskContribution: totalHeat,
    };
  }
}
