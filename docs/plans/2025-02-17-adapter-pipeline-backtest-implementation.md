# Exchange Adapter, Data Pipeline & Backtesting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build Exchange Adapter Service, Real-time Data Pipeline, and Backtesting Engine with unified interfaces

**Architecture:** Three-layer design where ExchangeAdapter is the central abstraction. Real-time Pipeline streams live data through adapters; Backtesting Engine replays historical data through the same adapter interface. Strategies work unchanged across live/paper/backtest modes.

**Tech Stack:** TypeScript, Bun, Alpaca API, WebSocket, PostgreSQL, Kubernetes

---

## Task 1: Create Foundation Types

**Files:**

- Create: `src/adapters/types.ts`
- Create: `src/pipeline/types.ts`
- Create: `src/backtesting/types.ts`
- Test: `src/__tests__/adapters/types.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import type { ExchangeAdapter, Quote, Bar, OrderRequest, Order } from "../../adapters/types.js";

describe("Adapter Types", () => {
    it("should create valid Quote", () => {
        const quote: Quote = {
            symbol: "AAPL",
            timestamp: new Date(),
            bid: 150.0,
            ask: 150.05,
            bidSize: 100,
            askSize: 200,
            lastPrice: 150.02,
            lastSize: 50,
            exchange: "NASDAQ",
        };
        expect(quote.symbol).toBe("AAPL");
        expect(quote.bid).toBeLessThan(quote.ask);
    });

    it("should create valid Bar", () => {
        const bar: Bar = {
            timestamp: new Date(),
            open: 150.0,
            high: 151.0,
            low: 149.5,
            close: 150.5,
            volume: 1000000,
        };
        expect(bar.high).toBeGreaterThanOrEqual(bar.low);
        expect(bar.close).toBeGreaterThan(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/adapters/types.test.ts`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/adapters/types.ts`:

```typescript
export interface Quote {
    symbol: string;
    timestamp: Date;
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    lastPrice: number;
    lastSize: number;
    exchange: string;
}

export interface Bar {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface PriceTick {
    symbol: string;
    timestamp: Date;
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    lastPrice: number;
    lastSize: number;
    exchange: string;
}

export interface OrderBookLevel {
    price: number;
    size: number;
}

export interface OrderBook {
    symbol: string;
    timestamp: Date;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    sequence: number;
}

export interface Account {
    id: string;
    buyingPower: number;
    cash: number;
    portfolioValue: number;
    equity: number;
    dayTradeCount: number;
    isPatternDayTrader: boolean;
    tradingBlocked: boolean;
}

export interface Position {
    symbol: string;
    qty: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    entryTime: Date;
}

export interface OrderRequest {
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    type: "market" | "limit" | "stop" | "stop_limit";
    limitPrice?: number;
    stopPrice?: number;
    timeInForce: "day" | "gtc" | "ioc" | "fok";
}

export interface Order {
    id: string;
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    filledQty: number;
    type: string;
    status: "pending" | "open" | "filled" | "canceled" | "rejected";
    limitPrice?: number;
    stopPrice?: number;
    avgFillPrice?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ExchangeAdapter {
    // Connection
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;
    getLatency(): number;

    // Market Data (REST)
    getQuote(symbol: string): Promise<Quote>;
    getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]>;

    // Market Data (Streaming)
    subscribe(symbols: string[], channels?: string[]): Promise<void>;
    unsubscribe(symbols: string[]): void;
    onPrice(callback: (tick: PriceTick) => void): void;
    onOrderBook(callback: (book: OrderBook) => void): void;
    onTrade(callback: (trade: Trade) => void): void;

    // Trading
    getAccount(): Promise<Account>;
    getPositions(): Promise<Position[]>;
    submitOrder(order: OrderRequest): Promise<Order>;
    cancelOrder(orderId: string): Promise<void>;
    getOrder(orderId: string): Promise<Order>;
}

export interface Trade {
    symbol: string;
    timestamp: Date;
    price: number;
    size: number;
    side: "buy" | "sell";
    exchange: string;
}
```

Create `src/pipeline/types.ts`:

```typescript
import type { PriceTick, OrderBook, Trade, Bar } from "../adapters/types.js";

export interface DataPipeline {
    connect(): Promise<void>;
    disconnect(): void;
    isConnected(): boolean;

    subscribe(symbols: string[], channels?: string[]): void;
    unsubscribe(symbols: string[]): void;

    onPrice(callback: (tick: PriceTick) => void): void;
    onTrade(callback: (trade: Trade) => void): void;
    onOrderBook(callback: (book: OrderBook) => void): void;
    onBar(callback: (bar: Bar) => void): void;

