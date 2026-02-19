/**
 * Moving Average Crossover Strategy
 * Example strategy demonstrating both live trading and backtesting support
 */

import type { Strategy } from "../backtesting/types.js";
import type { Bar, Quote, Trade, OrderRequest, ExchangeAdapter } from "../adapters/types.js";

export interface MovingAverageConfig {
  fastPeriod: number;  // Short-term MA period (e.g., 10)
  slowPeriod: number;  // Long-term MA period (e.g., 30)
  symbol: string;
  qty: number;         // Position size
  stopLossPercent: number; // Stop loss as percentage (e.g., 0.02 for 2%)
}

interface PositionState {
  entryPrice: number;
  qty: number;
  stopLossPrice: number;
}

export class MovingAverageCrossoverStrategy implements Strategy {
  name = "Moving Average Crossover";
  description = "Buy when fast MA crosses above slow MA, sell when it crosses below";

  private adapter: ExchangeAdapter;
  private config: MovingAverageConfig;
  private prices: number[] = [];
  private position: PositionState | null = null;
  private lastFastMA: number | null = null;
  private lastSlowMA: number | null = null;

  constructor(adapter: ExchangeAdapter, config: MovingAverageConfig) {
    this.adapter = adapter;
    this.config = config;
  }

  async onInit(): Promise<void> {
    console.log(`Initializing ${this.name} strategy for ${this.config.symbol}`);
    console.log(`Fast MA: ${this.config.fastPeriod}, Slow MA: ${this.config.slowPeriod}`);

    // Warmup - collect enough prices for both MAs
    const warmupBars = this.config.slowPeriod + 10;
    console.log(`Warming up with ${warmupBars} bars...`);

    // In live trading, we'd fetch historical bars here
    // For backtesting, the data is already loaded
  }

  async onBar(bar: Bar): Promise<void> {
    // Only process bars for our symbol
    if (bar.symbol !== this.config.symbol) return;

    // Add price to history
    this.prices.push(bar.close);

    // Keep only necessary history
    const maxHistory = this.config.slowPeriod + 50;
    if (this.prices.length > maxHistory) {
      this.prices = this.prices.slice(-maxHistory);
    }

    // Need enough data for slow MA
    if (this.prices.length < this.config.slowPeriod) {
      return;
    }

    // Calculate moving averages
    const fastMA = this.calculateSMA(this.config.fastPeriod);
    const slowMA = this.calculateSMA(this.config.slowPeriod);

    // Skip first calculation (no previous to compare)
    if (this.lastFastMA === null || this.lastSlowMA === null) {
      this.lastFastMA = fastMA;
      this.lastSlowMA = slowMA;
      return;
    }

    // Check for crossover
    const wasBelow = this.lastFastMA < this.lastSlowMA;
    const isAbove = fastMA > slowMA;
    const wasAbove = this.lastFastMA > this.lastSlowMA;
    const isBelow = fastMA < slowMA;

    // Golden Cross (Fast crosses above Slow) - BUY Signal
    if (wasBelow && isAbove && !this.position) {
      await this.enterLong(bar.close);
    }

    // Death Cross (Fast crosses below Slow) - SELL Signal
    else if (wasAbove && isBelow && this.position) {
      await this.exitLong(bar.close, "signal");
    }

    // Check stop loss if in position
    if (this.position) {
      if (bar.low <= this.position.stopLossPrice) {
        await this.exitLong(this.position.stopLossPrice, "stop_loss");
      }
    }

    // Update last values
    this.lastFastMA = fastMA;
    this.lastSlowMA = slowMA;
  }

  async onTick?(tick: Quote): Promise<void> {
    // Real-time price updates (for live trading)
    if (this.position && tick.bid <= this.position.stopLossPrice) {
      await this.exitLong(this.position.stopLossPrice, "stop_loss");
    }
  }

  async onTrade?(trade: Trade): Promise<void> {
    // Handle trade confirmations
    console.log(`Trade executed: ${trade.side} ${trade.size} @ ${trade.price}`);
  }

  async onEnd(): Promise<void> {
    console.log(`Strategy ${this.name} ending...`);

    // Close any open position at the end of backtest
    if (this.position) {
      const lastPrice = this.prices[this.prices.length - 1];
      if (lastPrice) {
        await this.exitLong(lastPrice, "end_of_test");
      }
    }

    // Print summary
    console.log(`\nStrategy Summary:`);
    console.log(`Total bars processed: ${this.prices.length}`);
    console.log(`Final position: ${this.position ? "LONG" : "FLAT"}`);
  }

  private calculateSMA(period: number): number {
    const relevantPrices = this.prices.slice(-period);
    const sum = relevantPrices.reduce((acc, price) => acc + price, 0);
    return sum / period;
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

      const submittedOrder = await this.adapter.submitOrder(order);

      if (submittedOrder.status === "filled" || submittedOrder.status === "open") {
        this.position = {
          entryPrice: price,
          qty: this.config.qty,
          stopLossPrice,
        };

        console.log(`[${new Date().toISOString()}] ENTER LONG: ${this.config.symbol} ${this.config.qty} @ ${price.toFixed(2)} (Stop: ${stopLossPrice.toFixed(2)})`);
      }
    } catch (error) {
      console.error(`Failed to enter long position:`, error);
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
      const pnlPercent = ((price - this.position.entryPrice) / this.position.entryPrice) * 100;

      console.log(`[${new Date().toISOString()}] EXIT LONG: ${this.config.symbol} ${this.position.qty} @ ${price.toFixed(2)} (Reason: ${reason}, P&L: $${pnl.toFixed(2)}, ${pnlPercent.toFixed(2)}%)`);

      this.position = null;
    } catch (error) {
      console.error(`Failed to exit long position:`, error);
    }
  }

  // Getters for monitoring
  getCurrentMAs(): { fast: number | null; slow: number | null } {
    return {
      fast: this.lastFastMA,
      slow: this.lastSlowMA,
    };
  }

  isInPosition(): boolean {
    return this.position !== null;
  }

  getPosition(): PositionState | null {
    return this.position;
  }
}

// Factory function for easy instantiation
export function createMACrossoverStrategy(
  adapter: ExchangeAdapter,
  symbol: string,
  options?: Partial<MovingAverageConfig>,
): MovingAverageCrossoverStrategy {
  const config: MovingAverageConfig = {
    fastPeriod: 10,
    slowPeriod: 30,
    symbol,
    qty: 100,
    stopLossPercent: 0.02,
    ...options,
  };

  return new MovingAverageCrossoverStrategy(adapter, config);
}
