import type { Bar, Portfolio } from "./types.js";

export interface Signal {
  action: "buy" | "sell" | "hold";
  symbol: string;
  qty: number;
  confidence: number;
  limitPrice?: number;
  stopPrice?: number;
}

export interface StrategyContext {
  portfolio: Portfolio;
  getBars: (symbol: string, lookback: number) => Bar[];
  currentTime: Date;
}

export interface Strategy {
  name: string;
  description?: string;
  parameters?: Record<string, number | string | boolean>;
  onBar: (bar: Bar, context: StrategyContext) => Signal | null;
  onInit?: () => void;
  onComplete?: () => void;
}

// New Strategy Interface with initialize method
export interface IStrategy {
  initialize(historicalBars: Bar[]): void;
  onBar(bar: Bar): Signal | null;
  getName(): string;
}

// Strategy configuration interface
export interface StrategyConfig {
  symbol: string;
}

// Moving Average Crossover configuration
export interface MovingAverageCrossoverConfig extends StrategyConfig {
  shortPeriod: number;
  longPeriod: number;
}

// Moving Average Crossover Strategy implementation
export class MovingAverageCrossoverStrategy implements IStrategy {
  private config: MovingAverageCrossoverConfig;
  private shortMA: number = 0;
  private longMA: number = 0;
  private previousShortMA: number = 0;
  private previousLongMA: number = 0;
  private bars: Bar[] = [];

  constructor(config: MovingAverageCrossoverConfig) {
    this.config = config;
  }

  initialize(historicalBars: Bar[]): void {
    this.bars = [...historicalBars];
    this.calculateMAs();
  }

  private calculateMAs(): void {
    const { shortPeriod, longPeriod } = this.config;

    if (this.bars.length < longPeriod) {
      this.shortMA = 0;
      this.longMA = 0;
      return;
    }

    const closes = this.bars.map((b) => b.close);

    // Calculate short MA
    const shortSlice = closes.slice(-shortPeriod);
    this.previousShortMA = this.shortMA;
    this.shortMA = shortSlice.reduce((a, b) => a + b, 0) / shortPeriod;

    // Calculate long MA
    const longSlice = closes.slice(-longPeriod);
    this.previousLongMA = this.longMA;
    this.longMA = longSlice.reduce((a, b) => a + b, 0) / longPeriod;
  }

  onBar(bar: Bar): Signal | null {
    this.bars.push(bar);
    this.calculateMAs();

    if (this.shortMA === 0 || this.longMA === 0) {
      return null;
    }

    // Check for crossover
    if (this.previousShortMA <= this.previousLongMA && this.shortMA > this.longMA) {
      return {
        action: "buy",
        symbol: this.config.symbol,
        qty: 10,
        confidence: 0.8,
      };
    }

    if (this.previousShortMA >= this.previousLongMA && this.shortMA < this.longMA) {
      return {
        action: "sell",
        symbol: this.config.symbol,
        qty: 10,
        confidence: 0.8,
      };
    }

    return null;
  }

  getName(): string {
    return `MA_Crossover(${this.config.shortPeriod}, ${this.config.longPeriod})`;
  }
}
