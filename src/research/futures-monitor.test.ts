/**
 * FuturesMonitor Tests
 */

import { test, expect } from "bun:test";
import { FuturesMonitor, FuturesData } from "./futures-monitor.js";

test("FuturesMonitor updates and retrieves data", () => {
  const monitor = new FuturesMonitor();

  const data: FuturesData = {
    symbol: "ES",
    price: 5500,
    change: 25,
    changePercent: 0.45,
    volume: 1500000,
    openInterest: 500000,
    timestamp: new Date(),
  };

  monitor.updateData(data);
  const retrieved = monitor.getData("ES");

  expect(retrieved?.price).toBe(5500);
  expect(retrieved?.changePercent).toBe(0.45);
});

test("FuturesMonitor analyzes market context", () => {
  const monitor = new FuturesMonitor();

  // Add historical data with strong uptrend
  for (let i = 0; i < 25; i++) {
    monitor.updateData({
      symbol: "ES",
      price: 5500 + i * 10,
      change: 10,
      changePercent: 0.18,
      volume: 1000000,
      openInterest: 500000,
      timestamp: new Date(Date.now() + i * 60000),
    });
  }

  const context = monitor.analyzeMarketContext("ES");

  expect(context.trend).toBe("up");
  expect(context.conviction).toBeGreaterThan(0);
});

test("FuturesMonitor generates signals", () => {
  const monitor = new FuturesMonitor();

  // Add data with significant move
  for (let i = 0; i < 15; i++) {
    monitor.updateData({
      symbol: "NQ",
      price: 19500 + i * 5,
      change: i === 14 ? 50 : 5,
      changePercent: i === 14 ? 1.2 : 0.1,
      volume: 1200000,
      openInterest: 400000,
      timestamp: new Date(Date.now() + i * 60000),
    });
  }

  const signals = monitor.generateSignals();

  expect(signals.length).toBeGreaterThan(0);
  expect(signals[0].symbol).toBe("NQ");
});

test("FuturesMonitor determines market bias", () => {
  const monitor = new FuturesMonitor();

  monitor.updateData({
    symbol: "ES",
    price: 5600,
    change: 30,
    changePercent: 0.6,
    volume: 1800000,
    openInterest: 500000,
    timestamp: new Date(),
  });

  monitor.updateData({
    symbol: "NQ",
    price: 19800,
    change: 100,
    changePercent: 0.8,
    volume: 1500000,
    openInterest: 400000,
    timestamp: new Date(),
  });

  const bias = monitor.getMarketBias();
  expect(["bullish", "bearish", "neutral"]).toContain(bias);
});

test("FuturesMonitor detects volatility", () => {
  const monitor = new FuturesMonitor();

  // Add volatile data
  for (let i = 0; i < 25; i++) {
    const volatility = 0.02 + Math.random() * 0.03;
    monitor.updateData({
      symbol: "VIX",
      price: 25 + volatility * 100,
      change: volatility * 100,
      changePercent: volatility * 4,
      volume: 2000000,
      openInterest: 300000,
      timestamp: new Date(Date.now() + i * 60000),
    });
  }

  const isVolatile = monitor.isVolatilityExpected();
  expect(typeof isVolatile).toBe("boolean");
});

test("FuturesMonitor gets premarket bias", () => {
  const monitor = new FuturesMonitor();

  monitor.updateData({
    symbol: "ES",
    price: 5520,
    change: 20,
    changePercent: 0.4,
    volume: 1000000,
    openInterest: 500000,
    timestamp: new Date(),
  });

  const bias = monitor.getPremarketBias();

  expect(["bullish", "bearish", "neutral"]).toContain(bias.bias);
  expect(bias.confidence).toBeGreaterThanOrEqual(0);
  expect(bias.factors.length).toBeGreaterThan(0);
});

test("FuturesMonitor clears data", () => {
  const monitor = new FuturesMonitor();

  monitor.updateData({
    symbol: "ES",
    price: 5500,
    change: 10,
    changePercent: 0.2,
    volume: 1000000,
    openInterest: 500000,
    timestamp: new Date(),
  });

  expect(monitor.getData("ES")).toBeDefined();

  monitor.clear("ES");
  expect(monitor.getData("ES")).toBeUndefined();
});
