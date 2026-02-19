/**
 * Time Based Exit
 * Exit positions if not profitable within timeframe
 */

import { BaseStop } from "./base-stop.js";
import type { Position, StopLevel, RiskConfig } from "../types.js";

export class TimeBasedExit extends BaseStop {
  private entryTimes: Map<string, Date> = new Map();

  constructor(config: RiskConfig) {
    super(config);
  }

  calculateStop(position: Position): StopLevel {
    this.entryTimes.set(position.symbol, position.entryTime);

    const expiresAt = new Date(position.entryTime);
    expiresAt.setSeconds(expiresAt.getSeconds() + this.config.timeLimit);

    return {
      stopPrice: position.stopLoss ?? position.entryPrice * 0.98,
      stopType: "time",
      expiresAt,
    };
  }

  updateStop(position: Position): StopLevel | null {
    const entryTime = this.entryTimes.get(position.symbol);
    if (!entryTime) return null;

    const elapsed = Date.now() - entryTime.getTime();
    const isProfitable = position.currentPrice > position.entryPrice;

    if (elapsed > this.config.timeLimit * 1000 && !isProfitable) {
      // Time expired and not profitable - exit at market
      return {
        stopPrice: position.currentPrice * 0.999, // Market exit
        stopType: "time",
        expiresAt: new Date(),
      };
    }

    return null;
  }
}
