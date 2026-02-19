/**
 * Backtest Engine
 * Main orchestrator for running historical backtests
 */

import type {
  BacktestConfig,
  BacktestResult,
  BacktestProgress,
  BacktestState,
  Strategy,
  TradeRecord,
  EquityPoint,
  Fill,
} from "./types.js";
import { HistoricalDataStore } from "./historical-data-store.js";
import { ExecutionSimulator } from "./execution-simulator.js";
import { PerformanceAnalyzer } from "./performance-analyzer.js";
import { HistoricalAdapter } from "./historical-adapter.js";
import type { Bar, Trade } from "../adapters/types.js";

export class BacktestEngine {
  private config: BacktestConfig;
  private dataStore: HistoricalDataStore;
  private executionSimulator: ExecutionSimulator;
  private performanceAnalyzer: PerformanceAnalyzer;
  private adapter: HistoricalAdapter;

  private state: BacktestState = "idle";
  private symbols: string[] = [];
  private bars: Map<string, Bar[]> = new Map();
  private trades: TradeRecord[] = [];
  private equityCurve: EquityPoint[] = [];
  private currentEquity: number = 0;
  private startTime: number = 0;
  private currentBarIndex: number = 0;
  private totalBars: number = 0;
  private openTrades: Map<string, TradeRecord> = new Map();

  // Event callbacks
  private progressCallbacks: ((progress: BacktestProgress) => void)[] = [];
  private tradeCallbacks: ((fill: Fill) => void)[] = [];
  private barCallbacks: ((bar: Bar) => void)[] = [];
  private completeCallbacks: ((result: BacktestResult) => void)[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
    this.currentEquity = config.initialCapital;
    this.dataStore = new HistoricalDataStore();
    this.executionSimulator = new ExecutionSimulator(config.commission, config.slippage);
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.adapter = new HistoricalAdapter(this.dataStore, this.executionSimulator);
  }

  configure(config: BacktestConfig): void {
    this.config = config;
    this.currentEquity = config.initialCapital;
  }

  async loadHistoricalData(symbols: string[]): Promise<void> {
    this.state = "loading";
    this.symbols = symbols;

    // Load data for all symbols
    for (const symbol of symbols) {
      const bars = await this.dataStore.loadBars(
        symbol,
        this.config.startDate,
        this.config.endDate,
        "1d", // Default to daily
      );
      this.bars.set(symbol, bars);
      this.totalBars += bars.length;
    }

    // Load all bars into adapter
    const allBars: Bar[] = [];
    for (const symbolBars of Array.from(this.bars.values())) {
      allBars.push(...symbolBars);
    }

    // Sort by timestamp
    allBars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.adapter.loadData(allBars);

    // Set initial capital
    this.adapter.setInitialCapital(this.config.initialCapital);
  }

  async run(strategy: Strategy): Promise<BacktestResult> {
    if (this.state === "running") {
      throw new Error("Backtest is already running");
    }

    this.state = "running";
    this.startTime = Date.now();

    // Initialize strategy
    await strategy.onInit();

    // Set up adapter callbacks
    this.setupAdapterCallbacks(strategy);

    // Connect adapter
    await this.adapter.connect();
    await this.adapter.subscribe(this.symbols);

    // Initialize equity curve
    this.equityCurve.push({
      timestamp: this.config.startDate,
      equity: this.config.initialCapital,
      cash: this.config.initialCapital,
      positionsValue: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
    });

    // Process bars
    let hasMoreData = true;
    while (hasMoreData && this.state === "running") {
      hasMoreData = await this.adapter.step();

      if (hasMoreData) {
        // Update portfolio value
        this.adapter.updatePortfolioValue();

        // Record equity
        const account = await this.adapter.getAccount();
        this.currentEquity = account.equity;
        this.equityCurve.push({
          timestamp: this.adapter.getCurrentTimestamp(),
          equity: account.equity,
          cash: account.cash,
          positionsValue: account.portfolioValue - account.cash,
          unrealizedPnl: 0, // Calculate from positions
          realizedPnl: this.calculateRealizedPnl(),
        });

        // Update progress
        this.currentBarIndex++;
        this.emitProgress();
      }
    }

    // Close any remaining open trades at the end
    await this.closeOpenTrades();

    // Finalize strategy
    await strategy.onEnd();

    // Disconnect
    this.adapter.disconnect();

    // Calculate metrics
    const metrics = this.performanceAnalyzer.analyze(this.trades, this.equityCurve);
    const drawdownCurve = this.performanceAnalyzer.calculateDrawdownCurve(this.equityCurve);

    // Build result
    const result: BacktestResult = {
      trades: this.trades,
      equityCurve: this.equityCurve,
      drawdownCurve,
      metrics,
      maxDrawdown: metrics.maxDrawdown,
      sharpeRatio: metrics.sharpeRatio,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      totalReturn: metrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn,
      volatility: metrics.volatility,
      startDate: this.config.startDate,
      endDate: this.config.endDate,
      duration: (this.config.endDate.getTime() - this.config.startDate.getTime()) / (1000 * 60 * 60 * 24),
    };

    this.state = "completed";
    this.emitComplete(result);

    return result;
  }

