/**
 * Risk Configuration Management
 */

import type { RiskConfig } from "./types.js";

export const defaultRiskConfig: RiskConfig = {
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

export function loadRiskConfig(overrides?: Partial<RiskConfig>): RiskConfig {
  return {
    ...defaultRiskConfig,
    ...overrides,
  };
}

export function validateRiskConfig(config: RiskConfig): string[] {
  const errors: string[] = [];

  if (config.maxPositionPct <= 0 || config.maxPositionPct > 1) {
    errors.push("maxPositionPct must be between 0 and 1");
  }
  if (config.riskPerTrade <= 0 || config.riskPerTrade > 0.1) {
    errors.push("riskPerTrade should be between 0 and 0.1 (10%)");
  }
  if (config.maxSectorExposure <= 0 || config.maxSectorExposure > 1) {
    errors.push("maxSectorExposure must be between 0 and 1");
  }

  return errors;
}
