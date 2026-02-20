// src/ml/models/price-action-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class PriceActionEmbedder implements EmbeddingModel {
  readonly name = "PriceActionV1";
  readonly dimensions = 384;
  readonly strategy = "breakout";

  generate(trade: TradeMemory): number[] {
    const features = [
      // Price features (normalized)
      trade.entryPrice / 1000,
      (trade.stopLoss ?? trade.entryPrice * 0.98) / 1000,
      (trade.takeProfit ?? trade.entryPrice * 1.04) / 1000,

      // Risk/reward ratio
      this.calculateRiskReward(trade),

      // Position sizing
      trade.shares / 100,

      // Time features
      new Date(trade.timestamp).getHours() / 24,
      new Date(trade.timestamp).getDay() / 7,

      // Strategy encoding
      trade.strategy === "breakout" ? 1 : 0,
      trade.strategy === "mean_reversion" ? 1 : 0,
      trade.strategy === "trend_following" ? 1 : 0,

      // Market condition encoding
      trade.marketCondition === "bullish" ? 1 : 0,
      trade.marketCondition === "bearish" ? 1 : 0,
      trade.marketCondition === "neutral" ? 1 : 0,

      // Volatility estimate (based on stop distance)
      this.estimateVolatility(trade),

      // Pattern strength indicators
      trade.confidence ?? 0.5,
    ];

    // Pad to 384 dimensions with zeros
    while (features.length < 384) {
      features.push(0);
    }

    return features.slice(0, 384);
  }

  generateBatch(trades: TradeMemory[]): number[][] {
    return trades.map((t) => this.generate(t));
  }

  compare(a: number[], b: number[]): number {
    // Cosine similarity
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
      { feature: "entryPrice", importance: 0.25 },
      { feature: "riskReward", importance: 0.2 },
      { feature: "volatility", importance: 0.15 },
      { feature: "confidence", importance: 0.15 },
      { feature: "timeOfDay", importance: 0.1 },
      { feature: "marketCondition", importance: 0.1 },
      { feature: "strategy", importance: 0.05 },
    ];
  }

  private calculateRiskReward(trade: TradeMemory): number {
    const stop = trade.stopLoss ?? trade.entryPrice * 0.98;
    const target = trade.takeProfit ?? trade.entryPrice * 1.04;
    const risk = Math.abs(trade.entryPrice - stop);
    const reward = Math.abs(target - trade.entryPrice);
    return risk > 0 ? reward / risk : 2;
  }

  private estimateVolatility(trade: TradeMemory): number {
    const stop = trade.stopLoss ?? trade.entryPrice * 0.98;
    const stopDistance = Math.abs(trade.entryPrice - stop) / trade.entryPrice;
    return Math.min(stopDistance * 10, 1); // Normalize to 0-1
  }
}
