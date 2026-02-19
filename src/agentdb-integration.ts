/**
 * AgentDB Integration for Stock Trading Agent
 *
 * Uses AgentDB's MemoryController for persistent trade memory
 * and pattern recognition with vector-based similarity search.
 */

import { MemoryController, type Memory, type SearchResult } from "agentdb";

export interface TradeMemory {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  shares: number;
  pnl?: number;
  outcome?: "win" | "loss" | "breakeven";
  strategy: string;
  marketCondition: string;
  reasoning: string;
  mistakes: string[];
  lessons: string[];
  timestamp: number;
}

export interface TradingPattern {
  id: string;
  pattern: string;
  strategy: string;
  marketCondition: string;
  successRate: number;
  avgPnl: number;
  occurrenceCount: number;
  confidence: number;
  lastSeen: number;
}

export class TradingAgentDB {
  private memory: MemoryController;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize MemoryController with default config
    this.memory = new MemoryController(null, {
      namespace: "trading",
      enableAttention: true,
      defaultTopK: 10,
      defaultThreshold: 0.7,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // MemoryController is ready immediately
    this.isInitialized = true;

    console.log("✅ AgentDB MemoryController initialized");
    console.log(`   Namespace: trading`);
    console.log(`   Attention: enabled`);
  }

  /**
   * Generate embedding from trade features
   */
  private generateTradeEmbedding(trade: TradeMemory): number[] {
    // Feature vector (normalize to 384 dimensions for MiniLM)
    const features = [
      trade.entryPrice / 1000,
      trade.stopLoss / 1000,
      trade.takeProfit / 1000,
      (trade.takeProfit - trade.entryPrice) / Math.max(0.01, trade.entryPrice - trade.stopLoss),
      trade.shares / 100,
      new Date(trade.timestamp).getHours() / 24,
      trade.strategy === "breakout" ? 1 : 0,
      trade.strategy === "mean_reversion" ? 1 : 0,
      trade.strategy === "trend_following" ? 1 : 0,
      trade.marketCondition === "bullish" ? 1 : 0,
      trade.marketCondition === "bearish" ? 1 : 0,
      trade.marketCondition === "neutral" ? 1 : 0,
      trade.outcome === "win" ? 1 : trade.outcome === "loss" ? -1 : 0,
    ];

    // Pad to 384 dimensions
    while (features.length < 384) {
      features.push(0);
    }

    return features.slice(0, 384);
  }

  /**
   * Store a trade in AgentDB
   */
  async storeTrade(trade: TradeMemory): Promise<void> {
    const embedding = this.generateTradeEmbedding(trade);

    const memory: Memory = {
      id: trade.id,
      content: `${trade.symbol} ${trade.side} - ${trade.strategy} (${trade.marketCondition})`,
      embedding,
      importance: trade.outcome === "win" ? 0.9 : trade.outcome === "loss" ? 0.7 : 0.5,
      timestamp: trade.timestamp,
      metadata: {
        type: "trade",
        ...trade,
      },
    };

    await this.memory.store(memory, "trading");

    // Update pattern
    await this.updatePattern(trade);
  }

  /**
   * Find similar historical trades
   */
  async findSimilarTrades(trade: TradeMemory, k: number = 5): Promise<TradeMemory[]> {
    const embedding = this.generateTradeEmbedding(trade);

    const results = await this.memory.search(embedding, {
      topK: k,
      threshold: 0.7,
      filter: { type: "trade" },
      useAttention: true,
    });

    return results.filter((r) => r.metadata?.type === "trade").map((r) => r.metadata as TradeMemory);
  }

  /**
   * Analyze trade risk before execution
   */
  async analyzeTradeRisk(trade: TradeMemory): Promise<{
    risk: "low" | "medium" | "high";
    confidence: number;
    similarTrades: TradeMemory[];
    avgOutcome: number;
    recommendation: string;
  }> {
    const similarTrades = await this.findSimilarTrades(trade, 10);

    if (similarTrades.length === 0) {
      return {
        risk: "medium",
        confidence: 0,
        similarTrades: [],
        avgOutcome: 0,
        recommendation: "No similar trades found. Proceed with caution.",
      };
    }

    const outcomes = similarTrades
      .filter((t) => t.outcome)
      .map((t) => (t.outcome === "win" ? 1 : t.outcome === "loss" ? -1 : 0));

    const winRate = outcomes.filter((o) => o > 0).length / Math.max(1, outcomes.length);
    const avgOutcome = similarTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / similarTrades.length;

    let risk: "low" | "medium" | "high" = "medium";
    let recommendation = "";

    if (winRate > 0.6) {
      risk = "low";
      recommendation = `✅ High win rate (${(winRate * 100).toFixed(0)}%) for similar trades. Good setup!`;
    } else if (winRate < 0.4) {
      risk = "high";
      recommendation = `⚠️ Low win rate (${(winRate * 100).toFixed(0)}%) for similar trades. Consider skipping.`;
    } else {
      recommendation = `⚖️ Mixed results (${(winRate * 100).toFixed(0)}% win rate). Trade with caution.`;
    }

    return {
      risk,
      confidence: Math.min(1, similarTrades.length / 10),
      similarTrades,
      avgOutcome,
      recommendation,
    };
  }

  /**
   * Update pattern statistics
   */
  private async updatePattern(trade: TradeMemory): Promise<void> {
    const patternKey = `${trade.strategy}_${trade.marketCondition}`;
    const patternId = `pattern_${patternKey}`;

    // Check if pattern exists
    const existing = await this.memory.retrieve(patternId);

    if (existing) {
      const pattern = existing.metadata as TradingPattern;
      pattern.occurrenceCount++;
      pattern.lastSeen = Date.now();

      // Get all related trades
      const relatedTrades = await this.getRelatedTrades(patternKey);
      const closed = relatedTrades.filter((t) => t.outcome);
      const wins = closed.filter((t) => t.outcome === "win").length;

      pattern.successRate = closed.length > 0 ? wins / closed.length : 0;
      pattern.avgPnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0) / Math.max(1, closed.length);
      pattern.confidence = Math.min(1, closed.length / 10);

      await this.storePattern(pattern);
    } else {
      // Create new pattern
      await this.storePattern({
        id: patternId,
        pattern: patternKey,
        strategy: trade.strategy,
        marketCondition: trade.marketCondition,
        successRate: trade.outcome === "win" ? 1 : 0,
        avgPnl: trade.pnl || 0,
        occurrenceCount: 1,
        confidence: 0.1,
        lastSeen: Date.now(),
      });
    }
  }

