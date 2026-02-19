import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface TradeRecord {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  shares: number;
  entryTime: string;
  exitTime?: string;
  status: "open" | "closed";
  pnl?: number;
  pnlPercent?: number;
  outcome: "win" | "loss" | "breakeven" | "open";
  marketCondition: "bullish" | "bearish" | "neutral";
  strategy: string;
  reasoning: string;
  mistakes: string[];
  lessons: string[];
  screenshot?: string;
}

export interface DailySummary {
  date: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgWinner: number;
  avgLoser: number;
  profitFactor: number;
  expectancy: number;
  lessons: string[];
  mistakes: string[];
  improvements: string[];
}

export interface LearningPattern {
  pattern: string;
  occurrenceCount: number;
  successRate: number;
  avgPnl: number;
  lastSeen: string;
  confidence: number;
}

export class TradeLearningSystem {
  private dataDir: string;
  private trades: TradeRecord[] = [];
  private patterns: LearningPattern[] = [];
  private dailySummaries: DailySummary[] = [];

  constructor(dataDir: string = "./data") {
    this.dataDir = dataDir;
    this.loadData();
  }

  // Record a new trade
  recordTrade(trade: Omit<TradeRecord, "id">): TradeRecord {
    const fullTrade: TradeRecord = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.trades.push(fullTrade);
    this.saveTrades();

    // Extract patterns from this trade
    this.analyzeTrade(fullTrade);

    return fullTrade;
  }

  // Close a trade and record the outcome
  closeTrade(
    tradeId: string,
    exitPrice: number,
    exitTime: string,
    mistakes: string[] = [],
    lessons: string[] = [],
  ): TradeRecord | null {
    const trade = this.trades.find((t) => t.id === tradeId);
    if (!trade) return null;

    trade.exitPrice = exitPrice;
    trade.exitTime = exitTime;
    trade.status = "closed";
    trade.mistakes = mistakes;
    trade.lessons = lessons;

    // Calculate P&L
    const multiplier = trade.side === "buy" ? 1 : -1;
    trade.pnl = (exitPrice - trade.entryPrice) * trade.shares * multiplier;
    trade.pnlPercent = (trade.pnl / (trade.entryPrice * trade.shares)) * 100;

    // Determine outcome
    if (trade.pnl > 0) trade.outcome = "win";
    else if (trade.pnl < 0) trade.outcome = "loss";
    else trade.outcome = "breakeven";

    this.saveTrades();
    this.updatePatterns();

    return trade;
  }

  // Analyze trade to extract learning patterns
  private analyzeTrade(trade: TradeRecord): void {
    const patterns: string[] = [
      `strategy:${trade.strategy}`,
      `market:${trade.marketCondition}`,
      `symbol:${trade.symbol}`,
      `side:${trade.side}`,
    ];

    // Future: Add technical pattern detection
    // e.g., "breakout_above_resistance", "bounce_off_support"

    patterns.forEach((pattern) => {
      const existing = this.patterns.find((p) => p.pattern === pattern);
      if (existing) {
        existing.occurrenceCount++;
        existing.lastSeen = new Date().toISOString();
      } else {
        this.patterns.push({
          pattern,
          occurrenceCount: 1,
          successRate: 0,
          avgPnl: 0,
          lastSeen: new Date().toISOString(),
          confidence: 0,
        });
      }
    });

    this.savePatterns();
  }

  // Update pattern success rates
  private updatePatterns(): void {
    this.patterns.forEach((pattern) => {
      const relatedTrades = this.getRelatedTrades(pattern.pattern);
      if (relatedTrades.length === 0) return;

      const closedTrades = relatedTrades.filter((t) => t.status === "closed");
      if (closedTrades.length === 0) return;

      const wins = closedTrades.filter((t) => t.outcome === "win").length;
      pattern.successRate = wins / closedTrades.length;

      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      pattern.avgPnl = totalPnl / closedTrades.length;

      pattern.confidence = Math.min(
        1,
        closedTrades.length / 10, // Confidence increases with sample size
      );
    });

    this.savePatterns();
  }

  // Get trades related to a pattern
  private getRelatedTrades(pattern: string): TradeRecord[] {
    const [key, value] = pattern.split(":");
    return this.trades.filter((t) => {
      if (key === "strategy" && t.strategy === value) return true;
      if (key === "market" && t.marketCondition === value) return true;
      if (key === "symbol" && t.symbol === value) return true;
      if (key === "side" && t.side === value) return true;
      return false;
    });
  }

