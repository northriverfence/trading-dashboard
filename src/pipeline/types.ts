/**
 * Data Pipeline Types
 * Core interfaces for real-time market data streaming
 */

import type { PriceTick, OrderBookUpdate, Bar, Trade, Quote, DataEvent, ConnectionState } from "../adapters/types.js";

export interface DataPipeline {
  // Connection Management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getConnectionState(): ConnectionState;

  // Subscription Management
  subscribe(symbols: string[], channels?: DataChannel[]): void;
  unsubscribe(symbols: string[], channels?: DataChannel[]): void;
  getSubscriptions(): string[];

  // Event Handlers
  onPrice(callback: (tick: PriceTick) => void): void;
  onTrade(callback: (trade: Trade) => void): void;
  onOrderBook(callback: (book: OrderBookUpdate) => void): void;
  onBar(callback: (bar: Bar) => void): void;
  onQuote(callback: (quote: Quote) => void): void;

  // Connection Events
  onConnect(callback: () => void): void;
  onDisconnect(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  onReconnect(callback: (attempt: number) => void): void;

  // Data Access
  getLatestPrice(symbol: string): PriceTick | undefined;
  getLatestOrderBook(symbol: string): OrderBookUpdate | undefined;
  getBuffer(symbol: string): DataBuffer | undefined;
}

export type DataChannel = "trades" | "quotes" | "orderbook" | "bars" | "trade_updates";

export interface PipelineConfig {
  autoReconnect: boolean;
  reconnectStrategy: "exponential" | "linear" | "fixed";
  maxReconnectDelay: number; // milliseconds
  baseReconnectDelay: number; // milliseconds
  maxReconnectAttempts: number;
  bufferSize: number;
  heartbeatInterval: number; // milliseconds
  heartbeatTimeout: number; // milliseconds
  batchInterval: number; // milliseconds for batch processing
}

export interface DataBuffer {
  symbol: string;
  prices: PriceTick[];
  trades: Trade[];
  orderBookUpdates: OrderBookUpdate[];
  bars: Bar[];

  addPrice(tick: PriceTick): void;
  addTrade(trade: Trade): void;
  addOrderBook(update: OrderBookUpdate): void;
  addBar(bar: Bar): void;

  getPrices(count?: number): PriceTick[];
  getTrades(count?: number): Trade[];
  getOrderBookUpdates(count?: number): OrderBookUpdate[];
  getBars(count?: number): Bar[];

  getLatestPrice(): PriceTick | undefined;
  getLatestTrade(): Trade | undefined;
  getLatestOrderBook(): OrderBookUpdate | undefined;
  getLatestBar(): Bar | undefined;

  clear(): void;
  getSize(): number;
  getUtilization(): number;
}

export interface WebSocketManager {
  connect(url: string, protocols?: string[]): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  send(data: unknown): void;
  onMessage(callback: (data: unknown) => void): void;
  onOpen(callback: () => void): void;
  onClose(callback: (code: number, reason: string) => void): void;
  onError(callback: (error: Error) => void): void;

  ping(): void;
  pong(): void;
}

export interface ReconnectStrategy {
  getDelay(attempt: number): number;
  shouldRetry(attempt: number): boolean;
}

export interface Subscription {
  symbols: string[];
  channels: DataChannel[];
  timestamp: Date;
}

export interface PipelineStats {
  connected: boolean;
  state: ConnectionState;
  messagesReceived: number;
  messagesPerSecond: number;
  latency: number;
  bufferUtilization: number;
  subscriptions: number;
  reconnectAttempts: number;
  lastMessageTime?: Date;
  errors: number;
}

export interface EventAggregator {
  addEvent(event: DataEvent): void;
  getEvents(symbol: string, type: string, count?: number): DataEvent[];
  clear(): void;
}