  /**
   * Store a trading pattern
   */
  private async storePattern(pattern: TradingPattern): Promise<void> {
    const embedding = [
      pattern.successRate,
      pattern.avgPnl / 100,
      pattern.occurrenceCount / 100,
      pattern.confidence,
      pattern.strategy === "breakout" ? 1 : 0,
      pattern.strategy === "mean_reversion" ? 1 : 0,
      pattern.strategy === "trend_following" ? 1 : 0,
    ];

    // Pad to 384 dimensions
    while (embedding.length < 384) {
      embedding.push(0);
    }

    const memory: Memory = {
      id: pattern.id,
      content: `Pattern: ${pattern.pattern} - ${(pattern.successRate * 100).toFixed(0)}% success`,
      embedding: embedding.slice(0, 384),
      importance: pattern.confidence,
      timestamp: pattern.lastSeen,
      metadata: {
        type: "pattern",
        ...pattern,
      },
    };

    await this.memory.store(memory, "trading");
  }

  /**
   * Get related trades for pattern analysis
   */
  private async getRelatedTrades(patternKey: string): Promise<TradeMemory[]> {
    const [strategy, marketCondition] = patternKey.split("_");

    const allMemories = this.memory.getAllMemories();
    return allMemories
      .filter(
        (m) =>
          m.metadata?.type === "trade" &&
          m.metadata?.strategy === strategy &&
          m.metadata?.marketCondition === marketCondition,
      )
      .map((m) => m.metadata as TradeMemory);
  }

