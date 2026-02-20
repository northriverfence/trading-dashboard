// src/pattern-discovery/quality-gate.ts
import type { DiscoveredPattern } from "./types.js";

export interface QualityGateConfig {
  minWinRate: number;
  minTrades: number;
}

export interface ValidationResult {
  valid: boolean;
  grade: "A" | "B" | "C" | "D" | "F";
  reason?: string;
  score: number;
}

export class QualityGate {
  private config: QualityGateConfig;

  constructor(config: QualityGateConfig) {
    this.config = config;
  }

  validate(pattern: DiscoveredPattern, tradeCount: number): ValidationResult {
    // Check minimum trades
    if (tradeCount < this.config.minTrades) {
      return {
        valid: false,
        grade: "F",
        reason: `Insufficient trades: ${tradeCount} < ${this.config.minTrades}`,
        score: 0,
      };
    }

    // Check minimum win rate
    if (pattern.winRate < this.config.minWinRate) {
      return {
        valid: false,
        grade: "F",
        reason: `Win rate too low: ${(pattern.winRate * 100).toFixed(1)}% < ${(this.config.minWinRate * 100).toFixed(1)}%`,
        score: pattern.winRate,
      };
    }

    // Calculate grade based on win rate
    const grade = this.calculateGrade(pattern.winRate);
    const score = this.calculateScore(pattern, tradeCount);

    return {
      valid: true,
      grade,
      score,
    };
  }

  private calculateGrade(winRate: number): "A" | "B" | "C" | "D" | "F" {
    if (winRate >= 0.8) return "A";
    if (winRate >= 0.7) return "B";
    if (winRate >= 0.6) return "C";
    if (winRate >= 0.5) return "D";
    return "F";
  }

  private calculateScore(pattern: DiscoveredPattern, tradeCount: number): number {
    // Composite score: winRate * 0.5 + confidence * 0.3 + tradeSupport * 0.2
    const tradeSupport = Math.min(tradeCount / 20, 1); // Normalize to 0-1
    return pattern.winRate * 0.5 + pattern.confidence * 0.3 + tradeSupport * 0.2;
  }

  /**
   * Check if pattern should be promoted to active status
   */
  shouldPromote(pattern: DiscoveredPattern, tradeCount: number): boolean {
    const result = this.validate(pattern, tradeCount);
    return result.valid && result.grade <= "B"; // A or B grade
  }

  /**
   * Check if pattern should be deprecated
   */
  shouldDeprecate(pattern: DiscoveredPattern, tradeCount: number): boolean {
    const result = this.validate(pattern, tradeCount);
    return !result.valid || result.grade === "F";
  }
}
