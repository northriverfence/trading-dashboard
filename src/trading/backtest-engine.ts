import { TradingEngine } from "./trading-engine.js";
import type { Strategy, Signal, StrategyContext } from "./strategy.js";
import type { Bar, Trade, Order, Portfolio } from "./types.js";

interface BacktestConfig {
    initialCash: number;
    symbols: string[];
    startDate: Date;
    endDate: Date;
    commission?: number; // per trade
}

interface BacktestResults {
    initialCash: number;
    finalEquity: number;
    totalReturn: number;
    totalReturnPercent: number;
    trades: Trade[];
    equityCurve: { timestamp: Date; equity: number }[];
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
}

export class BacktestEngine {
    private config: BacktestConfig;
    private tradingEngine: TradingEngine;
    private historicalData: Map<string, Bar[]> = new Map();
    private equityCurve: { timestamp: Date; equity: number }[] = [];

    constructor(config: BacktestConfig) {
        this.config = {
            commission: 0,
            ...config,
        };
        this.tradingEngine = new TradingEngine({ initialCash: config.initialCash });
    }

    async run(strategy: Strategy, historicalData: Record<string, Bar[]>): Promise<BacktestResults> {
        // Store historical data
        for (const [symbol, bars] of Object.entries(historicalData)) {
            this.historicalData.set(symbol, bars);
        }

        // Sort all bars by timestamp
        const allBars: (Bar & { symbol: string })[] = [];
        for (const [symbol, bars] of this.historicalData) {
            for (const bar of bars) {
                allBars.push({ ...bar, symbol });
            }
        }
        allBars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Initialize strategy
        strategy.onInit?.();

        // Process each bar
        for (const bar of allBars) {
            await this.processBar(bar, strategy, bar.symbol);
        }

        // Complete strategy
        strategy.onComplete?.();

        // Calculate results
        return this.calculateResults();
    }

    private async processBar(bar: Bar & { symbol: string }, strategy: Strategy, symbol: string): Promise<void> {
        // Update market prices
        this.tradingEngine.updateMarketPrices({ [symbol]: bar.close });

        // Set quote override for deterministic backtesting
        this.tradingEngine.setQuoteOverride(symbol, {
            symbol,
            bid: bar.close,
            ask: bar.close,
            lastPrice: bar.close,
            volume: bar.volume,
            timestamp: bar.timestamp,
        });

        // Build strategy context
        const context: StrategyContext = {
            portfolio: this.tradingEngine.getPortfolio(),
            getBars: (sym: string, lookback: number) => {
                const bars = this.historicalData.get(sym) || [];
                const currentIndex = bars.findIndex((b) => b.timestamp.getTime() === bar.timestamp.getTime());
                if (currentIndex < 0) return [];
                return bars.slice(Math.max(0, currentIndex - lookback), currentIndex);
            },
            currentTime: bar.timestamp,
        };

        // Get signal from strategy
        const signal = strategy.onBar(bar, context);

        // Execute signal
        if (signal) {
            await this.executeSignal(signal);
        }

        // Record equity
        const portfolio = this.tradingEngine.getPortfolio();
        this.equityCurve.push({
            timestamp: bar.timestamp,
            equity: portfolio.equity,
        });
    }

    private async executeSignal(signal: Signal): Promise<void> {
        const order: Omit<Order, "id" | "status" | "createdAt"> = {
            symbol: signal.symbol,
            side: signal.action === "buy" ? "buy" : "sell",
            qty: signal.qty,
            type: signal.limitPrice ? "limit" : "market",
            limitPrice: signal.limitPrice,
            timeInForce: "day",
        };

        try {
            await this.tradingEngine.submitOrder(order);
        } catch (error) {
            // Order failed (e.g., insufficient funds)
            console.warn(`Order failed: ${error}`);
        }
    }

    private calculateResults(): BacktestResults {
        const portfolio = this.tradingEngine.getPortfolio();
        const initialCash = this.config.initialCash;
        const finalEquity = portfolio.equity;
        const totalReturnDollar = finalEquity - initialCash;
        const totalReturnPercent = (totalReturnDollar / initialCash) * 100;

        // Build trades from filled orders
        const orders = this.tradingEngine.getAllOrders();
        const trades: Trade[] = [];
        for (const order of orders) {
            if (order.status === "filled" && order.avgPrice) {
                trades.push({
                    id: `tr_${order.id}`,
                    orderId: order.id,
                    symbol: order.symbol,
                    side: order.side,
                    qty: order.filledQty || order.qty,
                    price: order.avgPrice,
                    timestamp: order.updatedAt || order.createdAt,
                });
            }
        }

        return {
            initialCash,
            finalEquity,
            totalReturn: totalReturnPercent,
            totalReturnPercent,
            trades,
            equityCurve: this.equityCurve,
        };
    }
}
