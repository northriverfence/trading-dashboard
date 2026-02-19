import type { TradeRequest, SizingResult, Portfolio, RiskConfig } from "../types.js";

export abstract class BaseSizer {
  protected config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  abstract calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult;

  protected createResult(
    shares: number,
    positionValue: number,
    riskAmount: number,
    rejected: boolean = false,
    rejectionReason?: string,
  ): SizingResult {
    return {
      shares,
      positionValue,
      riskAmount,
      riskPercent: this.config.riskPerTrade,
      rejected,
      rejectionReason,
    };
  }
}
