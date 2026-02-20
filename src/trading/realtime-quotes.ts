import type { Quote } from "./types.js";

interface RealtimeQuotesConfig {
    apiKey: string;
    apiSecret: string;
    paper: boolean;
}

type QuoteCallback = (quote: Quote) => void;

export class RealtimeQuotes {
    private config: RealtimeQuotesConfig;
    private subscribedSymbols: Set<string> = new Set();
    private callbacks: QuoteCallback[] = [];

    constructor(config: RealtimeQuotesConfig) {
        this.config = config;
    }

    subscribe(symbols: string[]): void {
        symbols.forEach((s) => this.subscribedSymbols.add(s));
        console.log(`Subscribed to quotes: ${symbols.join(", ")}`);
    }

    unsubscribe(symbols: string[]): void {
        symbols.forEach((s) => this.subscribedSymbols.delete(s));
    }

    getSubscribedSymbols(): string[] {
        return Array.from(this.subscribedSymbols);
    }

    onQuote(callback: QuoteCallback): void {
        this.callbacks.push(callback);
    }

    simulateQuoteUpdate(symbol: string, price: number): void {
        const quote: Quote = {
            symbol,
            bid: price - 0.01,
            ask: price + 0.01,
            lastPrice: price,
            volume: Math.floor(Math.random() * 1000000),
            timestamp: new Date(),
        };

        this.callbacks.forEach((cb) => cb(quote));
    }

    disconnect(): void {
        this.subscribedSymbols.clear();
        this.callbacks = [];
    }
}
