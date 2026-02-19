/**
 * Sector Exposure Limiter
 * Prevents over-concentration in any single sector
 */

import { BaseAnalyzer } from "./base-analyzer.js";
import type { Position, Portfolio, PortfolioCheckResult } from "../types.js";

export class SectorExposureLimiter extends BaseAnalyzer {
  check(trade: Position, portfolio: Portfolio): PortfolioCheckResult {
    if (!trade.sector) {
      return { allowed: true, riskContribution: 0 };
    }

    const currentExposure = this.calculateSectorExposure(portfolio, trade.sector);
    const tradeValue = trade.entryPrice * trade.qty;
    const newExposure = (currentExposure * portfolio.totalValue + tradeValue) / portfolio.totalValue;

    if (newExposure > this.config.maxSectorExposure) {
      return {
        allowed: false,
        reason: `Sector ${trade.sector} exposure would be ${(newExposure * 100).toFixed(1)}%`,
        riskContribution: newExposure,
      };
    }

    return {
      allowed: true,
      riskContribution: newExposure,
    };
  }
}
