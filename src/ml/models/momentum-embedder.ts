// src/ml/models/momentum-embedder.ts
import type { TradeMemory } from "../../agentdb-integration.js";
import type { EmbeddingModel, FeatureImportance } from "../types.js";

export class MomentumEmbedder implements EmbeddingModel {
  readonly name = "MomentumV1";
  readonly dimensions = 512;
  readonly strategy = "trend_following";

  generate(trade: TradeMemory): number[] {
    const features = [
      // Moving average alignment (trend direction strength)
      this.calculateMAAlignment(trade),

      // RSI slope (momentum indicator)
      this.calculateRSISlope(trade),

      // MACD signal
      this.calculateMACD(trade),

      // ADX trend strength
      this.calculateADX(trade),

      // Price momentum
      this.calculateMomentum(trade),

      // Trend strength estimate
      this.calculateTrendStrength(trade),

      // Risk/reward ratio
      this.calculateRiskReward(trade),

      // Position sizing
      trade.shares / 100,

      // Time features
      new Date(trade.timestamp).getHours() / 24,
      new Date(trade.timestamp).getDay() / 7,

      // Confidence
      trade.confidence ?? 0.5,

      // Strategy encoding (one-hot for trend_following)
      0, // breakout
      0, // mean_reversion
      1, // trend_following

      // Market condition encoding
      trade.marketCondition === "bullish" ? 1 : 0,
      trade.marketCondition === "bearish" ? 1 : 0,
      trade.marketCondition === "neutral" ? 1 : 0,

      // Entry price normalized
      trade.entryPrice / 1000,

      // Stop loss distance (volatility estimate)
      this.estimateStopDistance(trade),
    ];

    // Pad to 512 dimensions
    while (features.length < 512) {
      features.push(0);
    }

    return features.slice(0, 512);
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
      { feature: "momentum", importance: 0.25 },
      { feature: "maAlignment", importance: 0.2 },
      { feature: "macd", importance: 0.15 },
      { feature: "adx", importance: 0.15 },
      { feature: "trendStrength", importance: 0.1 },
      { feature: "rsiSlope", importance: 0.1 },
      { feature: "riskReward", importance: 0.05 },
    ];
  }

  private calculateMAAlignment(trade: TradeMemory): number {
    // Simulate MA alignment based on entry vs stop
    // Positive = bullish alignment, negative = bearish
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const stop = trade.stopLoss ?? safeEntryPrice * 0.96;
    const distance = (safeEntryPrice - stop) / safeEntryPrice;
    return trade.side === "buy" ? distance * 5 : -distance * 5;
  }

  private calculateRSISlope(trade: TradeMemory): number {
    // Approximate RSI slope based on entry price and market condition
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const baseRsi = trade.marketCondition === "bullish" ? 60 : trade.marketCondition === "bearish" ? 40 : 50;
    const momentum = (trade.takeProfit ?? safeEntryPrice * 1.05) / safeEntryPrice;
    return (momentum - 1) * 10; // Positive slope for bullish momentum, normalized
  }

  private calculateMACD(trade: TradeMemory): number {
    // MACD histogram approximation
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const target = trade.takeProfit ?? safeEntryPrice * 1.05;
    const momentum = Math.abs(target - trade.entryPrice) / safeEntryPrice;
    return trade.side === "buy" ? momentum : -momentum; // Normalized to -1 to 1
  }

  private calculateADX(trade: TradeMemory): number {
    // Trend strength approximation (ADX ranges 0-100, normalized to 0-1)
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const target = trade.takeProfit ?? safeEntryPrice * 1.05;
    const stop = trade.stopLoss ?? safeEntryPrice * 0.96;
    const riskReward = Math.abs(target - trade.entryPrice) / Math.abs(safeEntryPrice - stop);
    // Higher ADX for strong trends with good risk/reward, normalized
    return Math.min((25 + riskReward * 15) / 100, 1);
  }

  private calculateMomentum(trade: TradeMemory): number {
    // Price momentum based on expected move
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const target = trade.takeProfit ?? safeEntryPrice * 1.05;
    const momentum = Math.abs(target - trade.entryPrice) / safeEntryPrice;
    return trade.side === "buy" ? momentum : -momentum; // Normalized to -1 to 1
  }

  private calculateTrendStrength(trade: TradeMemory): number {
    // Composite trend strength score
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const target = trade.takeProfit ?? safeEntryPrice * 1.05;
    const stop = trade.stopLoss ?? safeEntryPrice * 0.96;
    const move = Math.abs(target - trade.entryPrice) / safeEntryPrice;
    const risk = Math.abs(safeEntryPrice - stop) / safeEntryPrice;
    const strength = move / Math.max(risk, 0.001);
    return Math.min(strength / 5, 1); // Normalize to 0-1
  }

  private calculateRiskReward(trade: TradeMemory): number {
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const stop = trade.stopLoss ?? safeEntryPrice * 0.96;
    const target = trade.takeProfit ?? safeEntryPrice * 1.05;
    const risk = Math.abs(safeEntryPrice - stop);
    const reward = Math.abs(target - safeEntryPrice);
    return risk > 0 ? Math.min(reward / risk, 10) : 3; // Cap at 10
  }

  private estimateStopDistance(trade: TradeMemory): number {
    const safeEntryPrice = Math.max(trade.entryPrice, 0.0001);
    const stop = trade.stopLoss ?? safeEntryPrice * 0.96;
    return Math.abs(safeEntryPrice - stop) / safeEntryPrice;
  }
}
