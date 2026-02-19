/**
 * Exchange Adapter Configuration
 */

import type { ExchangeAdapterConfig, AlpacaConfig, IBConfig, HistoricalConfig } from "./types.js";

export type { ExchangeAdapterConfig, AlpacaConfig, IBConfig, HistoricalConfig };

export const defaultExchangeConfig: ExchangeAdapterConfig = {
  default: "alpaca",
  adapters: {
    alpaca: {
      apiKey: process.env.ALPACA_API_KEY || "",
      secretKey: process.env.ALPACA_SECRET_KEY || "",
      paper: true,
      restUrl: "https://paper-api.alpaca.markets",
      websocketUrl: "wss://stream.data.alpaca.markets/v2/iex",
    },
    interactive_brokers: {
      host: "127.0.0.1",
      port: 7497,
      clientId: 1,
    },
    historical: {
      dataPath: "./data/historical",
      replaySpeed: 1.0,
    },
  },
};

export function loadExchangeConfig(overrides?: Partial<ExchangeAdapterConfig>): ExchangeAdapterConfig {
  return {
    ...defaultExchangeConfig,
    ...overrides,
  };
}

export function validateExchangeConfig(config: ExchangeAdapterConfig): string[] {
  const errors: string[] = [];

  if (!config.default) {
    errors.push("default exchange must be specified");
  }

  if (config.default && !config.adapters[config.default as keyof typeof config.adapters]) {
    errors.push(`default adapter "${config.default}" not found in adapters`);
  }

  if (config.adapters.alpaca) {
    if (!config.adapters.alpaca.apiKey) errors.push("alpaca.apiKey is required");
    if (!config.adapters.alpaca.secretKey) errors.push("alpaca.secretKey is required");
  }

  return errors;
}
