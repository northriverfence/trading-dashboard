# Dashboard Trading Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add paper trading, live trading, and simulation capabilities to the trading dashboard with Alpaca integration and three-tier simulation engine.

**Architecture:** Core TradingEngine manages orders and positions, pluggable BrokerAdapters for paper/live trading, SimulationEngine for backtesting with three tiers (fast, step-through, advanced), all exposed via REST API and WebSocket.

**Tech Stack:** Bun, TypeScript, Alpaca Trade API, SQLite for trade storage, WebSocket for real-time updates.

---

## Phase 1: Foundation - Trading Engine

### Task 1.1: Order Types and Interfaces

**Files:**

- Create: `src/trading/types.ts`
- Test: `src/__tests__/trading/types.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/trading/types.test.ts
import { test, expect } from "bun:test";
import type { Order, OrderSide, OrderType, TimeInForce } from "../../trading/types.js";

test("Order type has required fields", () => {
    const order: Order = {
        id: "ord_123",
        symbol: "AAPL",
        side: "buy" as OrderSide,
        qty: 10,
        type: "market" as OrderType,
        timeInForce: "day" as TimeInForce,
        status: "pending",
        createdAt: new Date(),
    };
    expect(order.symbol).toBe("AAPL");
    expect(order.side).toBe("buy");
    expect(order.qty).toBe(10);
});

test("Order can have limit price for limit orders", () => {
    const order: Order = {
        id: "ord_124",
        symbol: "TSLA",
        side: "sell" as OrderSide,
        qty: 5,
        type: "limit" as OrderType,
        limitPrice: 250.0,
        timeInForce: "gtc" as TimeInForce,
        status: "pending",
        createdAt: new Date(),
    };
    expect(order.limitPrice).toBe(250.0);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/trading/types.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/trading/types.ts

export type OrderSide = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop" | "stop_limit";

export type OrderStatus = "pending" | "filled" | "partially_filled" | "canceled" | "rejected";

export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export interface Order {
    id: string;
    symbol: string;
    side: OrderSide;
    qty: number;
    type: OrderType;
    limitPrice?: number;
    stopPrice?: number;
    timeInForce: TimeInForce;
    status: OrderStatus;
    filledQty?: number;
    avgPrice?: number;
    createdAt: Date;
    updatedAt?: Date;
}

export interface Position {
    symbol: string;
    side: "long" | "short";
    qty: number;
    avgEntryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    openedAt: Date;
}

export interface Portfolio {
    cash: number;
    equity: number;
    buyingPower: number;
    positions: Position[];
    dailyPnl: number;
    totalPnl: number;
}

export interface Quote {
    symbol: string;
    bid: number;
    ask: number;
    lastPrice: number;
    lastSize?: number;
    volume: number;
    timestamp: Date;
}

export interface Trade {
    id: string;
    orderId: string;
    symbol: string;
    side: OrderSide;
    qty: number;
    price: number;
    timestamp: Date;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/trading/types.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/trading/types.ts src/__tests__/trading/types.test.ts
git commit -m "feat(trading): add order, position, and portfolio types"
```

---

### Task 1.2: OrderManager - Order Storage and Retrieval

**Files:**

