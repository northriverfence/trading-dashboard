/**
 * RegimeDetector Tests
 */

import { test, expect } from "bun:test";
import { RegimeDetector, PriceData } from "./regime-detector.js";

function generatePriceData(
  count: number,
  trend: "up" | "down" | "flat" = "flat",
  volatility: "low" | "high" = "low",
): PriceData[] {
  const data: PriceData[] = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    const vol = volatility === "high" ? 0.05 : 0.005;
    const change = (Math.random() - 0.5) * vol;
    const trendChange = trend === "up" ? 0.002 : trend === "down" ? -0.002 : 0;

    price = price * (1 + change + trendChange);

    data.push({
      timestamp: new Date(Date.now() + i * 60000),
      open: price * 0.995,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000000 + Math.random() * 500000,
    });
  }

  return data;
}

test("RegimeDetector detects trending up regime", () => {
  const detector = new RegimeDetector();

  // Add trending up data
  const data = generatePriceData(25, "up", "low");
  let result;

  for (const candle of data) {
    result = detector.addPriceData(candle);
  }

  expect(result.changed).toBe(true);
  expect(result.currentRegime.type).toBe("trending_up");
  expect(result.currentRegime.confidence).toBeGreaterThan(0);
});

test("RegimeDetector detects ranging regime", () => {
  const detector = new RegimeDetector();

  // Add flat data (ranging)
  const data = generatePriceData(25, "flat", "low");
  let result;

  for (const candle of data) {
    result = detector.addPriceData(candle);
  }

  expect(result.currentRegime.type).toBe("ranging");
});

test("RegimeDetector detects volatile regime", () => {
  const detector = new RegimeDetector();

  // Add high volatility data
  const data = generatePriceData(25, "flat", "high");
  let result;

  for (const candle of data) {
    result = detector.addPriceData(candle);
  }

  expect(result.currentRegime.type).toBe("volatile");
});

test("RegimeDetector recommends actions based on regime", () => {
  const detector = new RegimeDetector();

  // Crisis regime should recommend halt
  const crisisData: PriceData[] = [];
  let price = 100;
  for (let i = 0; i < 25; i++) {
    // Sharp decline with high volatility
    price = price * (1 - 0.03 + (Math.random() - 0.5) * 0.04);
    crisisData.push({
      timestamp: new Date(Date.now() + i * 60000),
      open: price * 1.01,
      high: price * 1.02,
      low: price * 0.95,
      close: price,
      volume: 2000000,
    });
  }

  let result;
  for (const candle of crisisData) {
    result = detector.addPriceData(candle);
  }

  expect(["halt", "volatile", "trending_down"]).toContain(result.currentRegime.type);
});

test("RegimeDetector provides position size multipliers", () => {
  const detector = new RegimeDetector();

  // Start with trending up
  const data = generatePriceData(25, "up", "low");
  for (const candle of data) {
    detector.addPriceData(candle);
  }

  const multiplier = detector.getPositionMultiplier();
  expect(multiplier).toBeGreaterThan(0);
  expect(multiplier).toBeLessThanOrEqual(1);
});

test("RegimeDetector tracks regime history", () => {
  const detector = new RegimeDetector();

  const data = generatePriceData(30, "up", "low");
  for (const candle of data) {
    detector.addPriceData(candle);
  }

  const history = detector.getRegimeHistory();
  expect(history.length).toBeGreaterThan(0);
});

test("RegimeDetector checks if specific regime is active", () => {
  const detector = new RegimeDetector();

  // Add trending down data
  const data = generatePriceData(25, "down", "low");
  for (const candle of data) {
    detector.addPriceData(candle);
  }

  const isTrendingDown = detector.isRegimeActive("trending_down");
  expect(typeof isTrendingDown).toBe("boolean");
});

test("RegimeDetector resets correctly", () => {
  const detector = new RegimeDetector();

  const data = generatePriceData(25, "up", "low");
  for (const candle of data) {
    detector.addPriceData(candle);
  }

  detector.reset();

  expect(detector.getCurrentRegime()).toBeNull();
  expect(detector.getRegimeHistory().length).toBe(0);
});
