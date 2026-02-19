/**
 * Consecutive Loss Halt Circuit Breaker
 * Halts after N consecutive losses
 */

import { BaseBreaker } from "./base-breaker.js";
import type { Portfolio, CircuitBreakerResult } from "../types.js";

export class ConsecutiveLossHalt extends BaseBreaker {
  private consecutiveLosses: number = 0;

  recordTrade(outcome: "win" | "loss" | "breakeven"): void {
    if (outcome === "loss") {
      this.consecutiveLosses++;
    } else if (outcome === "win") {
      this.consecutiveLosses = 0;
    }
  }

  check(): CircuitBreakerResult {
    const limit = this.config.consecutiveLosses;

    if (this.consecutiveLosses >= limit) {
      return this.createHaltResult(
        `${this.consecutiveLosses} consecutive losses`,
        30, // 30 minute cooldown
      );
    }

    return this.createClearResult();
  }
}
