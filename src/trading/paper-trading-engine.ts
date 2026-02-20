import { TradingEngine } from "./trading-engine.js";
import { AlpacaBroker } from "./alpaca-broker.js";
import { AlpacaProvider } from "./alpaca-provider.js";
import type { Order } from "./types.js";

interface PaperTradingConfig {
    alpacaApiKey: string;
    alpacaApiSecret: string;
    initialCash: number;
}

export class PaperTradingEngine extends TradingEngine {
    private broker: AlpacaBroker;
    private provider: AlpacaProvider;

    constructor(config: PaperTradingConfig) {
        super({ initialCash: config.initialCash });

        const alpacaConfig = {
            apiKey: config.alpacaApiKey,
            apiSecret: config.alpacaApiSecret,
            paper: true,
        };

        this.broker = new AlpacaBroker(alpacaConfig);
        this.provider = new AlpacaProvider(alpacaConfig);
    }

    async submitOrder(
        orderInput: Omit<Order, "id" | "status" | "createdAt">
    ): Promise<Order> {
        // Use parent class to create order
        const order = await super.submitOrder(orderInput);

        // Submit to broker for paper trading
        if (order.status === "filled") {
            await this.broker.submitOrder(order);
        }

        return order;
    }

    async syncWithBroker(): Promise<void> {
        const account = await this.broker.getAccount();
        const positions = await this.broker.getPositions();

        // Update local state with broker data
        console.log(`Synced with Alpaca paper account:`, {
            cash: account.cash,
            equity: account.equity,
            positions: positions.length,
        });
    }

    async getQuote(symbol: string) {
        return this.provider.getQuote(symbol);
    }

    async getHistoricalBars(symbol: string, timeframe: string, options: any) {
        return this.provider.getBars(symbol, timeframe, options);
    }
}
