/**
 * Backtesting Engine Types
 * Core interfaces for historical simulation
 */

import type { Bar, Trade, OrderRequest, Quote } from "../adapters/types.js";

export type { Bar, Trade, OrderRequest, Quote } from "../adapters/types.js";

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number; // Per trade (e.g., 0.001 = 0.1%)
  slippage: number; // Random slippage (e.g., 0.001 = 0.1%)
  fillModel: FillModel;
  dataSource: "files" | "database" | "api";
  replaySpeed: number; // 1 = real-time, 0 = unlimited
  warmupBars: number; // Bars to preload before start
}

export type FillModel = "immediate" | "next_bar" | "limit" | "market";

export interface BacktestResult {
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  metrics: PerformanceMetrics;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  startDate: Date;
  endDate: Date;
  duration: number; // Days
}

export interface TradeRecord {
  id: string;
  timestamp: Date;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  exitTime?: Date;
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  status: "open" | "closed";
  barsHeld: number;
  exitReason?: "stop_loss" | "take_profit" | "signal" | "end_of_test";
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  cash: number;
  positionsValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface DrawdownPoint {
  timestamp: Date;
  drawdown: number; // From peak
  drawdownPercent: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  lossRate: number;
  breakevenRate: number;

  avgWin: number;
  avgLoss: number;
  avgWinPercent: number;
  avgLossPercent: number;

  largestWin: number;
  largestLoss: number;
  largestWinPercent: number;
  largestLossPercent: number;

  profitFactor: number;
  expectancy: number;
  expectancyPercent: number;

  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number; // Days

  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;

  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  annualizedReturnPercent: number;

  volatility: number;
  volatilityPercent: number;

  avgBarsHeld: number;
  avgTradePerDay: number;
  avgTradePerMonth: number;
}

export interface Strategy {
  name: string;
  description?: string;

  onInit(): Promise<void>;
  onBar(bar: Bar): Promise<void>;
  onTick?(tick: Quote): Promise<void>;
  onTrade?(trade: Trade): Promise<void>;
  onEnd(): Promise<void>;
}

export interface BacktestEngine {
  configure(config: BacktestConfig): void;
  loadHistoricalData(symbols: string[]): Promise<void>;
  run(strategy: Strategy): Promise<BacktestResult>;
  pause(): void;
  resume(): void;
  stop(): void;
  getProgress(): BacktestProgress;
  getState(): BacktestState;

  onProgress(callback: (progress: BacktestProgress) => void): void;
  onTrade(callback: (fill: Fill) => void): void;
  onBar(callback: (bar: Bar) => void): void;
  onComplete(callback: (result: BacktestResult) => void): void;
}

export interface Fill {
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  timestamp: Date;
  commission: number;
  slippage: number;
}

export interface BacktestProgress {
  currentDate: Date;
  endDate: Date;
  percentComplete: number;
  barsProcessed: number;
  totalBars: number;
  elapsedTime: number; // Seconds
  estimatedTimeRemaining: number; // Seconds
  tradesExecuted: number;
  currentEquity: number;
}

export type BacktestState = "idle" | "loading" | "running" | "paused" | "completed" | "stopped" | "error";

export interface StrategyContext {
  timestamp: Date;
  volume?: number;
  bid?: number;
  ask?: number;
  [key: string]: unknown;
}

export interface Signal {
  action: "buy" | "sell" | "exit" | "hold";
  qty: number;
  price?: number;
  confidence?: number;
  reason?: string;
}

export interface HistoricalDataStore {
  loadBars(symbol: string, start: Date, end: Date, timeframe: string): Promise<Bar[]>;
  loadTrades(symbol: string, start: Date, end: Date): Promise<Trade[]>;
  loadQuotes(symbol: string, start: Date, end: Date): Promise<Quote[]>;
  hasData(symbol: string, date: Date): boolean;
  getAvailableSymbols(): string[];
  getDateRange(symbol: string): { start: Date; end: Date } | null;
}

export interface ExecutionSimulator {
  simulateFill(order: OrderRequest, bar: Bar, fillModel: FillModel): Fill | null;
  calculateSlippage(price: number, side: "buy" | "sell", volume: number): number;
}

export interface PerformanceAnalyzer {
  analyze(trades: TradeRecord[], equityCurve: EquityPoint[]): PerformanceMetrics;
  calculateSharpeRatio(returns: number[], riskFreeRate?: number): number;
  calculateMaxDrawdown(equityCurve: EquityPoint[]): { maxDrawdown: number; maxDrawdownPercent: number };
}

export interface WalkForwardConfig {
  inSamplePercent: number; // e.g., 0.7 for 70%
  outSamplePercent: number; // e.g., 0.3 for 30%
  windows: number; // Number of walk-forward windows
}

export interface WalkForwardResult {
  inSampleResults: BacktestResult[];
  outSampleResults: BacktestResult[];
  combinedResult: BacktestResult;
}