    onConnect(callback: () => void): void;
    onDisconnect(callback: () => void): void;
    onError(callback: (error: Error) => void): void;
}

export interface PipelineConfig {
    autoReconnect: boolean;
    reconnectStrategy: "exponential" | "linear" | "fixed";
    maxReconnectDelay: number;
    bufferSize: number;
    heartbeatInterval: number;
}

export interface DataBuffer {
    add(tick: PriceTick): void;
    get(symbol: string, count: number): PriceTick[];
    clear(): void;
}
```

Create `src/backtesting/types.ts`:

```typescript
import type { Bar, Trade, Order, OrderRequest, ExchangeAdapter } from "../adapters/types.js";

export interface BacktestConfig {
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    commission: number;
    slippage: number;
    fillModel: "immediate" | "next_bar" | "limit";
    dataSource: "files" | "database" | "api";
}

export interface BacktestResult {
    trades: TradeRecord[];
    equityCurve: EquityPoint[];
    metrics: PerformanceMetrics;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
    profitFactor: number;
    totalReturn: number;
    annualizedReturn: number;
    volatility: number;
}

export interface TradeRecord {
    id: string;
    timestamp: Date;
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    entryPrice: number;
    exitPrice?: number;
    pnl: number;
    commission: number;
    status: "open" | "closed";
}

export interface EquityPoint {
    timestamp: Date;
    equity: number;
    cash: number;
    positionsValue: number;
}

export interface PerformanceMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    maxDrawdown: number;
    sharpeRatio: number;
    calmarRatio: number;
}

export interface Strategy {
    name: string;
    onBar(bar: Bar): Promise<void>;
    onTick(tick: PriceTick): Promise<void>;
}

export interface BacktestEngine {
    configure(config: BacktestConfig): void;
    loadHistoricalData(symbol: string, start: Date, end: Date, timeframe: string): Promise<void>;
    run(strategy: Strategy): Promise<BacktestResult>;
    pause(): void;
    resume(): void;
    stop(): void;
    getProgress(): BacktestProgress;
}

