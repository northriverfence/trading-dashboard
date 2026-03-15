// src/__tests__/trading/enhanced-risk-manager.test.ts

import { test, expect, beforeEach, describe } from "bun:test";
import {
  EnhancedRiskManager,
  type EnhancedRiskConfig,
  type RiskCheckResult,
  type RiskMetrics,
  type RiskWarning,
  type SymbolData,
  RiskLimitType,
} from "../../trading/enhanced-risk-manager.js";
import { TradingModeManager, type TradingMode } from "../../trading/trading-mode-manager.js";
import type { Order, Portfolio, Position } from "../../trading/types.js";

describe("EnhancedRiskManager", () => {
  let riskManager: EnhancedRiskManager;
  let modeManager: TradingModeManager;

  const defaultConfig: EnhancedRiskConfig = {
    dailyLossLimit: 5000,
    maxPositionSizePerSymbol: 1000,
    maxTotalExposure: 100000,
    maxOrderSizeAsPercentOfADV: 0.05, // 5% of ADV
    marketHoursOnly: true,
    highRiskThreshold: 25000,
    requireConfirmationForHighRisk: true,
    warningThresholdPercent: 0.8, // Warn at 80% of limits
    liveModeMultipliers: {
      dailyLossLimit: 0.5, // 50% stricter in live
      maxPositionSize: 0.6, // 60% of paper/sim limits
      maxTotalExposure: 0.7, // 70% of paper/sim limits
    },
  };

  const createMockPortfolio = (overrides: Partial<Portfolio> = {}): Portfolio => ({
    cash: 100000,
    equity: 100000,
    buyingPower: 100000,
    positions: [],
    dailyPnl: 0,
    totalPnl: 0,
    ...overrides,
  });

  const createMockPosition = (overrides: Partial<Position> = {}): Position => ({
    symbol: "AAPL",
    side: "long",
    qty: 100,
    avgEntryPrice: 150,
    currentPrice: 150,
    unrealizedPnl: 0,
    realizedPnl: 0,
    openedAt: new Date(),
    ...overrides,
  });

  const createMockOrder = (overrides: Partial<Order> = {}): Order => ({
    id: "order-123",
    symbol: "AAPL",
    side: "buy",
    qty: 100,
    type: "market",
    timeInForce: "day",
    status: "pending",
    createdAt: new Date(),
    ...overrides,
  });

  const createMockSymbolData = (overrides: Partial<SymbolData> = {}): SymbolData => ({
    symbol: "AAPL",
    avgDailyVolume: 1000000,
    lastPrice: 150,
    openPrice: 148,
    highPrice: 152,
    lowPrice: 147,
    ...overrides,
  });

  beforeEach(() => {
    modeManager = new TradingModeManager({ initialMode: "paper" });
    riskManager = new EnhancedRiskManager(defaultConfig, modeManager);
  });

  describe("Initialization", () => {
    test("initializes with default configuration", () => {
      const manager = new EnhancedRiskManager(defaultConfig);
      expect(manager).toBeDefined();
    });

    test("initializes with mode manager", () => {
      const manager = new EnhancedRiskManager(defaultConfig, modeManager);
      expect(manager).toBeDefined();
    });

    test("has no initial risk metrics", () => {
      const metrics = riskManager.getRiskMetrics();
      expect(metrics).toBeDefined();
    });

    test("has empty warning history initially", () => {
      const warnings = riskManager.getWarningHistory();
      expect(warnings).toHaveLength(0);
    });

    test("has empty rejected orders initially", () => {
      const rejected = riskManager.getRejectedOrders();
      expect(rejected).toHaveLength(0);
    });
  });

  describe("Daily Loss Limit (Circuit Breaker)", () => {
    test("allows order when daily loss is below limit", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -1000 }); // $1K loss, below $5K limit
      const order = createMockOrder({ qty: 100 });
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true);
    });

    test("rejects order when daily loss limit is reached", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -5000 }); // $5K loss, at limit
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("daily loss limit");
    });

    test("rejects order when daily loss exceeds limit", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -6000 }); // $6K loss, exceeds limit
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("daily loss limit");
    });

    test("applies stricter daily loss limit in live mode", async () => {
      // Switch to live mode
      await modeManager.requestModeChange("live", { confirmed: true });

      // In live mode, daily loss limit should be 50% of $5K = $2.5K
      const portfolio = createMockPortfolio({ dailyPnl: -3000 }); // $3K loss
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("daily loss limit");
    });

    test("emits warning when approaching daily loss limit", async () => {
      const warnings: RiskWarning[] = [];
      riskManager.on("riskWarning", (warning) => {
        warnings.push(warning);
      });

      // At 85% of $5K limit = $4.25K
      const portfolio = createMockPortfolio({ dailyPnl: -4250 });
      const order = createMockOrder({ qty: 10 });
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      const dailyLossWarning = warnings.find((w) => w.type === RiskLimitType.DAILY_LOSS);
      expect(dailyLossWarning).toBeDefined();
      expect(dailyLossWarning?.severity).toBe("high");
    });
  });

  describe("Maximum Position Size Per Symbol", () => {
    test("allows order when position size is within limit", async () => {
      // Use smaller position to not exceed total exposure limit ($100K max)
      // 100 shares × $150 = $15K existing, adding 200 shares × $150 = $30K, total $45K < $100K
      const portfolio = createMockPortfolio({
        positions: [createMockPosition({ symbol: "AAPL", qty: 100 })],
      });
      const order = createMockOrder({ symbol: "AAPL", qty: 200 }); // 100 + 200 = 300 < 1000
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      if (!result.approved) {
        console.log("DEBUG: Order rejected with reason:", result.reason);
      }
      expect(result.approved).toBe(true);
    });

    test("rejects order when position size would exceed limit", async () => {
      const portfolio = createMockPortfolio({
        positions: [createMockPosition({ symbol: "AAPL", qty: 900 })],
      });
      const order = createMockOrder({ symbol: "AAPL", qty: 200 }); // 900 + 200 = 1100 > 1000
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("position size");
    });

    test("applies stricter position size limit in live mode", async () => {
      await modeManager.requestModeChange("live", { confirmed: true });

      // In live mode, max position size should be 60% of 1000 = 600
      const portfolio = createMockPortfolio({
        positions: [createMockPosition({ symbol: "AAPL", qty: 500 })],
      });
      const order = createMockOrder({ symbol: "AAPL", qty: 150 }); // 500 + 150 = 650 > 600
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("position size");
    });

    test("calculates existing position correctly for sell orders", async () => {
      // Use smaller position to stay under total exposure limit ($100K max)
      // 300 shares × $150 = $45K, well under the limit
      const portfolio = createMockPortfolio({
        positions: [createMockPosition({ symbol: "AAPL", qty: 300 })],
      });
      const order = createMockOrder({ symbol: "AAPL", side: "sell", qty: 100 }); // Reducing position
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true); // Selling should be allowed
    });
  });

  describe("Maximum Total Exposure", () => {
    test("allows order when total exposure is within limit", async () => {
      const portfolio = createMockPortfolio({
        positions: [
          createMockPosition({ symbol: "AAPL", qty: 100, currentPrice: 150 }), // $15K
          createMockPosition({ symbol: "MSFT", qty: 100, currentPrice: 300 }), // $30K
        ],
        cash: 55000,
      });
      // Current exposure: $45K, new order: $10K, total: $55K < $100K
      const order = createMockOrder({ symbol: "TSLA", qty: 100 });
      const symbolData = createMockSymbolData({ symbol: "TSLA", lastPrice: 100 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true);
    });

    test("rejects order when total exposure would exceed limit", async () => {
      const portfolio = createMockPortfolio({
        positions: [
          createMockPosition({ symbol: "AAPL", qty: 300, currentPrice: 150 }), // $45K
          createMockPosition({ symbol: "MSFT", qty: 100, currentPrice: 400 }), // $40K
        ],
        cash: 15000,
      });
      // Current exposure: $85K, new order: $20K, total: $105K > $100K
      const order = createMockOrder({ symbol: "TSLA", qty: 100 });
      const symbolData = createMockSymbolData({ symbol: "TSLA", lastPrice: 200 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("exposure");
    });

    test("applies stricter exposure limit in live mode", async () => {
      await modeManager.requestModeChange("live", { confirmed: true });

      // In live mode, max exposure should be 70% of $100K = $70K
      const portfolio = createMockPortfolio({
        positions: [
          createMockPosition({ symbol: "AAPL", qty: 300, currentPrice: 150 }), // $45K
        ],
        cash: 35000,
      });
      // Current exposure: $45K, new order: $30K, total: $75K > $70K
      const order = createMockOrder({ symbol: "TSLA", qty: 100 });
      const symbolData = createMockSymbolData({ symbol: "TSLA", lastPrice: 300 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("exposure");
    });
  });

  describe("Order Size vs Average Daily Volume", () => {
    test("allows order when size is within ADV percentage", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 400 }); // 4% of 10K ADV < 5%, also < 1000 position limit
      const symbolData = createMockSymbolData({ avgDailyVolume: 10000 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true);
    });

    test("rejects order when size exceeds ADV percentage", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 600 }); // 6% of 10K ADV > 5%, but < 1000 position limit
      const symbolData = createMockSymbolData({ avgDailyVolume: 10000 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("ADV");
    });

    test("handles missing ADV data", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 100 });
      const symbolData = createMockSymbolData({ avgDailyVolume: undefined });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      // Should pass but with a warning
      expect(result.approved).toBe(true);
      expect(result.warnings?.some((w) => w.type === RiskLimitType.ADV_CHECK)).toBe(true);
    });
  });

  describe("Market Hours Check", () => {
    test("rejects orders outside market hours in live mode", async () => {
      await modeManager.requestModeChange("live", { confirmed: true });

      // Create a manager with market hours check enabled
      const manager = new EnhancedRiskManager({ ...defaultConfig, marketHoursOnly: true }, modeManager);

      // Mock after-hours time (8 PM EST = 1 AM UTC)
      const afterHours = new Date();
      afterHours.setUTCHours(1, 0, 0, 0);

      const portfolio = createMockPortfolio();
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      // Temporarily override Date
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(...args: (string | number | Date)[]) {
          if (args.length === 0) {
            super(afterHours);
          } else {
            super(...args);
          }
        }
      } as DateConstructor;

      const result = await manager.checkOrder(order, portfolio, symbolData);

      // Restore Date
      global.Date = originalDate;

      expect(result.approved).toBe(false);
      expect(result.reason).toContain("market hours");
    });

    test("allows orders during market hours", async () => {
      await modeManager.requestModeChange("live", { confirmed: true });

      // Mock market hours time (12 PM EST = 5 PM UTC)
      const marketHours = new Date();
      marketHours.setUTCHours(17, 0, 0, 0);

      const portfolio = createMockPortfolio();
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      // Temporarily override Date
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(...args: (string | number | Date)[]) {
          if (args.length === 0) {
            super(marketHours);
          } else {
            super(...args);
          }
        }
      } as DateConstructor;

      const result = await riskManager.checkOrder(order, portfolio, symbolData);

      // Restore Date
      global.Date = originalDate;

      expect(result.approved).toBe(true);
    });

    test("allows orders outside market hours in simulation mode", async () => {
      // Create manager that would reject after-hours in live mode
      const manager = new EnhancedRiskManager({ ...defaultConfig, marketHoursOnly: true }, modeManager);

      // Ensure we're in simulation mode
      expect(modeManager.getCurrentMode()).toBe("paper");

      // Mock after-hours time
      const afterHours = new Date();
      afterHours.setUTCHours(1, 0, 0, 0);

      const portfolio = createMockPortfolio();
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      // Temporarily override Date
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(...args: (string | number | Date)[]) {
          if (args.length === 0) {
            super(afterHours);
          } else {
            super(...args);
          }
        }
      } as DateConstructor;

      const result = await manager.checkOrder(order, portfolio, symbolData);

      // Restore Date
      global.Date = originalDate;

      // Should be allowed in paper/simulation mode
      expect(result.approved).toBe(true);
    });
  });

  describe("High Risk Order Confirmation", () => {
    test("requires confirmation for high-value orders", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 200, type: "limit", limitPrice: 150 });
      const symbolData = createMockSymbolData({ lastPrice: 150 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.reason).toContain("high risk");
    });

    test("does not require confirmation for low-value orders", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 10, type: "limit", limitPrice: 100 });
      const symbolData = createMockSymbolData({ lastPrice: 100 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.requiresConfirmation).toBe(false);
    });

    test("emits high risk warning event", async () => {
      const warnings: RiskWarning[] = [];
      riskManager.on("riskWarning", (warning) => {
        warnings.push(warning);
      });

      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 200, type: "limit", limitPrice: 150 });
      const symbolData = createMockSymbolData({ lastPrice: 150 });

      await riskManager.checkOrder(order, portfolio, symbolData);

      const highRiskWarning = warnings.find((w) => w.type === RiskLimitType.HIGH_RISK_ORDER);
      expect(highRiskWarning).toBeDefined();
      expect(highRiskWarning?.severity).toBe("medium");
    });
  });

  describe("Risk Metrics Tracking", () => {
    test("tracks risk metrics in real-time", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -2000 });
      const order = createMockOrder({ qty: 50 });
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      const metrics = riskManager.getRiskMetrics();
      expect(metrics.dailyLossUsed).toBe(2000);
      expect(metrics.dailyLossRemaining).toBe(3000);
    });

    test("updates risk metrics after each check", async () => {
      // First check
      const portfolio1 = createMockPortfolio({ dailyPnl: -1000 });
      const order1 = createMockOrder({ symbol: "AAPL", qty: 100 });
      await riskManager.checkOrder(order1, portfolio1, createMockSymbolData({ symbol: "AAPL" }));

      // Second check with different symbol
      const portfolio2 = createMockPortfolio({ dailyPnl: -3000 });
      const order2 = createMockOrder({ symbol: "MSFT", qty: 50 });
      await riskManager.checkOrder(order2, portfolio2, createMockSymbolData({ symbol: "MSFT" }));

      const metrics = riskManager.getRiskMetrics();
      expect(metrics).toBeDefined();
    });

    test("tracks rejected orders", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -5000 }); // At limit
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      const rejected = riskManager.getRejectedOrders();
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.orderId).toBe(order.id);
      expect(rejected[0]?.reason).toContain("daily loss limit");
    });
  });

  describe("Warning Emissions", () => {
    test("emits warning when approaching daily loss limit", async () => {
      const warnings: RiskWarning[] = [];
      riskManager.on("riskWarning", (warning) => {
        warnings.push(warning);
      });

      const portfolio = createMockPortfolio({ dailyPnl: -4000 }); // 80% of limit
      const order = createMockOrder({ qty: 10 });
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.type === RiskLimitType.DAILY_LOSS)).toBe(true);
    });

    test("emits warning when approaching position size limit", async () => {
      const warnings: RiskWarning[] = [];
      riskManager.on("riskWarning", (warning) => {
        warnings.push(warning);
      });

      // 500 shares × $150 = $75K exposure (under $100K limit)
      // 500 shares is 50% of 1000 position limit, but adding 350 more = 850 total (85% of limit)
      const portfolio = createMockPortfolio({
        positions: [createMockPosition({ symbol: "AAPL", qty: 500 })],
      });
      const order = createMockOrder({ symbol: "AAPL", qty: 350 }); // Will be at 850/1000 = 85% of limit
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      expect(warnings.some((w) => w.type === RiskLimitType.POSITION_SIZE)).toBe(true);
    });

    test("emits warning when approaching total exposure limit", async () => {
      const warnings: RiskWarning[] = [];
      riskManager.on("riskWarning", (warning) => {
        warnings.push(warning);
      });

      // 600 shares × $150 = $90K, which is 90% of $100K limit (above 80% threshold)
      const portfolio = createMockPortfolio({
        positions: [
          createMockPosition({ symbol: "AAPL", qty: 600, currentPrice: 150 }), // $90K
        ],
        cash: 5000,
      });
      // Adding a small order should trigger warning at 90%+ of limit
      const order = createMockOrder({ qty: 10 });
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      expect(warnings.some((w) => w.type === RiskLimitType.TOTAL_EXPOSURE)).toBe(true);
    });

    test("stores warning in history", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -4000 });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      const history = riskManager.getWarningHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("Live Trading Specific Limits", () => {
    test("applies stricter multipliers in live mode", async () => {
      await modeManager.requestModeChange("live", { confirmed: true });

      // Check that limits are stricter
      const limits = riskManager.getCurrentLimits();
      expect(limits.dailyLossLimit).toBe(defaultConfig.dailyLossLimit * 0.5); // 50%
      expect(limits.maxPositionSizePerSymbol).toBe(defaultConfig.maxPositionSizePerSymbol * 0.6); // 60%
      expect(limits.maxTotalExposure).toBe(defaultConfig.maxTotalExposure * 0.7); // 70%
    });

    test("uses standard limits in paper mode", async () => {
      // Ensure we're in paper mode
      expect(modeManager.getCurrentMode()).toBe("paper");

      const limits = riskManager.getCurrentLimits();
      expect(limits.dailyLossLimit).toBe(defaultConfig.dailyLossLimit);
      expect(limits.maxPositionSizePerSymbol).toBe(defaultConfig.maxPositionSizePerSymbol);
      expect(limits.maxTotalExposure).toBe(defaultConfig.maxTotalExposure);
    });

    test("uses standard limits in simulation mode", async () => {
      await modeManager.requestModeChange("simulation");

      const limits = riskManager.getCurrentLimits();
      expect(limits.dailyLossLimit).toBe(defaultConfig.dailyLossLimit);
    });
  });

  describe("Event Handling", () => {
    test("emits orderChecked event", async () => {
      const events: RiskCheckResult[] = [];
      riskManager.on("orderChecked", (event) => {
        events.push(event);
      });

      const portfolio = createMockPortfolio();
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      expect(events).toHaveLength(1);
      expect(events[0]?.orderId).toBe(order.id);
    });

    test("emits orderRejected event for rejected orders", async () => {
      const events: RiskCheckResult[] = [];
      riskManager.on("orderRejected", (event) => {
        events.push(event);
      });

      const portfolio = createMockPortfolio({ dailyPnl: -5000 });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);

      expect(events).toHaveLength(1);
      expect(events[0]?.approved).toBe(false);
    });

    test("removeListener removes event handler", async () => {
      const events: RiskCheckResult[] = [];
      const handler = (event: RiskCheckResult) => {
        events.push(event);
      };

      riskManager.on("orderChecked", handler);

      const portfolio = createMockPortfolio();
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);
      expect(events).toHaveLength(1);

      riskManager.removeListener("orderChecked", handler);

      await riskManager.checkOrder(order, portfolio, symbolData);
      expect(events).toHaveLength(1); // Still 1, no new event
    });
  });

  describe("Configuration Updates", () => {
    test("allows updating configuration", () => {
      const newConfig: Partial<EnhancedRiskConfig> = {
        dailyLossLimit: 10000,
        maxPositionSizePerSymbol: 2000,
      };

      riskManager.updateConfig(newConfig);

      const limits = riskManager.getCurrentLimits();
      expect(limits.dailyLossLimit).toBe(10000);
      expect(limits.maxPositionSizePerSymbol).toBe(2000);
    });

    test("preserves existing config values when partially updating", () => {
      const originalMaxExposure = defaultConfig.maxTotalExposure;

      riskManager.updateConfig({ dailyLossLimit: 8000 });

      const limits = riskManager.getCurrentLimits();
      expect(limits.dailyLossLimit).toBe(8000);
      expect(limits.maxTotalExposure).toBe(originalMaxExposure);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty portfolio", async () => {
      const portfolio = createMockPortfolio({ positions: [] });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true);
    });

    test("handles zero quantity orders", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: 0 });
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("quantity");
    });

    test("handles negative quantity orders", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ qty: -100 });
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("quantity");
    });

    test("handles sell orders without existing position", async () => {
      const portfolio = createMockPortfolio({ positions: [] });
      const order = createMockOrder({ side: "sell", qty: 100 });
      const symbolData = createMockSymbolData();

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      // Should allow short selling or handle appropriately
      expect(result).toBeDefined();
    });

    test("handles market orders without price", async () => {
      const portfolio = createMockPortfolio();
      const order = createMockOrder({ type: "market" });
      const symbolData = createMockSymbolData({ lastPrice: 150 });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result).toBeDefined();
    });

    test("handles multiple symbols in portfolio", async () => {
      // Total exposure: $15K + $12K + $7.5K = $34.5K (under $100K limit)
      const portfolio = createMockPortfolio({
        positions: [
          createMockPosition({ symbol: "AAPL", qty: 100, currentPrice: 150 }), // $15K
          createMockPosition({ symbol: "MSFT", qty: 40, currentPrice: 300 }), // $12K
          createMockPosition({ symbol: "GOOGL", qty: 50, currentPrice: 150 }), // $7.5K
        ],
      });
      const order = createMockOrder({ symbol: "TSLA", qty: 100 });
      const symbolData = createMockSymbolData({ symbol: "TSLA" });

      const result = await riskManager.checkOrder(order, portfolio, symbolData);
      expect(result.approved).toBe(true);
    });
  });

  describe("State Management", () => {
    test("can clear warning history", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -4000 });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);
      expect(riskManager.getWarningHistory().length).toBeGreaterThan(0);

      riskManager.clearWarningHistory();
      expect(riskManager.getWarningHistory()).toHaveLength(0);
    });

    test("can clear rejected orders", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -5000 });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);
      expect(riskManager.getRejectedOrders().length).toBeGreaterThan(0);

      riskManager.clearRejectedOrders();
      expect(riskManager.getRejectedOrders()).toHaveLength(0);
    });

    test("can reset all metrics", async () => {
      const portfolio = createMockPortfolio({ dailyPnl: -4000 });
      const order = createMockOrder();
      const symbolData = createMockSymbolData();

      await riskManager.checkOrder(order, portfolio, symbolData);
      riskManager.reset();

      expect(riskManager.getWarningHistory()).toHaveLength(0);
      expect(riskManager.getRejectedOrders()).toHaveLength(0);
      const metrics = riskManager.getRiskMetrics();
      expect(metrics.dailyLossUsed).toBe(0);
    });
  });
});