  // Generate daily summary
  generateDailySummary(date: string): DailySummary {
    const dayTrades = this.trades.filter((t) => t.entryTime.startsWith(date) || t.exitTime?.startsWith(date));

    const closedTrades = dayTrades.filter((t) => t.status === "closed");
    const winners = closedTrades.filter((t) => t.outcome === "win");
    const losers = closedTrades.filter((t) => t.outcome === "loss");

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWinner = winners.length > 0 ? winners.reduce((sum, t) => sum + (t.pnl || 0), 0) / winners.length : 0;
    const avgLoser = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0) / losers.length) : 0;

    const profitFactor =
      losers.length === 0
        ? winners.length > 0
          ? Infinity
          : 0
        : (winners.reduce((sum, t) => sum + (t.pnl || 0), 0) || 0) /
          Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0) || 1);

    const winRate = closedTrades.length > 0 ? winners.length / closedTrades.length : 0;
    const expectancy = winRate * avgWinner - (1 - winRate) * avgLoser;

    // Extract lessons and mistakes
    const lessons: string[] = [];
    const mistakes: string[] = [];
    closedTrades.forEach((t) => {
      t.lessons?.forEach((l) => lessons.push(l));
      t.mistakes?.forEach((m) => mistakes.push(m));
    });

    // Identify improvements (unique lessons)
    const improvements = [...new Set(lessons)];

    const summary: DailySummary = {
      date,
      totalTrades: dayTrades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      winRate,
      totalPnl,
      avgWinner,
      avgLoser,
      profitFactor,
      expectancy,
      lessons: [...new Set(lessons)],
      mistakes: [...new Set(mistakes)],
      improvements,
    };

    this.dailySummaries.push(summary);
    this.saveSummaries();

    return summary;
  }

  // Get trading recommendations based on patterns
  getRecommendations(symbol?: string): string[] {
    const recommendations: string[] = [];

    // Find high-confidence patterns
    const highConfidencePatterns = this.patterns
      .filter((p) => p.confidence > 0.3 && p.successRate > 0.5)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    if (highConfidencePatterns.length > 0) {
      recommendations.push("📈 Based on your trading history, these patterns have worked well:");
      highConfidencePatterns.forEach((p) => {
        recommendations.push(
          `  • ${p.pattern}: ${(p.successRate * 100).toFixed(1)}% win rate, avg profit $${p.avgPnl.toFixed(2)}`,
        );
      });
    }

    // Find patterns to avoid
    const poorPatterns = this.patterns
      .filter((p) => p.confidence > 0.3 && p.successRate < 0.4)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 3);

    if (poorPatterns.length > 0) {
      recommendations.push("\n⚠️ Patterns to avoid:");
      poorPatterns.forEach((p) => {
        recommendations.push(
          `  • ${p.pattern}: ${(p.successRate * 100).toFixed(1)}% win rate, avg loss $${p.avgPnl.toFixed(2)}`,
        );
      });
    }

    // Add recent lessons
    const recentMistakes = this.trades
      .filter((t) => t.mistakes && t.mistakes.length > 0)
      .slice(-10)
      .flatMap((t) => t.mistakes || []);

    if (recentMistakes.length > 0) {
      recommendations.push("\n🎓 Recent lessons learned:");
      [...new Set(recentMistakes)].slice(0, 5).forEach((m) => recommendations.push(`  • ${m}`));
    }

    return recommendations;
  }

  // Save data to disk
  private saveTrades(): void {
    const filePath = join(this.dataDir, "trades.json");
    writeFileSync(filePath, JSON.stringify(this.trades, null, 2));
  }

  private savePatterns(): void {
    const filePath = join(this.dataDir, "patterns.json");
    writeFileSync(filePath, JSON.stringify(this.patterns, null, 2));
  }

  private saveSummaries(): void {
    const filePath = join(this.dataDir, "summaries.json");
    writeFileSync(filePath, JSON.stringify(this.dailySummaries, null, 2));
  }

  // Load data from disk
  private loadData(): void {
    const tradesPath = join(this.dataDir, "trades.json");
    const patternsPath = join(this.dataDir, "patterns.json");
    const summariesPath = join(this.dataDir, "summaries.json");

    if (existsSync(tradesPath)) {
      this.trades = JSON.parse(readFileSync(tradesPath, "utf-8"));
    }

    if (existsSync(patternsPath)) {
      this.patterns = JSON.parse(readFileSync(patternsPath, "utf-8"));
    }

    if (existsSync(summariesPath)) {
      this.dailySummaries = JSON.parse(readFileSync(summariesPath, "utf-8"));
    }
  }

  // Get statistics
  getStats() {
    const totalTrades = this.trades.filter((t) => t.status === "closed").length;
    const winners = this.trades.filter((t) => t.status === "closed" && t.outcome === "win").length;
    const totalPnl = this.trades.reduce((sum, t) => sum + (t.status === "closed" ? t.pnl || 0 : 0), 0);

    return {
      totalTrades,
      winRate: totalTrades > 0 ? winners / totalTrades : 0,
      totalPnl,
      patternCount: this.patterns.length,
      uniqueSymbols: [...new Set(this.trades.map((t) => t.symbol))].length,
    };
  }
}
