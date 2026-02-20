import { test, expect } from "bun:test";
import { AlpacaBroker } from "../../trading/alpaca-broker.js";
import type { Order } from "../../trading/types.js";

test("AlpacaBroker submits order", async () => {
  const broker = new AlpacaBroker({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });

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

  const result = await broker.submitOrder(order);
  expect(result.success).toBe(true);
  expect(result.filledPrice).toBeGreaterThan(0);
});

test("AlpacaBroker gets account info", async () => {
  const broker = new AlpacaBroker({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });

  const account = await broker.getAccount();
  expect(account.cash).toBeGreaterThan(0);
  expect(account.equity).toBeGreaterThan(0);
});

test("AlpacaBroker gets positions", async () => {
  const broker = new AlpacaBroker({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });

  const positions = await broker.getPositions();
  expect(Array.isArray(positions)).toBe(true);
});
