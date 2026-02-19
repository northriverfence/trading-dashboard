/**
 * Adapter Factory
 * Creates exchange adapters based on configuration
 */

import type { ExchangeAdapter, ExchangeAdapterConfig, AlpacaConfig, HistoricalConfig } from "./types.js";
import { AlpacaAdapter } from "./alpaca/alpaca-adapter.js";

export class AdapterFactory {
  private config: ExchangeAdapterConfig;

  constructor(config: ExchangeAdapterConfig) {
    this.config = config;
  }

  create(name: string): ExchangeAdapter {
    const adapterConfig = this.config.adapters[name as keyof typeof this.config.adapters];
    if (!adapterConfig) {
      throw new Error(`Unknown adapter: ${name}`);
    }

    switch (name) {
      case "alpaca":
        return this.createAlpacaAdapter(adapterConfig as AlpacaConfig);
      case "historical":
        return this.createHistoricalAdapter(adapterConfig as HistoricalConfig);
      default:
        throw new Error(`Adapter "${name}" not yet implemented`);
    }
  }

  createDefault(): ExchangeAdapter {
    return this.create(this.config.default);
  }

  private createAlpacaAdapter(config: AlpacaConfig): ExchangeAdapter {
    return new AlpacaAdapter(config);
  }

  private createHistoricalAdapter(config: HistoricalConfig): ExchangeAdapter {
    // Historical adapter will be implemented in backtesting module
    throw new Error("Historical adapter not yet implemented");
  }
}
