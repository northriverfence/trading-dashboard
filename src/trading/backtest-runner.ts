import { SimulationEngine } from "./simulation-engine.js";
import type { IStrategy, Signal } from "./strategy.js";
import type { Bar, Trade } from "../adapters/types.js";

interface BacktestConfig {
  initialCash: number;
}

interface BacktestOptions {
  strategy: IStrategy;
  bars: Bar[];
  symbol: string;
  startDate?: Date;
  endDate?: Date;
}

interface BacktestResult {
  trades: Trade[];
  metrics: {
    totalReturn: number;
    totalTrades: number;
    winRate: number;
  };
  equityCurve: { timestamp: Date; equity: number }[];
  barsProcessed: number;
}

export class BacktestRunner {
  private engine: SimulationEngine;

  constructor(config: BacktestConfig) {
    this.engine = new SimulationEngine({ initialCash: config.initialCash });
  }

  async run(options: BacktestOptions): Promise<BacktestResult> {
    // Load bars into engine
    this.engine.loadBars(options.symbol, options.bars);

    // Filter by date range
    const startTime = options.startDate?.getTime() ?? 0;
    const endTime = options.endDate?.getTime() ?? Infinity;
    const filteredBars = options.bars.filter(
      (bar) => bar.timestamp.getTime() >= startTime && bar.timestamp.getTime() <= endTime
    );

    // Initialize strategy
    options.strategy.initialize(filteredBars);

    const equityCurve: { timestamp: Date; equity: number }[] = [];
    const trades: Trade[] = [];

    // Process each bar
    for (const bar of filteredBars) {
      const signal = options.strategy.onBar(bar);
      if (signal && signal.action !== "hold") {
        // Execute signal via simulation engine
        // Create a mock trade from the signal
        const trade: Trade = {
          id: `bt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          orderId: `bt_order`,
          symbol: options.symbol,
          side: signal.action === "buy" ? "buy" : "sell",
          qty: signal.qty ?? 10,
          price: bar.close,
          timestamp: bar.timestamp,
        };
        trades.push(trade);
      }

      // Record equity at this point
      equityCurve.push({
        timestamp: bar.timestamp,
        equity: this.engine.getPortfolio().equity,
      });
    }

    const portfolio = this.engine.getPortfolio();
    const initialCash = 100000;

    return {
      trades,
      metrics: {
        totalReturn: ((portfolio.equity - initialCash) / initialCash) * 100,
        totalTrades: trades.length,
        winRate: 0,
      },
      equityCurve,
      barsProcessed: filteredBars.length,
    };
  }
}
