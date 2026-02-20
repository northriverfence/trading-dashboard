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
        qty: 10000,
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
        limitPrice: 100,
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
