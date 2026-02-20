// AdvancedSimulationEngine - Tier 2 & 3 Integration
// Combines SimulationEngine, StepThroughController, OrderBookSimulator, and SlippageModel

import { SimulationEngine } from "./simulation-engine.js";
import { StepThroughController, type SpeedMultiplier } from "./step-through-controller.js";
import { OrderBookSimulator, type OrderBookDepth } from "./order-book-simulator.js";
import { SlippageModel, type SlippageConfig } from "./slippage-model.js";
import { WebSocketFeeds } from "../dashboard/websocket-feeds.js";
import type { Bar, Trade } from "../adapters/types.js";

export type SimulationMode = "fast" | "step" | "advanced";

export interface SimulationTickEvent {
  bar: Bar;
  barIndex: number;
  totalBars: number;
  progress: number;
  portfolio: {
    cash: number;
    equity: number;
    positions: { symbol: string; qty: number }[];
  };
}

export interface ExtendedTrade extends Trade {
  slippage?: number;
  marketImpact?: number;
  orderBookDepth?: OrderBookDepth;
}

export interface SimulationResult {
  trades: ExtendedTrade[];
  finalEquity: number;
  finalCash: number;
  metrics: {
    totalReturn: number;
    totalTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    marketImpact?: number;
    avgSlippage?: number;
  };
  equityCurve: number[];
  orderBookData?: {
    depthHistory: { timestamp: Date; depth: OrderBookDepth }[];
    avgSpread: number;
  };
}

interface SimulationStrategyContext {
  symbol: string;
  currentBar: Bar;
  currentBarIndex: number;
  totalBars: number;
  portfolio: {
    cash: number;
    equity: number;
    positions: { symbol: string; qty: number }[];
  };
  buy: (qty: number) => void;
  sell: (qty: number) => void;
}

interface AdvancedSimulationConfig {
  mode: SimulationMode;
  strategy: (context: SimulationStrategyContext) => void;
  startDate?: Date;
  endDate?: Date;
}

interface EngineConstructorConfig {
  engine: SimulationEngine;
  symbol: string;
  initialCash: number;
  websocketFeeds?: WebSocketFeeds;
  slippageConfig?: SlippageConfig;
  orderBookDepth?: number;
}

export class AdvancedSimulationEngine {
  private engine: SimulationEngine;
  private symbol: string;
  private initialCash: number;
  private websocketFeeds?: WebSocketFeeds;
  private stepController?: StepThroughController;
  private orderBookSimulator?: OrderBookSimulator;
  private slippageModel: SlippageModel;
  private orderBookDepth: number;
  private simulationTrades: ExtendedTrade[] = [];
  private equityCurve: number[] = [];
  private orderBookHistory: { timestamp: Date; depth: OrderBookDepth }[] = [];
  private bars: Bar[] = [];

  constructor(config: EngineConstructorConfig) {
    this.engine = config.engine;
    this.symbol = config.symbol;
    this.initialCash = config.initialCash;
    this.websocketFeeds = config.websocketFeeds;
    this.orderBookDepth = config.orderBookDepth ?? 5;

    // Default slippage configuration
    const defaultSlippageConfig: SlippageConfig = {
      baseSlippage: 0.001, // 0.1%
      impactFactor: 0.01,
    };
    this.slippageModel = new SlippageModel(config.slippageConfig ?? defaultSlippageConfig);
  }

  /**
   * Run simulation in the specified mode
   */
  async runSimulation(config: AdvancedSimulationConfig): Promise<SimulationResult> {
    // Validate mode
    if (!["fast", "step", "advanced"].includes(config.mode)) {
      throw new Error(`Invalid simulation mode: ${config.mode}. Must be one of: fast, step, advanced`);
    }

    // Reset state
    this.simulationTrades = [];
    this.equityCurve = [];
    this.orderBookHistory = [];

    // Load and filter bars
    this.loadBars(config.startDate, config.endDate);

    if (this.bars.length === 0) {
      throw new Error(`No bars loaded for symbol: ${this.symbol}`);
    }

    switch (config.mode) {
      case "fast":
        return this.runFastSimulation(config);
      case "step":
        throw new Error("Use initializeStepMode() and getStepController() for step mode");
      case "advanced":
        return this.runAdvancedSimulation(config);
      default:
        throw new Error(`Unsupported mode: ${config.mode}`);
    }
  }

