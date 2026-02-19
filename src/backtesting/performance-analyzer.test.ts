/**
 * Performance Analyzer Tests
 */

import { test, expect, describe } from "bun:test";
import { PerformanceAnalyzer } from "./performance-analyzer.js";
import type { TradeRecord, EquityPoint } from "./types.js";

describe("PerformanceAnalyzer", () => {
  const analyzer = new PerformanceAnalyzer();

  const createTrade = (
    pnl: number,
    entryPrice: number = 100,
    exitPrice?: number,
  ): TradeRecord => ({
    id: `trade-${Math.random()}`,
    timestamp: new Date(),
    symbol: "AAPL",
    side: "buy",
    qty: 100,
    entryPrice,
    exitPrice: exitPrice ?? entryPrice + pnl / 100,
    exitTime: new Date(),
    pnl,
    pnlPercent: (pnl / (entryPrice * 100)) * 100,
    commission: 10,
    slippage: 5,
    status: "closed",
    barsHeld: 5,
    exitReason: "signal",
  });

  const createEquityCurve = (initial: number, returns: number[]): EquityPoint[] => {
    let equity = initial;
    const curve: EquityPoint[] = [{
      timestamp: new Date("2024-01-01"),
      equity,
      cash: initial,
      positionsValue: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
    }];

    for (let i = 0; i < returns.length; i++) {
      const ret = returns[i]!;
      equity *= (1 + ret);
      curve.push({
        timestamp: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        equity,
        cash: equity * 0.5,
        positionsValue: equity * 0.5,
        unrealizedPnl: 0,
        realizedPnl: equity - initial,
      });
    }

    return curve;
  };

  test("should return empty metrics for no trades", () => {
    const metrics = analyzer.analyze([], []);

    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
  });

  test("should calculate win rate correctly", () => {
    const trades: TradeRecord[] = [
      createTrade(100),
      createTrade(200),
      createTrade(-50),
      createTrade(-100),
    ];

    const metrics = analyzer.analyze(trades, createEquityCurve(10000, [0.01, 0.02, -0.005, -0.01]));

    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTrades).toBe(2);
    expect(metrics.losingTrades).toBe(2);
    expect(metrics.winRate).toBe(0.5);
  });

  test("should calculate profit factor correctly", () => {
    const trades: TradeRecord[] = [
      createTrade(100),
      createTrade(200),
      createTrade(-50),
      createTrade(-25),
    ];

    const metrics = analyzer.analyze(trades, createEquityCurve(10000, [0.01, 0.02, -0.005, -0.0025]));

    expect(metrics.profitFactor).toBe(300 / 75); // Gross profit / Gross loss
  });

  test("should calculate max drawdown", () => {
    const equityCurve: EquityPoint[] = [
      { timestamp: new Date(), equity: 10000, cash: 10000, positionsValue: 0, unrealizedPnl: 0, realizedPnl: 0 },
      { timestamp: new Date(), equity: 11000, cash: 11000, positionsValue: 0, unrealizedPnl: 0, realizedPnl: 1000 },
      { timestamp: new Date(), equity: 10500, cash: 10500, positionsValue: 0, unrealizedPnl: 0, realizedPnl: 500 },
      { timestamp: new Date(), equity: 9500, cash: 9500, positionsValue: 0, unrealizedPnl: 0, realizedPnl: -500 },
      { timestamp: new Date(), equity: 12000, cash: 12000, positionsValue: 0, unrealizedPnl: 0, realizedPnl: 2000 },
    ];

    const drawdown = analyzer.calculateMaxDrawdown(equityCurve);

    expect(drawdown.maxDrawdown).toBe(1500); // Peak at 11000, trough at 9500
    expect(drawdown.maxDrawdownPercent).toBe((1500 / 11000) * 100);
  });

  test("should calculate Sharpe ratio", () => {
    const returns = [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.002, 0.001];

    const sharpe = analyzer.calculateSharpeRatio(returns);

    expect(sharpe).toBeGreaterThan(0);
  });

  test("should return 0 for Sharpe ratio with insufficient data", () => {
    expect(analyzer.calculateSharpeRatio([])).toBe(0);
    expect(analyzer.calculateSharpeRatio([0.01])).toBe(0);
  });

  test("should calculate total and annualized return", () => {
    const equityCurve = createEquityCurve(10000, [0.01, 0.02, 0.015, -0.005, 0.01]);

    const trades: TradeRecord[] = [
      createTrade(100, 100, 101),
      createTrade(200, 100, 102),
    ];

    const metrics = analyzer.analyze(trades, equityCurve);

    expect(metrics.totalReturn).toBeGreaterThan(0);
    expect(metrics.totalReturnPercent).toBeGreaterThan(0);
    expect(metrics.annualizedReturn).toBeGreaterThan(0);
  });

  test("should track largest win and loss", () => {
    const trades: TradeRecord[] = [
      createTrade(500),  // Largest win
      createTrade(200),
      createTrade(-300), // Largest loss
      createTrade(-100),
    ];

    const metrics = analyzer.analyze(trades, createEquityCurve(10000, [0.05, 0.02, -0.03, -0.01]));

    expect(metrics.largestWin).toBe(500);
    expect(metrics.largestLoss).toBe(-300);
  });

  test("should calculate expectancy", () => {
    const trades: TradeRecord[] = [
      createTrade(200),
      createTrade(200),
      createTrade(-100),
      createTrade(-100),
    ];

    const metrics = analyzer.analyze(trades, createEquityCurve(10000, [0.02, 0.02, -0.01, -0.01]));

    expect(metrics.expectancy).toBe(50); // (0.5 * 200) - (0.5 * 100)
  });
});
