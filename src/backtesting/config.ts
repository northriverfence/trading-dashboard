/**
 * Backtesting Configuration
 */

import type { BacktestConfig } from "./types.js";

export const defaultBacktestConfig: BacktestConfig = {
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  initialCapital: 10000,
  commission: 0.001,
  slippage: 0.001,
  fillModel: "next_bar",
  dataSource: "files",
  replaySpeed: 1.0,
  warmupBars: 50,
};

export function loadBacktestConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
  return {
    ...defaultBacktestConfig,
    ...overrides,
  };
}

export function validateBacktestConfig(config: BacktestConfig): string[] {
  const errors: string[] = [];

  if (config.startDate >= config.endDate) {
    errors.push("startDate must be before endDate");
  }

  if (config.initialCapital <= 0) {
    errors.push("initialCapital must be positive");
  }

  if (config.commission < 0) {
    errors.push("commission must be non-negative");
  }

  if (config.slippage < 0) {
    errors.push("slippage must be non-negative");
  }

  return errors;
}
