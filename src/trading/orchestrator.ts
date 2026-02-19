/**
 * Real-Time Trading Orchestrator
 * Manages live trading execution with exchange adapters
 */

import type { ExchangeAdapter, Bar, Trade, Order, Position, Account } from "../adapters/types.js";
import type { Strategy } from "../backtesting/types.js";
import { AlpacaAdapter } from "../adapters/alpaca/alpaca-adapter.js";
import { InteractiveBrokersAdapter } from "../adapters/interactive-brokers/ib-adapter.js";
import { defaultExchangeConfig } from "../adapters/config.js";

interface TradingSessionConfig {
  adapter: "alpaca" | "interactive_brokers" | "historical";
  symbols: string[];
  channels?: string[];
  paperTrading?: boolean;
}

interface TradingSession {
  id: string;
  strategy: Strategy;
  symbols: string[];
  adapter: ExchangeAdapter;
  startTime: Date;
  status: "initializing" | "running" | "paused" | "stopped" | "error";
  orders: Order[];
  positions: Position[];
  account?: Account;
  error?: string;
}

interface SessionStats {
  sessionId: string;
  runtime: number; // seconds
  barsReceived: number;
  ticksReceived: number;
  tradesExecuted: number;
  ordersSubmitted: number;
  ordersFilled: number;
  pnl: number;
  latency: number;
}

export class RealtimeTradingOrchestrator {
  private sessions = new Map<string, TradingSession>();
  private sessionStats = new Map<string, SessionStats>();
  private eventLog: { timestamp: Date; level: "info" | "warn" | "error"; message: string; sessionId?: string }[] = [];

  /**
   * Create and start a new trading session
   */
  async createSession(strategy: Strategy, config: TradingSessionConfig): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    this.log("info", `Creating trading session ${sessionId}`, sessionId);

