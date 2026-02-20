/**
 * PreMarketIntelligence Tests
 */

import { test, expect } from "bun:test";
import { PreMarketIntelligence, PreMarketData } from "./pre-market-intelligence.js";

test("PreMarketIntelligence sets symbols correctly", () => {
  const intel = new PreMarketIntelligence();
  intel.setSymbols(["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]);

  const summary = intel.getMarketSummary();
  expect(summary.totalSymbols).toBe(0); // No data yet
});

test("PreMarketIntelligence analyzes gaps correctly", () => {
  const intel = new PreMarketIntelligence({ gapThreshold: 0.02 });
  intel.setSymbols(["AAPL"]);

  const data: PreMarketData = {
    symbol: "AAPL",
    preMarketPrice: 155,
    previousClose: 150,
    change: 5,
    changePercent: 0.033,
    volume: 500000,
    high: 156,
    low: 154,
    timestamp: new Date(),
  };

  intel.addPreMarketData(data);
  const results = intel.scanMarket();

  expect(results.length).toBe(1);
  expect(results[0].gapPercent).toBe(0.033);
  expect(results[0].alertLevel).toBe("medium");
});

test("PreMarketIntelligence detects high alert gaps", () => {
  const intel = new PreMarketIntelligence({ gapThreshold: 0.02 });
  intel.setSymbols(["TSLA"]);

  const data: PreMarketData = {
    symbol: "TSLA",
    preMarketPrice: 220,
    previousClose: 200,
    change: 20,
    changePercent: 0.1,
    volume: 1000000,
    high: 225,
    low: 215,
    timestamp: new Date(),
  };

  intel.addPreMarketData(data);
  const results = intel.scanMarket();

  expect(results[0].alertLevel).toBe("high");
  expect(results[0].momentum).toBe("up");
});

test("PreMarketIntelligence filters gap ups and gap downs", () => {
  const intel = new PreMarketIntelligence();
  intel.setSymbols(["AAPL", "TSLA"]);

  intel.addPreMarketData({
    symbol: "AAPL",
    preMarketPrice: 155,
    previousClose: 150,
    change: 5,
    changePercent: 0.033,
    volume: 500000,
    high: 156,
    low: 154,
    timestamp: new Date(),
  });

  intel.addPreMarketData({
    symbol: "TSLA",
    preMarketPrice: 180,
    previousClose: 200,
    change: -20,
    changePercent: -0.1,
    volume: 800000,
    high: 195,
    low: 175,
    timestamp: new Date(),
  });

  intel.scanMarket();

  const gapUps = intel.getGapUps(0.02);
  const gapDowns = intel.getGapDowns(0.02);

  expect(gapUps.length).toBe(1);
  expect(gapUps[0].symbol).toBe("AAPL");
  expect(gapDowns.length).toBe(1);
  expect(gapDowns[0].symbol).toBe("TSLA");
});

test("PreMarketIntelligence provides market summary", () => {
  const intel = new PreMarketIntelligence();
  intel.setSymbols(["AAPL", "MSFT", "TSLA"]);

  intel.addPreMarketData({
    symbol: "AAPL",
    preMarketPrice: 155,
    previousClose: 150,
    change: 5,
    changePercent: 0.033,
    volume: 500000,
    high: 156,
    low: 154,
    timestamp: new Date(),
  });

  intel.addPreMarketData({
    symbol: "MSFT",
    preMarketPrice: 400,
    previousClose: 395,
    change: 5,
    changePercent: 0.013,
    volume: 300000,
    high: 402,
    low: 398,
    timestamp: new Date(),
  });

  intel.scanMarket();
  const summary = intel.getMarketSummary();

  expect(summary.totalSymbols).toBe(2);
  expect(summary.gapUps).toBe(2);
  expect(summary.averageGap).toBeGreaterThan(0);
});

test("PreMarketIntelligence retrieves symbol data", () => {
  const intel = new PreMarketIntelligence();

  const data: PreMarketData = {
    symbol: "AAPL",
    preMarketPrice: 155,
    previousClose: 150,
    change: 5,
    changePercent: 0.033,
    volume: 500000,
    high: 156,
    low: 154,
    timestamp: new Date(),
  };

  intel.addPreMarketData(data);

  const retrieved = intel.getSymbolData("AAPL");
  expect(retrieved?.symbol).toBe("AAPL");
  expect(retrieved?.preMarketPrice).toBe(155);
});

test("PreMarketIntelligence clears data correctly", () => {
  const intel = new PreMarketIntelligence();

  intel.addPreMarketData({
    symbol: "AAPL",
    preMarketPrice: 155,
    previousClose: 150,
    change: 5,
    changePercent: 0.033,
    volume: 500000,
    high: 156,
    low: 154,
    timestamp: new Date(),
  });

  expect(intel.getSymbolData("AAPL")).toBeDefined();

  intel.clear();
  expect(intel.getSymbolData("AAPL")).toBeUndefined();
});
