/**
 * Trailing Stop Engine
 * Dynamic stop-loss that follows price movement
 */

import { BaseStop } from "./base-stop.js";
import type { Position, StopLevel } from "../types.js";

export class TrailingStopEngine extends BaseStop {
  private highestPrice: Map<string, number> = new Map();
  private activated: Map<string, boolean> = new Map();

  calculateStop(position: Position, currentPrice: number): StopLevel {
    const activationLevel = position.entryPrice * this.config.trailingActivation;
    const isActivated = currentPrice >= activationLevel;

    this.activated.set(position.symbol, isActivated);

    if (isActivated) {
      this.highestPrice.set(position.symbol, currentPrice);

      // Trailing distance: 2% below highest
      const trailPercent = 0.02;
      const stopPrice = currentPrice * (1 - trailPercent);

      return {
        stopPrice,
        stopType: "trailing",
        activationPrice: activationLevel,
      };
    }

    // Before activation, use fixed stop
    return {
      stopPrice: position.stopLoss ?? position.entryPrice * 0.98,
      stopType: "fixed",
      activationPrice: activationLevel,
    };
  }

  updateStop(position: Position, currentPrice: number): StopLevel | null {
    if (!this.activated.get(position.symbol)) {
      return this.calculateStop(position, currentPrice);
    }

    const prevHigh = this.highestPrice.get(position.symbol) ?? currentPrice;

    if (currentPrice > prevHigh) {
      this.highestPrice.set(position.symbol, currentPrice);

      // Move stop up
      const trailPercent = 0.02;
      const newStop = currentPrice * (1 - trailPercent);

      return {
        stopPrice: newStop,
        stopType: "trailing",
        activationPrice: position.entryPrice * this.config.trailingActivation,
      };
    }

    return null; // No update needed
  }
}
