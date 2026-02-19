/**
 * Base Stop Manager
 * Abstract class for stop-loss implementations
 */

import type { Position, StopLevel, RiskConfig } from "../types.js";

export abstract class BaseStop {
  protected config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  abstract calculateStop(position: Position, currentPrice: number): StopLevel;
  abstract updateStop(position: Position, currentPrice: number): StopLevel | null;
}
