/**
 * Daily Loss Limiter Circuit Breaker
 * Halts trading when daily loss limit is reached
 */

import { BaseBreaker } from "./base-breaker.js";
import type { Portfolio, CircuitBreakerResult } from "../types.js";

export class DailyLossLimiter extends BaseBreaker {
  check(portfolio: Portfolio): CircuitBreakerResult {
    const dailyLoss = Math.abs(Math.min(0, portfolio.dailyPnl));
    const limit = this.config.dailyLossLimit;

    if (dailyLoss >= limit) {
      return this.createHaltResult(
        `Daily loss limit reached: $${dailyLoss.toFixed(2)} >= $${limit}`,
        60, // 1 hour cooldown
      );
    }

    // Warn at 80% of limit
    if (dailyLoss >= limit * 0.8) {
      return {
        halted: false,
        haltReason: `Warning: Daily loss at ${((dailyLoss / limit) * 100).toFixed(0)}% of limit`,
      };
    }

    return this.createClearResult();
  }
}
