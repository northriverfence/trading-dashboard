// src/breakers/intelligent-breaker.ts
export interface CircuitBreakerConfig {
  consecutiveLossThreshold: number;
  dailyLossThreshold: number;
  coolDownMs?: number;
}

export interface CircuitBreakerState {
  dailyPnl: number;
  consecutiveLosses: number;
}

export interface CircuitBreakerResult {
  allowed: boolean;
  reason?: string;
  coolDownRemaining?: number;
}

export class IntelligentCircuitBreaker {
  private config: CircuitBreakerConfig;
  private consecutiveLosses = 0;
  private lastTripped = 0;
  private isTripped = false;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  checkCanTrade(state: CircuitBreakerState): CircuitBreakerResult {
    const now = Date.now();
    const coolDown = this.config.coolDownMs ?? 60000; // Default 1 min

    // Check if in cool-down period
    if (this.isTripped) {
      const elapsed = now - this.lastTripped;
      if (elapsed < coolDown) {
        return {
          allowed: false,
          reason: "Circuit breaker cooling down",
          coolDownRemaining: coolDown - elapsed,
        };
      }
      // Reset after cool-down
      this.isTripped = false;
      this.consecutiveLosses = 0;
    }

    // Check daily loss threshold
    if (state.dailyPnl <= -this.config.dailyLossThreshold) {
      this.trip("Daily loss threshold exceeded");
      return {
        allowed: false,
        reason: `Daily loss threshold exceeded: ${state.dailyPnl}`,
      };
    }

    // Check consecutive losses
    if (state.consecutiveLosses >= this.config.consecutiveLossThreshold) {
      this.trip("Consecutive loss threshold exceeded");
      return {
        allowed: false,
        reason: `Consecutive loss threshold exceeded: ${state.consecutiveLosses}`,
      };
    }

    return { allowed: true };
  }

  recordOutcome(outcome: "win" | "loss" | "breakeven"): void {
    if (outcome === "loss") {
      this.consecutiveLosses++;
    } else if (outcome === "win") {
      this.consecutiveLosses = 0; // Reset on win
    }
    // Breakeven doesn't change streak
  }

  private trip(reason: string): void {
    this.isTripped = true;
    this.lastTripped = Date.now();
  }

  getStatus(): { isTripped: boolean; consecutiveLosses: number } {
    return {
      isTripped: this.isTripped,
      consecutiveLosses: this.consecutiveLosses,
    };
  }

  reset(): void {
    this.isTripped = false;
    this.consecutiveLosses = 0;
    this.lastTripped = 0;
  }
}