  pause(): void {
    if (this.state === "running") {
      this.state = "paused";
    }
  }

  resume(): void {
    if (this.state === "paused") {
      this.state = "running";
    }
  }

  stop(): void {
    this.state = "stopped";
  }

  getProgress(): BacktestProgress {
    const progress = this.adapter.getProgress();
    const elapsedTime = (Date.now() - this.startTime) / 1000;
    const percentComplete = progress.percent;
    const estimatedTimeRemaining = percentComplete > 0 ? (elapsedTime / percentComplete) * (100 - percentComplete) : 0;

    return {
      currentDate: this.adapter.getCurrentTimestamp(),
      endDate: this.config.endDate,
      percentComplete,
      barsProcessed: this.currentBarIndex,
      totalBars: this.totalBars,
      elapsedTime,
      estimatedTimeRemaining,
      tradesExecuted: this.trades.length,
      currentEquity: this.currentEquity,
    };
  }

  getState(): BacktestState {
    return this.state;
  }

  onProgress(callback: (progress: BacktestProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  onTrade(callback: (fill: Fill) => void): void {
    this.tradeCallbacks.push(callback);
  }

  onBar(callback: (bar: Bar) => void): void {
    this.barCallbacks.push(callback);
  }

  onComplete(callback: (result: BacktestResult) => void): void {
    this.completeCallbacks.push(callback);
  }

  private setupAdapterCallbacks(strategy: Strategy): void {
    this.adapter.onPrice(async (tick) => {
      // Convert tick to minimal bar for strategy
      const bar: Bar = {
        symbol: tick.symbol,
        timestamp: tick.timestamp,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size,
      };

      if (strategy.onTick) {
        await strategy.onTick({
          symbol: tick.symbol,
          bid: tick.price,
          ask: tick.price,
          bidSize: tick.size,
          askSize: tick.size,
          lastPrice: tick.price,
          lastSize: tick.size,
          timestamp: tick.timestamp,
          exchange: tick.exchange,
        });
      }
    });

    this.adapter.onTrade(async (trade) => {
      if (strategy.onTrade) {
        await strategy.onTrade(trade);
      }

      // Record trade
      this.recordTrade(trade);
    });

    this.adapter.onQuote(async (quote) => {
      // Quotes handled by onBar
    });

    this.adapter.onBar(async (bar) => {
      await strategy.onBar(bar);
      this.emitBar(bar);
    });
  }

  private recordTrade(trade: Trade): void {
    // Create trade record
    const tradeRecord: TradeRecord = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: trade.timestamp,
      symbol: trade.symbol,
      side: trade.side,
      qty: trade.size,
      entryPrice: trade.price,
      pnl: 0,
      pnlPercent: 0,
      commission: 0,
      slippage: 0,
      status: "open",
      barsHeld: 0,
    };

    // Track open trades
    const key = `${trade.symbol}-${trade.side}`;
    if (trade.side === "buy") {
      this.openTrades.set(key, tradeRecord);
    } else {
      // Closing a long position
      const openTrade = this.openTrades.get(`${trade.symbol}-buy`);
      if (openTrade) {
        tradeRecord.entryPrice = openTrade.entryPrice;
        tradeRecord.pnl = (trade.price - openTrade.entryPrice) * trade.size;
        tradeRecord.pnlPercent = ((trade.price - openTrade.entryPrice) / openTrade.entryPrice) * 100;
        tradeRecord.status = "closed";
        tradeRecord.exitPrice = trade.price;
        tradeRecord.exitTime = trade.timestamp;
        this.openTrades.delete(`${trade.symbol}-buy`);
      }
    }

    this.trades.push(tradeRecord);
  }

  private async closeOpenTrades(): Promise<void> {
    // Close any remaining open trades at end of backtest
    for (const [key, trade] of Array.from(this.openTrades.entries())) {
      // Mark as closed at last known price
      const positions = await this.adapter.getPositions();
      const position = positions.find((p) => p.symbol === trade.symbol);
      if (position) {
        trade.exitPrice = position.currentPrice;
        trade.exitTime = this.config.endDate;
        trade.pnl = (position.currentPrice - trade.entryPrice) * trade.qty;
        trade.pnlPercent = ((position.currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
        trade.status = "closed";
        trade.exitReason = "end_of_test";
      }
    }
    this.openTrades.clear();
  }

  private calculateRealizedPnl(): number {
    return this.trades.filter((t) => t.status === "closed").reduce((sum, t) => sum + t.pnl, 0);
  }

  private emitProgress(): void {
    const progress = this.getProgress();
    for (const cb of this.progressCallbacks) {
      try {
        cb(progress);
      } catch (error) {
        console.error("Error in progress callback:", error);
      }
    }
  }

  private emitBar(bar: Bar): void {
    for (const cb of this.barCallbacks) {
      try {
        cb(bar);
      } catch (error) {
        console.error("Error in bar callback:", error);
      }
    }
  }

  private emitComplete(result: BacktestResult): void {
    for (const cb of this.completeCallbacks) {
      try {
        cb(result);
      } catch (error) {
        console.error("Error in complete callback:", error);
      }
    }
  }
}
