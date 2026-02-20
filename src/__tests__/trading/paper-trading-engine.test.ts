import { test, expect, beforeEach } from "bun:test";
import { PaperTradingEngine } from "../../trading/paper-trading-engine.js";
import type { Order } from "../../trading/types.js";

let engine: PaperTradingEngine;

beforeEach(() => {
  engine = new PaperTradingEngine({
    alpacaApiKey: "test_key",
    alpacaApiSecret: "test_secret",
    initialCash: 100000,
  });
});

test("PaperTradingEngine initializes with Alpaca broker", () => {
  expect(engine).toBeDefined();
});

test("PaperTradingEngine submits order through broker", async () => {
  const order: Omit<Order, "id" | "status" | "createdAt"> = {
    symbol: "AAPL",
    side: "buy",
    qty: 10,
    type: "market",
    timeInForce: "day",
  };

  const submitted = await engine.submitOrder(order);
  expect(submitted.status).toBe("filled");
});

test("PaperTradingEngine syncs with broker account", async () => {
  await engine.syncWithBroker();
  const portfolio = engine.getPortfolio();

  // Should have synced with Alpaca paper account
  expect(portfolio.cash).toBeGreaterThan(0);
});
