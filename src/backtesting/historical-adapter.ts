/**
 * Historical Adapter
 * Implements ExchangeAdapter for backtesting with historical data replay
 */

import type {
  ExchangeAdapter,
  Quote,
  Bar,
  PriceTick,
  Trade,
  OrderBookUpdate,
  OrderRequest,
  Order,
  Position,
  Account,
  MarketStatus,
} from "../adapters/types.js";
import type { HistoricalDataStore, ExecutionSimulator, Fill } from "./types.js";

export class HistoricalAdapter implements ExchangeAdapter {
  private dataStore: HistoricalDataStore;
  private executionSimulator: ExecutionSimulator;
  private symbols: string[] = [];
  private currentBars: Map<string, Bar> = new Map();
  private currentQuotes: Map<string, Quote> = new Map();
  private currentIndex: number = 0;
  private allBars: Bar[] = [];
  private isRunning: boolean = false;
  private connected: boolean = false;

  // Event callbacks
  private priceCallbacks: ((tick: PriceTick) => void)[] = [];
  private tradeCallbacks: ((trade: Trade) => void)[] = [];
  private orderBookCallbacks: ((book: OrderBookUpdate) => void)[] = [];
  private quoteCallbacks: ((quote: Quote) => void)[] = [];
  private barCallbacks: ((bar: Bar) => void)[] = [];

  // Simulated account state
  private account: Account = {
    id: "backtest",
    buyingPower: 100000,
    cash: 100000,
    portfolioValue: 100000,
    equity: 100000,
    dayTradeCount: 0,
    isPatternDayTrader: false,
    tradingBlocked: false,
  };

  private positions: Map<string, Position> = new Map();
  private orders: Map<string, Order> = new Map();
  private fills: Fill[] = [];

  constructor(dataStore: HistoricalDataStore, executionSimulator: ExecutionSimulator) {
    this.dataStore = dataStore;
    this.executionSimulator = executionSimulator;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.isRunning = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatency(): number {
    return 0; // No latency in backtesting
  }

  async subscribe(symbols: string[]): Promise<void> {
    this.symbols = Array.from(new Set([...this.symbols, ...symbols]));
  }

  unsubscribe(symbols: string[]): void {
    this.symbols = this.symbols.filter((s) => !symbols.includes(s));
  }

  onPrice(callback: (tick: PriceTick) => void): void {
    this.priceCallbacks.push(callback);
  }

  onOrderBook(callback: (book: OrderBookUpdate) => void): void {
    this.orderBookCallbacks.push(callback);
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallbacks.push(callback);
  }

  onQuote(callback: (quote: Quote) => void): void {
    this.quoteCallbacks.push(callback);
  }

  onBar(callback: (bar: Bar) => void): void {
    this.barCallbacks.push(callback);
  }

  async getQuote(symbol: string): Promise<Quote> {
    const quote = this.currentQuotes.get(symbol);
    if (!quote) {
      throw new Error(`No quote available for ${symbol}`);
    }
    return quote;
  }

  async getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]> {
    return this.dataStore.loadBars(symbol, new Date(0), new Date(), timeframe);
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return {
      isOpen: this.isRunning,
      nextOpen: new Date(),
      nextClose: new Date(),
      timestamp: new Date(),
    };
  }

  async getAccount(): Promise<Account> {
    return { ...this.account };
  }

  async getPositions(): Promise<Position[]> {
    return Array.from(this.positions.values());
  }