  /**
   * Initialize step-through mode
   */
  async initializeStepMode(config: Omit<AdvancedSimulationConfig, "mode">): Promise<void> {
    // Load and filter bars
    this.loadBars(config.startDate, config.endDate);

    // Create step-through controller
    this.stepController = new StepThroughController(this.engine, {
      symbol: this.symbol,
      startDate: config.startDate,
      endDate: config.endDate,
      strategy: (context) => {
        // Record equity at each step
        this.equityCurve.push(context.portfolio.equity);

        // Execute user strategy
        config.strategy(context);

        // Broadcast tick via WebSocket
        this.broadcastTick({
          bar: context.currentBar,
          barIndex: context.currentBarIndex,
          totalBars: context.totalBars,
          progress: Math.round((context.currentBarIndex / context.totalBars) * 100),
          portfolio: context.portfolio,
        });
      },
    });
  }

  /**
   * Get the step-through controller (only available after initializeStepMode)
   */
  getStepController(): StepThroughController {
    if (!this.stepController) {
      throw new Error("Step controller not initialized. Call initializeStepMode() first.");
    }
    return this.stepController;
  }

  /**
   * Run fast simulation (bar-by-bar, no order book)
   */
  private async runFastSimulation(config: AdvancedSimulationConfig): Promise<SimulationResult> {
    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];
      const context = this.createContext(bar, i);

      // Execute strategy
      config.strategy(context);

      // Record equity after this bar
      const portfolio = this.engine.getPortfolio();
      this.equityCurve.push(portfolio.equity);

