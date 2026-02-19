/**
 * Base Exchange Adapter
 * Abstract base class for exchange implementations
 */

import type {
  ExchangeAdapter,
  PriceTick,
  OrderBookUpdate,
  Quote,
  Bar,
  Trade,
  Account,
  Position,
  Order,
  OrderRequest,
  MarketStatus,
} from "./types.js";

export abstract class BaseAdapter implements ExchangeAdapter {
  protected connected = false;
  protected latency = 0;
  protected lastPingTime = 0;
  protected priceCallbacks: ((tick: PriceTick) => void)[] = [];
  protected orderBookCallbacks: ((book: OrderBookUpdate) => void)[] = [];
  protected tradeCallbacks: ((trade: Trade) => void)[] = [];
  protected quoteCallbacks: ((quote: Quote) => void)[] = [];

  abstract connect(): Promise<void>;
  abstract disconnect(): void;

  isConnected(): boolean {
    return this.connected;
  }

  getLatency(): number {
    return this.latency;
  }

  protected updateLatency(): void {
    if (this.lastPingTime > 0) {
      this.latency = Date.now() - this.lastPingTime;
    }
  }

  // Event subscription methods
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

  // Protected emit methods for subclasses
  protected emitPrice(tick: PriceTick): void {
    this.priceCallbacks.forEach((cb) => {
      try {
        cb(tick);
      } catch (error) {
        console.error("Error in price callback:", error);
      }
    });
  }

  protected emitOrderBook(book: OrderBookUpdate): void {
    this.orderBookCallbacks.forEach((cb) => {
      try {
        cb(book);
      } catch (error) {
        console.error("Error in orderbook callback:", error);
      }
    });
  }

  protected emitTrade(trade: Trade): void {
    this.tradeCallbacks.forEach((cb) => {
      try {
        cb(trade);
      } catch (error) {
        console.error("Error in trade callback:", error);
      }
    });
  }

  protected emitQuote(quote: Quote): void {
    this.quoteCallbacks.forEach((cb) => {
      try {
        cb(quote);
      } catch (error) {
        console.error("Error in quote callback:", error);
      }
    });
  }

  // Abstract methods that must be implemented by subclasses
  abstract getQuote(symbol: string): Promise<Quote>;
  abstract getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;
  abstract subscribe(symbols: string[], channels?: string[]): Promise<void>;
  abstract unsubscribe(symbols: string[]): void;
  abstract getAccount(): Promise<Account>;
  abstract getPositions(): Promise<Position[]>;
  abstract submitOrder(order: OrderRequest): Promise<Order>;
  abstract cancelOrder(orderId: string): Promise<void>;
  abstract getOrder(orderId: string): Promise<Order>;
  abstract getMarketStatus(): Promise<MarketStatus>;
}
