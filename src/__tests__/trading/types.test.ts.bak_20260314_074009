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