- Create: `src/trading/order-manager.ts`
- Test: `src/__tests__/trading/order-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/trading/order-manager.test.ts
import { test, expect, beforeEach } from "bun:test";
import { OrderManager } from "../../trading/order-manager.js";
import type { Order } from "../../trading/types.js";

let orderManager: OrderManager;

beforeEach(() => {
    orderManager = new OrderManager();
});

test("OrderManager stores and retrieves order", () => {
    const order: Order = {
        id: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "market",
        timeInForce: "day",
        status: "pending",
        createdAt: new Date(),
    };

    orderManager.addOrder(order);
    const retrieved = orderManager.getOrder("ord_1");

    expect(retrieved).toEqual(order);
});

test("OrderManager returns null for non-existent order", () => {
    const retrieved = orderManager.getOrder("nonexistent");
    expect(retrieved).toBeNull();
});

test("OrderManager lists all orders", () => {
    const order1: Order = {
        id: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "market",
        timeInForce: "day",
        status: "pending",
        createdAt: new Date(),
    };

    const order2: Order = {
        id: "ord_2",
        symbol: "TSLA",
        side: "sell",
        qty: 5,
        type: "limit",
        limitPrice: 250,
        timeInForce: "gtc",
        status: "pending",
        createdAt: new Date(),
    };

    orderManager.addOrder(order1);
    orderManager.addOrder(order2);

    const allOrders = orderManager.getAllOrders();
    expect(allOrders).toHaveLength(2);
    expect(allOrders.map((o) => o.id)).toContain("ord_1");
    expect(allOrders.map((o) => o.id)).toContain("ord_2");
});

test("OrderManager updates order status", () => {
    const order: Order = {
        id: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "market",
        timeInForce: "day",
        status: "pending",
        createdAt: new Date(),
    };

    orderManager.addOrder(order);
    orderManager.updateOrderStatus("ord_1", "filled", { filledQty: 10, avgPrice: 150.5 });

    const updated = orderManager.getOrder("ord_1");
    expect(updated?.status).toBe("filled");
    expect(updated?.filledQty).toBe(10);
    expect(updated?.avgPrice).toBe(150.5);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/trading/order-manager.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/trading/order-manager.ts
import type { Order, OrderStatus } from "./types.js";

export class OrderManager {
    private orders: Map<string, Order> = new Map();

    addOrder(order: Order): void {
        this.orders.set(order.id, order);
    }

    getOrder(id: string): Order | null {
        return this.orders.get(id) ?? null;
    }

    getAllOrders(): Order[] {
        return Array.from(this.orders.values());
    }

    getOrdersBySymbol(symbol: string): Order[] {
        return this.getAllOrders().filter((o) => o.symbol === symbol);
    }

    getOpenOrders(): Order[] {
        return this.getAllOrders().filter((o) => o.status === "pending" || o.status === "partially_filled");
    }

    updateOrderStatus(id: string, status: OrderStatus, updates?: { filledQty?: number; avgPrice?: number }): void {
        const order = this.orders.get(id);
        if (!order) return;

        order.status = status;
        order.updatedAt = new Date();

        if (updates?.filledQty !== undefined) {
            order.filledQty = updates.filledQty;
        }
        if (updates?.avgPrice !== undefined) {
            order.avgPrice = updates.avgPrice;
        }

        this.orders.set(id, order);
    }

    cancelOrder(id: string): boolean {
        const order = this.orders.get(id);
        if (!order || order.status !== "pending") return false;

        order.status = "canceled";
        order.updatedAt = new Date();
        this.orders.set(id, order);
        return true;
    }

    clear(): void {
        this.orders.clear();
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/trading/order-manager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/trading/order-manager.ts src/__tests__/trading/order-manager.test.ts
git commit -m "feat(trading): add OrderManager for order storage and retrieval"
```

---

### Task 1.3: PositionManager - Position Tracking

**Files:**