    try {
      // Create adapter based on config
      const adapter = this.createAdapter(config.adapter);

      // Initialize session
      const session: TradingSession = {
        id: sessionId,
        strategy,
        symbols: config.symbols,
        adapter,
        startTime: new Date(),
        status: "initializing",
        orders: [],
        positions: [],
      };

      this.sessions.set(sessionId, session);
      this.sessionStats.set(sessionId, {
        sessionId,
        runtime: 0,
        barsReceived: 0,
        ticksReceived: 0,
        tradesExecuted: 0,
        ordersSubmitted: 0,
        ordersFilled: 0,
        pnl: 0,
        latency: 0,
      });

      // Connect to exchange
      await adapter.connect();
      this.log("info", `Connected to ${config.adapter}`, sessionId);

      // Set up data handlers
      this.setupDataHandlers(session);

      // Initialize strategy
      await strategy.onInit();
      this.log("info", `Strategy ${strategy.name} initialized`, sessionId);

      // Subscribe to market data
      await adapter.subscribe(config.symbols, config.channels || ["trades", "quotes"]);
      this.log("info", `Subscribed to ${config.symbols.join(", ")}`, sessionId);

      // Update session status
      session.status = "running";

      // Fetch initial account info
      session.account = await adapter.getAccount();

      this.log("info", `Trading session ${sessionId} is now running`, sessionId);

      return sessionId;
    } catch (error) {
      this.log("error", `Failed to create session: ${(error as Error).message}`, sessionId);
      throw error;
    }
  }

  /**
   * Stop a trading session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.log("info", `Stopping session ${sessionId}`, sessionId);

    session.status = "stopped";

    // Clean up strategy
    await session.strategy.onEnd();

    // Unsubscribe from data
    session.adapter.unsubscribe(session.symbols);

    // Disconnect
    session.adapter.disconnect();

    this.sessions.delete(sessionId);
    this.sessionStats.delete(sessionId);

    this.log("info", `Session ${sessionId} stopped`, sessionId);
  }

  /**
   * Pause a trading session
   */
  pauseSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === "running") {
      session.status = "paused";
      this.log("info", `Session ${sessionId} paused`, sessionId);
    }
  }

  /**
   * Resume a paused trading session
   */
  resumeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === "paused") {
      session.status = "running";
      this.log("info", `Session ${sessionId} resumed`, sessionId);
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): TradingSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): TradingSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === "running" || s.status === "paused");
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): SessionStats | undefined {
    return this.sessionStats.get(sessionId);
  }

  /**
   * Get event log
   */
  getEventLog(
    sessionId?: string,
    limit = 100,
  ): { timestamp: Date; level: "info" | "warn" | "error"; message: string; sessionId?: string }[] {
    let logs = this.eventLog;
    if (sessionId) {
      logs = logs.filter((l) => l.sessionId === sessionId);
    }
    return logs.slice(-limit);
  }

  /**
   * Get current positions for a session
   */
  async getPositions(sessionId: string): Promise<Position[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.positions = await session.adapter.getPositions();
    return session.positions;
  }

  /**
   * Get account information for a session
   */
  async getAccount(sessionId: string): Promise<Account> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.account = await session.adapter.getAccount();
    return session.account;
  }

  /**
   * Cancel all open orders for a session
   */
  async cancelAllOrders(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    for (const order of session.orders) {
      if (order.status === "open") {
        await session.adapter.cancelOrder(order.id);
        this.log("info", `Cancelled order ${order.id}`, sessionId);
      }
    }
  }

  /**
   * Close all positions for a session
   */
  async closeAllPositions(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const positions = await this.getPositions(sessionId);

    for (const position of positions) {
      if (position.qty > 0) {
        await session.adapter.submitOrder({
          symbol: position.symbol,
          side: "sell",
          qty: position.qty,
          type: "market",
          timeInForce: "day",
        });
        this.log("info", `Closing position for ${position.symbol}`, sessionId);
      }
    }
  }

  /**
   * Emergency stop - cancel all orders and close all positions
   */
  async emergencyStop(sessionId: string): Promise<void> {
    this.log("warn", `EMERGENCY STOP triggered for session ${sessionId}`, sessionId);

    await this.cancelAllOrders(sessionId);
    await this.closeAllPositions(sessionId);
    await this.stopSession(sessionId);
  }

  /**
   * Stop all sessions
   */
  async stopAll(): Promise<void> {
    this.log("info", "Stopping all trading sessions");

    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      try {
        await this.stopSession(sessionId);
      } catch (error) {
        this.log("error", `Failed to stop session ${sessionId}: ${(error as Error).message}`);
      }
    }
  }

  private setupDataHandlers(session: TradingSession): void {
    const stats = this.sessionStats.get(session.id)!;

    // Handle price ticks
    session.adapter.onPrice((tick) => {
      if (session.status !== "running") return;

      stats.latency = session.adapter.getLatency();
    });

    // Handle bars (for strategies that use bar data)
    session.adapter.onTrade((trade) => {
      if (session.status !== "running") return;

      stats.tradesExecuted++;

      // Create a bar-like object for the strategy
      const bar: Bar = {
        symbol: trade.symbol,
        timestamp: trade.timestamp,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        volume: trade.size,
      };

      // Call strategy handlers
      session.strategy.onBar(bar).catch((error) => {
        this.log("error", `Strategy onBar error: ${(error as Error).message}`, session.id);
      });

      if (session.strategy.onTrade) {
        session.strategy.onTrade(trade).catch((error) => {
          this.log("error", `Strategy onTrade error: ${(error as Error).message}`, session.id);
        });
      }
    });

    // Handle quotes
    session.adapter.onQuote((quote) => {
      if (session.status !== "running") return;

      stats.ticksReceived++;

      if (session.strategy.onTick) {
        session.strategy.onTick(quote).catch((error) => {
          this.log("error", `Strategy onTick error: ${(error as Error).message}`, session.id);
        });
      }
    });
  }

  private log(level: "info" | "warn" | "error", message: string, sessionId?: string): void {
    const entry = {
      timestamp: new Date(),
      level,
      message,
      sessionId,
    };

    this.eventLog.push(entry);

    // Keep log size manageable
    if (this.eventLog.length > 10000) {
      this.eventLog = this.eventLog.slice(-5000);
    }

    // Also log to console
    const prefix = sessionId ? `[${sessionId}] ` : "";
    switch (level) {
      case "info":
        console.log(`${prefix}${message}`);
        break;
      case "warn":
        console.warn(`${prefix}${message}`);
        break;
      case "error":
        console.error(`${prefix}${message}`);
        break;
    }
  }

  /**
   * Update session statistics periodically
   */
  startStatsUpdates(sessionId: string, intervalMs = 1000): () => void {
    const interval = setInterval(() => {
      const session = this.sessions.get(sessionId);
      const stats = this.sessionStats.get(sessionId);

      if (session && stats) {
        stats.runtime = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Create an exchange adapter based on type
   */
  private createAdapter(adapterType: string): ExchangeAdapter {
    switch (adapterType) {
      case "alpaca": {
        const alpacaConfig = defaultExchangeConfig.adapters.alpaca;
        if (!alpacaConfig) throw new Error("Alpaca config not found");
        return new AlpacaAdapter(alpacaConfig);
      }
      case "interactive_brokers": {
        const ibConfig = defaultExchangeConfig.adapters.interactive_brokers;
        if (!ibConfig) throw new Error("Interactive Brokers config not found");
        return new InteractiveBrokersAdapter(ibConfig);
      }
      default:
        throw new Error(`Unknown adapter: ${adapterType}`);
    }
  }
}

// Export singleton instance
export const tradingOrchestrator = new RealtimeTradingOrchestrator();
