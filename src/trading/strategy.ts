import type { Bar, Portfolio } from "./types.js";

export interface Signal {
    action: "buy" | "sell" | "hold";
    symbol: string;
    qty: number;
    confidence: number;
    limitPrice?: number;
    stopPrice?: number;
}

export interface StrategyContext {
    portfolio: Portfolio;
    getBars: (symbol: string, lookback: number) => Bar[];
    currentTime: Date;
}

export interface Strategy {
    name: string;
    description?: string;
    parameters?: Record<string, number | string | boolean>;
    onBar: (bar: Bar, context: StrategyContext) => Signal | null;
    onInit?: () => void;
    onComplete?: () => void;
}
