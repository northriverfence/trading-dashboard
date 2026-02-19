/**
 * Web API Server
 * HTTP API for running backtests and managing trading operations
 */

import type { BacktestConfig, BacktestResult, Strategy } from "../backtesting/types.js";
import { BacktestEngine } from "../backtesting/backtest-engine.js";
import { HistoricalDataStore } from "../backtesting/historical-data-store.js";
import { AlpacaAdapter } from "../adapters/alpaca/alpaca-adapter.js";
import { RSIStrategy } from "../strategies/rsi-strategy.js";
import { BollingerBandsStrategy } from "../strategies/bollinger-bands-strategy.js";
import { MovingAverageCrossoverStrategy } from "../strategies/moving-average-crossover.js";

interface RunBacktestRequest {
  strategy: "rsi" | "bollinger" | "ma_crossover";
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  strategyConfig: Record<string, unknown>;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class TradingApiServer {
  private port: number;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private activeBacktests = new Map<string, BacktestEngine>();

  constructor(port = 3000) {
    this.port = port;
  }

  start(): void {
    this.server = Bun.serve({
      port: this.port,
      routes: {
        "/": () => {
          return new Response(
            JSON.stringify({
              name: "Stock Trading Agent API",
              version: "1.0.0",
              endpoints: [
                "GET  /health",
                "POST /api/backtest/run",
                "GET  /api/backtest/:id/status",
                "POST /api/backtest/:id/stop",
                "GET  /api/backtest/:id/results",
                "GET  /api/strategies",
              ],
            }),
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        },

        "/health": () => {
          return new Response(JSON.stringify({ status: "healthy", timestamp: new Date().toISOString() }), {
            headers: { "Content-Type": "application/json" },
          });
        },

        "/api/strategies": () => {
          const strategies = [
            {
              id: "rsi",
              name: "RSI Strategy",
              description: "Mean reversion using RSI oscillator",
              params: {
                period: { type: "number", default: 14, description: "RSI period" },
                overbought: { type: "number", default: 70, description: "Overbought threshold" },
                oversold: { type: "number", default: 30, description: "Oversold threshold" },
                qty: { type: "number", default: 100, description: "Order quantity" },
                stopLossPercent: { type: "number", default: 0.02, description: "Stop loss percentage" },
              },
            },
            {
              id: "bollinger",
              name: "Bollinger Bands Strategy",
              description: "Mean reversion using Bollinger Bands",
              params: {
                period: { type: "number", default: 20, description: "Moving average period" },
                stdDev: { type: "number", default: 2, description: "Standard deviation multiplier" },
                qty: { type: "number", default: 100, description: "Order quantity" },
                stopLossPercent: { type: "number", default: 0.02, description: "Stop loss percentage" },
              },
            },
            {
              id: "ma_crossover",
              name: "Moving Average Crossover",
              description: "Trend following using MA crossovers",
              params: {
                fastPeriod: { type: "number", default: 10, description: "Fast MA period" },
                slowPeriod: { type: "number", default: 30, description: "Slow MA period" },
                qty: { type: "number", default: 100, description: "Order quantity" },
                stopLossPercent: { type: "number", default: 0.02, description: "Stop loss percentage" },
              },
            },
          ];
          return new Response(JSON.stringify({ strategies }), {
            headers: { "Content-Type": "application/json" },
          });
        },

        "/api/backtest/run": {
          POST: async (req) => {
            try {
              const body = (await req.json()) as RunBacktestRequest;
              const result = await this.runBacktest(body);
              return new Response(JSON.stringify({ success: true, data: result }), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (error) {
              return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        },

        "/api/backtest/:id/status": (req) => {
          const id = req.params.id;
          const engine = this.activeBacktests.get(id);
          if (!engine) {
            return new Response(JSON.stringify({ success: false, error: "Backtest not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const progress = engine.getProgress();
          const state = engine.getState();
          return new Response(JSON.stringify({ success: true, data: { id, state, progress } }), {
            headers: { "Content-Type": "application/json" },
          });
        },

        "/api/backtest/:id/stop": {
          POST: (req) => {
            const id = req.params.id;
            const engine = this.activeBacktests.get(id);
            if (!engine) {
              return new Response(JSON.stringify({ success: false, error: "Backtest not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
              });
            }
            engine.stop();
            return new Response(JSON.stringify({ success: true, data: { message: "Backtest stopped" } }), {
              headers: { "Content-Type": "application/json" },
            });
          },
        },
      },

      // Fallback for unmatched routes
      fetch(req) {
        return new Response(JSON.stringify({ success: false, error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    console.log(`Trading API Server running at http://localhost:${this.port}`);
  }

  stop(): void {
    if (this.server) {
      this.server.stop();
      console.log("Trading API Server stopped");
    }
  }

  private async runBacktest(request: RunBacktestRequest): Promise<{ id: string; result?: BacktestResult }> {
    const id = `backtest_${Date.now()}`;

    // Create backtest configuration
    const config: BacktestConfig = {
      startDate: new Date(request.startDate),
      endDate: new Date(request.endDate),
      initialCapital: request.initialCapital,
      commission: 0.001,
      slippage: 0.001,
      fillModel: "immediate",
      dataSource: "files",
      replaySpeed: 0, // Unlimited speed for API
      warmupBars: 100,
    };

    // Validate symbols
    if (request.symbols.length === 0 || !request.symbols[0]) {
      throw new Error("At least one symbol is required");
    }

    // Create strategy
    const strategy = this.createStrategy(request.strategy, request.symbols[0], request.strategyConfig);

    // Create backtest engine
    const engine = new BacktestEngine(config);
    this.activeBacktests.set(id, engine);

    // Load data and run
    await engine.loadHistoricalData(request.symbols);
    const result = await engine.run(strategy);

    // Cleanup
    this.activeBacktests.delete(id);

    return { id, result };
  }

  private createStrategy(strategyId: string, symbol: string, config: Record<string, unknown>): Strategy {
    // Create a mock adapter for strategy initialization
    const mockAdapter = {
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
      getQuote: async () => ({
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
        nextClose: new Date(),
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
    } as unknown as import("../adapters/types.js").ExchangeAdapter;

    switch (strategyId) {
      case "rsi":
        return new RSIStrategy(mockAdapter, {
          period: (config.period as number) || 14,
          overbought: (config.overbought as number) || 70,
          oversold: (config.oversold as number) || 30,
          symbol,
          qty: (config.qty as number) || 100,
          stopLossPercent: (config.stopLossPercent as number) || 0.02,
        });
      case "bollinger":
        return new BollingerBandsStrategy(mockAdapter, {
          period: (config.period as number) || 20,
          stdDev: (config.stdDev as number) || 2,
          symbol,
          qty: (config.qty as number) || 100,
          stopLossPercent: (config.stopLossPercent as number) || 0.02,
        });
      case "ma_crossover":
        return new MovingAverageCrossoverStrategy(mockAdapter, {
          fastPeriod: (config.fastPeriod as number) || 10,
          slowPeriod: (config.slowPeriod as number) || 30,
          symbol,
          qty: (config.qty as number) || 100,
          stopLossPercent: (config.stopLossPercent as number) || 0.02,
        });
      default:
        throw new Error(`Unknown strategy: ${strategyId}`);
    }
  }
}

// CLI usage
if (import.meta.main) {
  const server = new TradingApiServer(parseInt(process.env.PORT || "3000"));
  server.start();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.stop();
    process.exit(0);
  });
}
