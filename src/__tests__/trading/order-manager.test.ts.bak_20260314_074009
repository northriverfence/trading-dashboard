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