  /**
   * Get winning patterns
   */
  async getWinningPatterns(minConfidence: number = 0.3, minSuccessRate: number = 0.5): Promise<TradingPattern[]> {
    const allMemories = this.memory.getAllMemories();
    const patterns = allMemories
      .filter((m) => m.metadata?.type === "pattern")
      .map((m) => m.metadata as TradingPattern)
      .filter((p) => p.confidence >= minConfidence && p.successRate >= minSuccessRate)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    return patterns;
  }

  /**
   * Get patterns to avoid
   */
  async getLosingPatterns(minConfidence: number = 0.3): Promise<TradingPattern[]> {
    const allMemories = this.memory.getAllMemories();
    const patterns = allMemories
      .filter((m) => m.metadata?.type === "pattern")
      .map((m) => m.metadata as TradingPattern)
      .filter((p) => p.confidence >= minConfidence && p.successRate < 0.4)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5);

    return patterns;
  }

  /**
   * Get trading recommendations
   */
  async getRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];

    // Get winning patterns
    const winners = await this.getWinningPatterns();
    if (winners.length > 0) {
      recommendations.push("📈 High-success patterns:");
      winners.forEach((p) => {
        recommendations.push(
          `  • ${p.pattern}: ${(p.successRate * 100).toFixed(0)}% win rate ($${p.avgPnl.toFixed(2)} avg)`,
        );
      });
    }

    // Get patterns to avoid
    const losers = await this.getLosingPatterns();
    if (losers.length > 0) {
      recommendations.push("\n⚠️ Patterns to avoid:");
      losers.forEach((p) => {
        recommendations.push(`  • ${p.pattern}: ${(p.successRate * 100).toFixed(0)}% win rate`);
      });
    }

    // Get recent mistakes
    const recentMistakes = await this.getRecentMistakes(10);
    if (recentMistakes.length > 0) {
      recommendations.push("\n🎓 Recent lessons:");
      Array.from(new Set(recentMistakes))
        .slice(0, 5)
        .forEach((m) => {
          recommendations.push(`  • ${m}`);
        });
    }

    return recommendations;
  }

  /**
   * Get recent mistakes
   */
  private async getRecentMistakes(limit: number): Promise<string[]> {
    const allMemories = this.memory.getAllMemories();
    return allMemories
      .filter((m) => m.metadata?.type === "trade" && m.metadata?.outcome === "loss" && m.metadata?.mistakes?.length > 0)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, limit)
      .flatMap((m) => (m.metadata as TradeMemory).mistakes || [])
      .filter(Boolean);
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalTrades: number;
    totalPatterns: number;
    memoryCount: number;
    winRate: number;
    totalPnl: number;
  } {
    const allMemories = this.memory.getAllMemories();
    const trades = allMemories.filter((m) => m.metadata?.type === "trade");
    const patterns = allMemories.filter((m) => m.metadata?.type === "pattern");

    const closed = trades.filter((t) => t.metadata?.outcome);
    const wins = closed.filter((t) => t.metadata?.outcome === "win").length;

    const totalPnl = trades.reduce((sum, t) => sum + (t.metadata?.pnl || 0), 0);

    return {
      totalTrades: trades.length,
      totalPatterns: patterns.length,
      memoryCount: this.memory.count,
      winRate: closed.length > 0 ? wins / closed.length : 0,
      totalPnl,
    };
  }

  /**
   * Clear all memories (use with caution!)
   */
  clear(): void {
    this.memory.clear();
    console.log("🗑️ All memories cleared");
  }
}

// Export singleton instance
export const tradingDB = new TradingAgentDB();
