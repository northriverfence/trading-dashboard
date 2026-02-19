/**
 * Drawdown Reducer Circuit Breaker
 * Progressively reduces position sizes during drawdowns
 */

import { BaseBreaker } from "./base-breaker.js";
import type { Portfolio, CircuitBreakerResult } from "../types.js";

export class DrawdownReducer extends BaseBreaker {
  private peakValue: number = 0;

  setPeak(value: number): void {
    this.peakValue = Math.max(this.peakValue, value);
  }

  check(portfolio: Portfolio): CircuitBreakerResult {
    this.setPeak(portfolio.totalValue);

    const drawdown = (this.peakValue - portfolio.totalValue) / this.peakValue;

    // Drawdown reduction schedule
    if (drawdown >= 0.2) {
      return this.createHaltResult(
        `Critical drawdown: ${(drawdown * 100).toFixed(1)}%. Entering research mode.`,
        1440, // 24 hour cooldown
        0, // Stop trading
      );
    } else if (drawdown >= 0.15) {
      return {
        halted: false,
        haltReason: `Severe drawdown: ${(drawdown * 100).toFixed(1)}%. Reducing size by 75%.`,
        reductionFactor: 0.25,
      };
    } else if (drawdown >= 0.1) {
      return {
        halted: false,
        haltReason: `Significant drawdown: ${(drawdown * 100).toFixed(1)}%. Reducing size by 50%.`,
        reductionFactor: 0.5,
      };
    } else if (drawdown >= 0.05) {
      return {
        halted: false,
        haltReason: `Moderate drawdown: ${(drawdown * 100).toFixed(1)}%. Reducing size by 25%.`,
        reductionFactor: 0.75,
      };
    }

    return this.createClearResult();
  }
}
