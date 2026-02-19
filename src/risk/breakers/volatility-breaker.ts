/**
 * Volatility Breaker Circuit Breaker
 * Pauses trading when market volatility spikes
 */

import { BaseBreaker } from "./base-breaker.js";
import type { Portfolio, CircuitBreakerResult } from "../types.js";

export class VolatilityBreaker extends BaseBreaker {
  private currentATR: number = 0;
  private avgATR: number = 0;

  setATR(current: number, average: number): void {
    this.currentATR = current;
    this.avgATR = average;
  }

  check(): CircuitBreakerResult {
    if (this.avgATR === 0) {
      return this.createClearResult();
    }

    const atrRatio = this.currentATR / this.avgATR;
    const threshold = this.config.volatilityThreshold;

    if (atrRatio > threshold) {
      return this.createHaltResult(
        `Volatility spike detected: ATR ratio ${atrRatio.toFixed(2)} > ${threshold}`,
        15, // 15 minute cooldown
      );
    }

    return this.createClearResult();
  }
}
