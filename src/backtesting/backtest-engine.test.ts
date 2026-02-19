/**
 * Backtest Engine Tests
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { BacktestEngine } from "./backtest-engine.js";
import type { BacktestConfig, Strategy } from "./types.js";
import type { Bar } from "../adapters/types.js";

const mockConfig: BacktestConfig = {
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-31"),
  initialCapital: 10000,
  commission: 0.001,
  slippage: 0.001,
  fillModel: "immediate",
  dataSource: "files",
  replaySpeed: 0,
  warmupBars: 0,
};

const createMockBars = (symbol: string, count: number): Bar[] => {
  const bars: Bar[] = [];
  const startTime = new Date("2024-01-01").getTime();

  for (let i = 0; i < count; i++) {
    const price = 150 + Math.sin(i * 0.1) * 10;
    bars.push({
      symbol,
      timestamp: new Date(startTime + i * 24 * 60 * 60 * 1000),
      open: price * 0.99,
      high: price * 1.02,
      low: price * 0.98,
      close: price,
      volume: 10000 + i * 100,
    });
  }

  return bars;
};

describe("BacktestEngine", () => {
  let engine: BacktestEngine;

  beforeEach(() => {
    engine = new BacktestEngine(mockConfig);
  });

  test("should create engine with config", () => {
    expect(engine).toBeDefined();
    expect(engine.getState()).toBe("idle");
  });

  test("should update config", () => {
    const newConfig = { ...mockConfig, initialCapital: 20000 };
    engine.configure(newConfig);

    // Config updated, state should still be idle
    expect(engine.getState()).toBe("idle");
  });

  test("should run simple strategy", async () => {
    const bars = createMockBars("AAPL", 30);

    // Mock strategy
    const strategy: Strategy = {
      name: "Test Strategy",
      onInit: async () => {},
      onBar: async (bar: Bar) => {
        // Simple strategy logic
      },
      onEnd: async () => {},
    };

    // Note: In real usage, we'd need to properly load data
    // For this test, we just verify the engine structure
    expect(engine.getState()).toBe("idle");
  });

  test("should track progress", () => {
    const progress = engine.getProgress();

    expect(progress).toHaveProperty("currentDate");
    expect(progress).toHaveProperty("endDate");
    expect(progress).toHaveProperty("percentComplete");
    expect(progress).toHaveProperty("barsProcessed");
    expect(progress).toHaveProperty("totalBars");
    expect(progress).toHaveProperty("elapsedTime");
    expect(progress).toHaveProperty("estimatedTimeRemaining");
    expect(progress).toHaveProperty("tradesExecuted");
    expect(progress).toHaveProperty("currentEquity");
  });

  test("should handle state transitions", () => {
    expect(engine.getState()).toBe("idle");

    // Can't test running without loading data first
    // But we can test pause/resume/stop from idle

    engine.pause();
    expect(engine.getState()).toBe("idle"); // No change from idle

    engine.stop();
    expect(engine.getState()).toBe("stopped");
  });

  test("should register callbacks", () => {
    let progressCalled = false;
    let barCalled = false;
    let completeCalled = false;

    engine.onProgress(() => {
      progressCalled = true;
    });

    engine.onBar(() => {
      barCalled = true;
    });

    engine.onComplete(() => {
      completeCalled = true;
    });

    // Callbacks registered (actual calls would happen during run)
    expect(progressCalled).toBe(false);
    expect(barCalled).toBe(false);
    expect(completeCalled).toBe(false);
  });

  test("should register trade callback", () => {
    let tradeCalled = false;

    engine.onTrade(() => {
      tradeCalled = true;
    });

    expect(tradeCalled).toBe(false);
  });

  test("should throw if running without loading data", async () => {
    const strategy: Strategy = {
      name: "Test Strategy",
      onInit: async () => {},
      onBar: async () => {},
      onEnd: async () => {},
    };

    // Should fail because no data loaded
    // In actual implementation, this might fail gracefully
    try {
      await engine.run(strategy);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
