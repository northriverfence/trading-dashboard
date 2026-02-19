import { type TradeRecord } from "./learning-system";

export interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  avgTrade: number;
  avgWinner: number;
  avgLoser: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  largestPosition: number;
  avgHoldingTime: number;
  tradesPerDay: number;
}

export class PerformanceAnalytics {
  // Calculate comprehensive metrics
  calculateMetrics(trades: TradeRecord[]): PerformanceMetrics {
    const closedTrades = trades.filter((t) => t.status === "closed");

    if (closedTrades.length === 0) {
      return this.getDefaultMetrics();
    }

    const winners = closedTrades.filter((t) => t.outcome === "win");
    const losers = closedTrades.filter((t) => t.outcome === "loss");

    const returns = closedTrades.map((t) => t.pnl || 0);
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const avgReturn = totalReturn / closedTrades.length;

    // Sharpe ratio (simplified - assumes risk-free rate = 0)
    const stdDev = this.calculateStdDev(returns);
    const sharpeRatio = stdDev === 0 ? 0 : avgReturn / stdDev;

    // Max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(returns);

    // Profit factor
    const grossProfit = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

    // Expectancy
    const winRate = winners.length / closedTrades.length;
    const avgWinner = winners.length > 0 ? winners.reduce((sum, t) => sum + (t.pnl || 0), 0) / winners.length : 0;
    const avgLoser = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0) / losers.length) : 0;
    const expectancy = winRate * avgWinner - (1 - winRate) * avgLoser;

    // Consecutive wins/losses
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutive(trades);

    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      expectancy,
      avgTrade: avgReturn,
      avgWinner,
      avgLoser,
      bestTrade: Math.max(...returns),
      worstTrade: Math.min(...returns),
      consecutiveWins,
      consecutiveLosses,
      largestPosition: Math.max(...trades.map((t) => t.shares)),
      avgHoldingTime: this.calculateAvgHoldingTime(closedTrades),
      tradesPerDay: this.calculateTradesPerDay(closedTrades),
    };
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;

    for (const ret of returns) {
      runningTotal += ret;
      if (runningTotal > peak) peak = runningTotal;
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private calculateConsecutive(trades: TradeRecord[]): { consecutiveWins: number; consecutiveLosses: number } {
    let currentWins = 0;
    let currentLosses = 0;
    let maxWins = 0;
    let maxLosses = 0;

    const closedTrades = trades.filter((t) => t.status === "closed");

    for (const trade of closedTrades) {
      if (trade.outcome === "win") {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (trade.outcome === "loss") {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return { consecutiveWins: maxWins, consecutiveLosses: maxLosses };
  }

  private calculateAvgHoldingTime(trades: TradeRecord[]): number {
    const holdingTimes = trades
      .filter((t) => t.exitTime)
      .map((t) => new Date(t.exitTime!).getTime() - new Date(t.entryTime).getTime());

    return holdingTimes.length > 0
      ? holdingTimes.reduce((sum, h) => sum + h, 0) / holdingTimes.length / 1000 / 60 // minutes
      : 0;
  }

  private calculateTradesPerDay(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    const dates = trades.map((t) => t.entryTime.split("T")[0]);
    const uniqueDates = [...new Set(dates)];

    return trades.length / uniqueDates.length;
  }

  // Detect losing patterns
  detectLosingPatterns(trades: TradeRecord[]): string[] {
    const patterns: Record<string, { wins: number; losses: number; totalPnl: number }> = {};

    trades
      .filter((t) => t.status === "closed")
      .forEach((t) => {
        const key = `${t.strategy}_${t.marketCondition}`;
        if (!patterns[key]) {
          patterns[key] = { wins: 0, losses: 0, totalPnl: 0 };
        }
        patterns[key].totalPnl += t.pnl || 0;
        if (t.outcome === "win") patterns[key].wins++;
        else if (t.outcome === "loss") patterns[key].losses++;
      });

    const losingPatterns: string[] = [];
    Object.entries(patterns).forEach(([key, stats]) => {
      const total = stats.wins + stats.losses;
      if (total >= 5 && stats.losses / total > 0.6) {
        losingPatterns.push(
          `${key}: ${((stats.losses / total) * 100).toFixed(0)}% loss rate, $${stats.totalPnl.toFixed(2)} total`,
        );
      }
    });

    return losingPatterns;
  }

  // Get improvement suggestions
  getImprovements(metrics: PerformanceMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.winRate < 0.5) {
      suggestions.push("📉 Win rate is below 50%. Review entry criteria and wait for higher-probability setups.");
    }

    if (metrics.profitFactor < 1.5) {
      suggestions.push("⚠️ Profit factor is low. Focus on letting winners run and cutting losers faster.");
    }

    if (metrics.maxDrawdown > 0.1) {
      suggestions.push("🔻 Max drawdown exceeds 10%. Reduce position sizes and increase stops.");
    }

    if (metrics.avgLoser > metrics.avgWinner * 0.8) {
      suggestions.push("💰 Losses are too large relative to winners. Tighten stop losses.");
    }

    if (metrics.consecutiveLosses >= 3) {
      suggestions.push("🚫 You've had 3+ consecutive losses. Take a break and review your strategy.");
    }

    if (metrics.sharpeRatio < 1) {
      suggestions.push("📊 Risk-adjusted returns need improvement. Reduce trade frequency or size.");
    }

    return suggestions;
  }

  private getDefaultMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      avgTrade: 0,
      avgWinner: 0,
      avgLoser: 0,
      bestTrade: 0,
      worstTrade: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestPosition: 0,
      avgHoldingTime: 0,
      tradesPerDay: 0,
    };
  }
}
