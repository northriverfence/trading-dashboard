// src/ml/models/statistical-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class StatisticalEmbedder implements EmbeddingModel {
  readonly name = "StatisticalV1";
  readonly dimensions = 256;
  readonly strategy = "mean_reversion";

  generate(trade: TradeMemory): number[] {
    const features = [
      // Price position relative to mean (z-score approximation)
      this.calculateZScore(trade),

      // Bollinger Band position
      this.calculateBBPosition(trade),

      // RSI deviation
      this.calculateRSIDeviation(trade),

      // Standard deviation
      this.estimateStdDev(trade),

      // Mean reversion velocity
      this.calculateReversionVelocity(trade),

      // Position sizing
      trade.shares / 100,

      // Time features
      new Date(trade.timestamp).getHours() / 24,

      // Confidence
      (trade as any).confidence ?? 0.5,

      // Strategy encoding
      1, // mean_reversion
      0, // breakout
      0, // trend_following
    ];

    // Pad to 256 dimensions
    while (features.length < 256) {
      features.push(0);
    }

    return features.slice(0, 256);
  }

  generateBatch(trades: TradeMemory[]): number[][] {
    return trades.map((t) => this.generate(t));
  }

  compare(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  getFeatureImportance(): FeatureImportance[] {
    return [
      { feature: "zScore", importance: 0.3 },
      { feature: "bbPosition", importance: 0.25 },
      { feature: "rsiDeviation", importance: 0.2 },
      { feature: "reversionVelocity", importance: 0.15 },
      { feature: "stdDev", importance: 0.1 },
    ];
  }

  private calculateZScore(trade: TradeMemory): number {
    // Approximate z-score based on stop distance
    const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
    const deviation = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
    return -deviation * 3; // Negative for oversold (mean reversion buy)
  }

  private calculateBBPosition(trade: TradeMemory): number {
    // Position within Bollinger Bands (-1 to 1, where -1 is lower band)
    const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
    const bandWidth = Math.abs(trade.entryPrice - stop) * 2;
    return bandWidth > 0 ? -0.5 : 0;
  }

  private calculateRSIDeviation(trade: TradeMemory): number {
    // Approximate RSI based on position
    const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
    const distance = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
    return 30 - distance * 100; // Lower RSI = more oversold
  }

  private estimateStdDev(trade: TradeMemory): number {
    const stop = trade.stopLoss ?? trade.entryPrice * 0.97;
    return Math.abs(trade.entryPrice - stop) / trade.entryPrice;
  }

  private calculateReversionVelocity(trade: TradeMemory): number {
    // Expected speed of mean reversion
    const riskReward =
      Math.abs((trade.takeProfit ?? trade.entryPrice * 1.03) - trade.entryPrice) /
      Math.abs(trade.entryPrice - (trade.stopLoss ?? trade.entryPrice * 0.97));
    return riskReward > 0 ? 1 / riskReward : 0.5;
  }
}
