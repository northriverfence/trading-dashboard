/**
 * Event Logger
 * Comprehensive audit trail for strategy decisions and trading actions
 */

import { getDatabaseClient } from "../database/db-client.js";

export type EventLevel = "debug" | "info" | "warn" | "error" | "critical";
export type EventCategory =
  | "strategy"
  | "signal"
  | "risk"
  | "order"
  | "position"
  | "market"
  | "system"
  | "user";

export interface EventEntry {
  id: string;
  timestamp: Date;
  level: EventLevel;
  category: EventCategory;
  sessionId?: string;
  strategyName?: string;
  symbol?: string;
  message: string;
  details?: Record<string, unknown>;
  context?: {
    price?: number;
    position?: string;
    accountValue?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface SignalDecision {
  timestamp: Date;
  strategyName: string;
  symbol: string;
  signal: "buy" | "sell" | "hold" | "exit";
  confidence: number;
  indicators: Record<string, number>;
  rationale: string;
  executed: boolean;
  rejectionReason?: string;
}

export interface RiskManagementAction {
  timestamp: Date;
  actionType: "stop_loss" | "take_profit" | "position_limit" | "drawdown_limit" | "volatility_limit";
  symbol: string;
  sessionId: string;
  triggerValue: number;
  threshold: number;
  actionTaken: string;
  positionsAffected: string[];
  pnlImpact: number;
}

export interface MarketStateSnapshot {
  timestamp: Date;
  symbol: string;
  price: number;
  volume: number;
  volatility: number;
  trend: "up" | "down" | "sideways";
  indicators: Record<string, number>;
  regime: "trending" | "mean_reverting" | "volatile" | "low_volatility";
}

export class EventLogger {
  private events: EventEntry[] = [];
  private maxMemoryEvents: number;
  private persistToDatabase: boolean;

  constructor(options: { maxMemoryEvents?: number; persistToDatabase?: boolean } = {}) {
    this.maxMemoryEvents = options.maxMemoryEvents ?? 10000;
    this.persistToDatabase = options.persistToDatabase ?? true;
  }

  /**
   * Log a general event
   */
  log(
    level: EventLevel,
    category: EventCategory,
    message: string,
    options: {
      sessionId?: string;
      strategyName?: string;
      symbol?: string;
      details?: Record<string, unknown>;
      context?: EventEntry["context"];
    } = {}
  ): void {
    const entry: EventEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      level,
      category,
      sessionId: options.sessionId,
      strategyName: options.strategyName,
      symbol: options.symbol,
      message,
      details: options.details,
      context: options.context,
    };

    this.events.push(entry);

    // Trim old events if needed
    if (this.events.length > this.maxMemoryEvents) {
      this.events = this.events.slice(-this.maxMemoryEvents);
    }

    // Persist to database if enabled
    if (this.persistToDatabase) {
      this.persistEvent(entry);
    }

    // Console output for critical errors
    if (level === "error" || level === "critical") {
      console.error(`[${entry.timestamp.toISOString()}] ${level.toUpperCase()}: ${message}`, options.details || "");
    } else if (level === "warn") {
      console.warn(`[${entry.timestamp.toISOString()}] WARN: ${message}`);
    } else if (process.env.DEBUG) {
      console.log(`[${entry.timestamp.toISOString()}] ${level.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Log a strategy decision
   */
  logStrategyDecision(decision: SignalDecision): void {
    this.log(decision.executed ? "info" : "warn", "signal", `Strategy ${decision.signal} signal ${decision.executed ? "executed" : "rejected"}`, {
      sessionId: decision.strategyName,
      strategyName: decision.strategyName,
      symbol: decision.symbol,
      details: {
        signal: decision.signal,
        confidence: decision.confidence,
        indicators: decision.indicators,
        rationale: decision.rationale,
        rejectionReason: decision.rejectionReason,
      },
    });
  }

  /**
   * Log a risk management action
   */
  logRiskAction(action: RiskManagementAction): void {
    this.log("warn", "risk", `Risk action triggered: ${action.actionType}`, {
      sessionId: action.sessionId,
      symbol: action.symbol,
      details: {
        actionType: action.actionType,
        triggerValue: action.triggerValue,
        threshold: action.threshold,
        actionTaken: action.actionTaken,
        positionsAffected: action.positionsAffected,
        pnlImpact: action.pnlImpact,
      },
    });
  }

  /**
   * Log a market state snapshot
   */
  logMarketState(snapshot: MarketStateSnapshot): void {
    this.log("debug", "market", `Market state: ${snapshot.regime}`, {
      symbol: snapshot.symbol,
      details: {
        price: snapshot.price,
        volume: snapshot.volume,
        volatility: snapshot.volatility,
        trend: snapshot.trend,
        indicators: snapshot.indicators,
        regime: snapshot.regime,
      },
    });
  }

  /**
   * Log order lifecycle
   */
  logOrder(
    orderId: string,
    action: "submitted" | "filled" | "partial" | "cancelled" | "rejected",
    details: {
      symbol: string;
      side: "buy" | "sell";
      qty: number;
      price?: number;
      filledQty?: number;
      avgFillPrice?: number;
      reason?: string;
    }
  ): void {
    this.log(
      action === "rejected" ? "error" : "info",
      "order",
      `Order ${orderId} ${action}${details.reason ? `: ${details.reason}` : ""}`,
      {
        symbol: details.symbol,
        details: {
          orderId,
          action,
          ...details,
        },
      }
    );
  }

  /**
   * Log position changes
   */
  logPosition(
    action: "opened" | "closed" | "modified",
    details: {
      symbol: string;
      side: "long" | "short";
      qty: number;
      entryPrice: number;
      exitPrice?: number;
      pnl?: number;
      reason?: string;
    }
  ): void {
    this.log("info", "position", `Position ${action}: ${details.side} ${details.qty} ${details.symbol}`, {
      symbol: details.symbol,
      details: {
        action,
        ...details,
      },
    });
  }

  /**
   * Query events with filters
   */
  query(options: {
    level?: EventLevel;
    category?: EventCategory;
    sessionId?: string;
    strategyName?: string;
    symbol?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}): EventEntry[] {
    let filtered = this.events;

    if (options.level) {
      filtered = filtered.filter((e) => e.level === options.level);
    }
    if (options.category) {
      filtered = filtered.filter((e) => e.category === options.category);
    }
    if (options.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === options.sessionId);
    }
    if (options.strategyName) {
      filtered = filtered.filter((e) => e.strategyName === options.strategyName);
    }
    if (options.symbol) {
      filtered = filtered.filter((e) => e.symbol === options.symbol);
    }
    if (options.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
    }

    const limit = options.limit ?? 100;
    return filtered.slice(-limit).reverse();
  }

  /**
   * Get recent errors
   */
  getErrors(limit = 50): EventEntry[] {
    return this.query({ level: "error", limit });
  }

  /**
   * Get events for a specific session
   */
  getSessionLog(sessionId: string): EventEntry[] {
    return this.query({ sessionId, limit: 1000 });
  }

  /**
   * Get strategy decisions log
   */
  getStrategyDecisions(strategyName?: string): EventEntry[] {
    return this.query({
      category: "signal",
      strategyName,
      limit: 500,
    });
  }

  /**
   * Get risk management actions
   */
  getRiskActions(sessionId?: string): EventEntry[] {
    return this.query({
      category: "risk",
      sessionId,
      limit: 500,
    });
  }

  /**
   * Export events to JSON
   */
  exportToJSON(options: {
    startTime?: Date;
    endTime?: Date;
    categories?: EventCategory[];
  } = {}): string {
    let filtered = this.events;

    if (options.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
    }
    if (options.categories) {
      filtered = filtered.filter((e) => options.categories!.includes(e.category));
    }

    return JSON.stringify(
      filtered.map((e) => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
      null,
      2
    );
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get statistics about logged events
   */
  getStats(): {
    totalEvents: number;
    byLevel: Record<EventLevel, number>;
    byCategory: Record<EventCategory, number>;
    timeRange: { start: Date | null; end: Date | null };
  } {
    const byLevel = { debug: 0, info: 0, warn: 0, error: 0, critical: 0 };
    const byCategory = {
      strategy: 0,
      signal: 0,
      risk: 0,
      order: 0,
      position: 0,
      market: 0,
      system: 0,
      user: 0,
    };

    for (const event of this.events) {
      byLevel[event.level]++;
      byCategory[event.category]++;
    }

    return {
      totalEvents: this.events.length,
      byLevel,
      byCategory,
      timeRange: {
        start: this.events[0]?.timestamp || null,
        end: this.events[this.events.length - 1]?.timestamp || null,
      },
    };
  }

  private persistEvent(entry: EventEntry): void {
    try {
      const db = getDatabaseClient();
      db.logEvent(entry.level, entry.message, entry.sessionId);
    } catch {
      // Database might not be connected, that's ok
    }
  }
}

// Singleton instance
export const eventLogger = new EventLogger();
