// src/memory/importance-scorer.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface ImportanceScorerConfig {
  winRateWeight?: number;
  pnlWeight?: number;
  recencyWeight?: number;
  uniquenessWeight?: number;
}

/**
 * Calculates importance score for trade memories
 * Formula: I = win_rate*0.4 + pnl*0.3 + recency*0.2 + uniqueness*0.1
 */
export class ImportanceScorer {
  private config: Required<ImportanceScorerConfig>;

  constructor(config: ImportanceScorerConfig = {}) {
    this.config = {
      winRateWeight: config.winRateWeight ?? 0.4,
      pnlWeight: config.pnlWeight ?? 0.3,
      recencyWeight: config.recencyWeight ?? 0.2,
      uniquenessWeight: config.uniquenessWeight ?? 0.1,
    };
  }

  /**
   * Calculate importance score for a trade
   * Returns score between 0 and 1
   */
  calculate(trade: TradeMemory): number {
    const winRateScore = this.calculateWinRateScore(trade);
    const pnlScore = this.calculatePnlScore(trade);
    const recencyScore = this.calculateRecencyScore(trade);
    const uniquenessScore = this.calculateUniquenessScore(trade);

    const importance =
      winRateScore * this.config.winRateWeight +
      pnlScore * this.config.pnlWeight +
      recencyScore * this.config.recencyWeight +
      uniquenessScore * this.config.uniquenessWeight;

    return Math.min(1, Math.max(0, importance));
  }

  /**
   * Calculate win rate component (0-1)
   * Based on trade outcome
   */
  private calculateWinRateScore(trade: TradeMemory): number {
    if (trade.outcome === "win") return 1.0;
    if (trade.outcome === "loss") return 0.0;
    if (trade.outcome === "breakeven") return 0.5;

    // No outcome yet - use heuristics based on mistakes
    if (trade.mistakes && trade.mistakes.length > 0) {
      return Math.max(0, 0.5 - trade.mistakes.length * 0.1);
    }

    return 0.5; // Neutral for open trades
  }

  /**
   * Calculate PnL component (0-1)
   * Normalized based on trade profit/loss
   */
  private calculatePnlScore(trade: TradeMemory): number {
    if (trade.pnl === undefined || trade.pnl === null) {
      // For open trades, estimate based on setup quality
      const riskReward = (trade.takeProfit - trade.entryPrice) / Math.max(0.01, trade.entryPrice - trade.stopLoss);
      return Math.min(1, Math.max(0, (riskReward - 1) / 2));
    }

    // Normalize PnL (assuming typical range -1000 to +1000)
    const normalizedPnl = (trade.pnl + 1000) / 2000;
    return Math.min(1, Math.max(0, normalizedPnl));
  }

  /**
   * Calculate recency component (0-1)
   * Higher for more recent trades, decays over 30 days
   */
  private calculateRecencyScore(trade: TradeMemory): number {
    const ageMs = Date.now() - trade.timestamp;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return Math.max(0, 1 - ageMs / thirtyDaysMs);
  }

  /**
   * Calculate uniqueness component (0-1)
   * Higher for trades with lessons learned or unique characteristics
   */
  private calculateUniquenessScore(trade: TradeMemory): number {
    let score = 0.5;

    // Trades with lessons are more unique/important
    if (trade.lessons && trade.lessons.length > 0) {
      score += Math.min(0.3, trade.lessons.length * 0.1);
    }

    // Trades with mistakes documented are unique learning opportunities
    if (trade.mistakes && trade.mistakes.length > 0) {
      score += Math.min(0.2, trade.mistakes.length * 0.05);
    }

    // Different market conditions add uniqueness
    if (trade.marketCondition !== "neutral") {
      score += 0.1;
    }

    return Math.min(1, score);
  }
}
