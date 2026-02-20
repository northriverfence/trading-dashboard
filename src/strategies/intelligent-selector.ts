import { tradingDB, type TradingPattern } from "../agentdb-integration.js";

// Constants for magic numbers
const MIN_CONFIDENCE_THRESHOLD = 0.3;
const MIN_SUCCESS_RATE = 0.5;
const FALLBACK_STRATEGY = "breakout";
const FALLBACK_CONFIDENCE = 0.3;
const FALLBACK_WIN_RATE = 0.5;
const PERFORMANCE_MIN_CONFIDENCE = 0.1;
const PERFORMANCE_MIN_SUCCESS_RATE = 0;

export interface MarketCondition {
  condition: "bullish" | "bearish" | "neutral" | "volatile";
  indicators: {
    rsi: number;
    trend: "up" | "down" | "sideways";
    volatility: number;
  };
}

export interface StrategyRecommendation {
  strategy: string;
  confidence: number;
  expectedWinRate: number;
  reasoning: string;
}

export class IntelligentStrategySelector {
  async selectStrategy(marketCondition: MarketCondition): Promise<StrategyRecommendation> {
    // Get winning patterns from AgentDB
    let patterns: TradingPattern[];
    try {
      patterns = await tradingDB.getWinningPatterns(MIN_CONFIDENCE_THRESHOLD, MIN_SUCCESS_RATE);
    } catch (error) {
      console.error("Failed to fetch patterns from AgentDB:", error);
      return {
        strategy: FALLBACK_STRATEGY,
        confidence: FALLBACK_CONFIDENCE,
        expectedWinRate: FALLBACK_WIN_RATE,
        reasoning: "Pattern analysis unavailable due to database error. Using default strategy.",
      };
    }

    if (patterns.length === 0) {
      return {
        strategy: FALLBACK_STRATEGY,
        confidence: FALLBACK_CONFIDENCE,
        expectedWinRate: FALLBACK_WIN_RATE,
        reasoning: "No pattern data available. Defaulting to breakout strategy.",
      };
    }

    // Filter patterns matching current market condition
    const relevantPatterns = patterns.filter((p) => p.marketCondition === marketCondition.condition);

    // If no patterns match current condition, use all patterns
    const patternsToRank = relevantPatterns.length > 0 ? relevantPatterns : patterns;

    // Rank by success rate * occurrence count (weighted confidence)
    const ranked = patternsToRank
      .map((p) => ({
        pattern: p,
        score: p.successRate * Math.log(p.occurrenceCount + 1), // Log scaling for occurrence
      }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];

    if (!best) {
      return {
        strategy: FALLBACK_STRATEGY,
        confidence: FALLBACK_CONFIDENCE,
        expectedWinRate: FALLBACK_WIN_RATE,
        reasoning: "Pattern analysis inconclusive. Defaulting to breakout strategy.",
      };
    }

    // Parse strategy from pattern key (format: "strategy_marketCondition")
    const [strategy] = best.pattern.pattern.split("_");

    // Validate strategy is not empty
    if (!strategy || strategy.trim() === "") {
      return {
        strategy: FALLBACK_STRATEGY,
        confidence: FALLBACK_CONFIDENCE,
        expectedWinRate: FALLBACK_WIN_RATE,
        reasoning: "Invalid pattern format. Defaulting to breakout strategy.",
      };
    }

    return {
      strategy: strategy,
      confidence: best.pattern.confidence,
      expectedWinRate: best.pattern.successRate,
      reasoning: `Selected based on ${best.pattern.occurrenceCount} historical trades with ${(best.pattern.successRate * 100).toFixed(0)}% win rate in ${marketCondition.condition} conditions`,
    };
  }

  async getStrategyPerformance(strategy: string): Promise<{
    totalTrades: number;
    winRate: number;
    avgPnl: number;
  }> {
    let patterns: TradingPattern[];
    try {
      patterns = await tradingDB.getWinningPatterns(PERFORMANCE_MIN_CONFIDENCE, PERFORMANCE_MIN_SUCCESS_RATE);
    } catch (error) {
      console.error("Failed to fetch patterns for performance analysis:", error);
      return { totalTrades: 0, winRate: 0, avgPnl: 0 };
    }
    const strategyPatterns = patterns.filter((p) => p.pattern.startsWith(`${strategy}_`));

    if (strategyPatterns.length === 0) {
      return { totalTrades: 0, winRate: 0, avgPnl: 0 };
    }

    const totalTrades = strategyPatterns.reduce((sum, p) => sum + p.occurrenceCount, 0);
    const avgWinRate = strategyPatterns.reduce((sum, p) => sum + p.successRate, 0) / strategyPatterns.length;
    // Weighted average by occurrence count (not simple average)
    const avgPnl =
      totalTrades > 0 ? strategyPatterns.reduce((sum, p) => sum + p.avgPnl * p.occurrenceCount, 0) / totalTrades : 0;

    return { totalTrades, winRate: avgWinRate, avgPnl };
  }
}
