import { MemoryController, type Memory, type SearchResult } from "agentdb";

const backtestMemory = new MemoryController(null, {
  namespace: "backtests",
  enableAttention: true,
  defaultTopK: 10,
  defaultThreshold: 0.6,
});

export interface BacktestScenario {
  id: string;
  symbol: string;
  strategy: string;
  marketCondition: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timeOfDay: number; // Hour of entry (0-23)
  dayOfWeek: number; // 0-6
  simulatedOutcome: "win" | "loss";
  simulatedPnl: number;
  timestamp: number;
}

export interface TradeSignal {
  symbol: string;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  strategy?: string;
  marketCondition?: string;
}

export class BacktestMemory {
  async storeScenario(scenario: BacktestScenario): Promise<void> {
    const embedding = this.generateScenarioEmbedding(scenario);

    const memory: Memory = {
      id: scenario.id,
      content: `Backtest: ${scenario.symbol} ${scenario.strategy} ${scenario.marketCondition} - ${scenario.simulatedOutcome}`,
      embedding,
      importance: 0.5,
      timestamp: scenario.timestamp,
      metadata: {
        type: "backtest",
        ...scenario,
      },
    };

    await backtestMemory.store(memory, "backtests");
  }

  async findSimilarScenarios(trade: TradeSignal, k: number = 5): Promise<BacktestScenario[]> {
    // Create a partial scenario for embedding
    const partialScenario: Partial<BacktestScenario> = {
      symbol: trade.symbol,
      strategy: trade.strategy || "unknown",
      marketCondition: trade.marketCondition || "neutral",
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss || trade.entryPrice * 0.98,
      takeProfit: trade.takeProfit || trade.entryPrice * 1.04,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
    };

    const embedding = this.generatePartialEmbedding(partialScenario);

    const results = await backtestMemory.search(embedding, {
      topK: k,
      threshold: 0.6,
    });

    return results
      .filter((r: SearchResult) => r.metadata?.type === "backtest")
      .map((r: SearchResult) => r.metadata as unknown as BacktestScenario);
  }

  async getScenarioStats(_symbol: string): Promise<{
    totalScenarios: number;
    winRate: number;
    avgPnl: number;
  }> {
    // This would query all scenarios for a symbol
    // For now, return placeholder
    return {
      totalScenarios: 0,
      winRate: 0,
      avgPnl: 0,
    };
  }

  private generateScenarioEmbedding(scenario: BacktestScenario): number[] {
    const features = [
      // Price features (normalized)
      scenario.entryPrice / 1000,
      scenario.stopLoss / 1000,
      scenario.takeProfit / 1000,

      // Risk ratio
      (scenario.takeProfit - scenario.entryPrice) / Math.max(0.01, scenario.entryPrice - scenario.stopLoss),

      // Time features
      scenario.timeOfDay / 24,
      scenario.dayOfWeek / 7,

      // Categorical (one-hot)
      scenario.strategy === "breakout" ? 1 : 0,
      scenario.strategy === "mean_reversion" ? 1 : 0,
      scenario.strategy === "trend_following" ? 1 : 0,
      scenario.marketCondition === "bullish" ? 1 : 0,
      scenario.marketCondition === "bearish" ? 1 : 0,
      scenario.marketCondition === "neutral" ? 1 : 0,

      // Outcome
      scenario.simulatedOutcome === "win" ? 1 : -1,
    ];

    // Pad to 384 dimensions
    while (features.length < 384) features.push(0);
    return features.slice(0, 384);
  }

  private generatePartialEmbedding(scenario: Partial<BacktestScenario>): number[] {
    const features = [
      (scenario.entryPrice || 0) / 1000,
      (scenario.stopLoss || 0) / 1000,
      (scenario.takeProfit || 0) / 1000,
      new Date().getHours() / 24,
      new Date().getDay() / 7,
      scenario.strategy === "breakout" ? 1 : 0,
      scenario.strategy === "mean_reversion" ? 1 : 0,
      scenario.strategy === "trend_following" ? 1 : 0,
      scenario.marketCondition === "bullish" ? 1 : 0,
      scenario.marketCondition === "bearish" ? 1 : 0,
      scenario.marketCondition === "neutral" ? 1 : 0,
    ];

    while (features.length < 384) features.push(0);
    return features.slice(0, 384);
  }
}
