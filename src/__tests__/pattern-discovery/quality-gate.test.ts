import { test, expect } from "bun:test";
import { QualityGate } from "../../pattern-discovery/quality-gate";
import type { DiscoveredPattern } from "../../pattern-discovery/types";

test("QualityGate validates pattern with sufficient trades", () => {
  const gate = new QualityGate({ minWinRate: 0.6, minTrades: 5 });

  const pattern: DiscoveredPattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [],
    winRate: 0.85,
    avgPnl: 100,
    confidence: 0.8,
    discoveredAt: Date.now(),
    status: "discovered",
  };

  const result = gate.validate(pattern, 10); // 10 supporting trades
  expect(result.valid).toBe(true);
  expect(result.grade).toBe("A");
});

test("QualityGate rejects pattern with low win rate", () => {
  const gate = new QualityGate({ minWinRate: 0.6, minTrades: 5 });

  const pattern: DiscoveredPattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [],
    winRate: 0.4, // Below threshold
    avgPnl: -50,
    confidence: 0.3,
    discoveredAt: Date.now(),
    status: "discovered",
  };

  const result = gate.validate(pattern, 10);
  expect(result.valid).toBe(false);
  expect(result.grade).toBe("F");
});

test("QualityGate rejects pattern with insufficient trades", () => {
  const gate = new QualityGate({ minWinRate: 0.6, minTrades: 10 });

  const pattern: DiscoveredPattern = {
    id: "p1",
    clusterId: 1,
    features: {},
    trades: [],
    winRate: 0.8,
    avgPnl: 100,
    confidence: 0.9,
    discoveredAt: Date.now(),
    status: "discovered",
  };

  const result = gate.validate(pattern, 3); // Only 3 trades
  expect(result.valid).toBe(false);
});

test("QualityGate assigns correct grades", () => {
  const gate = new QualityGate({ minWinRate: 0.5, minTrades: 3 });

  // Grade A: >= 80% win rate
  const resultA = gate.validate({ winRate: 0.85 } as DiscoveredPattern, 10);
  expect(resultA.grade).toBe("A");

  // Grade B: >= 70% win rate
  const resultB = gate.validate({ winRate: 0.75 } as DiscoveredPattern, 10);
  expect(resultB.grade).toBe("B");

  // Grade C: >= 60% win rate
  const resultC = gate.validate({ winRate: 0.65 } as DiscoveredPattern, 10);
  expect(resultC.grade).toBe("C");

  // Grade D: >= 50% win rate
  const resultD = gate.validate({ winRate: 0.55 } as DiscoveredPattern, 10);
  expect(resultD.grade).toBe("D");

  // Grade F: < 50% win rate
  const resultF = gate.validate({ winRate: 0.45 } as DiscoveredPattern, 10);
  expect(resultF.grade).toBe("F");
});
