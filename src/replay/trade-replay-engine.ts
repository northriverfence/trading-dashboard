/**
 * TradeReplayEngine
 * Replays historical trades for analysis and learning
 */

export interface HistoricalTrade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  quantity: number;
  side: "long" | "short";
  pnl: number;
  pnlPercent: number;
  strategy: string;
  exitReason: string;
  marketConditions: {
    volatility: number;
    trend: string;
    volume: number;
  };
}

export interface ReplayResult {
  trade: HistoricalTrade;
  whatIfScenarios: WhatIfResult[];
  lessons: string[];
  optimalExit: {
    price: number;
    time: Date;
    potentialPnl: number;
  };
}

export interface WhatIfResult {
  scenario: string;
  exitPrice: number;
  pnl: number;
  difference: number;
}

export interface ReplaySession {
  id: string;
  startTime: Date;
  trades: HistoricalTrade[];
  results: ReplayResult[];
  summary: {
    totalTrades: number;
    winningTrades: number;
    totalPnl: number;
    avgImprovement: number;
  };
}

export class TradeReplayEngine {
  private historicalTrades: HistoricalTrade[] = [];
  private sessions: Map<string, ReplaySession> = new Map();

  /**
   * Add historical trade
   */
  addTrade(trade: HistoricalTrade): void {
    this.historicalTrades.push(trade);
  }

  /**
   * Add multiple trades
   */
  addTrades(trades: HistoricalTrade[]): void {
    this.historicalTrades.push(...trades);
  }

  /**
   * Replay a specific trade with scenarios
   */
  replayTrade(tradeId: string): ReplayResult | null {
    const trade = this.historicalTrades.find((t) => t.id === tradeId);
    if (!trade) return null;

    const whatIfScenarios = this.generateWhatIfScenarios(trade);
    const lessons = this.extractLessons(trade);
    const optimalExit = this.calculateOptimalExit(trade);

    return {
      trade,
      whatIfScenarios,
      lessons,
      optimalExit,
    };
  }

