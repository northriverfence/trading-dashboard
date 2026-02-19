/**
 * Base Portfolio Analyzer
 * Abstract class for portfolio risk analysis
 */

import type { Position, Portfolio, PortfolioCheckResult, RiskConfig } from "../types.js";

export abstract class BaseAnalyzer {
  protected config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  abstract check(trade: Position, portfolio: Portfolio): PortfolioCheckResult;

  protected calculateSectorExposure(portfolio: Portfolio, sector: string): number {
    const sectorPositions = portfolio.positions.filter((p) => p.sector === sector);
    const sectorValue = sectorPositions.reduce((sum, p) => sum + p.currentPrice * p.qty, 0);
    return sectorValue / portfolio.totalValue;
  }

  protected calculatePortfolioHeat(portfolio: Portfolio): number {
    // Total % of portfolio at risk
    return portfolio.positions.reduce((sum, p) => {
      const riskPerPosition = p.stopLoss ? Math.abs(p.entryPrice - p.stopLoss) * p.qty : 0;
      return sum + riskPerPosition / portfolio.totalValue;
    }, 0);
  }
}
