import { test, expect } from "bun:test";
import { ResultsFormatter } from "../../trading/results-formatter.js";
import type { Trade } from "../../adapters/types.js";

test("ResultsFormatter formats equity curve", () => {
  const formatter = new ResultsFormatter();

  const equityCurve = [
    { timestamp: new Date("2024-01-01"), equity: 100000 },
    { timestamp: new Date("2024-01-02"), equity: 101000 },
    { timestamp: new Date("2024-01-03"), equity: 100500 },
  ];

  const formatted = formatter.formatEquity(equityCurve);

  expect(formatted).toContain("Equity Curve");
  expect(formatted).toContain("$100,000.00");
  expect(formatted).toContain("$101,000.00");
});

test("ResultsFormatter formats trade list", () => {
  const formatter = new ResultsFormatter();

  const trades: Trade[] = [
    {
      id: "tr_1",
      orderId: "ord_1",
      symbol: "AAPL",
      side: "buy",
      qty: 10,
      price: 150,
      timestamp: new Date("2024-01-01"),
    },
    {
      id: "tr_2",
      orderId: "ord_2",
      symbol: "AAPL",
      side: "sell",
      qty: 10,
      price: 160,
      timestamp: new Date("2024-01-02"),
    },
  ];

  const formatted = formatter.formatTrades(trades);

  expect(formatted).toContain("BUY");
  expect(formatted).toContain("SELL");
  expect(formatted).toContain("$150.00");
  expect(formatted).toContain("$160.00");
});

test("ResultsFormatter formats performance metrics", () => {
  const formatter = new ResultsFormatter();

  const metrics = {
    totalReturn: 15.5,
    totalTrades: 10,
    winRate: 60,
    avgWin: 250,
    avgLoss: 100,
    maxDrawdown: 5.2,
  };

  const formatted = formatter.formatMetrics(metrics);

  expect(formatted).toContain("Total Return");
  expect(formatted).toContain("15.50%");
  expect(formatted).toContain("Win Rate");
  expect(formatted).toContain("60.0%");
});
