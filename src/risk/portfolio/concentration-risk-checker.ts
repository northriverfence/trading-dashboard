/**
 * Concentration Risk Checker
 * Prevents over-concentration in single positions
 */

import { BaseAnalyzer } from "./base-analyzer.js";
import type { Position, Portfolio, PortfolioCheckResult } from "../types.js";

export class ConcentrationRiskChecker extends BaseAnalyzer {
  check(trade: Position, portfolio: Portfolio): PortfolioCheckResult {
    const tradeValue = trade.entryPrice * trade.qty;
    const exposure = tradeValue / portfolio.totalValue;

    // Check if this would be the largest position
    const existingPositions = portfolio.positions.map((p) => ({
      symbol: p.symbol,
      value: p.currentPrice * p.qty,
    }));

    const maxExistingValue = existingPositions.length > 0 ? Math.max(...existingPositions.map((p) => p.value)) : 0;

    // Skip concentration check for first positions or when there's no existing position to compare against
    if (maxExistingValue > 0 && tradeValue > maxExistingValue * 1.5) {
      return {
        allowed: false,
        reason: `Position would be 50% larger than current largest position`,
        adjustedSize: Math.floor(maxExistingValue / trade.entryPrice),
        riskContribution: exposure,
      };
    }

    return {
      allowed: true,
      riskContribution: exposure,
    };
  }
}
