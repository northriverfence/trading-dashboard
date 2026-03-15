import { test, expect, beforeEach } from "bun:test";
import { PortfolioTracker } from "../../trading/portfolio-tracker.js";
import type { Trade } from "../../trading/types.js";

let tracker: PortfolioTracker;

beforeEach(() => {
  tracker = new PortfolioTracker(100000);
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

  expect(portfolio.cash).toBe(100000 - 1500);
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
  expect(portfolio.cash).toBe(100000 + 100);
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
  // Equity = cash + positions value = 98500 + 1600 = 100100
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
  expect(portfolio.dailyPnl).toBeCloseTo(100, 2);
});
