import { test, expect } from "bun:test";
import { IntelligentCircuitBreaker } from "../../breakers/intelligent-breaker";
import type { TradeMemory } from "../../agentdb-integration";

test("CircuitBreaker allows trading when healthy", () => {
  const breaker = new IntelligentCircuitBreaker({
    consecutiveLossThreshold: 3,
    dailyLossThreshold: 100,
  });

  const canTrade = breaker.checkCanTrade({
    dailyPnl: 50,
    consecutiveLosses: 0,
  });

  expect(canTrade.allowed).toBe(true);
});

test("CircuitBreaker stops trading after consecutive losses", () => {
  const breaker = new IntelligentCircuitBreaker({
    consecutiveLossThreshold: 3,
    dailyLossThreshold: 100,
  });

  // Record 3 consecutive losses
  breaker.recordOutcome("loss");
  breaker.recordOutcome("loss");
  breaker.recordOutcome("loss");

  const canTrade = breaker.checkCanTrade({
    dailyPnl: -50,
    consecutiveLosses: 3,
  });

  expect(canTrade.allowed).toBe(false);
  expect(canTrade.reason).toContain("Consecutive");
});

test("CircuitBreaker stops trading on daily loss limit", () => {
  const breaker = new IntelligentCircuitBreaker({
    consecutiveLossThreshold: 3,
    dailyLossThreshold: 100,
  });

  const canTrade = breaker.checkCanTrade({
    dailyPnl: -150, // Exceeds threshold
    consecutiveLosses: 0,
  });

  expect(canTrade.allowed).toBe(false);
  expect(canTrade.reason).toContain("Daily");
});

test("CircuitBreaker resets after cool-down", async () => {
  const breaker = new IntelligentCircuitBreaker({
    consecutiveLossThreshold: 3,
    dailyLossThreshold: 100,
    coolDownMs: 100, // 100ms for testing
  });

  // Trigger breaker
  breaker.recordOutcome("loss");
  breaker.recordOutcome("loss");
  breaker.recordOutcome("loss");

  expect(breaker.checkCanTrade({ dailyPnl: 0, consecutiveLosses: 3 }).allowed).toBe(false);

  // Wait for cool-down
  await new Promise((r) => setTimeout(r, 150));

  const canTrade = breaker.checkCanTrade({ dailyPnl: 0, consecutiveLosses: 0 });
  expect(canTrade.allowed).toBe(true);
});
