/**
 * Portfolio Manager
 * Manages multiple strategies with capital allocation and combined reporting
 */

import type { Strategy } from "../backtesting/types.js";
import type { ExchangeAdapter } from "../adapters/types.js";
import { eventLogger } from "../reporting/event-logger.js";

export interface PortfolioConfig {
  /** Total capital to allocate across all strategies */
  totalCapital: number;
  /** Default allocation method */
  allocationMethod: "equal" | "risk_parity" | "custom";
  /** Maximum number of concurrent positions */
  maxPositions: number;
  /** Maximum portfolio heat (total risk exposure) */
  maxPortfolioHeat: number;
  /** Rebalancing frequency in days */
  rebalanceFrequency: number;
  /** Whether to allow overlapping positions across strategies */
  allowOverlappingPositions: boolean;
}

export interface StrategyAllocation {
  strategyId: string;
  strategyName: string;
  /** Capital allocated to this strategy */
  allocatedCapital: number;
  /** Weight as percentage of total (0-100) */
  weightPercent: number;
  /** Current positions held by this strategy */
  currentPositions: Position[];
  /** Current equity for this strategy */
  currentEquity: number;
  /** Strategy instance */
  strategy: Strategy;
  /** Enabled/disabled */
  enabled: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  strategyId: string;
  timestamp: Date;
}

export interface PortfolioSnapshot {
  timestamp: Date;
  totalEquity: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPositions: number;
  strategySnapshots: StrategySnapshot[];
}

export interface StrategySnapshot {
  strategyId: string;
  strategyName: string;
  equity: number;
  allocatedCapital: number;
  positionCount: number;
  unrealizedPnl: number;
  realizedPnl: number;
  weightPercent: number;
}

export interface PortfolioMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  correlationMatrix: Record<string, Record<string, number>>;
  strategyReturns: Record<string, number[]>;
}

export class PortfolioManager {
  private config: PortfolioConfig;
  private strategies: Map<string, StrategyAllocation> = new Map();
  private adapter: ExchangeAdapter;
  private cash: number;
  private positions: Map<string, Position> = new Map();
  private snapshots: PortfolioSnapshot[] = [];
  private realizedPnl: number = 0;
  private sessionId: string;

  constructor(config: PortfolioConfig, adapter: ExchangeAdapter) {
    this.config = { ...this.getDefaultConfig(), ...config };
    this.adapter = adapter;
    this.cash = this.config.totalCapital;
    this.sessionId = crypto.randomUUID();

    eventLogger.log("info", "system", "PortfolioManager initialized", {
      sessionId: this.sessionId,
      details: { config: this.config },
    });
  }

  /**
   * Add a strategy to the portfolio
   */
  addStrategy(
    strategyId: string,
    strategyName: string,
    strategy: Strategy,
    weightPercent: number
  ): void {
    if (this.strategies.has(strategyId)) {
      throw new Error(`Strategy ${strategyId} already exists in portfolio`);
    }

    const allocatedCapital = (this.config.totalCapital * weightPercent) / 100;

    const allocation: StrategyAllocation = {
      strategyId,
      strategyName,
      allocatedCapital,
      weightPercent,
      currentPositions: [],
      currentEquity: allocatedCapital,
      strategy,
      enabled: true,
    };

    this.strategies.set(strategyId, allocation);

    eventLogger.log("info", "strategy", `Strategy ${strategyName} added to portfolio`, {
      sessionId: this.sessionId,
      strategyName,
      details: { strategyId, weightPercent, allocatedCapital },
    });
  }

  /**
   * Remove a strategy from the portfolio
   */
  removeStrategy(strategyId: string): void {
    const allocation = this.strategies.get(strategyId);
    if (!allocation) {
      throw new Error(`Strategy ${strategyId} not found in portfolio`);
    }

    // Close all positions for this strategy
    for (const position of allocation.currentPositions) {
      this.closePosition(position.id, "strategy_removed");
    }

    this.strategies.delete(strategyId);

    eventLogger.log("info", "strategy", `Strategy ${allocation.strategyName} removed from portfolio`, {
      sessionId: this.sessionId,
      strategyName: allocation.strategyName,
      details: { strategyId },
    });
  }