- Create: `src/trading/position-manager.ts`
- Test: `src/__tests__/trading/position-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/trading/position-manager.test.ts
import { test, expect, beforeEach } from "bun:test";
import { PositionManager } from "../../trading/position-manager.js";
import type { Trade } from "../../trading/types.js";

let positionManager: PositionManager;

beforeEach(() => {
    positionManager = new PositionManager();
});

test("PositionManager creates position on buy trade", () => {
    const trade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    positionManager.processTrade(trade);
    const position = positionManager.getPosition("AAPL");

    expect(position).not.toBeNull();
    expect(position?.symbol).toBe("AAPL");
    expect(position?.side).toBe("long");
    expect(position?.qty).toBe(10);
    expect(position?.avgEntryPrice).toBe(150.0);
});

test("PositionManager increases position on additional buy", () => {
    const trade1: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    const trade2: Trade = {
        id: "tr_2",
        orderId: "ord_2",
        symbol: "AAPL",
        side: "buy",
        qty: 5,
        price: 155.0,
        timestamp: new Date(),
    };

    positionManager.processTrade(trade1);
    positionManager.processTrade(trade2);

    const position = positionManager.getPosition("AAPL");
    expect(position?.qty).toBe(15);
    // Average entry price: (10*150 + 5*155) / 15 = 151.67
    expect(position?.avgEntryPrice).toBeCloseTo(151.67, 2);
});

test("PositionManager decreases position on sell", () => {
    const buyTrade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    const sellTrade: Trade = {
        id: "tr_2",
        orderId: "ord_2",
        symbol: "AAPL",
        side: "sell",
        qty: 3,
        price: 160.0,
        timestamp: new Date(),
    };

    positionManager.processTrade(buyTrade);
    positionManager.processTrade(sellTrade);

    const position = positionManager.getPosition("AAPL");
    expect(position?.qty).toBe(7);
    // Realized P&L: (160 - 150) * 3 = 30
    expect(position?.realizedPnl).toBeCloseTo(30, 2);
});

test("PositionManager removes position when fully sold", () => {
    const buyTrade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    const sellTrade: Trade = {
        id: "tr_2",
        orderId: "ord_2",
        symbol: "AAPL",
        side: "sell",
        qty: 10,
        price: 160.0,
        timestamp: new Date(),
    };

    positionManager.processTrade(buyTrade);
    positionManager.processTrade(sellTrade);

    const position = positionManager.getPosition("AAPL");
    expect(position).toBeNull();
});

test("PositionManager calculates unrealized P&L", () => {
    const trade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    positionManager.processTrade(trade);
    positionManager.updatePrice("AAPL", 160.0);

    const position = positionManager.getPosition("AAPL");
    // Unrealized P&L: (160 - 150) * 10 = 100
    expect(position?.unrealizedPnl).toBeCloseTo(100, 2);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/trading/position-manager.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/trading/position-manager.ts
import type { Position, Trade } from "./types.js";

export class PositionManager {
    private positions: Map<string, Position> = new Map();

    processTrade(trade: Trade): void {
        const existingPosition = this.positions.get(trade.symbol);

        if (trade.side === "buy") {
            this.handleBuyTrade(trade, existingPosition);
        } else {
            this.handleSellTrade(trade, existingPosition);
        }
    }

    private handleBuyTrade(trade: Trade, existingPosition?: Position): void {
        if (!existingPosition) {
            // Create new long position
            this.positions.set(trade.symbol, {
                symbol: trade.symbol,
                side: "long",
                qty: trade.qty,
                avgEntryPrice: trade.price,
                currentPrice: trade.price,
                unrealizedPnl: 0,
                realizedPnl: 0,
                openedAt: trade.timestamp,
            });
        } else {
            // Increase position
            const totalCost = existingPosition.qty * existingPosition.avgEntryPrice + trade.qty * trade.price;
            const newQty = existingPosition.qty + trade.qty;

            existingPosition.qty = newQty;
            existingPosition.avgEntryPrice = totalCost / newQty;
            existingPosition.unrealizedPnl = (existingPosition.currentPrice - existingPosition.avgEntryPrice) * newQty;
        }
    }

    private handleSellTrade(trade: Trade, existingPosition?: Position): void {
        if (!existingPosition) {
            // Short selling not supported in this implementation
            return;
        }

        const sellQty = Math.min(trade.qty, existingPosition.qty);

        // Calculate realized P&L
        const realizedPnl = (trade.price - existingPosition.avgEntryPrice) * sellQty;
        existingPosition.realizedPnl += realizedPnl;

        // Reduce position
        existingPosition.qty -= sellQty;

        if (existingPosition.qty <= 0) {
            // Fully closed
            this.positions.delete(trade.symbol);
        } else {
            // Update unrealized P&L for remaining
            existingPosition.unrealizedPnl =
                (existingPosition.currentPrice - existingPosition.avgEntryPrice) * existingPosition.qty;
        }
    }

    updatePrice(symbol: string, price: number): void {
        const position = this.positions.get(symbol);
        if (!position) return;

        position.currentPrice = price;
        position.unrealizedPnl = (price - position.avgEntryPrice) * position.qty;
    }

    getPosition(symbol: string): Position | null {
        return this.positions.get(symbol) ?? null;
    }

    getAllPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    getTotalUnrealizedPnl(): number {
        return this.getAllPositions().reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    }

    getTotalRealizedPnl(): number {
        return this.getAllPositions().reduce((sum, pos) => sum + pos.realizedPnl, 0);
    }

    clear(): void {
        this.positions.clear();
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/trading/position-manager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/trading/position-manager.ts src/__tests__/trading/position-manager.test.ts
git commit -m "feat(trading): add PositionManager for position tracking and P&L"
```

