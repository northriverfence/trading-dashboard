/**
 * ScenarioMatcher Tests
 */

import { test, expect } from "bun:test";
import { ScenarioMatcher, MarketScenario } from "./scenario-matcher.js";

const createMockScenario = (id: string, trend: "up" | "down" | "sideways", volatility: number): MarketScenario => ({
  id,
  timestamp: new Date(),
  volatility,
  trend,
  volumeProfile: "normal",
  marketPhase: "markup",
  keyLevels: {
    support: 100,
    resistance: 110,
    pivot: 105,
  },
});

test("ScenarioMatcher adds and finds matching scenarios", () => {
  const matcher = new ScenarioMatcher();

  // Add historical scenarios
  matcher.addHistoricalScenario(createMockScenario("hist-1", "up", 0.02), [
    { direction: "up", magnitude: 0.05, timeToOutcome: 24 },
  ]);

  matcher.addHistoricalScenario(createMockScenario("hist-2", "down", 0.03), [
    { direction: "down", magnitude: 0.04, timeToOutcome: 24 },
  ]);

  // Set current scenario
  matcher.setCurrentScenario(createMockScenario("current", "up", 0.025));

  const matches = matcher.findMatches(0.5);
  expect(matches.length).toBeGreaterThan(0);
});

test("ScenarioMatcher predicts outcomes", () => {
  const matcher = new ScenarioMatcher();

  // Add multiple up scenarios
  for (let i = 0; i < 5; i++) {
    matcher.addHistoricalScenario(createMockScenario(`hist-${i}`, "up", 0.02 + i * 0.001), [
      { direction: "up", magnitude: 0.03 + i * 0.01, timeToOutcome: 24 },
    ]);
  }

  matcher.setCurrentScenario(createMockScenario("current", "up", 0.022));

  const prediction = matcher.getPredictedOutcome();
  expect(prediction).not.toBeNull();
  expect(prediction?.direction).toBe("up");
  expect(prediction?.confidence).toBeGreaterThan(0);
});

test("ScenarioMatcher compares scenarios", () => {
  const matcher = new ScenarioMatcher();

  const historical = createMockScenario("hist-1", "up", 0.02);
  matcher.addHistoricalScenario(historical, []);

  matcher.setCurrentScenario(createMockScenario("current", "up", 0.022));

  const comparison = matcher.compareScenario("hist-1");
  expect(comparison).not.toBeNull();
  expect(comparison?.similarity).toBeGreaterThan(0);
  expect(comparison?.similarities.length).toBeGreaterThan(0);
});

test("ScenarioMatcher calculates similarity correctly", () => {
  const matcher = new ScenarioMatcher();

  // Add identical scenario
  matcher.addHistoricalScenario(createMockScenario("identical", "up", 0.02), []);

  // Add different scenario
  matcher.addHistoricalScenario(createMockScenario("different", "down", 0.05), []);

  matcher.setCurrentScenario(createMockScenario("current", "up", 0.02));

  const matches = matcher.findMatches(0);
  expect(matches.length).toBe(2);

  // Identical should have higher similarity
  const identicalMatch = matches.find((m) => m.historical.id === "identical");
  const differentMatch = matches.find((m) => m.historical.id === "different");

  expect(identicalMatch!.similarity).toBeGreaterThan(differentMatch!.similarity);
});

test("ScenarioMatcher gets statistics", () => {
  const matcher = new ScenarioMatcher();

  matcher.addHistoricalScenario(createMockScenario("s1", "up", 0.02), []);
  matcher.addHistoricalScenario(createMockScenario("s2", "down", 0.03), []);

  matcher.setCurrentScenario(createMockScenario("current", "up", 0.025));

  const stats = matcher.getStatistics();
  expect(stats.totalScenarios).toBe(2);
  expect(stats.topMatches.length).toBeGreaterThan(0);
});

test("ScenarioMatcher clears data", () => {
  const matcher = new ScenarioMatcher();

  matcher.addHistoricalScenario(createMockScenario("s1", "up", 0.02), []);
  matcher.setCurrentScenario(createMockScenario("current", "up", 0.02));

  matcher.clear();

  const stats = matcher.getStatistics();
  expect(stats.totalScenarios).toBe(0);
});

test("ScenarioMatcher exports and imports library", () => {
  const matcher = new ScenarioMatcher();

  matcher.addHistoricalScenario(createMockScenario("s1", "up", 0.02), []);

  const exported = matcher.exportLibrary();
  expect(exported.scenarios.length).toBe(1);

  const newMatcher = new ScenarioMatcher();
  newMatcher.importLibrary(exported);

  expect(newMatcher.getStatistics().totalScenarios).toBe(1);
});
