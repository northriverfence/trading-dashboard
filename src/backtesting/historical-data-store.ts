/**
 * Historical Data Store
 * Loads and manages historical market data
 */

import type { Bar, Trade, Quote } from "../adapters/types.js";
import type { HistoricalDataStore as IHistoricalDataStore } from "./types.js";

export class HistoricalDataStore implements IHistoricalDataStore {
  private bars: Map<string, Bar[]> = new Map();
  private trades: Map<string, Trade[]> = new Map();
  private quotes: Map<string, Quote[]> = new Map();
  private dataPath: string;

  constructor(dataPath: string = "./data/historical") {
    this.dataPath = dataPath;
  }

  async loadBars(symbol: string, start: Date, end: Date, timeframe: string): Promise<Bar[]> {
    // In a real implementation, this would load from files or database
    // For now, return empty array as placeholder
    console.log(`Loading bars for ${symbol} from ${start.toISOString()} to ${end.toISOString()}`);
    return [];
  }

  async loadTrades(symbol: string, start: Date, end: Date): Promise<Trade[]> {
    console.log(`Loading trades for ${symbol} from ${start.toISOString()} to ${end.toISOString()}`);
    return [];
  }

  async loadQuotes(symbol: string, start: Date, end: Date): Promise<Quote[]> {
    console.log(`Loading quotes for ${symbol} from ${start.toISOString()} to ${end.toISOString()}`);
    return [];
  }

  setBars(symbol: string, bars: Bar[]): void {
    this.bars.set(symbol, bars);
  }

  setTrades(symbol: string, trades: Trade[]): void {
    this.trades.set(symbol, trades);
  }

  setQuotes(symbol: string, quotes: Quote[]): void {
    this.quotes.set(symbol, quotes);
  }

  getBarsInRange(symbol: string, start: Date, end: Date): Bar[] {
    const bars = this.bars.get(symbol) || [];
    return bars.filter((bar) => bar.timestamp >= start && bar.timestamp <= end);
  }

  hasData(symbol: string, date: Date): boolean {
    const bars = this.bars.get(symbol);
    if (!bars || bars.length === 0) return false;
    return bars.some((bar) => bar.timestamp.toDateString() === date.toDateString());
  }

  getAvailableSymbols(): string[] {
    return Array.from(this.bars.keys());
  }

  getDateRange(symbol: string): { start: Date; end: Date } | null {
    const bars = this.bars.get(symbol);
    if (!bars || bars.length === 0) return null;
    const firstBar = bars[0];
    const lastBar = bars[bars.length - 1];
    if (!firstBar || !lastBar) return null;
    return {
      start: firstBar.timestamp,
      end: lastBar.timestamp,
    };
  }

  clear(): void {
    this.bars.clear();
    this.trades.clear();
    this.quotes.clear();
  }
}