---

### Task 1.4: PortfolioTracker

**Files:**

- Create: `src/trading/portfolio-tracker.ts`
- Test: `src/__tests__/trading/portfolio-tracker.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/trading/portfolio-tracker.test.ts
import { test, expect, beforeEach } from "bun:test";
import { PortfolioTracker } from "../../trading/portfolio-tracker.js";
import type { Trade } from "../../trading/types.js";

let tracker: PortfolioTracker;

beforeEach(() => {
    tracker = new PortfolioTracker(100000); // Start with $100k
});

test("PortfolioTracker initializes with cash", () => {
    const portfolio = tracker.getPortfolio();
    expect(portfolio.cash).toBe(100000);
    expect(portfolio.equity).toBe(100000);
    expect(portfolio.positions).toHaveLength(0);
});

test("PortfolioTracker reduces cash on buy", () => {
    const trade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    tracker.processTrade(trade);
    const portfolio = tracker.getPortfolio();

    expect(portfolio.cash).toBe(100000 - 1500); // $100k - (10 * $150)
    expect(portfolio.positions).toHaveLength(1);
});

test("PortfolioTracker increases cash on sell", () => {
    const buyTrade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    const sellTrade: Trade = {
        id: "tr_2",
        orderId: "ord_2",
        symbol: "AAPL",
        side: "sell",
        qty: 10,
        price: 160.0,
        timestamp: new Date(),
    };

    tracker.processTrade(buyTrade);
    tracker.processTrade(sellTrade);

    const portfolio = tracker.getPortfolio();
    expect(portfolio.cash).toBe(100000 + 100); // Original + $100 profit
    expect(portfolio.positions).toHaveLength(0);
});

test("PortfolioTracker calculates total equity", () => {
    const trade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    tracker.processTrade(trade);
    tracker.updatePrices({ AAPL: 160.0 });

    const portfolio = tracker.getPortfolio();
    // Equity = cash + positions value
    // Cash = 100000 - 1500 = 98500
    // Positions value = 10 * 160 = 1600
    // Total equity = 98500 + 1600 = 100100
    expect(portfolio.equity).toBeCloseTo(100100, 2);
});

test("PortfolioTracker tracks daily P&L", () => {
    const trade: Trade = {
        id: "tr_1",
        orderId: "ord_1",
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        price: 150.0,
        timestamp: new Date(),
    };

    tracker.processTrade(trade);
    tracker.updatePrices({ AAPL: 160.0 });

    const portfolio = tracker.getPortfolio();
    expect(portfolio.dailyPnl).toBeCloseTo(100, 2); // (160 - 150) * 10
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/trading/portfolio-tracker.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/trading/portfolio-tracker.ts
import { PositionManager } from "./position-manager.js";
import type { Portfolio, Trade } from "./types.js";

export class PortfolioTracker {
    private positionManager: PositionManager;
    private initialCash: number;
    private cash: number;
    private startingEquity: number;

    constructor(initialCash: number) {
        this.initialCash = initialCash;
        this.cash = initialCash;
        this.startingEquity = initialCash;
        this.positionManager = new PositionManager();
    }

    processTrade(trade: Trade): void {
        const tradeValue = trade.price * trade.qty;

        if (trade.side === "buy") {
            this.cash -= tradeValue;
        } else {
            // Calculate realized P&L from position manager
            const position = this.positionManager.getPosition(trade.symbol);
            if (position) {
                const avgEntry = position.avgEntryPrice;
                const realizedPnl = (trade.price - avgEntry) * trade.qty;
                // Cash increases by sale amount
                this.cash += tradeValue;
            }
        }

        this.positionManager.processTrade(trade);
    }

    updatePrices(prices: Record<string, number>): void {
        for (const [symbol, price] of Object.entries(prices)) {
            this.positionManager.updatePrice(symbol, price);
        }
    }

    getPortfolio(): Portfolio {
        const positions = this.positionManager.getAllPositions();
        const positionsValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.qty, 0);

        const totalPnl = this.positionManager.getTotalRealizedPnl();
        const unrealizedPnl = this.positionManager.getTotalUnrealizedPnl();
        const currentEquity = this.cash + positionsValue;
        const dailyPnl = currentEquity - this.startingEquity;

        return {
            cash: this.cash,
            equity: currentEquity,
            buyingPower: this.cash, // Simplified - no margin
            positions,
            dailyPnl,
            totalPnl,
        };
    }

    reset(): void {
        this.cash = this.initialCash;
        this.startingEquity = this.initialCash;
        this.positionManager.clear();
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/trading/portfolio-tracker.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/trading/portfolio-tracker.ts src/__tests__/trading/portfolio-tracker.test.ts
git commit -m "feat(trading): add PortfolioTracker for cash and equity management"
```

