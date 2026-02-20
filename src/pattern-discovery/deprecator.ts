// src/pattern-discovery/deprecator.ts
import type { DiscoveredPattern } from "./types.js";

export interface DeprecatorConfig {
  maxAgeMs: number; // Maximum age in milliseconds before deprecation
  minWinRate?: number; // Minimum win rate to avoid deprecation
  minTrades?: number; // Minimum trades to avoid deprecation
}

export interface DeprecationResult {
  shouldDeprecate: boolean;
  reason: string;
  ageMs: number;
  ageDays: number;
}

export class PatternDeprecator {
  private config: DeprecatorConfig;

  constructor(config: DeprecatorConfig) {
    this.config = config;
  }

  /**
   * Check if a pattern should be deprecated
   */
  shouldDeprecate(pattern: DiscoveredPattern): boolean {
    const result = this.evaluate(pattern);
    return result.shouldDeprecate;
  }

  /**
   * Evaluate a pattern for deprecation
   */
  evaluate(pattern: DiscoveredPattern): DeprecationResult {
    const now = Date.now();
    const ageMs = now - pattern.discoveredAt;
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    // Check if pattern is too old
    if (ageMs > this.config.maxAgeMs) {
      // Check if it has been performing poorly (if thresholds are set)
      if (this.config.minWinRate !== undefined && pattern.winRate < this.config.minWinRate) {
        return {
          shouldDeprecate: true,
          reason: `Pattern aged (${ageDays} days) with poor win rate (${(pattern.winRate * 100).toFixed(1)}% < ${(this.config.minWinRate * 100).toFixed(1)}%)`,
          ageMs,
          ageDays,
        };
      }

      return {
        shouldDeprecate: true,
        reason: `Pattern aged beyond max age: ${ageDays} days > ${Math.floor(this.config.maxAgeMs / (24 * 60 * 60 * 1000))} days`,
        ageMs,
        ageDays,
      };
    }

    // Check if pattern has insufficient trades
    if (this.config.minTrades !== undefined && pattern.trades.length < this.config.minTrades) {
      return {
        shouldDeprecate: true,
        reason: `Insufficient trades: ${pattern.trades.length} < ${this.config.minTrades}`,
        ageMs,
        ageDays,
      };
    }

    // Check if pattern has very low win rate
    if (this.config.minWinRate !== undefined && pattern.winRate < this.config.minWinRate) {
      return {
        shouldDeprecate: true,
        reason: `Win rate too low: ${(pattern.winRate * 100).toFixed(1)}% < ${(this.config.minWinRate * 100).toFixed(1)}%`,
        ageMs,
        ageDays,
      };
    }

    return {
      shouldDeprecate: false,
      reason: "Pattern is still valid",
      ageMs,
      ageDays,
    };
  }

  /**
   * Mark a pattern as deprecated
   */
  deprecate(pattern: DiscoveredPattern): DiscoveredPattern {
    return {
      ...pattern,
      status: "deprecated",
    };
  }

  /**
   * Filter and deprecate old patterns
   */
  processPatterns(patterns: DiscoveredPattern[]): {
    deprecated: DiscoveredPattern[];
    kept: DiscoveredPattern[];
  } {
    const deprecated: DiscoveredPattern[] = [];
    const kept: DiscoveredPattern[] = [];

    for (const pattern of patterns) {
      const evaluation = this.evaluate(pattern);
      if (evaluation.shouldDeprecate) {
        deprecated.push(this.deprecate(pattern));
      } else {
        kept.push(pattern);
      }
    }

    return { deprecated, kept };
  }
}
