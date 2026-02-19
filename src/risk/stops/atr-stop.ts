/**
 * ATR Stop
 * Stop distance based on Average True Range
 */

import { BaseStop } from "./base-stop.js";
import type { Position, StopLevel, RiskConfig } from "../types.js";

export class ATRStop extends BaseStop {
  private atr: number;

  constructor(config: RiskConfig, atr: number) {
    super(config);
    this.atr = atr;
  }

  calculateStop(position: Position): StopLevel {
    const multiplier = this.config.atrMultiplier;
    const stopDistance = this.atr * multiplier;

    const stopPrice = position.entryPrice - stopDistance;

    return {
      stopPrice,
      stopType: "atr",
    };
  }

  updateStop(): null {
    // ATR stops are fixed once set
    return null;
  }
}
