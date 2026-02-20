/**
 * DynamicThresholds Tests
 */

import { test, expect } from "bun:test";
import { DynamicThresholds, VolatilityMetrics } from "./dynamic-thresholds.js";

test("DynamicThresholds calculates adjusted thresholds with low volatility", () => {
  const dt = new DynamicThresholds({
    baseDailyLossLimit: 1000,
    baseConsecutiveLossLimit: 3,
  });

  const metrics: VolatilityMetrics = {
    vix: 12,
    atr20: 2.5,
    realizedVol: 0.015,
  };

  const thresholds = dt.calculateThresholds(metrics);

  expect(thresholds.dailyLossLimit).toBeGreaterThan(1000);
  expect(thresholds.volatilityFactor).toBeGreaterThan(1);
});

test("DynamicThresholds reduces limits during high volatility", () => {
  const dt = new DynamicThresholds({
    baseDailyLossLimit: 1000,
    baseConsecutiveLossLimit: 3,
  });

  const metrics: VolatilityMetrics = {
    vix: 35,
    atr20: 5.0,
    realizedVol: 0.05,
  };

  const thresholds = dt.calculateThresholds(metrics);

  expect(thresholds.dailyLossLimit).toBeLessThan(1000);
  expect(thresholds.volatilityFactor).toBeLessThan(1);
});

test("DynamicThresholds detects volatility regimes", () => {
  const dt = new DynamicThresholds();

  // Low volatility
  dt.calculateThresholds({ vix: 12, atr20: 2.0, realizedVol: 0.01 });
  expect(dt.getVolatilityRegime()).toBe("low");

  // Reset and test high volatility
  dt.resetHistory();
  dt.calculateThresholds({ vix: 35, atr20: 4.0, realizedVol: 0.04 });
  expect(dt.getVolatilityRegime()).toBe("high");

  // Reset and test extreme volatility
  dt.resetHistory();
  dt.calculateThresholds({ vix: 45, atr20: 6.0, realizedVol: 0.06 });
  expect(dt.getVolatilityRegime()).toBe("extreme");
});

test("DynamicThresholds recommends actions based on volatility", () => {
  const dt = new DynamicThresholds();

  // Extreme volatility should recommend halt
  dt.calculateThresholds({ vix: 45, atr20: 6.0, realizedVol: 0.06 });
  expect(dt.getRecommendedAction()).toBe("halt");

  // Reset and test high volatility
  dt.resetHistory();
  dt.calculateThresholds({ vix: 32, atr20: 4.0, realizedVol: 0.03 });
  expect(dt.getRecommendedAction()).toBe("defensive");
});

test("DynamicThresholds updates configuration", () => {
  const dt = new DynamicThresholds({ baseDailyLossLimit: 1000 });

  dt.updateConfig({ baseDailyLossLimit: 2000 });
  const config = dt.getConfig();

  expect(config.baseDailyLossLimit).toBe(2000);
});

test("DynamicThresholds respects min and max thresholds", () => {
  const dt = new DynamicThresholds({
    minThreshold: 0.5,
    maxThreshold: 1.5,
  });

  // Very low VIX
  const lowVol = dt.calculateThresholds({ vix: 10, atr20: 1.0, realizedVol: 0.005 });
  expect(lowVol.volatilityFactor).toBeLessThanOrEqual(1.5);

  dt.resetHistory();

  // Very high VIX
  const highVol = dt.calculateThresholds({ vix: 50, atr20: 8.0, realizedVol: 0.08 });
  expect(highVol.volatilityFactor).toBeGreaterThanOrEqual(0.5);
});

test("DynamicThresholds calculates position adjustments", () => {
  const dt = new DynamicThresholds({ basePositionSize: 0.1 });

  const metrics: VolatilityMetrics = {
    vix: 20,
    atr20: 3.0,
    realizedVol: 0.02,
  };

  const adjusted = dt.calculatePositionAdjustment(100, metrics);
  expect(adjusted).toBeGreaterThan(0);
});

test("DynamicThresholds detects volatility trends", () => {
  const dt = new DynamicThresholds();

  // Add increasing volatility data
  for (let i = 0; i < 5; i++) {
    dt.calculateThresholds({
      vix: 15 + i * 3,
      atr20: 2 + i * 0.5,
      realizedVol: 0.01 + i * 0.005,
    });
  }

  const trend = dt.getVolatilityTrend();
  expect(["increasing", "stable"]).toContain(trend);
});

test("DynamicThresholds provides reasoning for adjustments", () => {
  const dt = new DynamicThresholds();

  const metrics: VolatilityMetrics = {
    vix: 35,
    atr20: 5.0,
    realizedVol: 0.04,
  };

  const thresholds = dt.calculateThresholds(metrics);
  expect(thresholds.reasoning.length).toBeGreaterThan(0);
});

test("DynamicThresholds resets history correctly", () => {
  const dt = new DynamicThresholds();

  dt.calculateThresholds({ vix: 20, atr20: 3.0, realizedVol: 0.02 });
  dt.calculateThresholds({ vix: 22, atr20: 3.2, realizedVol: 0.025 });

  dt.resetHistory();

  // After reset, should return normal regime
  expect(dt.getVolatilityTrend()).toBe("stable");
});
