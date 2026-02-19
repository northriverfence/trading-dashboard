/**
 * Historical Data Ingestion Script
 * Fetches historical data from Alpaca and stores in PostgreSQL
 */

import { AlpacaAdapter } from "../adapters/alpaca/alpaca-adapter.js";
import type { AlpacaConfig } from "../adapters/types.js";

interface IngestionConfig {
  symbols: string[];
  startDate: Date;
  endDate: Date;
  timeframe: string;
  batchSize: number;
}

interface IngestionProgress {
  symbol: string;
  totalBars: number;
  processedBars: number;
  currentDate: Date;
  percentComplete: number;
}

export class HistoricalDataIngestion {
  private adapter: AlpacaAdapter;
  private config: IngestionConfig;

  constructor(alpacaConfig: AlpacaConfig, ingestionConfig: IngestionConfig) {
    this.adapter = new AlpacaAdapter(alpacaConfig);
    this.config = ingestionConfig;
  }

  async run(): Promise<void> {
    console.log("Starting historical data ingestion...");
    console.log(`Symbols: ${this.config.symbols.join(", ")}`);
    console.log(`Date Range: ${this.config.startDate.toISOString()} to ${this.config.endDate.toISOString()}`);
    console.log(`Timeframe: ${this.config.timeframe}`);

    await this.adapter.connect();

    for (const symbol of this.config.symbols) {
      await this.ingestSymbol(symbol);
    }

    this.adapter.disconnect();
    console.log("Ingestion complete!");
  }

  private async ingestSymbol(symbol: string): Promise<void> {
    console.log(`\nIngesting ${symbol}...`);

    try {
      // Fetch historical bars from Alpaca
      const bars = await this.adapter.getHistoricalBars(
        symbol,
        this.config.timeframe,
        this.config.batchSize
      );

      // Filter bars within date range
      const filteredBars = bars.filter(bar =>
        bar.timestamp >= this.config.startDate &&
        bar.timestamp <= this.config.endDate
      );

      console.log(`  Fetched ${filteredBars.length} bars for ${symbol}`);

      // Store in database (placeholder - would use actual DB client)
      for (const bar of filteredBars) {
        await this.storeBar(bar);
      }

      console.log(`  Stored ${filteredBars.length} bars for ${symbol}`);
    } catch (error) {
      console.error(`  Error ingesting ${symbol}:`, error);
    }
  }

  private async storeBar(bar: { symbol: string; timestamp: Date; open: number; high: number; low: number; close: number; volume: number }): Promise<void> {
    // In a real implementation, this would insert into PostgreSQL
    // Example SQL:
    // INSERT INTO market_data.bars (symbol, timestamp, timeframe, open, high, low, close, volume)
    // VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    // ON CONFLICT (symbol, timestamp, timeframe) DO NOTHING

    // Placeholder - simulate async storage
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  async getProgress(): Promise<IngestionProgress[]> {
    // Return current ingestion progress
    return [];
  }
}

// CLI usage
if (import.meta.main) {
  const alpacaConfig: AlpacaConfig = {
    apiKey: process.env.ALPACA_API_KEY || "",
    secretKey: process.env.ALPACA_SECRET_KEY || "",
    paper: true,
    restUrl: "https://paper-api.alpaca.markets",
    websocketUrl: "wss://stream.data.alpaca.markets/v2/iex",
  };

  const ingestionConfig: IngestionConfig = {
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"],
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    timeframe: "1Day",
    batchSize: 1000,
  };

  const ingestion = new HistoricalDataIngestion(alpacaConfig, ingestionConfig);
  ingestion.run().catch(console.error);
}
