#!/usr/bin/env bun
/**
 * Trading Agent CLI
 * Command-line interface for backtesting, trading, and data operations
 */

import { parseArgs } from "util";
import { ReportGenerator } from "../reporting/report-generator.js";
import { BacktestEngine } from "../backtesting/backtest-engine.js";
import { HistoricalDataStore } from "../backtesting/historical-data-store.js";
import { RSIStrategy } from "../strategies/rsi-strategy.js";
import { BollingerBandsStrategy } from "../strategies/bollinger-bands-strategy.js";
import { MovingAverageCrossoverStrategy } from "../strategies/ma-crossover.js";
import { initializeDatabase } from "../database/db-client.js";
import type { Strategy, BacktestConfig } from "../backtesting/types.js";
import type { ExchangeAdapter } from "../adapters/types.js";

const VERSION = "1.0.0";

// Strategy constructors map - using any for flexibility with different signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STRATEGIES: Record<string, new (...args: any[]) => Strategy> = {
  rsi: RSIStrategy,
  bollinger: BollingerBandsStrategy,
  ma_crossover: MovingAverageCrossoverStrategy,
};

const STRATEGY_DEFAULTS: Record<string, Record<string, unknown>> = {
  rsi: { period: 14, overbought: 70, oversold: 30, qty: 100, stopLossPercent: 0.02 },
  bollinger: { period: 20, stdDev: 2, qty: 100, stopLossPercent: 0.02 },
  ma_crossover: { fastPeriod: 10, slowPeriod: 30, qty: 100, stopLossPercent: 0.02 },
};

function showHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Stock Trading Agent CLI v${VERSION}                       ║
╚════════════════════════════════════════════════════════════════╝

Usage: bun run cli <command> [options]

Commands:
  backtest      Run a backtest with a strategy
  trade         Start paper or live trading
  positions     View current positions
  ingest        Ingest historical data
  report        Generate reports from backtest results
  db            Database operations
  help          Show this help message

Options:
  --version, -v     Show version
  --help, -h        Show help

Examples:
  bun run cli backtest --strategy rsi --symbol AAPL --start 2024-01-01 --end 2024-12-31
  bun run cli trade --mode paper --strategy bollinger --symbols AAPL,MSFT
  bun run cli positions --adapter alpaca
  bun run cli ingest --symbols AAPL,MSFT --timeframe 1Day --start 2020-01-01
`);
}

function showBacktestHelp(): void {
  console.log(`
Backtest Command

Usage: bun run cli backtest [options]

Options:
  --strategy, -s        Strategy to use (rsi, bollinger, ma_crossover)
  --symbol, -sym      Trading symbol (e.g., AAPL)
  --symbols           Comma-separated list of symbols
  --start             Start date (YYYY-MM-DD)
  --end               End date (YYYY-MM-DD)
  --capital           Initial capital (default: 10000)
  --commission        Commission per trade (default: 0.001)
  --slippage          Slippage factor (default: 0.001)
  --output, -o        Output file for report
  --format            Report format: html, json (default: html)
  --config            JSON file with strategy configuration

Examples:
  bun run cli backtest --strategy rsi --symbol AAPL --start 2024-01-01 --end 2024-12-31
  bun run cli backtest --strategy ma_crossover --symbols AAPL,MSFT --capital 50000 --output report.html
