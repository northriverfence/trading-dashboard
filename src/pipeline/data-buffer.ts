/**
 * Data Buffer
 * Ring buffer for price data with symbol indexing
 */

import type { PriceTick, Trade, OrderBookUpdate, Bar } from "../adapters/types.js";
import type { DataBuffer as IDataBuffer } from "./types.js";

export class DataBuffer implements IDataBuffer {
  symbol: string;
  prices: PriceTick[] = [];
  trades: Trade[] = [];
  orderBookUpdates: OrderBookUpdate[] = [];
  bars: Bar[] = [];

  private maxSize: number;

  constructor(symbol: string, maxSize: number = 1000) {
    this.symbol = symbol;
    this.maxSize = maxSize;
  }

  addPrice(tick: PriceTick): void {
    this.prices.push(tick);
    if (this.prices.length > this.maxSize) {
      this.prices.shift();
    }
  }

  addTrade(trade: Trade): void {
    this.trades.push(trade);
    if (this.trades.length > this.maxSize) {
      this.trades.shift();
    }
  }

  addOrderBook(update: OrderBookUpdate): void {
    this.orderBookUpdates.push(update);
    if (this.orderBookUpdates.length > this.maxSize) {
      this.orderBookUpdates.shift();
    }
  }

  addBar(bar: Bar): void {
    this.bars.push(bar);
    if (this.bars.length > this.maxSize) {
      this.bars.shift();
    }
  }

  getPrices(count?: number): PriceTick[] {
    return this.prices.slice(-(count ?? this.prices.length));
  }

  getTrades(count?: number): Trade[] {
    return this.trades.slice(-(count ?? this.trades.length));
  }

  getOrderBookUpdates(count?: number): OrderBookUpdate[] {
    return this.orderBookUpdates.slice(-(count ?? this.orderBookUpdates.length));
  }

  getBars(count?: number): Bar[] {
    return this.bars.slice(-(count ?? this.bars.length));
  }

  getLatestPrice(): PriceTick | undefined {
    return this.prices[this.prices.length - 1];
  }

  getLatestTrade(): Trade | undefined {
    return this.trades[this.trades.length - 1];
  }

  getLatestOrderBook(): OrderBookUpdate | undefined {
    return this.orderBookUpdates[this.orderBookUpdates.length - 1];
  }

  getLatestBar(): Bar | undefined {
    return this.bars[this.bars.length - 1];
  }

  clear(): void {
    this.prices = [];
    this.trades = [];
    this.orderBookUpdates = [];
    this.bars = [];
  }

  getSize(): number {
    return this.prices.length + this.trades.length + this.orderBookUpdates.length + this.bars.length;
  }

  getUtilization(): number {
    return this.getSize() / (this.maxSize * 4); // 4 data types
  }
}
