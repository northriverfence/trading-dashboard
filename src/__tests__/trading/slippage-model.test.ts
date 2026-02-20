import { test, expect, describe } from "bun:test";
import { SlippageModel, type SlippageConfig } from "../../trading/slippage-model.js";

describe("SlippageModel", () => {
  const defaultConfig: SlippageConfig = {
    baseSlippage: 0.001, // 0.1% base slippage
    impactFactor: 0.01,  // Impact factor for volume participation
  };

  test("should initialize with default config", () => {
    const model = new SlippageModel(defaultConfig);
    expect(model).toBeDefined();
  });

  test("should apply base slippage for small orders relative to volume", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const orderSize = 100;  // Small order
    const volume = 100000000; // Very large volume (100M)

    const executionPrice = model.calculateExecutionPrice("buy", price, orderSize, volume);

    // For small order relative to volume, slippage should be close to base slippage
    // participation rate = 100/100M = 0.000001, sqrt = 0.001, impact = 0.01 * 0.001 = 0.00001 (negligible)
    // Buy orders get higher price: price * (1 + slippage)
    const expectedSlippage = defaultConfig.baseSlippage; // ~0.1%
    const expectedPrice = price * (1 + expectedSlippage);
    expect(executionPrice).toBeCloseTo(expectedPrice, 2); // Check to 2 decimal places
  });

  test("should apply higher slippage for larger orders", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const volume = 100000;

    const smallOrder = 100;   // 0.1% of volume
    const largeOrder = 10000; // 10% of volume

    const smallSlippage = model.calculateSlippage(smallOrder, volume);
    const largeSlippage = model.calculateSlippage(largeOrder, volume);

    // Large orders should have significantly higher slippage
    expect(largeSlippage).toBeGreaterThan(smallSlippage);
  });

  test("should increase price for buy orders (positive slippage)", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const orderSize = 1000;
    const volume = 100000;

    const executionPrice = model.calculateExecutionPrice("buy", price, orderSize, volume);

    // Buy orders should have execution price higher than market price
    expect(executionPrice).toBeGreaterThan(price);
  });

  test("should decrease price for sell orders (negative slippage)", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const orderSize = 1000;
    const volume = 100000;

    const executionPrice = model.calculateExecutionPrice("sell", price, orderSize, volume);

    // Sell orders should have execution price lower than market price
    expect(executionPrice).toBeLessThan(price);
  });

  test("should return near-zero slippage when volume is very high", () => {
    const model = new SlippageModel(defaultConfig);
    const orderSize = 100;
    const veryHighVolume = 100000000; // Very high volume

    const slippage = model.calculateSlippage(orderSize, veryHighVolume);

    // Slippage should be close to base slippage (minimum)
    expect(slippage).toBeCloseTo(defaultConfig.baseSlippage, 4);
  });

  test("should use configurable base slippage", () => {
    const customConfig: SlippageConfig = {
      baseSlippage: 0.0005, // 0.05% base slippage
      impactFactor: 0.01,
    };
    const model = new SlippageModel(customConfig);
    const orderSize = 100;
    const volume = 10000000;

    const slippage = model.calculateSlippage(orderSize, volume);

    // Should use custom base slippage
    expect(slippage).toBeCloseTo(customConfig.baseSlippage, 4);
  });

  test("should use configurable impact factor", () => {
    const lowImpactConfig: SlippageConfig = {
      baseSlippage: 0.001,
      impactFactor: 0.005, // Lower impact factor
    };
    const highImpactConfig: SlippageConfig = {
      baseSlippage: 0.001,
      impactFactor: 0.02,  // Higher impact factor
    };

    const lowImpactModel = new SlippageModel(lowImpactConfig);
    const highImpactModel = new SlippageModel(highImpactConfig);

    const orderSize = 5000;
    const volume = 100000;

    const lowSlippage = lowImpactModel.calculateSlippage(orderSize, volume);
    const highSlippage = highImpactModel.calculateSlippage(orderSize, volume);

    // Higher impact factor should result in higher slippage
    expect(highSlippage).toBeGreaterThan(lowSlippage);
  });

  test("should use square root model for non-linear impact", () => {
    const model = new SlippageModel(defaultConfig);
    const volume = 100000;

    // Order sizes with 4x relationship
    const orderSize1 = 1000;  // 1% of volume
    const orderSize2 = 4000;  // 4% of volume

    const slippage1 = model.calculateSlippage(orderSize1, volume);
    const slippage2 = model.calculateSlippage(orderSize2, volume);

    // With square root model, 4x order size should result in 2x slippage impact (plus base)
    const impact1 = slippage1 - defaultConfig.baseSlippage;
    const impact2 = slippage2 - defaultConfig.baseSlippage;

    expect(impact2).toBeCloseTo(impact1 * 2, 1);
  });

  test("should handle edge case of zero volume gracefully", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const orderSize = 1000;

    // Should not throw and should return reasonable fallback
    const executionPrice = model.calculateExecutionPrice("buy", price, orderSize, 0);
    expect(executionPrice).toBeDefined();
    expect(executionPrice).toBeGreaterThan(0);
  });

  test("should handle edge case of zero order size", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const volume = 100000;

    const slippage = model.calculateSlippage(0, volume);

    // Zero order size should result in just base slippage
    expect(slippage).toBeCloseTo(defaultConfig.baseSlippage, 4);
  });

  test("should return consistent results for same inputs", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 150.0;
    const orderSize = 500;
    const volume = 500000;

    const executionPrice1 = model.calculateExecutionPrice("buy", price, orderSize, volume);
    const executionPrice2 = model.calculateExecutionPrice("buy", price, orderSize, volume);

    expect(executionPrice1).toBe(executionPrice2);
  });

  test("should calculate different slippage for buy vs sell at same size", () => {
    const model = new SlippageModel(defaultConfig);
    const price = 100.0;
    const orderSize = 1000;
    const volume = 100000;

    const buyPrice = model.calculateExecutionPrice("buy", price, orderSize, volume);
    const sellPrice = model.calculateExecutionPrice("sell", price, orderSize, volume);

    // Buy price should be higher than sell price
    expect(buyPrice).toBeGreaterThan(sellPrice);
    // Market price should be between buy and sell execution prices
    expect(buyPrice).toBeGreaterThan(price);
    expect(sellPrice).toBeLessThan(price);
  });

  test("should expose config values via getter", () => {
    const model = new SlippageModel(defaultConfig);
    const config = model.getConfig();

    expect(config.baseSlippage).toBe(defaultConfig.baseSlippage);
    expect(config.impactFactor).toBe(defaultConfig.impactFactor);
  });
});
