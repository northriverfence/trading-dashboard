/**
 * Exchange Adapter Types
 * Core interfaces for exchange abstraction layer
 */

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  lastPrice: number;
  lastSize: number;
  timestamp: Date;
  exchange: string;
}

export interface Bar {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface PriceTick {
  symbol: string;
  timestamp: Date;
  price: number;
  size: number;
  exchange: string;
  conditions?: string[];
  tape?: string;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  count?: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: Date;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  sequence: number;
}

export interface OrderBookUpdate {
  symbol: string;
  timestamp: Date;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  sequence: number;
  isSnapshot: boolean;
}

export interface Account {
  id: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  equity: number;
  dayTradeCount: number;
  isPatternDayTrader: boolean;
  tradingBlocked: boolean;
}

export interface Position {
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok";
export type OrderStatus = "pending" | "open" | "filled" | "partially_filled" | "canceled" | "expired" | "rejected";

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  qty: number;
  type: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  trailPercent?: number;
  timeInForce: TimeInForce;
  extendedHours?: boolean;
  clientOrderId?: string;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  filledQty: number;
  type: OrderType;
  limitPrice?: number;
  stopPrice?: number;
  trailPrice?: number;
  trailPercent?: number;
  timeInForce: TimeInForce;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  filledAvgPrice?: number;
}

export interface Fill {
  orderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  timestamp: Date;
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
  timestamp: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  lastPing: Date;
  latency: number;
  reconnectCount: number;
}

export type DataEventType = "price" | "trade" | "orderbook" | "bar" | "quote";

export interface DataEvent {
  type: DataEventType;
  symbol: string;
  timestamp: Date;
  data: Quote | PriceTick | OrderBookUpdate | Bar;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting" | "error";

export interface Trade {
  symbol: string;
  timestamp: Date;
  price: number;
  size: number;
  side: "buy" | "sell";
  exchange: string;
  id?: string;
  conditions?: string[];
}

export interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  paper: boolean;
  restUrl: string;
  websocketUrl: string;
}

export interface IBConfig {
  host: string;
  port: number;
  clientId: number;
}

export interface HistoricalConfig {
  dataPath: string;
  replaySpeed: number;
}

export interface ExchangeAdapterConfig {
  default: string;
  adapters: {
    alpaca?: AlpacaConfig;
    interactive_brokers?: IBConfig;
    historical?: HistoricalConfig;
  };
}

export interface ExchangeAdapter {
  // Connection
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getLatency(): number;

  // Market Data (REST)
  getQuote(symbol: string): Promise<Quote>;
  getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;
  getMarketStatus(): Promise<MarketStatus>;

  // Market Data (Streaming)
  subscribe(symbols: string[], channels?: string[]): Promise<void>;
  unsubscribe(symbols: string[]): void;
  onPrice(callback: (tick: PriceTick) => void): void;
  onOrderBook(callback: (book: OrderBookUpdate) => void): void;
  onTrade(callback: (trade: Trade) => void): void;
  onQuote(callback: (quote: Quote) => void): void;

  // Trading
  getAccount(): Promise<Account>;
  getPositions(): Promise<Position[]>;
  submitOrder(order: OrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<Order>;
}
