/**
 * Moving Average Crossover Strategy
 * Example strategy demonstrating buy/sell logic based on SMA crossover
 * Works with both live trading and backtesting
 */

import type { Bar, Quote, Trade, ExchangeAdapter, OrderRequest } from "../adapters/types.js";
import type { Strategy } from "../backtesting/types.js";

export interface MACrossoverParams {
  fastPeriod: number;    // Fast moving average period (default: 10)
  slowPeriod: number;    // Slow moving average period (default: 30)
  symbol: string;        // Trading symbol
  qty: number;          // Position size
  stopLossPercent: number;  // Stop loss percentage (default: 2%)
  takeProfitPercent: number; // Take profit percentage (default: 6%)
}

export class MovingAverageCrossoverStrategy implements Strategy {
  name = "MA Crossover Strategy";
  description = "Simple moving average crossover strategy with risk management";

  private params: MACrossoverParams;
  private adapter?: ExchangeAdapter;

  // State
  private prices: number[] = [];
  private position: "long" | "short" | "none" = "none";
  private entryPrice: number = 0;
  private orderId?: string;

  // Calculated values
  private fastMA: number = 0;
  private slowMA: number = 0;

  constructor(params: Partial<MACrossoverParams> = {}) {
    this.params = {
      fastPeriod: 10,
      slowPeriod: 30,
      symbol: "AAPL",
      qty: 100,
      stopLossPercent: 2,
      takeProfitPercent: 6,
      ...params,
    };

    if (this.params.fastPeriod >= this.params.slowPeriod) {
      throw new Error("Fast period must be less than slow period");
    }
  }

  setAdapter(adapter: ExchangeAdapter): void {
    this.adapter = adapter;
  }

  async onInit(): Promise<void> {
    console.log(`Initializing ${this.name} for ${this.params.symbol}`);
    console.log(`Fast MA: ${this.params.fastPeriod}, Slow MA: ${this.params.slowPeriod}`);
    this.prices = [];
    this.position = "none";
  }

  async onBar(bar: Bar): Promise<void> {
    // Only process bars for our symbol
    if (bar.symbol !== this.params.symbol) return;

    // Add new price
    this.prices.push(bar.close);

    // Keep only necessary history
    const maxHistory = this.params.slowPeriod + 10;
    if (this.prices.length > maxHistory) {
      this.prices = this.prices.slice(-maxHistory);
    }

    // Wait for enough data
    if (this.prices.length < this.params.slowPeriod) {
      console.log(`Collecting data: ${this.prices.length}/${this.params.slowPeriod} bars`);
      return;
    }

    // Calculate moving averages
    this.calculateMAs();

    // Check for crossover signals
    const signal = this.checkSignal();

    // Execute trades based on signal
    await this.executeSignal(signal, bar.close);

    // Check stop loss / take profit
    await this.checkRiskManagement(bar.close);
  }

  async onTick(tick: Quote): Promise<void> {
    // Real-time price updates for risk management
    if (this.position !== "none" && tick.symbol === this.params.symbol) {
      await this.checkRiskManagement(tick.lastPrice);
    }
  }

  async onTrade(trade: Trade): Promise<void> {
    // Log trade events
    console.log(`Trade executed: ${trade.side} ${trade.size} @ ${trade.price}`);
  }

  async onEnd(): Promise<void> {
    console.log(`Strategy ${this.name} ended`);
    console.log(`Final position: ${this.position}`);

    // Close any open positions
    if (this.position !== "none" && this.adapter) {
      await this.closePosition("end_of_test");
    }
  }

  private calculateMAs(): void {
    this.fastMA = this.calculateSMA(this.params.fastPeriod);
    this.slowMA = this.calculateSMA(this.params.slowPeriod);
  }

  private calculateSMA(period: number): number {
    const recent = this.prices.slice(-period);
    const sum = recent.reduce((a, b) => a + b, 0);
    return sum / recent.length;
  }

