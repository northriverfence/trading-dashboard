import type { Quote } from "./types.js";

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  paper: boolean;
}

export interface Bar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class AlpacaProvider {
  private config: AlpacaConfig;
  private baseUrl: string;

  constructor(config: AlpacaConfig) {
    this.config = config;
    this.baseUrl = config.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  }

  async getQuote(symbol: string): Promise<Quote> {
    // For now, return simulated data
    // In real implementation, would call Alpaca API
    const basePrice = 150 + Math.random() * 50;
    const spread = 0.02;

    return {
      symbol,
      bid: basePrice - spread,
      ask: basePrice + spread,
      lastPrice: basePrice,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
    };
  }

  async getBars(symbol: string, timeframe: string, options: { start?: Date; end?: Date }): Promise<Bar[]> {
    // Return simulated historical data
    const bars: Bar[] = [];
    let price = 150;

    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.5) * 5;
      price += change;

      bars.push({
        timestamp: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
        open: price - Math.random() * 2,
        high: price + Math.random() * 2,
        low: price - Math.random() * 2,
        close: price,
        volume: Math.floor(Math.random() * 1000000),
      });
    }

    return bars;
  }
}
