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
  expect(position?.unrealizedPnl).toBeCloseTo(100, 2);
});