  async submitOrder(orderRequest: OrderRequest): Promise<Order> {
    const order: Order = {
      id: this.generateOrderId(),
      clientOrderId: orderRequest.clientOrderId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      qty: orderRequest.qty,
      filledQty: 0,
      type: orderRequest.type,
      limitPrice: orderRequest.limitPrice,
      stopPrice: orderRequest.stopPrice,
      trailPrice: orderRequest.trailPrice,
      trailPercent: orderRequest.trailPercent,
      timeInForce: orderRequest.timeInForce,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.orders.set(order.id, order);

    // Try to fill immediately with current bar
    const currentBar = this.currentBars.get(order.symbol);
    if (currentBar) {
      const fill = this.executionSimulator.simulateFill(orderRequest, currentBar, "immediate");
      if (fill) {
        this.processFill(order, fill);
      }
    }

    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (order && order.status === "open") {
      order.status = "canceled";
      order.updatedAt = new Date();
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  // Backtesting specific methods
  loadData(bars: Bar[]): void {
    // Sort bars by timestamp
    this.allBars = bars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.currentIndex = 0;
  }

  async step(): Promise<boolean> {
    if (this.currentIndex >= this.allBars.length) {
      return false;
    }

    const bar = this.allBars[this.currentIndex]!;
    this.currentBars.set(bar.symbol, bar);
    this.currentIndex++;

    // Generate quote from bar
    const quote: Quote = {
      symbol: bar.symbol,
      bid: bar.close * 0.999,
      ask: bar.close * 1.001,
      bidSize: bar.volume * 0.4,
      askSize: bar.volume * 0.4,
      lastPrice: bar.close,
      lastSize: bar.volume,
      timestamp: bar.timestamp,
      exchange: "SIM",
    };
    this.currentQuotes.set(bar.symbol, quote);

    // Emit events
    this.emitQuote(quote);
    this.emitPrice({
      symbol: bar.symbol,
      timestamp: bar.timestamp,
      price: bar.close,
      size: bar.volume,
      exchange: "SIM",
    });
    this.emitBar(bar);

    // Check pending orders
    await this.processPendingOrders(bar);

    return true;
  }

  private async processPendingOrders(bar: Bar): Promise<void> {
    for (const order of Array.from(this.orders.values())) {
      if (order.status !== "open" || order.symbol !== bar.symbol) continue;

      const orderRequest: OrderRequest = {
        symbol: order.symbol,
        side: order.side,
        qty: order.qty - order.filledQty,
        type: order.type,
        limitPrice: order.limitPrice,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce,
      };

      const fill = this.executionSimulator.simulateFill(
        orderRequest,
        bar,
        order.type === "limit" ? "limit" : "immediate",
      );
      if (fill) {
        this.processFill(order, fill);
      }
    }
  }

  private processFill(order: Order, fill: Fill): void {
    // Update order
    order.filledQty += fill.qty;
    if (order.filledQty >= order.qty) {
      order.status = "filled";
    } else {
      order.status = "partially_filled";
    }
    order.filledAvgPrice = fill.price;
    order.updatedAt = new Date();

    // Update account
    const notional = fill.price * fill.qty;
    const cost = notional + fill.commission + fill.slippage;

    if (fill.side === "buy") {
      this.account.cash -= cost;
    } else {
      this.account.cash += notional - fill.commission - fill.slippage;
    }

    // Update position
    let position = this.positions.get(order.symbol);
    if (!position) {
      position = {
        symbol: order.symbol,
        qty: 0,
        entryPrice: 0,
        currentPrice: fill.price,
        marketValue: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
      };
      this.positions.set(order.symbol, position);
    }

    const prevQty = position.qty;
    if (fill.side === "buy") {
      position.qty += fill.qty;
      position.entryPrice = (position.entryPrice * prevQty + fill.price * fill.qty) / position.qty;
    } else {
      position.qty -= fill.qty;
      if (position.qty === 0) {
        position.entryPrice = 0;
      }
    }

    position.currentPrice = fill.price;
    position.marketValue = Math.abs(position.qty * fill.price);

    this.fills.push(fill);

    // Emit trade event
    this.emitTrade({
      symbol: order.symbol,
      timestamp: fill.timestamp,
      price: fill.price,
      size: fill.qty,
      side: fill.side,
      exchange: "SIM",
      id: fill.orderId,
    });
  }

  getFills(): Fill[] {
    return [...this.fills];
  }

  setInitialCapital(capital: number): void {
    this.account.cash = capital;
    this.account.buyingPower = capital;
    this.account.equity = capital;
    this.account.portfolioValue = capital;
  }

  updatePortfolioValue(): void {
    let positionsValue = 0;
    for (const position of Array.from(this.positions.values())) {
      const quote = this.currentQuotes.get(position.symbol);
      if (quote) {
        position.currentPrice = quote.lastPrice;
        position.marketValue = Math.abs(position.qty * quote.lastPrice);
        if (position.qty > 0) {
          position.unrealizedPnl = position.marketValue - position.qty * position.entryPrice;
        } else {
          position.unrealizedPnl = Math.abs(position.qty) * position.entryPrice - position.marketValue;
        }
        positionsValue += position.marketValue;
      }
    }
    this.account.portfolioValue = this.account.cash + positionsValue;
    this.account.equity = this.account.portfolioValue;
    this.account.buyingPower = this.account.cash; // Simplified
  }

  private emitPrice(tick: PriceTick): void {
    for (const cb of this.priceCallbacks) {
      try {
        cb(tick);
      } catch (error) {
        console.error("Error in price callback:", error);
      }
    }
  }

  private emitTrade(trade: Trade): void {
    for (const cb of this.tradeCallbacks) {
      try {
        cb(trade);
      } catch (error) {
        console.error("Error in trade callback:", error);
      }
    }
  }

  private emitOrderBook(book: OrderBookUpdate): void {
    for (const cb of this.orderBookCallbacks) {
      try {
        cb(book);
      } catch (error) {
        console.error("Error in orderbook callback:", error);
      }
    }
  }

  private emitQuote(quote: Quote): void {
    for (const cb of this.quoteCallbacks) {
      try {
        cb(quote);
      } catch (error) {
        console.error("Error in quote callback:", error);
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

  private generateOrderId(): string {
    return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  getCurrentTimestamp(): Date {
    const currentBar = this.allBars[this.currentIndex];
    return currentBar ? currentBar.timestamp : new Date();
  }

  getProgress(): { current: number; total: number; percent: number } {
    return {
      current: this.currentIndex,
      total: this.allBars.length,
      percent: this.allBars.length > 0 ? (this.currentIndex / this.allBars.length) * 100 : 0,
    };
  }
}