export interface BacktestProgress {
    currentDate: Date;
    endDate: Date;
    percentComplete: number;
    barsProcessed: number;
    totalBars: number;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/adapters/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/types.ts src/pipeline/types.ts src/backtesting/types.ts

git add src/__tests__/adapters/types.test.ts
git commit -m "feat: add exchange adapter, pipeline, and backtesting types"
```

---

## Task 2: Create Configuration Management

**Files:**

- Create: `src/adapters/config.ts`
- Create: `config/exchange-config.yaml`
- Create: `src/pipeline/config.ts`
- Create: `config/pipeline-config.yaml`
- Create: `src/backtesting/config.ts`
- Test: `src/__tests__/adapters/config.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { loadExchangeConfig, validateExchangeConfig } from "../../adapters/config.js";

describe("Exchange Config", () => {
    it("should load default config", () => {
        const config = loadExchangeConfig();
        expect(config.default).toBe("alpaca");
        expect(config.adapters.alpaca).toBeDefined();
    });

    it("should validate config", () => {
        const errors = validateExchangeConfig(loadExchangeConfig());
        expect(errors).toHaveLength(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/adapters/config.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/adapters/config.ts`:

```typescript
export interface ExchangeAdapterConfig {
    default: string;
    adapters: Record<string, AlpacaConfig | IBConfig | HistoricalConfig>;
}

export interface AlpacaConfig {
    apiKey: string;
    secretKey: string;
    paper: boolean;
    restUrl: string;
    websocketUrl: string;
}

export interface IBConfig {
    host: string;
    port: number;
    clientId: number;
}

export interface HistoricalConfig {
    dataPath: string;
    replaySpeed: number;
}

export const defaultExchangeConfig: ExchangeAdapterConfig = {
    default: "alpaca",
    adapters: {
        alpaca: {
            apiKey: process.env.ALPACA_API_KEY || "",
            secretKey: process.env.ALPACA_SECRET_KEY || "",
            paper: true,
            restUrl: "https://paper-api.alpaca.markets",
            websocketUrl: "wss://stream.data.alpaca.markets/v2/iex",
        },
        interactive_brokers: {
            host: "127.0.0.1",
            port: 7497,
            clientId: 1,
        },
        historical: {
            dataPath: "./data/historical",
            replaySpeed: 1.0,
        },
    },
};

export function loadExchangeConfig(overrides?: Partial<ExchangeAdapterConfig>): ExchangeAdapterConfig {
    return {
        ...defaultExchangeConfig,
        ...overrides,
    };
}

export function validateExchangeConfig(config: ExchangeAdapterConfig): string[] {
    const errors: string[] = [];

    if (!config.default) {
        errors.push("default exchange must be specified");
    }

    if (!config.adapters[config.default]) {
        errors.push(`default adapter "${config.default}" not found in adapters`);
    }

    for (const [name, adapter] of Object.entries(config.adapters)) {
        if (name === "alpaca") {
            const alpaca = adapter as AlpacaConfig;
            if (!alpaca.apiKey) errors.push(`alpaca.apiKey is required`);
            if (!alpaca.secretKey) errors.push(`alpaca.secretKey is required`);
        }
    }

    return errors;
}
```

Create `config/exchange-config.yaml`:

```yaml
exchange:
    default: alpaca

    adapters:
        alpaca:
            apiKey: "${ALPACA_API_KEY}"
            secretKey: "${ALPACA_SECRET_KEY}"
            paper: true
            restUrl: "https://paper-api.alpaca.markets"
            websocketUrl: "wss://stream.data.alpaca.markets/v2/iex"

        interactive_brokers:
            host: "127.0.0.1"
            port: 7497
            clientId: 1

        historical:
            dataPath: "./data/historical"
            replaySpeed: 1.0
```

Create `src/pipeline/config.ts`:

```typescript
import type { PipelineConfig } from "./types.js";

export const defaultPipelineConfig: PipelineConfig = {
    autoReconnect: true,
    reconnectStrategy: "exponential",
    maxReconnectDelay: 60000,
    bufferSize: 1000,
    heartbeatInterval: 30000,
};

export function loadPipelineConfig(overrides?: Partial<PipelineConfig>): PipelineConfig {
    return {
        ...defaultPipelineConfig,
        ...overrides,
    };
}

export function validatePipelineConfig(config: PipelineConfig): string[] {
    const errors: string[] = [];

    if (config.bufferSize <= 0) {
        errors.push("bufferSize must be positive");
    }

    if (config.heartbeatInterval < 5000) {
        errors.push("heartbeatInterval must be at least 5000ms");
    }

    return errors;
}
```

Create `config/pipeline-config.yaml`:

```yaml
pipeline:
    autoReconnect: true
    reconnectStrategy: exponential
    maxReconnectDelay: 60000
    bufferSize: 1000
    heartbeatInterval: 30000

    subscriptions:
        - symbols: ["AAPL", "MSFT", "GOOGL"]
          channels: ["trades", "quotes"]
```

Create `src/backtesting/config.ts`:

```typescript
import type { BacktestConfig } from "./types.js";

export const defaultBacktestConfig: BacktestConfig = {
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    initialCapital: 10000,
    commission: 0.001,
    slippage: 0.001,
    fillModel: "next_bar",
    dataSource: "files",
};

export function loadBacktestConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
    return {
        ...defaultBacktestConfig,
        ...overrides,
    };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/adapters/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/config.ts src/pipeline/config.ts src/backtesting/config.ts
git add config/exchange-config.yaml config/pipeline-config.yaml
git add src/__tests__/adapters/config.test.ts
git commit -m "feat: add adapter, pipeline, and backtesting configuration"
```

---

## Task 3: Create Adapter Factory

**Files:**

- Create: `src/adapters/adapter-factory.ts`
- Create: `src/adapters/base-adapter.ts`
- Test: `src/__tests__/adapters/adapter-factory.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { AdapterFactory } from "../../adapters/adapter-factory.js";
import { loadExchangeConfig } from "../../adapters/config.js";

describe("AdapterFactory", () => {
    it("should create alpaca adapter", () => {
        const config = loadExchangeConfig();
        const factory = new AdapterFactory(config);
        const adapter = factory.create("alpaca");
        expect(adapter).toBeDefined();
    });

    it("should create default adapter", () => {
        const config = loadExchangeConfig();
        const factory = new AdapterFactory(config);
        const adapter = factory.createDefault();
        expect(adapter).toBeDefined();
    });

    it("should throw on unknown adapter", () => {
        const config = loadExchangeConfig();
        const factory = new AdapterFactory(config);
        expect(() => factory.create("unknown")).toThrow();
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/adapters/adapter-factory.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/adapters/base-adapter.ts`:

```typescript
import type { ExchangeAdapter, PriceTick, OrderBook, Trade } from "./types.js";

export abstract class BaseAdapter implements ExchangeAdapter {
    protected connected = false;
    protected latency = 0;
    protected priceCallbacks: ((tick: PriceTick) => void)[] = [];
    protected orderBookCallbacks: ((book: OrderBook) => void)[] = [];
    protected tradeCallbacks: ((trade: Trade) => void)[] = [];

    abstract connect(): Promise<void>;
    abstract disconnect(): void;
    abstract isConnected(): boolean;

    getLatency(): number {
        return this.latency;
    }

    onPrice(callback: (tick: PriceTick) => void): void {
        this.priceCallbacks.push(callback);
    }

    onOrderBook(callback: (book: OrderBook) => void): void {
        this.orderBookCallbacks.push(callback);
    }

    onTrade(callback: (trade: Trade) => void): void {
        this.tradeCallbacks.push(callback);
    }

    protected emitPrice(tick: PriceTick): void {
        this.priceCallbacks.forEach((cb) => cb(tick));
    }

    protected emitOrderBook(book: OrderBook): void {
        this.orderBookCallbacks.forEach((cb) => cb(book));
    }

    protected emitTrade(trade: Trade): void {
        this.tradeCallbacks.forEach((cb) => cb(trade));
    }

    abstract getQuote(symbol: string): Promise<import("./types.js").Quote>;
    abstract getHistoricalBars(symbol: string, timeframe: string, limit: number): Promise<import("./types.js").Bar[]>;
    abstract subscribe(symbols: string[], channels?: string[]): Promise<void>;
    abstract unsubscribe(symbols: string[]): void;
    abstract getAccount(): Promise<import("./types.js").Account>;
    abstract getPositions(): Promise<import("./types.js").Position[]>;
    abstract submitOrder(order: import("./types.js").OrderRequest): Promise<import("./types.js").Order>;
    abstract cancelOrder(orderId: string): Promise<void>;
    abstract getOrder(orderId: string): Promise<import("./types.js").Order>;
}
```

Create `src/adapters/adapter-factory.ts`:

```typescript
import type { ExchangeAdapter } from "./types.js";
import type { ExchangeAdapterConfig } from "./config.js";
import { BaseAdapter } from "./base-adapter.js";

export class AdapterFactory {
    private config: ExchangeAdapterConfig;

    constructor(config: ExchangeAdapterConfig) {
        this.config = config;
    }

    create(name: string): ExchangeAdapter {
        const adapterConfig = this.config.adapters[name];
        if (!adapterConfig) {
            throw new Error(`Unknown adapter: ${name}`);
        }

        switch (name) {
            case "alpaca":
                // Will import and create AlpacaAdapter
                return this.createAlpacaAdapter(adapterConfig);
            case "historical":
                // Will import and create HistoricalAdapter
                return this.createHistoricalAdapter(adapterConfig);
            default:
                throw new Error(`Adapter "${name}" not yet implemented`);
        }
    }

    createDefault(): ExchangeAdapter {
        return this.create(this.config.default);
    }

    private createAlpacaAdapter(config: unknown): ExchangeAdapter {
        // Placeholder - will be replaced with actual AlpacaAdapter
        return new PlaceholderAdapter("alpaca");
    }

    private createHistoricalAdapter(config: unknown): ExchangeAdapter {
        // Placeholder - will be replaced with actual HistoricalAdapter
        return new PlaceholderAdapter("historical");
    }
}

// Temporary placeholder for factory tests
class PlaceholderAdapter extends BaseAdapter {
    constructor(private name: string) {
        super();
    }

    async connect(): Promise<void> {
        this.connected = true;
    }

    disconnect(): void {
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async getQuote(): Promise<never> {
        throw new Error("Placeholder adapter");
    }

    async getHistoricalBars(): Promise<never> {
        throw new Error("Placeholder adapter");
    }

    async subscribe(): Promise<void> {
        return;
    }

    unsubscribe(): void {
        return;
    }

    async getAccount(): Promise<never> {
        throw new Error("Placeholder adapter");
    }

    async getPositions(): Promise<never> {
        throw new Error("Placeholder adapter");
    }

    async submitOrder(): Promise<never> {
        throw new Error("Placeholder adapter");
    }

    async cancelOrder(): Promise<void> {
        return;
    }

    async getOrder(): Promise<never> {
        throw new Error("Placeholder adapter");
    }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/adapters/adapter-factory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/adapter-factory.ts src/adapters/base-adapter.ts
git add src/__tests__/adapters/adapter-factory.test.ts
git commit -m "feat: add adapter factory and base adapter"
```

---

[Continue with remaining tasks...]