  /**
   * Enable/disable a strategy
   */
  setStrategyEnabled(strategyId: string, enabled: boolean): void {
    const allocation = this.strategies.get(strategyId);
    if (!allocation) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    allocation.enabled = enabled;

    eventLogger.log("info", "strategy", `Strategy ${allocation.strategyName} ${enabled ? "enabled" : "disabled"}`, {
      sessionId: this.sessionId,
      strategyName: allocation.strategyName,
      details: { strategyId, enabled },
    });
  }

  /**
   * Update strategy allocation
   */
  updateAllocation(strategyId: string, newWeightPercent: number): void {
    const allocation = this.strategies.get(strategyId);
    if (!allocation) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    const newAllocatedCapital = (this.config.totalCapital * newWeightPercent) / 100;
    allocation.weightPercent = newWeightPercent;
    allocation.allocatedCapital = newAllocatedCapital;

    eventLogger.log("info", "strategy", `Strategy ${allocation.strategyName} allocation updated`, {
      sessionId: this.sessionId,
      strategyName: allocation.strategyName,
      details: { strategyId, newWeightPercent, newAllocatedCapital },
    });
  }

  /**
   * Open a position
   */
  openPosition(
    strategyId: string,
    symbol: string,
    side: "long" | "short",
    qty: number,
    entryPrice: number
  ): Position {
    // Check if we can add more positions
    if (this.positions.size >= this.config.maxPositions) {
      throw new Error(`Maximum positions (${this.config.maxPositions}) reached`);
    }

    // Check portfolio heat
    const currentHeat = this.calculatePortfolioHeat();
    if (currentHeat >= this.config.maxPortfolioHeat) {
      throw new Error(`Portfolio heat limit (${this.config.maxPortfolioHeat}) reached`);
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    if (!strategy.enabled) {
      throw new Error(`Strategy ${strategyId} is disabled`);
    }

    const positionId = `pos_${strategyId}_${symbol}_${Date.now()}`;
    const position: Position = {
      id: positionId,
      symbol,
      side,
      qty,
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnl: 0,
      strategyId,
      timestamp: new Date(),
    };

    this.positions.set(positionId, position);
    strategy.currentPositions.push(position);

    // Deduct cash for long positions
    if (side === "long") {
      const cost = qty * entryPrice;
      if (cost > this.cash) {
        throw new Error(`Insufficient cash for position: need $${cost}, have $${this.cash}`);
      }
      this.cash -= cost;
    }

    eventLogger.log("info", "position", `Position opened: ${side} ${qty} ${symbol}`, {
      sessionId: this.sessionId,
      symbol,
      details: {
        positionId,
        strategyId,
        strategyName: strategy.strategyName,
        side,
        qty,
        entryPrice,
      },
    });

    return position;
  }

  /**
   * Close a position
   */
  closePosition(positionId: string, reason?: string): number {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const strategy = this.strategies.get(position.strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${position.strategyId} not found`);
    }

    // Calculate realized PnL
    const pnl = position.side === "long"
      ? (position.currentPrice - position.entryPrice) * position.qty
      : (position.entryPrice - position.currentPrice) * position.qty;

    this.realizedPnl += pnl;

    // Add cash back for long positions
    if (position.side === "long") {
      this.cash += position.qty * position.currentPrice;
    }

    // Remove from strategy's positions
    strategy.currentPositions = strategy.currentPositions.filter((p) => p.id !== positionId);

    // Remove from positions map
    this.positions.delete(positionId);

    eventLogger.log("info", "position", `Position closed: ${position.symbol} PnL: $${pnl.toFixed(2)}`, {
      sessionId: this.sessionId,
      symbol: position.symbol,
      details: {
        positionId,
        strategyId: position.strategyId,
        strategyName: strategy.strategyName,
        pnl,
        reason,
      },
    });

    return pnl;
  }

  /**
   * Update position prices and calculate unrealized PnL
   */
  updatePrices(prices: Record<string, number>): void {
    for (const position of this.positions.values()) {
      const price = prices[position.symbol];
      if (price !== undefined) {
        position.currentPrice = price;
        position.unrealizedPnl = position.side === "long"
          ? (position.currentPrice - position.entryPrice) * position.qty
          : (position.entryPrice - position.currentPrice) * position.qty;
      }
    }
  }

  /**
   * Take a snapshot of the current portfolio state
   */
  takeSnapshot(): PortfolioSnapshot {
    const positionsValue = Array.from(this.positions.values()).reduce(
      (sum, p) => sum + p.qty * p.currentPrice,
      0
    );

    const unrealizedPnl = Array.from(this.positions.values()).reduce(
      (sum, p) => sum + p.unrealizedPnl,
      0
    );

    const strategySnapshots: StrategySnapshot[] = [];
    for (const allocation of this.strategies.values()) {
      const strategyPositions = allocation.currentPositions;
      const strategyUnrealizedPnl = strategyPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
      const strategyPositionsValue = strategyPositions.reduce((sum, p) => sum + p.qty * p.currentPrice, 0);

      strategySnapshots.push({
        strategyId: allocation.strategyId,
        strategyName: allocation.strategyName,
        equity: allocation.currentEquity + strategyUnrealizedPnl + strategyPositionsValue,
        allocatedCapital: allocation.allocatedCapital,
        positionCount: strategyPositions.length,
        unrealizedPnl: strategyUnrealizedPnl,
        realizedPnl: this.getStrategyRealizedPnl(allocation.strategyId),
        weightPercent: allocation.weightPercent,
      });
    }

    const snapshot: PortfolioSnapshot = {
      timestamp: new Date(),
      totalEquity: this.cash + positionsValue + unrealizedPnl,
      cash: this.cash,
      positionsValue,
      unrealizedPnl,
      realizedPnl: this.realizedPnl,
      totalPositions: this.positions.size,
      strategySnapshots,
    };

    this.snapshots.push(snapshot);

    // Keep only last 1000 snapshots
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }

    return snapshot;
  }

  /**
   * Get portfolio summary
   */
  getSummary(): {
    totalEquity: number;
    cash: number;
    positionsValue: number;
    totalReturn: number;
    totalPositions: number;
    unrealizedPnl: number;
    realizedPnl: number;
    strategyCount: number;
  } {
    const snapshot = this.takeSnapshot();
    const totalReturn = ((snapshot.totalEquity - this.config.totalCapital) / this.config.totalCapital) * 100;

    return {
      totalEquity: snapshot.totalEquity,
      cash: snapshot.cash,
      positionsValue: snapshot.positionsValue,
      totalReturn,
      totalPositions: snapshot.totalPositions,
      unrealizedPnl: snapshot.unrealizedPnl,
      realizedPnl: snapshot.realizedPnl,
      strategyCount: this.strategies.size,
    };
  }

  /**
   * Calculate portfolio heat (total risk exposure)
   */
  private calculatePortfolioHeat(): number {
    const totalPositionValue = Array.from(this.positions.values()).reduce(
      (sum, p) => sum + p.qty * p.currentPrice,
      0
    );
    return (totalPositionValue / this.config.totalCapital) * 100;
  }

  /**
   * Get realized PnL for a specific strategy
   */
  private getStrategyRealizedPnl(_strategyId: string): number {
    // In a real implementation, track per-strategy PnL
    return 0;
  }

  /**
   * Get all positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get positions for a specific strategy
   */
  getStrategyPositions(strategyId: string): Position[] {
    const strategy = this.strategies.get(strategyId);
    return strategy ? strategy.currentPositions : [];
  }

  /**
   * Get strategies
   */
  getStrategies(): StrategyAllocation[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get snapshots
   */
  getSnapshots(): PortfolioSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): Partial<PortfolioConfig> {
    return {
      allocationMethod: "equal",
      maxPositions: 10,
      maxPortfolioHeat: 70,
      rebalanceFrequency: 30,
      allowOverlappingPositions: false,
    };
  }

  /**
   * Rebalance portfolio allocations
   */
  rebalance(): void {
    if (this.config.allocationMethod === "equal") {
      const count = this.strategies.size;
      if (count > 0) {
        const equalWeight = 100 / count;
        for (const allocation of this.strategies.values()) {
          this.updateAllocation(allocation.strategyId, equalWeight);
        }
      }
    }

    // For risk parity and custom allocation, implement specific logic

    eventLogger.log("info", "system", "Portfolio rebalanced", {
      sessionId: this.sessionId,
      details: { method: this.config.allocationMethod },
    });
  }

  /**
   * Stop the portfolio manager
   */
  stop(): void {
    // Close all positions
    for (const positionId of this.positions.keys()) {
      this.closePosition(positionId, "portfolio_stop");
    }

    eventLogger.log("info", "system", "PortfolioManager stopped", {
      sessionId: this.sessionId,
      details: { finalSummary: this.getSummary() },
    });
  }
}

