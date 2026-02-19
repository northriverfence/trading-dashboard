/**
 * Base Circuit Breaker
 * Abstract class for circuit breaker implementations
 */

import type { Portfolio, CircuitBreakerResult, RiskConfig } from "../types.js";

export abstract class BaseBreaker {
  protected config: RiskConfig;
  protected lastTriggered: Date | null = null;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  abstract check(portfolio: Portfolio): CircuitBreakerResult;

  protected createHaltResult(reason: string, cooldownMinutes: number, reductionFactor?: number): CircuitBreakerResult {
    const resumeTime = new Date();
    resumeTime.setMinutes(resumeTime.getMinutes() + cooldownMinutes);

    return {
      halted: true,
      haltReason: reason,
      resumeTime,
      cooldownMinutes,
      reductionFactor,
    };
  }

  protected createClearResult(): CircuitBreakerResult {
    return { halted: false };
  }
}
