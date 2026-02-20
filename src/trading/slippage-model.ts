// src/trading/slippage-model.ts

import type { OrderSide } from "./types.js";

/**
 * Configuration for slippage calculation
 */
export interface SlippageConfig {
  /** Base slippage as a decimal (e.g., 0.001 = 0.1%) */
  baseSlippage: number;
  /** Impact factor for volume participation rate (e.g., 0.01) */
  impactFactor: number;
}

/**
 * Volume-based slippage model for realistic execution price simulation.
 *
 * Uses a square root model to calculate price impact based on order size
 * relative to market volume. Larger orders relative to volume result in
 * higher slippage.
 *
 * Formula: slippage = baseSlippage + impactFactor * sqrt(orderSize / volume)
 */
export class SlippageModel {
  private config: SlippageConfig;

  constructor(config: SlippageConfig) {
    this.config = config;
  }

  /**
   * Calculate the slippage percentage for an order.
   *
   * @param orderSize - The size of the order (number of shares/contracts)
   * @param volume - The market volume (e.g., daily volume)
   * @returns The slippage as a decimal (e.g., 0.002 = 0.2%)
   */
  calculateSlippage(orderSize: number, volume: number): number {
    // Handle edge case: zero or negative volume
    if (volume <= 0) {
      // When volume is unknown or zero, use a fallback with maximum reasonable slippage
      // This represents uncertainty in the market
      return this.config.baseSlippage + this.config.impactFactor;
    }

    // Handle edge case: zero or negative order size
    if (orderSize <= 0) {
      return this.config.baseSlippage;
    }

    // Calculate volume participation rate
    const participationRate = orderSize / volume;

    // Apply square root model for non-linear impact
    // Higher participation rates have diminishing marginal impact
    const volumeImpact = this.config.impactFactor * Math.sqrt(participationRate);

    // Total slippage is base + volume impact
    const slippage = this.config.baseSlippage + volumeImpact;

    return slippage;
  }

  /**
   * Calculate the execution price for an order including slippage.
   *
   * @param side - The order side ("buy" or "sell")
   * @param price - The market price (e.g., mid price or last price)
   * @param orderSize - The size of the order
   * @param volume - The market volume
   * @returns The adjusted execution price with slippage applied
   */
  calculateExecutionPrice(
    side: OrderSide,
    price: number,
    orderSize: number,
    volume: number
  ): number {
    // Handle edge case: invalid price
    if (price <= 0) {
      return 0;
    }

    const slippage = this.calculateSlippage(orderSize, volume);

    if (side === "buy") {
      // Buy orders get higher price (positive slippage)
      return price * (1 + slippage);
    } else {
      // Sell orders get lower price (negative slippage)
      return price * (1 - slippage);
    }
  }

  /**
   * Get the current configuration.
   *
   * @returns A copy of the slippage configuration
   */
  getConfig(): SlippageConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration.
   *
   * @param config - New configuration values (partial update supported)
   */
  updateConfig(config: Partial<SlippageConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}
