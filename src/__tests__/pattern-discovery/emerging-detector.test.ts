// src/__tests__/pattern-discovery/emerging-detector.test.ts
import { test, expect } from "bun:test";
import { EmergingDetector } from "../../pattern-discovery/emerging-detector.js";
import type { DiscoveredPattern, TradeMemory } from "../../pattern-discovery/types.js";

test("EmergingDetector identifies fast-track eligible patterns", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.7, minTradesForFastTrack: 3 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}] as TradeMemory[],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 3);
  expect(emerging.fastTrackEligible).toBe(true);
});

test("EmergingDetector rejects patterns below threshold", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.7, minTradesForFastTrack: 3 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}] as TradeMemory[],
    winRate: 0.5,
    avgPnl: 100,
    confidence: 0.5,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 2);
  expect(emerging.fastTrackEligible).toBe(false);
});

test("EmergingDetector requires minimum trade count", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.6, minTradesForFastTrack: 5 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}] as TradeMemory[],
    winRate: 0.9,
    avgPnl: 100,
    confidence: 0.9,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 3);
  expect(emerging.fastTrackEligible).toBe(false);
});

test("EmergingDetector returns correct trades count", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.7, minTradesForFastTrack: 3 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}, {}] as TradeMemory[],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 4);
  expect(emerging.tradesCount).toBe(4);
});

test("EmergingDetector returns correct win rate", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.7, minTradesForFastTrack: 3 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}] as TradeMemory[],
    winRate: 0.75,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 3);
  expect(emerging.winRate).toBe(0.75);
});

test("EmergingDetector returns pattern ID in result", () => {
  const detector = new EmergingDetector({ fastTrackThreshold: 0.7, minTradesForFastTrack: 3 });

  const pattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [{}, {}, {}] as TradeMemory[],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.85,
    discoveredAt: Date.now(),
    status: "discovered",
  } as DiscoveredPattern;

  const emerging = detector.analyze(pattern, 3);
  expect(emerging.patternId).toBe("p1");
});
