/**
 * Volatility Based Stop
 * Wider stops in volatile conditions, tighter in calm markets
 */

import { BaseStop } from "./base-stop.js";
import type { Position, StopLevel, RiskConfig } from "../types.js";

export class VolatilityBasedStop extends BaseStop {
  private volatility: number; // e.g., 0.20 for 20%

  constructor(config: RiskConfig, volatility: number) {
    super(config);
    this.volatility = volatility;
  }

  calculateStop(position: Position): StopLevel {
    // Base stop at 2%
    const baseStop = 0.02;

    // Adjust for volatility (higher vol = wider stop)
    const adjustedStop = baseStop * (1 + this.volatility);

    const stopPrice = position.entryPrice * (1 - adjustedStop);

    return {
      stopPrice,
      stopType: "volatility",
    };
  }

  updateStop(): null {
    // Volatility stops are fixed once set
    return null;
  }
}