      // Broadcast tick via WebSocket
      this.broadcastTick({
        bar,
        barIndex: i,
        totalBars: this.bars.length,
        progress: Math.round(((i + 1) / this.bars.length) * 100),
        portfolio: {
          cash: portfolio.cash,
          equity: portfolio.equity,
          positions: portfolio.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
        },
      });
    }

    return this.buildResult();
  }

  /**
   * Run advanced simulation with order book and slippage
   */
  private async runAdvancedSimulation(config: AdvancedSimulationConfig): Promise<SimulationResult> {
    // Initialize order book simulator
    this.orderBookSimulator = new OrderBookSimulator(this.symbol);

    // Initialize order book with initial liquidity based on first bar
    this.initializeOrderBook(this.bars[0]);

    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];

      // Update order book based on current bar
      this.updateOrderBook(bar);

      // Create context with order book execution
      const context = this.createAdvancedContext(bar, i);

      // Execute strategy
      config.strategy(context);

      // Record equity after this bar
      const portfolio = this.engine.getPortfolio();
      this.equityCurve.push(portfolio.equity);

      // Record order book depth
      if (this.orderBookSimulator) {
        this.orderBookHistory.push({
          timestamp: bar.timestamp,
          depth: this.orderBookSimulator.getDepth(),
        });
      }

      // Broadcast tick via WebSocket
      this.broadcastTick({
        bar,
        barIndex: i,
        totalBars: this.bars.length,
        progress: Math.round(((i + 1) / this.bars.length) * 100),
        portfolio: {
          cash: portfolio.cash,
          equity: portfolio.equity,
          positions: portfolio.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
        },
      });
    }

    return this.buildAdvancedResult();
  }

  /**
   * Load and filter bars
   */
  private loadBars(startDate?: Date, endDate?: Date): void {
    let bars = this.engine.getBars(this.symbol);

    // Filter by date range if specified
    if (startDate || endDate) {
      const startTime = startDate?.getTime() ?? 0;
      const endTime = endDate?.getTime() ?? Infinity;
      bars = bars.filter((bar) => bar.timestamp.getTime() >= startTime && bar.timestamp.getTime() <= endTime);
    }

    this.bars = bars;
  }

  /**
   * Create simulation context for fast mode
   */
  private createContext(bar: Bar, index: number): SimulationStrategyContext {
    const portfolio = this.engine.getPortfolio();

    return {
      symbol: this.symbol,
      currentBar: bar,
      currentBarIndex: index,
      totalBars: this.bars.length,
      portfolio: {
        cash: portfolio.cash,
        equity: portfolio.equity,
        positions: portfolio.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
      },
      buy: (qty: number) => this.executeBuy(bar, qty),
      sell: (qty: number) => this.executeSell(bar, qty),
    };
  }

  /**
   * Create simulation context for advanced mode
   */
  private createAdvancedContext(bar: Bar, index: number): SimulationStrategyContext {
    const portfolio = this.engine.getPortfolio();

    return {
      symbol: this.symbol,
      currentBar: bar,
      currentBarIndex: index,
      totalBars: this.bars.length,
      portfolio: {
        cash: portfolio.cash,
        equity: portfolio.equity,
        positions: portfolio.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
      },
      buy: (qty: number) => this.executeAdvancedBuy(bar, qty),
      sell: (qty: number) => this.executeAdvancedSell(bar, qty),
    };
  }

  /**
   * Execute buy order (fast mode)
   */
  private executeBuy(bar: Bar, qty: number): void {
    const trade: ExtendedTrade = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `sim_order`,
      symbol: this.symbol,
      side: "buy",
      qty,
      price: bar.close,
      timestamp: bar.timestamp,
    };

    this.simulationTrades.push(trade);

    // Access portfolio tracker through engine
    const engineWithTracker = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: ExtendedTrade) => void };
    };
    engineWithTracker.portfolioTracker.processTrade(trade);
  }

  /**
   * Execute sell order (fast mode)
   */
  private executeSell(bar: Bar, qty: number): void {
    const trade: ExtendedTrade = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `sim_order`,
      symbol: this.symbol,
      side: "sell",
      qty,
      price: bar.close,
      timestamp: bar.timestamp,
    };

    this.simulationTrades.push(trade);

    // Access portfolio tracker through engine
    const engineWithTracker = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: ExtendedTrade) => void };
    };
    engineWithTracker.portfolioTracker.processTrade(trade);
  }

  /**
   * Execute buy order with order book and slippage (advanced mode)
   */
  private executeAdvancedBuy(bar: Bar, qty: number): void {
    if (!this.orderBookSimulator) return;

    // Calculate slippage based on volume
    const slippage = this.slippageModel.calculateSlippage(qty, bar.volume);
    const executionPrice = this.slippageModel.calculateExecutionPrice("buy", bar.close, qty, bar.volume);

    // Execute through order book
    const result = this.orderBookSimulator.executeMarketOrder("buy", qty);

    // Use order book price if available, otherwise use slippage-adjusted price
    const finalPrice = result.avgPrice ?? executionPrice;

    const trade: ExtendedTrade = {
      id: `adv_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `adv_order`,
      symbol: this.symbol,
      side: "buy",
      qty: result.filledQty,
      price: finalPrice,
      timestamp: bar.timestamp,
      slippage,
      marketImpact: slippage * bar.close,
      orderBookDepth: this.orderBookSimulator.getDepth(),
    };

    this.simulationTrades.push(trade);

    // Access portfolio tracker through engine
    const engineWithTracker = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: ExtendedTrade) => void };
    };
    engineWithTracker.portfolioTracker.processTrade(trade);
  }

  /**
   * Execute sell order with order book and slippage (advanced mode)
   */
  private executeAdvancedSell(bar: Bar, qty: number): void {
    if (!this.orderBookSimulator) return;

    // Calculate slippage based on volume
    const slippage = this.slippageModel.calculateSlippage(qty, bar.volume);
    const executionPrice = this.slippageModel.calculateExecutionPrice("sell", bar.close, qty, bar.volume);

    // Execute through order book
    const result = this.orderBookSimulator.executeMarketOrder("sell", qty);

    // Use order book price if available, otherwise use slippage-adjusted price
    const finalPrice = result.avgPrice ?? executionPrice;

    const trade: ExtendedTrade = {
      id: `adv_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `adv_order`,
      symbol: this.symbol,
      side: "sell",
      qty: result.filledQty,
      price: finalPrice,
      timestamp: bar.timestamp,
      slippage,
      marketImpact: slippage * bar.close,
      orderBookDepth: this.orderBookSimulator.getDepth(),
    };

    this.simulationTrades.push(trade);

    // Access portfolio tracker through engine
    const engineWithTracker = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: ExtendedTrade) => void };
    };
    engineWithTracker.portfolioTracker.processTrade(trade);
  }

  /**
   * Initialize order book with liquidity
   */
  private initializeOrderBook(bar: Bar): void {
    if (!this.orderBookSimulator) return;

    const basePrice = bar.close;
    const spread = basePrice * 0.001; // 0.1% spread
    const volume = bar.volume;

    // Add bid levels
    for (let i = 1; i <= this.orderBookDepth; i++) {
      const price = basePrice - spread * i;
      const size = Math.floor((volume * 0.1) / this.orderBookDepth / i);
      if (size > 0) {
        this.orderBookSimulator.addLimitOrder("buy", price, size, Date.now());
      }
    }

    // Add ask levels
    for (let i = 1; i <= this.orderBookDepth; i++) {
      const price = basePrice + spread * i;
      const size = Math.floor((volume * 0.1) / this.orderBookDepth / i);
      if (size > 0) {
        this.orderBookSimulator.addLimitOrder("sell", price, size, Date.now());
      }
    }
  }

  /**
   * Update order book based on current bar
   */
  private updateOrderBook(bar: Bar): void {
    if (!this.orderBookSimulator) return;

    // Clear and re-initialize order book based on new bar
    this.orderBookSimulator.clear();
    this.initializeOrderBook(bar);
  }

  /**
   * Broadcast simulation tick via WebSocket
   */
  private broadcastTick(event: SimulationTickEvent): void {
    if (!this.websocketFeeds) return;

    this.websocketFeeds.broadcast(
      "simulation",
      {
        type: "simulation_tick",
        bar: event.bar,
        barIndex: event.barIndex,
        totalBars: event.totalBars,
        progress: event.progress,
        portfolio: event.portfolio,
      },
      "metric"
    );
  }

  /**
   * Build simulation result for fast mode
   */
  private buildResult(): SimulationResult {
    const portfolio = this.engine.getPortfolio();
    const metrics = this.calculateMetrics();

    return {
      trades: this.simulationTrades,
      finalEquity: portfolio.equity,
      finalCash: portfolio.cash,
      metrics,
      equityCurve: this.equityCurve,
    };
  }

  /**
   * Build simulation result for advanced mode
   */
  private buildAdvancedResult(): SimulationResult {
    const portfolio = this.engine.getPortfolio();
    const metrics = this.calculateAdvancedMetrics();

    // Calculate average spread
    const avgSpread = this.orderBookHistory.length > 0
      ? this.orderBookHistory.reduce((sum, h) => {
          const spread = h.depth.asks[0]?.price && h.depth.bids[0]?.price
            ? h.depth.asks[0].price - h.depth.bids[0].price
            : 0;
          return sum + spread;
        }, 0) / this.orderBookHistory.length
      : 0;

    return {
      trades: this.simulationTrades,
      finalEquity: portfolio.equity,
      finalCash: portfolio.cash,
      metrics,
      equityCurve: this.equityCurve,
      orderBookData: {
        depthHistory: this.orderBookHistory,
        avgSpread,
      },
    };
  }

  /**
   * Calculate basic metrics
   */
  private calculateMetrics() {
    const finalEquity = this.engine.getPortfolio().equity;
    const totalReturn = ((finalEquity - this.initialCash) / this.initialCash) * 100;

    return {
      totalReturn,
      totalTrades: this.simulationTrades.length,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdown: 0,
    };
  }

  /**
   * Calculate advanced metrics including slippage and market impact
   */
  private calculateAdvancedMetrics() {
    const baseMetrics = this.calculateMetrics();

    // Calculate average slippage
    const tradesWithSlippage = this.simulationTrades.filter(t => t.slippage !== undefined);
    const avgSlippage = tradesWithSlippage.length > 0
      ? tradesWithSlippage.reduce((sum, t) => sum + (t.slippage || 0), 0) / tradesWithSlippage.length
      : 0;

    // Calculate total market impact
    const totalMarketImpact = this.simulationTrades.reduce((sum, t) => sum + (t.marketImpact || 0), 0);

    return {
      ...baseMetrics,
      avgSlippage,
      marketImpact: totalMarketImpact,
    };
  }
}
