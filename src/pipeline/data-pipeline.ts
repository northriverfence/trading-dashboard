/**
 * Data Pipeline
 * Real-time market data streaming with auto-reconnect
 */

import type { ExchangeAdapter, PriceTick, Trade, OrderBookUpdate, Bar, Quote } from "../adapters/types.js";
import type { DataPipeline as IDataPipeline, PipelineConfig, DataBuffer, DataChannel, PipelineStats } from "./types.js";
import { WebSocketManager } from "./websocket-manager.js";
import { DataBuffer as DataBufferImpl } from "./data-buffer.js";

export class DataPipeline implements IDataPipeline {
  private adapter: ExchangeAdapter;
  private config: PipelineConfig;
  private wsManager: WebSocketManager;
  private buffers: Map<string, DataBuffer> = new Map();
  private subscriptions: Set<string> = new Set();

  private priceCallbacks: ((tick: PriceTick) => void)[] = [];
  private tradeCallbacks: ((trade: Trade) => void)[] = [];
  private orderBookCallbacks: ((book: OrderBookUpdate) => void)[] = [];
  private barCallbacks: ((bar: Bar) => void)[] = [];
  private quoteCallbacks: ((quote: Quote) => void)[] = [];

  private connectCallbacks: (() => void)[] = [];
  private disconnectCallbacks: (() => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private reconnectCallbacks: ((attempt: number) => void)[] = [];

  private stats: PipelineStats = {
    connected: false,
    state: "disconnected",
    messagesReceived: 0,
    messagesPerSecond: 0,
    latency: 0,
    bufferUtilization: 0,
    subscriptions: 0,
    reconnectAttempts: 0,
    lastMessageTime: undefined,
    errors: 0,
  };

  private messageCount = 0;
  private lastMessageCountReset = Date.now();

  constructor(adapter: ExchangeAdapter, config: PipelineConfig) {
    this.adapter = adapter;
    this.config = config;
    this.wsManager = new WebSocketManager(config);

    this.setupWebSocketHandlers();
    this.setupAdapterHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wsManager.onOpen(() => {
      this.stats.connected = true;
      this.stats.state = "connected";
      this.connectCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (error) {
          console.error("Error in connect callback:", error);
        }
      });
    });

    this.wsManager.onClose(() => {
      this.stats.connected = false;
      this.stats.state = "disconnected";
      this.disconnectCallbacks.forEach((cb) => {
        try {
          cb();
        } catch (error) {
          console.error("Error in disconnect callback:", error);
        }
      });
    });

    this.wsManager.onError((error) => {
      this.stats.errors++;
      this.errorCallbacks.forEach((cb) => {
        try {
          cb(error);
        } catch (e) {
          console.error("Error in error callback:", e);
        }
      });
    });