  private checkSignal(): "buy" | "sell" | "hold" {
    // Need at least 2 data points to detect crossover
    if (this.prices.length < this.params.slowPeriod + 1) return "hold";

    const prevFastMA = this.calculateSMA(this.params.fastPeriod - 1);
    const prevSlowMA = this.calculateSMA(this.params.slowPeriod - 1);

    const wasBelow = prevFastMA < prevSlowMA;
    const isAbove = this.fastMA > this.slowMA;
    const wasAbove = prevFastMA > prevSlowMA;
    const isBelow = this.fastMA < this.slowMA;

    // Golden cross: fast crosses above slow
    if (wasBelow && isAbove) {
      console.log(`Golden cross detected! Fast MA: ${this.fastMA.toFixed(2)}, Slow MA: ${this.slowMA.toFixed(2)}`);
      return "buy";
    }

    // Death cross: fast crosses below slow
    if (wasAbove && isBelow) {
      console.log(`Death cross detected! Fast MA: ${this.fastMA.toFixed(2)}, Slow MA: ${this.slowMA.toFixed(2)}`);
      return "sell";
    }

    return "hold";
  }

  private async executeSignal(signal: "buy" | "sell" | "hold", price: number): Promise<void> {
    if (!this.adapter) return;

    if (signal === "buy" && this.position !== "long") {
      // Close short if exists
      if (this.position === "short") {
        await this.closePosition("signal");
      }

      // Open long position
      await this.openLong();
    } else if (signal === "sell" && this.position !== "short") {
      // Close long if exists
      if (this.position === "long") {
        await this.closePosition("signal");
      }

      // Open short position (optional - for this example, we'll just go to cash)
      // await this.openShort();
    }
  }

  private async openLong(): Promise<void> {
    if (!this.adapter) return;

    const order: OrderRequest = {
      symbol: this.params.symbol,
      side: "buy",
      qty: this.params.qty,
      type: "market",
      timeInForce: "day",
    };

    try {
      const result = await this.adapter.submitOrder(order);
      this.position = "long";
      this.orderId = result.id;
      console.log(`Opened long position: ${result.id}`);
    } catch (error) {
      console.error(`Failed to open long position:`, error);
    }
  }

  private async closePosition(reason: string): Promise<void> {
    if (!this.adapter || !this.orderId) return;

    const side = this.position === "long" ? "sell" : "buy";

    const order: OrderRequest = {
      symbol: this.params.symbol,
      side,
      qty: this.params.qty,
      type: "market",
      timeInForce: "day",
    };

    try {
      const result = await this.adapter.submitOrder(order);
      console.log(`Closed ${this.position} position (${reason}): ${result.id}`);
      this.position = "none";
      this.orderId = undefined;
    } catch (error) {
      console.error(`Failed to close position:`, error);
    }
  }

  private async checkRiskManagement(currentPrice: number): Promise<void> {
    if (this.position === "none" || !this.orderId) return;

    // Get position info
    try {
      if (!this.adapter) return;
      const positions = await this.adapter.getPositions();
      const position = positions.find((p) => p.symbol === this.params.symbol);

      if (!position) return;

      const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

      // Check stop loss
      if (pnlPercent <= -this.params.stopLossPercent) {
        console.log(`Stop loss triggered at ${pnlPercent.toFixed(2)}%`);
        await this.closePosition("stop_loss");
        return;
      }

      // Check take profit
      if (pnlPercent >= this.params.takeProfitPercent) {
        console.log(`Take profit triggered at ${pnlPercent.toFixed(2)}%`);
        await this.closePosition("take_profit");
        return;
      }
    } catch (error) {
      console.error("Risk management check failed:", error);
    }
  }

  // Getters for monitoring
  getFastMA(): number {
    return this.fastMA;
  }

  getSlowMA(): number {
    return this.slowMA;
  }

  getPosition(): string {
    return this.position;
  }

  getParams(): MACrossoverParams {
    return { ...this.params };
  }
}

export default MovingAverageCrossoverStrategy;