  /**
   * Create a replay session for a set of trades
   */
  createSession(tradeIds?: string[]): ReplaySession {
    const sessionId = `session-${Date.now()}`;
    const trades = tradeIds ? this.historicalTrades.filter((t) => tradeIds.includes(t.id)) : [...this.historicalTrades];

    const session: ReplaySession = {
      id: sessionId,
      startTime: new Date(),
      trades,
      results: [],
      summary: {
        totalTrades: trades.length,
        winningTrades: 0,
        totalPnl: 0,
        avgImprovement: 0,
      },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Run replay session
   */
  runSession(sessionId: string): ReplaySession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    let winningTrades = 0;
    let totalPnl = 0;
    let totalImprovement = 0;

    for (const trade of session.trades) {
      const result = this.replayTrade(trade.id);
      if (result) {
        session.results.push(result);
        totalPnl += trade.pnl;
        if (trade.pnl > 0) winningTrades++;

        // Calculate potential improvement
        const improvement = result.optimalExit.potentialPnl - trade.pnl;
        totalImprovement += improvement;
      }
    }

    session.summary = {
      totalTrades: session.trades.length,
      winningTrades,
      totalPnl,
      avgImprovement: session.trades.length > 0 ? totalImprovement / session.trades.length : 0,
    };

    return session;
  }

  /**
   * Replay trades by strategy
   */
  replayByStrategy(strategy: string): ReplayResult[] {
    const trades = this.historicalTrades.filter((t) => t.strategy === strategy);
    return trades.map((t) => this.replayTrade(t.id)).filter((r): r is ReplayResult => r !== null);
  }

  /**
   * Replay trades by symbol
   */
  replayBySymbol(symbol: string): ReplayResult[] {
    const trades = this.historicalTrades.filter((t) => t.symbol === symbol);
    return trades.map((t) => this.replayTrade(t.id)).filter((r): r is ReplayResult => r !== null);
  }

  /**
   * Get best and worst trades
   */
  getExtremeTrades(count: number = 5): { best: HistoricalTrade[]; worst: HistoricalTrade[] } {
    const sorted = [...this.historicalTrades].sort((a, b) => b.pnl - a.pnl);

    return {
      best: sorted.slice(0, count),
      worst: sorted.slice(-count).reverse(),
    };
  }

  /**
   * Analyze exit timing
   */
  analyzeExitTiming(): {
    earlyExits: number;
    optimalExits: number;
    lateExits: number;
    avgImprovement: number;
  } {
    let early = 0;
    let optimal = 0;
    let late = 0;
    let totalImprovement = 0;

    for (const trade of this.historicalTrades) {
      const replay = this.replayTrade(trade.id);
      if (!replay) continue;

      const improvement = replay.optimalExit.potentialPnl - trade.pnl;
      totalImprovement += improvement;

      if (improvement > trade.pnl * 0.1) {
        early++;
      } else if (improvement < -trade.pnl * 0.1) {
        late++;
      } else {
        optimal++;
      }
    }

    const avgImprovement = this.historicalTrades.length > 0 ? totalImprovement / this.historicalTrades.length : 0;

    return {
      earlyExits: early,
      optimalExits: optimal,
      lateExits: late,
      avgImprovement,
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ReplaySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): ReplaySession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear historical data
   */
  clear(): void {
    this.historicalTrades = [];
    this.sessions.clear();
  }

  private generateWhatIfScenarios(trade: HistoricalTrade): WhatIfResult[] {
    const scenarios: WhatIfResult[] = [];

    // Earlier exit (50% of time in trade)
    const halfTime = new Date(trade.entryTime.getTime() + (trade.exitTime.getTime() - trade.entryTime.getTime()) / 2);
    const earlierPnl = trade.pnl * 0.8; // Simplified
    scenarios.push({
      scenario: "Exit at 50% of holding time",
      exitPrice: trade.entryPrice + earlierPnl / trade.quantity,
      pnl: earlierPnl,
      difference: earlierPnl - trade.pnl,
    });

    // Later exit (150% of time in trade)
    const laterPnl = trade.pnl * 1.2; // Simplified
    scenarios.push({
      scenario: "Hold 50% longer",
      exitPrice: trade.entryPrice + laterPnl / trade.quantity,
      pnl: laterPnl,
      difference: laterPnl - trade.pnl,
    });

    // Different exit price (5% better)
    const betterPrice = trade.side === "long" ? trade.exitPrice * 1.05 : trade.exitPrice * 0.95;
    const betterPnl =
      trade.side === "long"
        ? (betterPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - betterPrice) * trade.quantity;
    scenarios.push({
      scenario: "Exit at 5% better price",
      exitPrice: betterPrice,
      pnl: betterPnl,
      difference: betterPnl - trade.pnl,
    });

    return scenarios;
  }

  private extractLessons(trade: HistoricalTrade): string[] {
    const lessons: string[] = [];

    if (trade.pnl < 0) {
      lessons.push("Review entry criteria - was this a valid setup?");

      if (trade.marketConditions.volatility > 0.03) {
        lessons.push("High volatility environment - consider smaller position size");
      }
    }

    if (trade.pnlPercent > 0.05) {
      lessons.push("Strong winner - what conditions contributed to this success?");
    }

    if (trade.exitReason === "stop_loss") {
      lessons.push("Stopped out - review stop placement for this strategy");
    }

    return lessons;
  }

  private calculateOptimalExit(trade: HistoricalTrade): { price: number; time: Date; potentialPnl: number } {
    // Simplified optimal exit calculation
    const optimalMultiplier = trade.pnl > 0 ? 1.15 : 0.85;
    const potentialPnl = trade.pnl * optimalMultiplier;

    return {
      price: trade.entryPrice + potentialPnl / trade.quantity,
      time: trade.exitTime,
      potentialPnl,
    };
  }
}
