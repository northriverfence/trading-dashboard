/**
 * OutcomeTracker Tests
 */

import { test, expect } from "bun:test";
import { OutcomeTracker, OutcomeRecord } from "./outcome-tracker.js";

const createMockOutcome = (overrides: Partial<OutcomeRecord> = {}): OutcomeRecord => ({
  id: `outcome-${Date.now()}-${Math.random()}`,
  symbol: "AAPL",
  prediction: "up",
  actual: overrides.correct !== false ? "up" : "down",
  predictedMagnitude: 0.05,
  actualMagnitude: 0.04,
  timestamp: new Date(),
  timeToOutcome: 24,
  factors: ["earnings", "momentum"],
  confidence: 0.8,
  correct: overrides.correct !== false,
  ...overrides,
});

test("OutcomeTracker records outcomes and calculates stats", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome({ correct: true }));
  tracker.recordOutcome(createMockOutcome({ correct: true }));
  tracker.recordOutcome(createMockOutcome({ correct: false }));

  const stats = tracker.getStats();

  expect(stats.totalPredictions).toBe(3);
  expect(stats.correctPredictions).toBe(2);
  expect(stats.accuracy).toBeCloseTo(2 / 3, 2);
});

test("OutcomeTracker tracks streaks", () => {
  const tracker = new OutcomeTracker();

  // Winning streak
  tracker.recordOutcome(createMockOutcome({ correct: true }));
  tracker.recordOutcome(createMockOutcome({ correct: true }));
  tracker.recordOutcome(createMockOutcome({ correct: true }));

  // Losing streak
  tracker.recordOutcome(createMockOutcome({ correct: false }));
  tracker.recordOutcome(createMockOutcome({ correct: false }));

  const stats = tracker.getStats();
  expect(stats.streak.best).toBe(3);
  expect(stats.streak.worst).toBe(-2);
  expect(stats.streak.current).toBe(-2);
});

test("OutcomeTracker filters by symbol", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome({ symbol: "AAPL" }));
  tracker.recordOutcome(createMockOutcome({ symbol: "MSFT" }));
  tracker.recordOutcome(createMockOutcome({ symbol: "AAPL" }));

  const aaplOutcomes = tracker.getBySymbol("AAPL");
  expect(aaplOutcomes.length).toBe(2);
});

test("OutcomeTracker filters by factor", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome({ factors: ["earnings", "momentum"] }));
  tracker.recordOutcome(createMockOutcome({ factors: ["technical", "volume"] }));
  tracker.recordOutcome(createMockOutcome({ factors: ["earnings", "sentiment"] }));

  const earningsOutcomes = tracker.getByFactor("earnings");
  expect(earningsOutcomes.length).toBe(2);
});

test("OutcomeTracker gets accuracy by confidence", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome({ confidence: 0.9, correct: true }));
  tracker.recordOutcome(createMockOutcome({ confidence: 0.9, correct: true }));
  tracker.recordOutcome(createMockOutcome({ confidence: 0.5, correct: false }));
  tracker.recordOutcome(createMockOutcome({ confidence: 0.3, correct: false }));

  const byConfidence = tracker.getAccuracyByConfidence();
  expect(byConfidence.high.total).toBe(2);
  expect(byConfidence.medium.total).toBe(1);
  expect(byConfidence.low.total).toBe(1);
});

test("OutcomeTracker detects accuracy trend", () => {
  const tracker = new OutcomeTracker();

  // Older - declining accuracy
  for (let i = 0; i < 20; i++) {
    tracker.recordOutcome(createMockOutcome({ correct: i < 10 }));
  }

  // Recent - improving accuracy
  for (let i = 0; i < 20; i++) {
    tracker.recordOutcome(createMockOutcome({ correct: true }));
  }

  const trend = tracker.getAccuracyTrend(20);
  expect(trend).toBe("improving");
});

test("OutcomeTracker gets best factors", () => {
  const tracker = new OutcomeTracker();

  for (let i = 0; i < 15; i++) {
    tracker.recordOutcome(createMockOutcome({ factors: ["momentum"], correct: i < 12 }));
  }

  for (let i = 0; i < 15; i++) {
    tracker.recordOutcome(createMockOutcome({ factors: ["mean_reversion"], correct: i < 5 }));
  }

  const bestFactors = tracker.getBestFactors(10);
  expect(bestFactors[0].factor).toBe("momentum");
  expect(bestFactors[0].accuracy).toBeGreaterThan(0.7);
});

test("OutcomeTracker gets win rate by day", () => {
  const tracker = new OutcomeTracker();

  const monday = new Date("2024-06-10"); // Monday
  tracker.recordOutcome(createMockOutcome({ timestamp: monday, correct: true }));

  const tuesday = new Date("2024-06-11"); // Tuesday
  tracker.recordOutcome(createMockOutcome({ timestamp: tuesday, correct: false }));

  const byDay = tracker.getWinRateByDay();
  expect(byDay["Monday"].total).toBe(1);
  expect(byDay["Tuesday"].total).toBe(1);
});

test("OutcomeTracker filters by period", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome({ timestamp: new Date("2024-01-15") }));
  tracker.recordOutcome(createMockOutcome({ timestamp: new Date("2024-02-15") }));
  tracker.recordOutcome(createMockOutcome({ timestamp: new Date("2024-03-15") }));

  const januaryOutcomes = tracker.getForPeriod(
    new Date("2024-01-01"),
    new Date("2024-01-31")
  );
  expect(januaryOutcomes.length).toBe(1);
});

test("OutcomeTracker clears data", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome());
  tracker.clear();

  const stats = tracker.getStats();
  expect(stats.totalPredictions).toBe(0);
});

test("OutcomeTracker exports and imports", () => {
  const tracker = new OutcomeTracker();

  tracker.recordOutcome(createMockOutcome());
  tracker.recordOutcome(createMockOutcome());

  const exported = tracker.export();
  expect(exported.length).toBe(2);

  const newTracker = new OutcomeTracker();
  newTracker.import(exported);

  expect(newTracker.getStats().totalPredictions).toBe(2);
});
