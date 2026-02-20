import type { Strategy, StrategyContext, Signal } from "../strategy.js";
import type { Bar } from "../types.js";

interface SMACrossoverParams {
    fastPeriod: number;
    slowPeriod: number;
    qty: number;
}

export class SMACrossoverStrategy implements Strategy {
    name = "SMACrossover";
    private params: SMACrossoverParams;
    private inPosition = false;

    constructor(params: SMACrossoverParams) {
        this.params = params;
    }

    onBar(bar: Bar, context: StrategyContext): Signal | null {
        const symbol = (bar as Bar & { symbol?: string }).symbol || "UNKNOWN";
        const fastSMA = this.calculateSMA(context, this.params.fastPeriod);
        const slowSMA = this.calculateSMA(context, this.params.slowPeriod);

        if (fastSMA && slowSMA && fastSMA > slowSMA && !this.inPosition) {
            this.inPosition = true;
            return {
                action: "buy",
                symbol,
                qty: this.params.qty,
                confidence: 0.8,
            };
        }

        if (fastSMA && slowSMA && fastSMA < slowSMA && this.inPosition) {
            this.inPosition = false;
            return {
                action: "sell",
                symbol,
                qty: this.params.qty,
                confidence: 0.8,
            };
        }

        return null;
    }

    private calculateSMA(context: StrategyContext, period: number): number | null {
        const bars = context.getBars("AAPL", period);
        if (bars.length < period) return null;

        const sum = bars.reduce((acc, bar) => acc + bar.close, 0);
        return sum / period;
    }
}
