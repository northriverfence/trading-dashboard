import { TradingEngine } from "./trading-engine.js";
import type { Bar, Trade } from "../adapters/types.js";

interface SimulationContext {
    symbol: string;
    currentBar: Bar;
    currentBarIndex: number;
    totalBars: number;
    portfolio: {
        cash: number;
        equity: number;
        positions: { symbol: string; qty: number }[];
    };
    buy: (qty: number) => void;
    sell: (qty: number) => void;
}

interface SimulationConfig {
    symbol: string;
    startDate?: Date;
    endDate?: Date;
    strategy: (context: SimulationContext) => void;
}

interface SimulationResult {
    trades: Trade[];
    finalEquity: number;
    finalCash: number;
    metrics: {
        totalReturn: number;
        totalTrades: number;
        winRate: number;
        avgWin: number;
        avgLoss: number;
        maxDrawdown: number;
    };
}

export class SimulationEngine extends TradingEngine {
    private bars: Map<string, Bar[]> = new Map();
    private simulationTrades: Trade[] = [];

    constructor(config: { initialCash: number }) {
        super(config);
    }

    loadBars(symbol: string, bars: Bar[]): void {
        this.bars.set(symbol, bars);
    }

    getBars(symbol: string): Bar[] {
        return this.bars.get(symbol) ?? [];
    }

    async runFastSimulation(config: SimulationConfig): Promise<SimulationResult> {
        const symbolBars = this.bars.get(config.symbol);
        if (!symbolBars || symbolBars.length === 0) {
            throw new Error(`No bars loaded for symbol: ${config.symbol}`);
        }

        // Filter by date range
        const startTime = config.startDate?.getTime() ?? 0;
        const endTime = config.endDate?.getTime() ?? Infinity;
        const filteredBars = symbolBars.filter(
            (bar) => bar.timestamp.getTime() >= startTime && bar.timestamp.getTime() <= endTime
        );

        this.simulationTrades = [];

        for (let i = 0; i < filteredBars.length; i++) {
            const bar = filteredBars[i];
            const context = this.createContext(config.symbol, bar, i, filteredBars.length);
            config.strategy(context);
        }

        const portfolio = this.getPortfolio();

        return {
            trades: this.simulationTrades,
            finalEquity: portfolio.equity,
            finalCash: portfolio.cash,
            metrics: this.calculateMetrics(),
        };
    }

    private createContext(symbol: string, bar: Bar, index: number, total: number): SimulationContext {
        return {
            symbol,
            currentBar: bar,
            currentBarIndex: index,
            totalBars: total,
            portfolio: {
                cash: this.getPortfolio().cash,
                equity: this.getPortfolio().equity,
                positions: this.getPortfolio().positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
            },
            buy: (qty: number) => this.executeBuy(symbol, bar.close, qty, bar.timestamp),
            sell: (qty: number) => this.executeSell(symbol, bar.close, qty, bar.timestamp),
        };
    }

    private executeBuy(symbol: string, price: number, qty: number, timestamp: Date): void {
        const trade: Trade = {
            id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            orderId: `sim_order`,
            symbol,
            side: "buy",
            qty,
            price,
            timestamp,
        };
        this.simulationTrades.push(trade);
        // Access protected portfolioTracker via bracket notation
        (this as unknown as { portfolioTracker: { processTrade: (trade: Trade) => void } }).portfolioTracker.processTrade(trade);
    }

    private executeSell(symbol: string, price: number, qty: number, timestamp: Date): void {
        const trade: Trade = {
            id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            orderId: `sim_order`,
            symbol,
            side: "sell",
            qty,
            price,
            timestamp,
        };
        this.simulationTrades.push(trade);
        // Access protected portfolioTracker via bracket notation
        (this as unknown as { portfolioTracker: { processTrade: (trade: Trade) => void } }).portfolioTracker.processTrade(trade);
    }

    private calculateMetrics() {
        const initialCash = 100000;
        const finalEquity = this.getPortfolio().equity;
        const totalReturn = ((finalEquity - initialCash) / initialCash) * 100;

        return {
            totalReturn,
            totalTrades: this.simulationTrades.length,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            maxDrawdown: 0,
        };
    }
}
