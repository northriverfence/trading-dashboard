/**
 * Interactive Brokers Adapter
 * Implements ExchangeAdapter for Interactive Brokers TWS/Gateway
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
} from "../types.js";
import type { IBConfig } from "../types.js";

export class InteractiveBrokersAdapter implements ExchangeAdapter {
  private config: IBConfig;
  private connected = false;
  private latency = 0;
  private clientId: number;

  // Event callbacks
  private priceCallbacks: ((tick: PriceTick) => void)[] = [];
  private tradeCallbacks: ((trade: Trade) => void)[] = [];
  private orderBookCallbacks: ((book: OrderBookUpdate) => void)[] = [];
  private quoteCallbacks: ((quote: Quote) => void)[] = [];

  // Connection
  private socket: any = null;
  private nextRequestId = 1;
  private subscriptions = new Map<string, Set<string>>();

  constructor(config: IBConfig) {
    this.config = config;
    this.clientId = config.clientId;
  }

  async connect(): Promise<void> {
    // In a real implementation, this would connect to TWS/IB Gateway via the IB API
    // For now, we'll simulate the connection
    console.log(`Connecting to Interactive Brokers at ${this.config.host}:${this.config.port} (Client ID: ${this.clientId})`);

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));

    this.connected = true;
    console.log("Connected to Interactive Brokers");
  }

  disconnect(): void {
    if (this.socket) {
      // this.socket.disconnect();
    }
    this.connected = false;
    console.log("Disconnected from Interactive Brokers");
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLatency(): number {
    return this.latency;
  }

  async subscribe(symbols: string[], channels?: string[]): Promise<void> {
    for (const symbol of symbols) {
      const subs = this.subscriptions.get(symbol) || new Set();
      for (const channel of channels || ["trades"]) {
        subs.add(channel);
      }
      this.subscriptions.set(symbol, subs);

      // In real implementation, would send market data request to IB API
      console.log(`Subscribing to ${symbol} with channels: ${channels?.join(", ") || "trades"}`);
    }
  }

  unsubscribe(symbols: string[]): void {
    for (const symbol of symbols) {
      this.subscriptions.delete(symbol);
      console.log(`Unsubscribed from ${symbol}`);
    }
  }

  onPrice(callback: (tick: PriceTick) => void): void {
    this.priceCallbacks.push(callback);
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallbacks.push(callback);
  }

  onOrderBook(callback: (book: OrderBookUpdate) => void): void {
    this.orderBookCallbacks.push(callback);
  }

  onQuote(callback: (quote: Quote) => void): void {
    this.quoteCallbacks.push(callback);
  }

  async getQuote(symbol: string): Promise<Quote> {
    // In real implementation, would request snapshot from IB
    return {
      symbol,
      bid: 149.99,
      ask: 150.01,
      bidSize: 100,
      askSize: 100,
      lastPrice: 150.00,
      lastSize: 50,
      timestamp: new Date(),
      exchange: "NYSE",
    };
  }

  async getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]> {
    // In real implementation, would request historical data from IB
    const bars: Bar[] = [];
    const now = new Date();

    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      const basePrice = 150 + Math.sin(i * 0.1) * 5;

      bars.push({
        symbol,
        timestamp,
        open: basePrice - 0.5,
        high: basePrice + 1,
        low: basePrice - 1,
        close: basePrice + 0.5,
        volume: 100000 + Math.floor(Math.random() * 50000),
      });
    }

    return bars;
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return {
      isOpen: true,
      nextOpen: new Date(),
      nextClose: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
      timestamp: new Date(),
    };
  }

  async getAccount(): Promise<Account> {
    return {
      id: `IB-${this.clientId}`,
      buyingPower: 100000,
      cash: 50000,
      portfolioValue: 150000,
      equity: 150000,
      dayTradeCount: 0,
      isPatternDayTrader: false,
      tradingBlocked: false,
    };
  }

  async getPositions(): Promise<Position[]> {
    // In real implementation, would request positions from IB
    return [];
  }

  async submitOrder(orderRequest: OrderRequest): Promise<Order> {
    const orderId = `IB${Date.now()}${this.nextRequestId++}`;

    // In real implementation, would submit order via IB API
    console.log(`Submitting order to IB: ${orderRequest.side} ${orderRequest.qty} ${orderRequest.symbol}`);

    return {
      id: orderId,
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      qty: orderRequest.qty,
      filledQty: 0,
      type: orderRequest.type,
      limitPrice: orderRequest.limitPrice,
      stopPrice: orderRequest.stopPrice,
      timeInForce: orderRequest.timeInForce,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    console.log(`Cancelling order ${orderId} via IB`);
  }

  async getOrder(orderId: string): Promise<Order> {
    // In real implementation, would query order status from IB
    throw new Error("Order not found");
  }

  // IB-specific helper methods
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
}
