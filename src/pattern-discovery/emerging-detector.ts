// src/pattern-discovery/emerging-detector.ts
import type { DiscoveredPattern, EmergingPattern, TradeMemory } from "./types.js";

export interface EmergingDetectorConfig {
  fastTrackThreshold: number; // Minimum confidence for fast-track eligibility
  minTradesForFastTrack: number; // Minimum trades needed for fast-track
}

export interface EmergingAnalysisResult {
  fastTrackEligible: boolean;
  confidence: number;
  tradeCount: number;
  tradesCount: number; // Alias for tradeCount
  winRate: number;
  patternId: string;
  reason: string;
}

export class EmergingDetector {
  private config: EmergingDetectorConfig;

  constructor(config: EmergingDetectorConfig) {
    this.config = config;
  }

  /**
   * Analyze a pattern to determine if it's emerging and fast-track eligible
   */
  analyze(pattern: DiscoveredPattern, tradeCount: number): EmergingAnalysisResult {
    const fastTrackEligible = this.isFastTrackEligible(pattern, tradeCount);

    return {
      fastTrackEligible,
      confidence: pattern.confidence,
      tradeCount,
      tradesCount: tradeCount,
      winRate: pattern.winRate,
      patternId: pattern.id,
      reason: fastTrackEligible
        ? "Pattern meets fast-track criteria: high confidence and sufficient trades"
        : this.getIneligibilityReason(pattern, tradeCount),
    };
  }

  /**
   * Check if a pattern qualifies for fast-track promotion
   */
  private isFastTrackEligible(pattern: DiscoveredPattern, tradeCount: number): boolean {
    // Must have minimum trades
    if (tradeCount < this.config.minTradesForFastTrack) {
      return false;
    }

    // Must have high confidence
    if (pattern.confidence < this.config.fastTrackThreshold) {
      return false;
    }

    // Must have positive win rate
    if (pattern.winRate < 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Get the reason why pattern is not fast-track eligible
   */
  private getIneligibilityReason(pattern: DiscoveredPattern, tradeCount: number): string {
    if (tradeCount < this.config.minTradesForFastTrack) {
      return `Insufficient trades: ${tradeCount} < ${this.config.minTradesForFastTrack}`;
    }
    if (pattern.confidence < this.config.fastTrackThreshold) {
      return `Confidence too low: ${(pattern.confidence * 100).toFixed(1)}% < ${(this.config.fastTrackThreshold * 100).toFixed(1)}%`;
    }
    if (pattern.winRate < 0.5) {
      return `Win rate below 50%: ${(pattern.winRate * 100).toFixed(1)}%`;
    }
    return "Unknown reason";
  }

  /**
   * Create an EmergingPattern from a DiscoveredPattern
   */
  createEmergingPattern(pattern: DiscoveredPattern, tradeCount: number): EmergingPattern {
    const analysis = this.analyze(pattern, tradeCount);

    return {
      id: `emerging_${pattern.id}`,
      patternId: pattern.id,
      tradesCount: tradeCount,
      winRate: pattern.winRate,
      fastTrackEligible: analysis.fastTrackEligible,
    };
  }

  /**
   * Filter patterns that are eligible for fast-track
   */
  filterFastTrackEligible(patterns: Array<{ pattern: DiscoveredPattern; tradeCount: number }>): EmergingPattern[] {
    return patterns
      .filter(({ pattern, tradeCount }) => this.isFastTrackEligible(pattern, tradeCount))
      .map(({ pattern, tradeCount }) => this.createEmergingPattern(pattern, tradeCount));
  }
}