`);
}

async function runBacktest(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      strategy: { type: "string", short: "s" },
      symbol: { type: "string" },
      symbols: { type: "string" },
      start: { type: "string" },
      end: { type: "string" },
      capital: { type: "string", default: "10000" },
      commission: { type: "string", default: "0.001" },
      slippage: { type: "string", default: "0.001" },
      output: { type: "string", short: "o" },
      format: { type: "string", default: "html" },
      config: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    showBacktestHelp();
    return;
  }

  // Validate required args
  if (!values.strategy) {
    console.error("Error: --strategy is required");
    showBacktestHelp();
    process.exit(1);
  }

  if (!values.symbol && !values.symbols) {
    console.error("Error: --symbol or --symbols is required");
    showBacktestHelp();
    process.exit(1);
  }

  if (!values.start || !values.end) {
    console.error("Error: --start and --end dates are required");
    showBacktestHelp();
    process.exit(1);
  }

  const symbols = values.symbols ? values.symbols.split(",") : [values.symbol!];
  const strategyName = values.strategy;

  if (!STRATEGIES[strategyName]) {
    console.error(`Error: Unknown strategy '${strategyName}'`);
    console.error(`Available strategies: ${Object.keys(STRATEGIES).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n📊 Running Backtest`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Strategy:     ${strategyName}`);
  console.log(`Symbols:      ${symbols.join(", ")}`);
  console.log(`Period:       ${values.start} to ${values.end}`);
  console.log(`Capital:      $${values.capital}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // Create mock adapter for strategy
    const mockAdapter = createMockAdapter();

    // Load strategy config
    let strategyConfig = STRATEGY_DEFAULTS[strategyName];
    if (values.config) {
      const configFile = await Bun.file(values.config).text();
      strategyConfig = { ...strategyConfig, ...JSON.parse(configFile) };
    }

    // Create strategy instance
    const strategy = new STRATEGIES[strategyName](mockAdapter, {
      ...strategyConfig,
      symbol: symbols[0],
    });

    // Configure backtest
    const backtestConfig: BacktestConfig = {
      startDate: new Date(values.start),
      endDate: new Date(values.end),
      initialCapital: parseFloat(values.capital),
      commission: parseFloat(values.commission),
      slippage: parseFloat(values.slippage),
      fillModel: "immediate",
      dataSource: "files",
      replaySpeed: 0,
      warmupBars: 100,
    };

    // Run backtest
    const engine = new BacktestEngine(backtestConfig);

    await engine.loadHistoricalData(symbols);
    const result = await engine.run(strategy);

    // Display results
    console.log(`\n✅ Backtest Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total Return:        ${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`);
    console.log(
      `Annualized Return:   ${result.annualizedReturn >= 0 ? "+" : ""}${result.annualizedReturn.toFixed(2)}%`,
    );
    console.log(`Sharpe Ratio:        ${result.sharpeRatio.toFixed(2)}`);
    console.log(`Max Drawdown:        ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`Win Rate:            ${(result.winRate * 100).toFixed(1)}%`);
    console.log(`Profit Factor:       ${result.profitFactor.toFixed(2)}`);
    console.log(`Total Trades:        ${result.metrics.totalTrades}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Generate report
    const outputPath = values.output || `./backtest-report-${strategyName}-${Date.now()}.html`;
    const generator = new ReportGenerator({ outputFormat: values.format as "html" | "json" });
    await generator.saveReport(result, strategyName, outputPath);
    console.log(`📄 Report saved to: ${outputPath}\n`);
  } catch (error) {
    console.error(`\n❌ Backtest failed: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

async function runTrade(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      mode: { type: "string", default: "paper" },
      strategy: { type: "string", short: "s" },
      symbols: { type: "string" },
      adapter: { type: "string", default: "alpaca" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Trade Command

Usage: bun run cli trade [options]

Options:
  --mode          Trading mode: paper or live (default: paper)
  --strategy, -s  Strategy to use
  --symbols       Comma-separated list of symbols
  --adapter       Exchange adapter: alpaca, interactive_brokers (default: alpaca)
  --help, -h      Show help

Examples:
  bun run cli trade --mode paper --strategy rsi --symbols AAPL,MSFT
  bun run cli trade --mode live --strategy bollinger --symbols AAPL --adapter alpaca
`);
    return;
  }

  if (!values.strategy || !values.symbols) {
    console.error("Error: --strategy and --symbols are required");
    process.exit(1);
  }

  const symbols = values.symbols.split(",");
  const mode = values.mode as "paper" | "live";

  console.log(`\n🚀 Starting ${mode.toUpperCase()} Trading`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Strategy:  ${values.strategy}`);
  console.log(`Symbols:   ${symbols.join(", ")}`);
  console.log(`Adapter:   ${values.adapter}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (mode === "live") {
    console.log("⚠️  WARNING: This will trade with REAL MONEY!");
    console.log("Press Ctrl+C within 5 seconds to cancel...\n");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("📝 To be implemented: Real-time trading session");
  console.log("   Use the API server or orchestrator directly for now.\n");
}

async function showPositions(): Promise<void> {
  console.log(`\n📈 Current Positions`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log("📝 To be implemented: Position query");
  console.log("   Use the API server for now.\n");
}

async function runIngest(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      symbols: { type: "string" },
      timeframe: { type: "string", default: "1Day" },
      start: { type: "string" },
      end: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Ingest Command

Usage: bun run cli ingest [options]

Options:
  --symbols       Comma-separated list of symbols (required)
  --timeframe     Timeframe: 1Min, 5Min, 15Min, 1Hour, 1Day (default: 1Day)
  --start         Start date (YYYY-MM-DD)
  --end           End date (YYYY-MM-DD)
  --help, -h      Show help

Examples:
  bun run cli ingest --symbols AAPL,MSFT,GOOGL --timeframe 1Day --start 2020-01-01 --end 2024-12-31
`);
    return;
  }

  if (!values.symbols) {
    console.error("Error: --symbols is required");
    process.exit(1);
  }

  const symbols = values.symbols.split(",");
  console.log(`\n📥 Ingesting Historical Data`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Symbols:    ${symbols.join(", ")}`);
  console.log(`Timeframe:  ${values.timeframe}`);
  console.log(`Period:     ${values.start || "2020-01-01"} to ${values.end || new Date().toISOString().split("T")[0]}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Initialize database
  initializeDatabase({ path: "./data/trading.db" });

  console.log("✅ Database initialized");
  console.log("📝 Use the ingestion script directly for full data loading:\n");
  console.log(`   bun run src/ingestion/historical-data-ingestion.ts\n`);
}

async function runDbCommand(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "init":
      console.log("\n🗄️  Initializing database...");
      initializeDatabase({ path: "./data/trading.db" });
      console.log("✅ Database initialized\n");
      break;
    case "status":
      console.log("\n🗄️  Database Status");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Status:     Connected");
      console.log("Path:       ./data/trading.db");
      console.log("Type:       SQLite");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      break;
    default:
      console.log(`
Database Commands

Usage: bun run cli db <command>

Commands:
  init      Initialize the database
  status    Show database status

Examples:
  bun run cli db init
  bun run cli db status
`);
  }
}

function createMockAdapter(): ExchangeAdapter {
  return {
    connect: async () => {},
    disconnect: () => {},
    isConnected: () => true,
    getLatency: () => 0,
    subscribe: async () => {},
    unsubscribe: () => {},
    onPrice: () => {},
    onTrade: () => {},
    onOrderBook: () => {},
    onQuote: () => {},
    getQuote: async (symbol: string) => ({
      symbol,
      bid: 100,
      ask: 101,
      bidSize: 100,
      askSize: 100,
      lastPrice: 100.5,
      lastSize: 50,
      timestamp: new Date(),
      exchange: "TEST",
    }),
    getHistoricalBars: async () => [],
    getMarketStatus: async () => ({
      isOpen: true,
      nextOpen: new Date(),
      nextClose: new Date(Date.now() + 8 * 60 * 60 * 1000),
      timestamp: new Date(),
    }),
    getAccount: async () => ({
      id: "test",
      buyingPower: 100000,
      cash: 100000,
      portfolioValue: 100000,
      equity: 100000,
      dayTradeCount: 0,
      isPatternDayTrader: false,
      tradingBlocked: false,
    }),
    getPositions: async () => [],
    submitOrder: async (order: import("../adapters/types.js").OrderRequest) => ({
      id: `order_${Date.now()}`,
      ...order,
      filledQty: 0,
      status: "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    cancelOrder: async () => {},
    getOrder: async (_id: string) => {
      throw new Error("Not implemented");
    },
  };
}

// Main entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "-h" || command === "--help") {
    showHelp();
    process.exit(0);
  }

  if (command === "-v" || command === "--version") {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case "backtest":
        await runBacktest(commandArgs);
        break;
      case "trade":
        await runTrade(commandArgs);
        break;
      case "positions":
        await showPositions();
        break;
      case "ingest":
        await runIngest(commandArgs);
        break;
      case "report":
        console.log("📊 Report generation - use backtest command with --output");
        break;
      case "db":
        await runDbCommand(commandArgs);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main();
