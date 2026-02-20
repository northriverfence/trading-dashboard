import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export interface TradeRequest {
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  shares?: number;
}

export interface RiskAdjustment {
  positionSizeMultiplier: number;
  stopLossMultiplier: number;
  confidence: number;
  reasoning: string;
}

export class DynamicRiskAdjuster {
  async adjustRisk(request: TradeRequest): Promise<RiskAdjustment> {
    const queryTrade: TradeMemory = {
      id: `risk_query_${Date.now()}`,
      symbol: request.symbol,
      side: request.side,
      entryPrice: request.entryPrice,
      stopLoss: request.stopLoss ?? 0,
      takeProfit: request.takeProfit ?? 0,
      shares: request.shares ?? 0,
      strategy: "unknown",
      marketCondition: "neutral",
      reasoning: "Risk adjustment query",
      mistakes: [],
      lessons: [],
      timestamp: Date.now(),
    };

    const similarTrades = await tradingDB.findSimilarTrades(queryTrade, 20);

    if (similarTrades.length === 0) {
      return {
        positionSizeMultiplier: 1.0,
        stopLossMultiplier: 1.0,
        confidence: 0,
        reasoning: "No historical data. Using standard risk parameters.",
      };
    }

    const closedTrades = similarTrades.filter((t) => t.outcome);
    const winRate = this.calculateWinRate(closedTrades);
    const avgPnl = this.calculateAvgPnl(closedTrades);

    let positionSizeMultiplier = 1.0;
    let stopLossMultiplier = 1.0;
    let confidence = Math.min(1, similarTrades.length / 20);
    let reasoning: string;

    if (avgPnl > 50 && winRate > 0.6) {
      positionSizeMultiplier = 1.2;
      stopLossMultiplier = 1.0;
      reasoning = `✅ High confidence: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L`;
    } else if (avgPnl > 20 && winRate >= 0.4) {
      positionSizeMultiplier = 1.0;
      stopLossMultiplier = 1.0;
      reasoning = `⚖️ Neutral setup: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L`;
    } else if (avgPnl < -20 || winRate < 0.4) {
      positionSizeMultiplier = 0.5;
      stopLossMultiplier = 0.8;
      reasoning = `⚠️ Poor setup: ${(winRate * 100).toFixed(0)}% win rate. Reducing position size.`;
    } else {
      positionSizeMultiplier = 1.0;
      stopLossMultiplier = 1.0;
      reasoning = `ℹ️ Limited data: ${(winRate * 100).toFixed(0)}% win rate`;
    }

    return { positionSizeMultiplier, stopLossMultiplier, confidence, reasoning };
  }

  private calculateWinRate(trades: TradeMemory[]): number {
    if (trades.length === 0) return 0;
    return trades.filter((t) => t.outcome === "win").length / trades.length;
  }

  private calculateAvgPnl(trades: TradeMemory[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce((sum, t) => sum + (t.pnl || 0), 0) / trades.length;
  }
}