    this.wsManager.onMessage((data) => {
      this.handleMessage(data);
    });
  }

  private setupAdapterHandlers(): void {
    this.adapter.onPrice((tick) => {
      this.handlePriceTick(tick);
    });

    this.adapter.onTrade((trade) => {
      this.handleTrade(trade);
    });

    this.adapter.onOrderBook((book) => {
      this.handleOrderBook(book);
    });

    this.adapter.onQuote((quote) => {
      this.handleQuote(quote);
    });
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;

    await this.adapter.connect();

    // Subscribe to all tracked symbols
    if (this.subscriptions.size > 0) {
      const symbols = Array.from(this.subscriptions);
      await this.adapter.subscribe(symbols);
    }
  }

  disconnect(): void {
    this.adapter.disconnect();
    this.wsManager.disconnect();
    this.stats.connected = false;
    this.stats.state = "disconnected";
  }

  isConnected(): boolean {
    return this.adapter.isConnected();
  }

  getConnectionState() {
    return this.stats.state;
  }

  subscribe(symbols: string[], channels?: DataChannel[]): void {
    symbols.forEach((symbol) => {
      this.subscriptions.add(symbol);
      if (!this.buffers.has(symbol)) {
        this.buffers.set(symbol, new DataBufferImpl(symbol, this.config.bufferSize));
      }
    });

    if (this.isConnected()) {
      this.adapter.subscribe(symbols, channels).catch((error) => {
        console.error("Error subscribing:", error);
      });
    }

    this.stats.subscriptions = this.subscriptions.size;
  }

  unsubscribe(symbols: string[], channels?: DataChannel[]): void {
    symbols.forEach((symbol) => {
      this.subscriptions.delete(symbol);
    });

    if (this.isConnected()) {
      this.adapter.unsubscribe(symbols);
    }

    this.stats.subscriptions = this.subscriptions.size;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  // Event handlers
  onPrice(callback: (tick: PriceTick) => void): void {
    this.priceCallbacks.push(callback);
  }

  onTrade(callback: (trade: Trade) => void): void {
    this.tradeCallbacks.push(callback);
  }

  onOrderBook(callback: (book: OrderBookUpdate) => void): void {
    this.orderBookCallbacks.push(callback);
  }

  onBar(callback: (bar: Bar) => void): void {
    this.barCallbacks.push(callback);
  }

  onQuote(callback: (quote: Quote) => void): void {
    this.quoteCallbacks.push(callback);
  }

  onConnect(callback: () => void): void {
    this.connectCallbacks.push(callback);
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  onReconnect(callback: (attempt: number) => void): void {
    this.reconnectCallbacks.push(callback);
  }

  // Data access
  getLatestPrice(symbol: string): PriceTick | undefined {
    return this.buffers.get(symbol)?.getLatestPrice();
  }

  getLatestOrderBook(symbol: string): OrderBookUpdate | undefined {
    return this.buffers.get(symbol)?.getLatestOrderBook();
  }

  getBuffer(symbol: string): DataBuffer | undefined {
    return this.buffers.get(symbol) ?? undefined;
  }

  getStats(): PipelineStats {
    this.updateStats();
    return { ...this.stats };
  }

  // Private handlers
  private handleMessage(data: unknown): void {
    this.messageCount++;
    this.stats.messagesReceived++;
    this.stats.lastMessageTime = new Date();
  }

  private handlePriceTick(tick: PriceTick): void {
    this.getOrCreateBuffer(tick.symbol).addPrice(tick);
    this.priceCallbacks.forEach((cb) => {
      try {
        cb(tick);
      } catch (error) {
        console.error("Error in price callback:", error);
      }
    });
  }

  private handleTrade(trade: Trade): void {
    this.getOrCreateBuffer(trade.symbol).addTrade(trade);
    this.tradeCallbacks.forEach((cb) => {
      try {
        cb(trade);
      } catch (error) {
        console.error("Error in trade callback:", error);
      }
    });
  }

  private handleOrderBook(book: OrderBookUpdate): void {
    this.getOrCreateBuffer(book.symbol).addOrderBook(book);
    this.orderBookCallbacks.forEach((cb) => {
      try {
        cb(book);
      } catch (error) {
        console.error("Error in orderbook callback:", error);
      }
    });
  }

  private handleQuote(quote: Quote): void {
    this.quoteCallbacks.forEach((cb) => {
      try {
        cb(quote);
      } catch (error) {
        console.error("Error in quote callback:", error);
      }
    });
  }

  private getOrCreateBuffer(symbol: string): DataBuffer {
    let buffer = this.buffers.get(symbol);
    if (!buffer) {
      buffer = new DataBufferImpl(symbol, this.config.bufferSize);
      this.buffers.set(symbol, buffer);
    }
    return buffer;
  }

  private updateStats(): void {
    const now = Date.now();
    const elapsed = (now - this.lastMessageCountReset) / 1000;

    if (elapsed >= 1) {
      this.stats.messagesPerSecond = this.messageCount / elapsed;
      this.messageCount = 0;
      this.lastMessageCountReset = now;
    }

    this.stats.latency = this.adapter.getLatency();
    this.stats.bufferUtilization = this.calculateBufferUtilization();
  }

  private calculateBufferUtilization(): number {
    let total = 0;
    let count = 0;
    for (const buffer of this.buffers.values()) {
      total += buffer.getUtilization();
      count++;
    }
    return count > 0 ? total / count : 0;
  }
}