---

### Task 1.5: TradingEngine - Core Integration

**Files:**

- Create: `src/trading/trading-engine.ts`
- Test: `src/__tests__/trading/trading-engine.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/trading/trading-engine.test.ts
import { test, expect, beforeEach } from "bun:test";
import { TradingEngine } from "../../trading/trading-engine.js";
import type { Order } from "../../trading/types.js";

let engine: TradingEngine;

beforeEach(() => {
    engine = new TradingEngine({ initialCash: 100000 });
});

test("TradingEngine submits and fills market order", async () => {
    const order: Omit<Order, "id" | "status" | "createdAt"> = {
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "market",
        timeInForce: "day",
    };

    const submittedOrder = await engine.submitOrder(order);

    expect(submittedOrder.id).toBeDefined();
    expect(submittedOrder.status).toBe("filled");
    expect(submittedOrder.filledQty).toBe(10);
    expect(submittedOrder.avgPrice).toBeGreaterThan(0);
});

test("TradingEngine rejects order exceeding cash", async () => {
    const order: Omit<Order, "id" | "status" | "createdAt"> = {
        symbol: "AAPL",
        side: "buy",
        qty: 10000, // Too many shares
        type: "market",
        timeInForce: "day",
    };

    await expect(engine.submitOrder(order)).rejects.toThrow("insufficient funds");
});

test("TradingEngine tracks position after fill", async () => {
    const order: Omit<Order, "id" | "status" | "createdAt"> = {
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "market",
        timeInForce: "day",
    };

    await engine.submitOrder(order);
    const portfolio = engine.getPortfolio();

    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0]?.symbol).toBe("AAPL");
    expect(portfolio.positions[0]?.qty).toBe(10);
});

test("TradingEngine cancels pending order", async () => {
    const order: Omit<Order, "id" | "status" | "createdAt"> = {
        symbol: "AAPL",
        side: "buy",
        qty: 10,
        type: "limit",
        limitPrice: 100, // Low price that won't fill
        timeInForce: "day",
    };

    const submitted = await engine.submitOrder(order);
    const canceled = await engine.cancelOrder(submitted.id);

    expect(canceled).toBe(true);
    const retrieved = engine.getOrder(submitted.id);
    expect(retrieved?.status).toBe("canceled");
});

test("TradingEngine provides market data", async () => {
    const quote = await engine.getQuote("AAPL");

    expect(quote.symbol).toBe("AAPL");
    expect(quote.lastPrice).toBeGreaterThan(0);
    expect(quote.bid).toBeGreaterThan(0);
    expect(quote.ask).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/__tests__/trading/trading-engine.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/trading/trading-engine.ts
import { OrderManager } from "./order-manager.js";
import { PortfolioTracker } from "./portfolio-tracker.js";
import type { Order, OrderStatus, Quote, Trade } from "./types.js";

interface TradingEngineConfig {
    initialCash: number;
}

export class TradingEngine {
    private orderManager: OrderManager;
    private portfolioTracker: PortfolioTracker;
    private config: TradingEngineConfig;

    constructor(config: TradingEngineConfig) {
        this.config = config;
        this.orderManager = new OrderManager();
        this.portfolioTracker = new PortfolioTracker(config.initialCash);
    }

    async submitOrder(orderInput: Omit<Order, "id" | "status" | "createdAt">): Promise<Order> {
        const order: Order = {
            ...orderInput,
            id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            status: "pending",
            createdAt: new Date(),
        };

        // Validate order
        const validation = this.validateOrder(order);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // For market orders, fill immediately (simulated)
        if (order.type === "market") {
            const quote = await this.getQuote(order.symbol);
            const fillPrice = order.side === "buy" ? quote.ask : quote.bid;

            order.status = "filled";
            order.filledQty = order.qty;
            order.avgPrice = fillPrice;
            order.updatedAt = new Date();

            // Create trade
            const trade: Trade = {
                id: `tr_${Date.now()}`,
                orderId: order.id,
                symbol: order.symbol,
                side: order.side,
                qty: order.qty,
                price: fillPrice,
                timestamp: new Date(),
            };

            this.portfolioTracker.processTrade(trade);
        }

        this.orderManager.addOrder(order);
        return order;
    }

    private validateOrder(order: Order): { valid: boolean; error?: string } {
        const portfolio = this.portfolioTracker.getPortfolio();

        if (order.side === "buy") {
            // Check sufficient cash for buy
            const estimatedCost = order.qty * (order.limitPrice || 100); // Estimate
            if (estimatedCost > portfolio.cash) {
                return { valid: false, error: "insufficient funds" };
            }
        } else {
            // Check sufficient shares for sell
            // (simplified - would check actual position)
        }

        return { valid: true };
    }

    async cancelOrder(id: string): Promise<boolean> {
        return this.orderManager.cancelOrder(id);
    }

    getOrder(id: string): Order | null {
        return this.orderManager.getOrder(id);
    }

    getAllOrders(): Order[] {
        return this.orderManager.getAllOrders();
    }

    getOpenOrders(): Order[] {
        return this.orderManager.getOpenOrders();
    }

    getPortfolio() {
        return this.portfolioTracker.getPortfolio();
    }

    async getQuote(symbol: string): Promise<Quote> {
        // Simulated market data
        const basePrice = 150 + Math.random() * 50;
        const spread = 0.02;

        return {
            symbol,
            bid: basePrice - spread,
            ask: basePrice + spread,
            lastPrice: basePrice,
            volume: Math.floor(Math.random() * 1000000),
            timestamp: new Date(),
        };
    }

    updateMarketPrices(prices: Record<string, number>): void {
        this.portfolioTracker.updatePrices(prices);
    }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/__tests__/trading/trading-engine.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/trading/trading-engine.ts src/__tests__/trading/trading-engine.test.ts
git commit -m "feat(trading): add TradingEngine core integration"
```

---

## Summary

Phase 1 Foundation is complete with:

- **Order types** - Full order, position, portfolio type definitions
- **OrderManager** - Order storage, retrieval, status updates
- **PositionManager** - Position tracking, P&L calculation
- **PortfolioTracker** - Cash management, equity calculation
- **TradingEngine** - Core integration, order submission, simulated fills

Next: Phase 2 - Paper Trading with Alpaca integration.

**Plan complete and saved to `docs/plans/2026-02-20-dashboard-trading-implementation.md`.**

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you prefer?**
