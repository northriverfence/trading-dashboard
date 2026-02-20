import type { Strategy, StrategyContext, Signal } from "../strategy.js";
import type { Bar } from "../types.js";

interface BuyAndHoldParams {
    qty: number;
}

export class BuyAndHoldStrategy implements Strategy {
    name = "BuyAndHold";
    private params: BuyAndHoldParams;
    private hasBought = false;

    constructor(params: BuyAndHoldParams) {
        this.params = params;
    }

    onBar(bar: Bar, context: StrategyContext): Signal | null {
        // Only buy once on the first bar
        if (!this.hasBought) {
            this.hasBought = true;
            return {
                action: "buy",
                symbol: (bar as Bar & { symbol?: string }).symbol || "UNKNOWN",
                qty: this.params.qty,
                confidence: 1.0,
            };
        }

        // Hold for the rest of the backtest
        return null;
    }

    onComplete(): void {
        this.hasBought = false;
    }
}
