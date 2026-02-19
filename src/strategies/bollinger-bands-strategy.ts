/**
 * Bollinger Bands Strategy
 * Mean reversion strategy using price bands based on moving average and standard deviation
 */

import type { Strategy } from "../backtesting/types.js";
import type { Bar, Quote, Trade, OrderRequest, ExchangeAdapter } from "../adapters/types.js";

export interface BollingerConfig {
  period: number; // Moving average period (default: 20)
  stdDev: number; // Standard deviation multiplier (default: 2)
  symbol: string;
  qty: number;
  stopLossPercent: number;
}

export class BollingerBandsStrategy implements Strategy {
  name = "Bollinger Bands Strategy";
  description = "Mean reversion using Bollinger Bands";

  private adapter: ExchangeAdapter;
  private config: BollingerConfig;
  private prices: number[] = [];
  private position: { entryPrice: number; qty: number; stopLossPrice: number } | null = null;

  constructor(adapter: ExchangeAdapter, config: BollingerConfig) {
    this.adapter = adapter;
    this.config = config;
  }

  async onInit(): Promise<void> {
    console.log(`Initializing ${this.name} for ${this.config.symbol}`);
    console.log(`Period: ${this.config.period}, StdDev: ${this.config.stdDev}`);
  }

  async onBar(bar: Bar): Promise<void> {
    if (bar.symbol !== this.config.symbol) return;

    this.prices.push(bar.close);
    if (this.prices.length > this.config.period + 50) {
      this.prices = this.prices.slice(-(this.config.period + 50));
    }

    if (this.prices.length < this.config.period) return;

    const bands = this.calculateBollingerBands();
    if (!bands) return;

    const { upper, lower } = bands;
    const price = bar.close;

    // Buy when price touches or goes below lower band
    if (price <= lower && !this.position) {
      await this.enterLong(price);
    }
    // Sell when price touches or goes above upper band
    else if (price >= upper && this.position) {
      await this.exitLong(price, "signal");
    }
    // Check stop loss
    else if (this.position && bar.low <= this.position.stopLossPrice) {
      await this.exitLong(this.position.stopLossPrice, "stop_loss");
    }
  }

  async onTick?(tick: Quote): Promise<void> {
    if (this.position && tick.bid <= this.position.stopLossPrice) {
      await this.exitLong(this.position.stopLossPrice, "stop_loss");
    }
  }

  async onTrade?(trade: Trade): Promise<void> {
    console.log(`Trade: ${trade.side} ${trade.size} @ ${trade.price}`);
  }

  async onEnd(): Promise<void> {
    console.log(`Strategy ${this.name} ending`);
    if (this.position) {
      const lastPrice = this.prices[this.prices.length - 1];
      if (lastPrice) await this.exitLong(lastPrice, "end_of_test");
    }
  }

  private calculateBollingerBands(): { middle: number; upper: number; lower: number } | null {
    if (this.prices.length < this.config.period) return null;

    const recentPrices = this.prices.slice(-this.config.period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    const middle = sum / this.config.period;

    const squaredDiffs = recentPrices.map((p) => Math.pow(p - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.config.period;
    const stdDev = Math.sqrt(variance);

    return {
      middle,
      upper: middle + stdDev * this.config.stdDev,
      lower: middle - stdDev * this.config.stdDev,
    };
  }

  private async enterLong(price: number): Promise<void> {
    try {
      const stopLossPrice = price * (1 - this.config.stopLossPercent);
      const order: OrderRequest = {
        symbol: this.config.symbol,
        side: "buy",
        qty: this.config.qty,
        type: "market",
        timeInForce: "day",
      };
      const submitted = await this.adapter.submitOrder(order);
      if (submitted.status === "filled" || submitted.status === "open") {
        this.position = { entryPrice: price, qty: this.config.qty, stopLossPrice };
        console.log(
          `[${new Date().toISOString()}] ENTER LONG: ${this.config.symbol} @ ${price.toFixed(2)} (BB Lower Band)`,
        );
      }
    } catch (error) {
      console.error("Failed to enter:", error);
    }
  }

  private async exitLong(price: number, reason: string): Promise<void> {
    if (!this.position) return;
    try {
      const order: OrderRequest = {
        symbol: this.config.symbol,
        side: "sell",
        qty: this.position.qty,
        type: "market",
        timeInForce: "day",
      };
      await this.adapter.submitOrder(order);
      const pnl = (price - this.position.entryPrice) * this.position.qty;
      console.log(
        `[${new Date().toISOString()}] EXIT LONG: ${this.config.symbol} @ ${price.toFixed(2)} (Reason: ${reason}, P&L: $${pnl.toFixed(2)})`,
      );
      this.position = null;
    } catch (error) {
      console.error("Failed to exit:", error);
    }
  }
}
