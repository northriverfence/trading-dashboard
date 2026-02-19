import { describe, it, expect } from "bun:test";
import { loadRiskConfig, validateRiskConfig, defaultRiskConfig } from "../../risk/config.js";

describe("Risk Config", () => {
  it("should load default config", () => {
    const config = loadRiskConfig();
    expect(config.dailyLossLimit).toBe(10);
    expect(config.maxPositionPct).toBe(0.1);
  });

  it("should apply config overrides", () => {
    const config = loadRiskConfig({ dailyLossLimit: 20 });
    expect(config.dailyLossLimit).toBe(20);
    expect(config.maxPositionPct).toBe(0.1); // Unchanged
  });

  it("should validate invalid configs", () => {
    const errors = validateRiskConfig({ ...defaultRiskConfig, maxPositionPct: 1.5 });
    expect(errors.length).toBeGreaterThan(0);
  });
});
