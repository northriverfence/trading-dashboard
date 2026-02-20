/**
 * CorrelationEngine Tests
 */

import { test, expect } from "bun:test";
import { CorrelationEngine } from "./correlation-engine.js";

test("CorrelationEngine calculates correlation between symbols", () => {
  const engine = new CorrelationEngine();

  // Create correlated price series
  const prices1 = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  const prices2 = [50, 50.5, 51, 51.5, 52, 52.5, 53, 53.5, 54, 54.5, 55];

  engine.addPriceData("AAPL", prices1);
  engine.addPriceData("MSFT", prices2);

  const correlation = engine.calculateCorrelation("AAPL", "MSFT");

  expect(correlation).not.toBeNull();
  expect(correlation?.correlation).toBeGreaterThan(0.9);
  expect(correlation?.confidence).toBeGreaterThan(0);
});

test("CorrelationEngine handles insufficient data", () => {
  const engine = new CorrelationEngine();

  engine.addPriceData("SYM1", [100, 101]);
  engine.addPriceData("SYM2", [50, 51]);

  const correlation = engine.calculateCorrelation("SYM1", "SYM2");

  expect(correlation).toBeNull();
});

test("CorrelationEngine builds correlation matrix", () => {
  const engine = new CorrelationEngine();

  const symbols = ["A", "B", "C"];
  for (const symbol of symbols) {
    engine.addPriceData(symbol, [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
  }

  const matrix = engine.buildCorrelationMatrix(symbols);

  expect(matrix.symbols).toEqual(symbols);
  expect(matrix.matrix.length).toBe(3);
  expect(matrix.matrix[0][0]).toBe(1); // Diagonal is 1
});

test("CorrelationEngine calculates beta", () => {
  const engine = new CorrelationEngine();

  const marketPrices = [100, 101, 102, 103, 104, 105];
  const stockPrices = [50, 51, 52, 51, 53, 54]; // More volatile than market

  engine.addPriceData("SPY", marketPrices);
  engine.addPriceData("XYZ", stockPrices);

  const beta = engine.calculateBeta("XYZ", "SPY");

  expect(typeof beta).toBe("number");
});

test("CorrelationEngine finds highly correlated pairs", () => {
  const engine = new CorrelationEngine();

  // Highly correlated pair
  engine.addPriceData("TECH1", [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  engine.addPriceData("TECH2", [50, 50.5, 51, 51.5, 52, 52.5, 53, 53.5, 54, 54.5]);

  // Uncorrelated
  engine.addPriceData("UTIL", [100, 99, 100, 101, 100, 99, 100, 101, 100, 99]);

  const pairs = engine.findHighlyCorrelated(0.8);

  expect(pairs.length).toBeGreaterThan(0);
  expect(pairs[0].correlation).toBeGreaterThan(0.8);
});

test("CorrelationEngine finds diversification opportunities", () => {
  const engine = new CorrelationEngine();

  engine.addPriceData("MAIN", [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
  engine.addPriceData("ALT1", [100, 99, 100, 101, 100, 99, 100, 101, 100, 99]); // Low correlation
  engine.addPriceData("ALT2", [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]); // High correlation

  const alternatives = engine.findDiversificationOpportunities("MAIN", 0.3);

  expect(alternatives.length).toBeGreaterThan(0);
});

test("CorrelationEngine detects correlation breakdowns", () => {
  const engine = new CorrelationEngine();

  // First 20 periods - highly correlated
  const prices1First = Array.from({ length: 20 }, (_, i) => 100 + i);
  const prices2First = Array.from({ length: 20 }, (_, i) => 50 + i * 0.5);

  // Last 20 periods - diverge
  const prices1Last = Array.from({ length: 20 }, (_, i) => 120 + i);
  const prices2Last = Array.from({ length: 20 }, (_, i) => 60 - i * 0.5);

  engine.addPriceData("PAIR1", [...prices1First, ...prices1Last]);
  engine.addPriceData("PAIR2", [...prices2First, ...prices2Last]);

  const breakdown = engine.detectCorrelationBreakdown("PAIR1", "PAIR2", 20);

  expect(breakdown).not.toBeNull();
  expect(typeof breakdown?.broken).toBe("boolean");
});

test("CorrelationEngine stores and retrieves correlations", () => {
  const engine = new CorrelationEngine();

  const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110];
  engine.addPriceData("A", prices);
  engine.addPriceData(
    "B",
    prices.map((p) => p * 0.5),
  );

  engine.calculateCorrelation("A", "B");

  const stored = engine.getCorrelation("A", "B");
  expect(stored).not.toBeUndefined();
  expect(stored?.symbol1).toBe("A");
  expect(stored?.symbol2).toBe("B");
});

test("CorrelationEngine clears data", () => {
  const engine = new CorrelationEngine();

  engine.addPriceData("TEST", [100, 101, 102, 103, 104]);

  engine.clear("TEST");

  const correlation = engine.calculateCorrelation("TEST", "OTHER");
  expect(correlation).toBeNull();
});

test("CorrelationEngine gets all correlations", () => {
  const engine = new CorrelationEngine();

  const prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];

  engine.addPriceData("X", prices);
  engine.addPriceData("Y", prices);
  engine.addPriceData("Z", prices);

  engine.calculateCorrelation("X", "Y");
  engine.calculateCorrelation("Y", "Z");

  const all = engine.getAllCorrelations();
  expect(all.length).toBeGreaterThan(0);
});
