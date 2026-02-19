/**
 * Correlation Analyzer
 * Prevents highly correlated positions
 */

import { BaseAnalyzer } from "./base-analyzer.js";
import type { Position, Portfolio, PortfolioCheckResult, RiskConfig } from "../types.js";

export interface CorrelationData {
  symbol: string;
  correlation: number; // -1 to 1
}

export class CorrelationAnalyzer extends BaseAnalyzer {
  private correlations: Map<string, CorrelationData[]>;

  constructor(config: RiskConfig, correlations: Map<string, CorrelationData[]>) {
    super(config);
    this.correlations = correlations;
  }

  check(trade: Position, portfolio: Portfolio): PortfolioCheckResult {
    const existingSymbols = portfolio.positions.map((p) => p.symbol);
    const maxCorrelation = this.config.maxCorrelation;

    for (const existingSymbol of existingSymbols) {
      const correlationData = this.correlations.get(trade.symbol)?.find((c) => c.symbol === existingSymbol);

      if (correlationData && correlationData.correlation > maxCorrelation) {
        return {
          allowed: false,
          reason: `High correlation (${(correlationData.correlation * 100).toFixed(0)}%) with ${existingSymbol}`,
          riskContribution: 0,
        };
      }
    }

    return {
      allowed: true,
      riskContribution: 0,
    };
  }
}
