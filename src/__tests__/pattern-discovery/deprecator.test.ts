// src/__tests__/pattern-discovery/deprecator.test.ts
import { test, expect } from "bun:test";
import { PatternDeprecator } from "../../pattern-discovery/deprecator.js";
import type { DiscoveredPattern } from "../../pattern-discovery/types.js";

test("Deprecator marks old patterns for deprecation", () => {
  const deprecator = new PatternDeprecator({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 }); // 7 days

  const oldPattern = {
    id: "p1",
    discoveredAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days old
    status: "validated",
  } as DiscoveredPattern;

  const shouldDeprecate = deprecator.shouldDeprecate(oldPattern);
  expect(shouldDeprecate).toBe(true);
});

test("Deprecator keeps recent patterns", () => {
  const deprecator = new PatternDeprecator({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 }); // 7 days

  const recentPattern = {
    id: "p1",
    discoveredAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days old
    status: "validated",
  } as DiscoveredPattern;

  const shouldDeprecate = deprecator.shouldDeprecate(recentPattern);
  expect(shouldDeprecate).toBe(false);
});

test("Deprecator evaluates pattern with age information", () => {
  const deprecator = new PatternDeprecator({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

  const oldPattern = {
    id: "p1",
    discoveredAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    status: "validated",
  } as DiscoveredPattern;

  const result = deprecator.evaluate(oldPattern);
  expect(result.shouldDeprecate).toBe(true);
  expect(result.ageDays).toBe(10);
  expect(result.reason).toContain("aged beyond max age");
});

test("Deprecator deprecates patterns with low win rate", () => {
  const deprecator = new PatternDeprecator({
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
    minWinRate: 0.4,
  });

  const pattern = {
    id: "p1",
    discoveredAt: Date.now(),
    winRate: 0.3,
    status: "validated",
  } as DiscoveredPattern;

  const result = deprecator.evaluate(pattern);
  expect(result.shouldDeprecate).toBe(true);
  expect(result.reason).toContain("Win rate too low");
});

test("Deprecator deprecates patterns with insufficient trades", () => {
  const deprecator = new PatternDeprecator({
    maxAgeMs: 30 * 24 * 60 * 60 * 1000,
    minTrades: 5,
  });

  const pattern = {
    id: "p1",
    discoveredAt: Date.now(),
    trades: [{}, {}],
    status: "validated",
  } as DiscoveredPattern;

  const result = deprecator.evaluate(pattern);
  expect(result.shouldDeprecate).toBe(true);
  expect(result.reason).toContain("Insufficient trades");
});

test("Deprecator marks pattern as deprecated", () => {
  const deprecator = new PatternDeprecator({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "validated",
  } as DiscoveredPattern;

  const deprecated = deprecator.deprecate(pattern);
  expect(deprecated.status).toBe("deprecated");
  expect(deprecated.id).toBe(pattern.id);
});

test("Deprecator processes multiple patterns", () => {
  const deprecator = new PatternDeprecator({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

  const oldPattern = {
    id: "p1",
    discoveredAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    trades: [],
    status: "validated",
  } as DiscoveredPattern;

  const recentPattern = {
    id: "p2",
    discoveredAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    trades: [],
    status: "validated",
  } as DiscoveredPattern;

  const result = deprecator.processPatterns([oldPattern, recentPattern]);
  expect(result.deprecated.length).toBe(1);
  expect(result.kept.length).toBe(1);
  expect(result.deprecated[0].id).toBe("p1");
  expect(result.kept[0].id).toBe("p2");
});
