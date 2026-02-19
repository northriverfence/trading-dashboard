/**
 * RSI (Relative Strength Index) Strategy
 * Buy when RSI is oversold (< 30), sell when overbought (> 70)
 */

import type { Strategy } from "../backtesting/types.js";
import type { Bar, Quote, Trade, OrderRequest, ExchangeAdapter } from "../adapters/types.js";

export interface RSIConfig {
  period: number; // RSI period (default: 14)
  overbought: number; // Overbought threshold (default: 70)
  oversold: number; // Oversold threshold (default: 30)
  symbol: string;
  qty: number;
  stopLossPercent: number;
}

export class RSIStrategy implements Strategy {
  name = "RSI Strategy";
  description = "Mean reversion strategy using RSI oscillator";

  private adapter: ExchangeAdapter;
  private config: RSIConfig;
  private prices: number[] = [];
  private position: { entryPrice: number; qty: number; stopLossPrice: number } | null = null;

  constructor(adapter: ExchangeAdapter, config: RSIConfig) {
    this.adapter = adapter;
    this.config = config;
  }

  async onInit(): Promise<void> {
    console.log(`Initializing ${this.name} for ${this.config.symbol}`);
    console.log(
      `Period: ${this.config.period}, Overbought: ${this.config.overbought}, Oversold: ${this.config.oversold}`,
    );
  }

  async onBar(bar: Bar): Promise<void> {
    if (bar.symbol !== this.config.symbol) return;

    this.prices.push(bar.close);
    if (this.prices.length > this.config.period + 50) {
      this.prices = this.prices.slice(-(this.config.period + 50));
    }

    if (this.prices.length < this.config.period + 1) return;

    const rsi = this.calculateRSI();
    if (rsi === null) return;

    // Buy signal: RSI below oversold threshold
    if (rsi < this.config.oversold && !this.position) {
      await this.enterLong(bar.close);
    }
    // Sell signal: RSI above overbought threshold
    else if (rsi > this.config.overbought && this.position) {
      await this.exitLong(bar.close, "signal");
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

  private calculateRSI(): number | null {
    if (this.prices.length < this.config.period + 1) return null;

    const changes: number[] = [];
    const prices = this.prices;
    for (let i = 1; i < prices.length; i++) {
      const current = prices[i]!;
      const previous = prices[i - 1]!;
      changes.push(current - previous);
    }

    const recentChanges = changes.slice(-this.config.period);
    const gains = recentChanges.filter((c) => c > 0);
    const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / this.config.period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / this.config.period : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
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
          `[${new Date().toISOString()}] ENTER LONG: ${this.config.symbol} @ ${price.toFixed(2)} (RSI Oversold)`,
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
