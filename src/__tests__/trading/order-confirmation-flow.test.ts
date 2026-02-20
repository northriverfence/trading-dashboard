// src/__tests__/trading/order-confirmation-flow.test.ts

import { test, expect, beforeEach, describe } from "bun:test";
import {
  OrderConfirmationFlow,
  type OrderConfirmationRequest,
  type OrderConfirmationResult,
  type OrderConfirmationConfig,
  type RiskWarning,
  type ConfirmationLogEntry,
} from "../../trading/order-confirmation-flow.js";
import { TradingModeManager, type TradingMode } from "../../trading/trading-mode-manager.js";
import type { Order } from "../../trading/types.js";

describe("OrderConfirmationFlow", () => {
  let confirmationFlow: OrderConfirmationFlow;
  let modeManager: TradingModeManager;

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

  beforeEach(() => {
    modeManager = new TradingModeManager({ initialMode: "simulation" });
    confirmationFlow = new OrderConfirmationFlow({
      modeManager,
      confirmationTimeoutMs: 5000,
      cooldownPeriodMs: 1000,
    });
  });

  describe("Initialization", () => {
    test("initializes with default configuration", () => {
      const flow = new OrderConfirmationFlow({ modeManager });
      expect(flow).toBeDefined();
    });

    test("initializes with custom configuration", () => {
      const config: OrderConfirmationConfig = {
        modeManager,
        confirmationTimeoutMs: 10000,
        cooldownPeriodMs: 5000,
        maxOrderValueForWarning: 50000,
        maxPositionSizeForWarning: 1000,
      };
      const flow = new OrderConfirmationFlow(config);
      expect(flow).toBeDefined();
    });

    test("has no pending confirmations initially", () => {
      const pending = confirmationFlow.getPendingConfirmations();
      expect(pending).toHaveLength(0);
    });

    test("has empty confirmation log initially", () => {
      const logs = confirmationFlow.getConfirmationLog();
      expect(logs).toHaveLength(0);
    });
  });

  describe("Mode-Based Confirmation Requirements", () => {
    test("requires confirmation for live mode orders", async () => {
      // Switch to live mode
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.requiresConfirmation).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("Confirmation required");
    });

    test("skips confirmation for simulation mode orders", async () => {
      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.requiresConfirmation).toBe(false);
      expect(result.approved).toBe(true);
    });

    test("skips confirmation for paper mode orders", async () => {
      await modeManager.requestModeChange("paper");

      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.requiresConfirmation).toBe(false);
      expect(result.approved).toBe(true);
    });

    test("auto-approves orders in non-live modes", async () => {
      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.approved).toBe(true);
      expect(result.orderId).toBe(order.id);
    });
  });

  describe("Order Details Display", () => {
    test("displays correct order details in confirmation request", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        symbol: "TSLA",
        side: "sell",
        qty: 50,
        type: "limit",
        limitPrice: 250.5,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.orderDetails).toBeDefined();
      expect(result.orderDetails?.symbol).toBe("TSLA");
      expect(result.orderDetails?.side).toBe("sell");
      expect(result.orderDetails?.qty).toBe(50);
      expect(result.orderDetails?.type).toBe("limit");
      expect(result.orderDetails?.price).toBe(250.5);
    });

    test("calculates order value for market orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        type: "market",
        qty: 100,
      });

      // Mock current price for the symbol
      const result = await confirmationFlow.requestOrderConfirmation(order, {
        currentPrice: 150.0,
      });

      expect(result.orderDetails?.estimatedValue).toBe(15000); // 100 * 150
    });

    test("calculates order value for limit orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        type: "limit",
        limitPrice: 200,
        qty: 50,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.orderDetails?.estimatedValue).toBe(10000); // 50 * 200
    });
  });

  describe("Risk Warnings", () => {
    test("shows risk warning for large order value", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        qty: 1000,
        type: "limit",
        limitPrice: 100,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.riskWarnings).toBeDefined();
      expect(result.riskWarnings?.length).toBeGreaterThan(0);
      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "order_value")).toBe(true);
    });

    test("shows risk warning for large position size", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        qty: 5000,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order, {
        currentPrice: 50,
      });

      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "position_size")).toBe(true);
    });

    test("shows risk warning for high daily loss impact", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        side: "sell",
        qty: 100,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order, {
        currentPrice: 100,
        dailyPnl: -5000, // Already down $5000 today
      });

      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "daily_loss")).toBe(true);
    });

    test("includes severity level in risk warnings", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        qty: 10000,
        type: "limit",
        limitPrice: 500,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      const warnings = result.riskWarnings ?? [];
      expect(warnings.length).toBeGreaterThan(0);
      for (const warning of warnings) {
        expect(warning.severity).toBeDefined();
        expect(["low", "medium", "high", "critical"]).toContain(warning.severity);
      }
    });
  });

  describe("Confirmation Cooldown", () => {
    test("implements cooldown period between confirmations", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order1 = createMockOrder({ id: "order-1" });
      const result1 = await confirmationFlow.requestOrderConfirmation(order1);
      expect(result1.requiresConfirmation).toBe(true);

      // Confirm first order
      await confirmationFlow.confirmOrder(order1.id);

      // Try second order immediately (should be in cooldown)
      const order2 = createMockOrder({ id: "order-2" });
      const result2 = await confirmationFlow.requestOrderConfirmation(order2);

      expect(result2.inCooldown).toBe(true);
      expect(result2.cooldownRemainingMs).toBeGreaterThan(0);
    });

    test("allows confirmation after cooldown period expires", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      // Create flow with short cooldown for testing
      const shortCooldownFlow = new OrderConfirmationFlow({
        modeManager,
        confirmationTimeoutMs: 5000,
        cooldownPeriodMs: 50, // Very short for testing
      });

      const order1 = createMockOrder({ id: "order-1" });
      await shortCooldownFlow.requestOrderConfirmation(order1);
      await shortCooldownFlow.confirmOrder(order1.id);

      // Wait for cooldown to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      const order2 = createMockOrder({ id: "order-2" });
      const result2 = await shortCooldownFlow.requestOrderConfirmation(order2);

      expect(result2.inCooldown).toBe(false);
      expect(result2.requiresConfirmation).toBe(true);
    });

    test("cooldown is only applied in live mode", async () => {
      // In simulation mode - no cooldown
      const order1 = createMockOrder({ id: "order-1" });
      await confirmationFlow.requestOrderConfirmation(order1);

      const order2 = createMockOrder({ id: "order-2" });
      const result2 = await confirmationFlow.requestOrderConfirmation(order2);

      expect(result2.inCooldown).toBe(false);
      expect(result2.approved).toBe(true);
    });
  });

  describe("Confirmation Timeout", () => {
    test("tracks pending confirmations with timeout", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-123" });
      await confirmationFlow.requestOrderConfirmation(order);

      const pending = confirmationFlow.getPendingConfirmations();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.orderId).toBe("order-123");
      expect(pending[0]?.expiresAt).toBeInstanceOf(Date);
    });

    test("pending confirmation expires after timeout", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      // Create flow with short timeout
      const shortTimeoutFlow = new OrderConfirmationFlow({
        modeManager,
        confirmationTimeoutMs: 50, // Very short for testing
        cooldownPeriodMs: 1000,
      });

      const order = createMockOrder({ id: "order-123" });
      await shortTimeoutFlow.requestOrderConfirmation(order);

      // Should have pending confirmation
      expect(shortTimeoutFlow.getPendingConfirmations()).toHaveLength(1);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check expired - accessing pending should trigger cleanup
      const pending = shortTimeoutFlow.getPendingConfirmations();
      expect(pending).toHaveLength(0);
    });

    test("returns timeout info in confirmation result", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.timeoutAt).toBeInstanceOf(Date);
      expect(result.timeRemainingMs).toBeGreaterThan(0);
    });
  });

  describe("Order Cancellation", () => {
    test("supports cancellation of pending orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-to-cancel" });
      await confirmationFlow.requestOrderConfirmation(order);

      // Should have pending confirmation
      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(1);

      // Cancel the order
      const cancelled = confirmationFlow.cancelPendingOrder(order.id);
      expect(cancelled).toBe(true);

      // Should no longer be pending
      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(0);
    });

    test("returns false when cancelling non-existent order", () => {
      const cancelled = confirmationFlow.cancelPendingOrder("non-existent");
      expect(cancelled).toBe(false);
    });

    test("cannot confirm cancelled order", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-cancelled" });
      await confirmationFlow.requestOrderConfirmation(order);

      // Cancel first
      confirmationFlow.cancelPendingOrder(order.id);

      // Try to confirm
      const result = await confirmationFlow.confirmOrder(order.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Confirmation Logging", () => {
    test("logs all confirmation attempts", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-log-test" });
      await confirmationFlow.requestOrderConfirmation(order);

      const logs = confirmationFlow.getConfirmationLog();
      expect(logs.length).toBeGreaterThan(0);

      const entry = logs[logs.length - 1];
      expect(entry?.orderId).toBe("order-log-test");
      expect(entry?.timestamp).toBeInstanceOf(Date);
      expect(entry?.mode).toBe("live");
    });

    test("logs successful confirmations", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-success" });
      await confirmationFlow.requestOrderConfirmation(order);
      await confirmationFlow.confirmOrder(order.id);

      const logs = confirmationFlow.getConfirmationLog();
      const successEntry = logs.find(
        (l: ConfirmationLogEntry) => l.orderId === "order-success" && l.action === "confirmed",
      );
      expect(successEntry).toBeDefined();
    });

    test("logs cancelled orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "order-cancelled-log" });
      await confirmationFlow.requestOrderConfirmation(order);
      confirmationFlow.cancelPendingOrder(order.id);

      const logs = confirmationFlow.getConfirmationLog();
      const cancelEntry = logs.find(
        (l: ConfirmationLogEntry) => l.orderId === "order-cancelled-log" && l.action === "cancelled",
      );
      expect(cancelEntry).toBeDefined();
    });

    test("logs expired confirmations", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const shortTimeoutFlow = new OrderConfirmationFlow({
        modeManager,
        confirmationTimeoutMs: 50,
        cooldownPeriodMs: 1000,
      });

      const order = createMockOrder({ id: "order-expired" });
      await shortTimeoutFlow.requestOrderConfirmation(order);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger cleanup by getting pending
      shortTimeoutFlow.getPendingConfirmations();

      const logs = shortTimeoutFlow.getConfirmationLog();
      const expireEntry = logs.find(
        (l: ConfirmationLogEntry) => l.orderId === "order-expired" && l.action === "expired",
      );
      expect(expireEntry).toBeDefined();
    });

    test("includes mode in log entries", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder();
      await confirmationFlow.requestOrderConfirmation(order);

      const logs = confirmationFlow.getConfirmationLog();
      expect(logs[0]?.mode).toBe("live");
    });
  });

  describe("Confirmation Flow", () => {
    test("can confirm pending order", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "confirm-test" });
      await confirmationFlow.requestOrderConfirmation(order);

      const result = await confirmationFlow.confirmOrder(order.id);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    test("confirmed order is removed from pending", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "remove-pending" });
      await confirmationFlow.requestOrderConfirmation(order);

      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(1);

      await confirmationFlow.confirmOrder(order.id);

      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(0);
    });

    test("cannot confirm already confirmed order", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "double-confirm" });
      await confirmationFlow.requestOrderConfirmation(order);
      await confirmationFlow.confirmOrder(order.id);

      const secondResult = await confirmationFlow.confirmOrder(order.id);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain("not found");
    });

    test("returns error for non-existent order", async () => {
      const result = await confirmationFlow.confirmOrder("non-existent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Edge Cases", () => {
    test("handles multiple pending orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order1 = createMockOrder({ id: "multi-1" });
      const order2 = createMockOrder({ id: "multi-2" });

      await confirmationFlow.requestOrderConfirmation(order1);
      await confirmationFlow.requestOrderConfirmation(order2);

      const pending = confirmationFlow.getPendingConfirmations();
      expect(pending).toHaveLength(2);
    });

    test("handles rapid confirmation requests in live mode", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      // Create flow with very short cooldown
      const rapidFlow = new OrderConfirmationFlow({
        modeManager,
        confirmationTimeoutMs: 5000,
        cooldownPeriodMs: 10, // Very short
      });

      const order1 = createMockOrder({ id: "rapid-1" });
      const order2 = createMockOrder({ id: "rapid-2" });

      await rapidFlow.requestOrderConfirmation(order1);
      await rapidFlow.confirmOrder(order1.id);

      // Small delay to let cooldown pass
      await new Promise((resolve) => setTimeout(resolve, 50));

      const result2 = await rapidFlow.requestOrderConfirmation(order2);
      expect(result2.inCooldown).toBe(false);
    });

    test("handles mode switch during pending confirmation", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "mode-switch" });
      await confirmationFlow.requestOrderConfirmation(order);

      // Switch back to paper
      await modeManager.requestModeChange("paper");

      // Confirmation should still work
      const result = await confirmationFlow.confirmOrder(order.id);
      expect(result.success).toBe(true);
    });

    test("handles stop orders correctly", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        type: "stop",
        stopPrice: 150,
        qty: 100,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.orderDetails?.type).toBe("stop");
      expect(result.orderDetails?.stopPrice).toBe(150);
    });

    test("handles stop_limit orders correctly", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        type: "stop_limit",
        stopPrice: 150,
        limitPrice: 155,
        qty: 100,
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      expect(result.orderDetails?.type).toBe("stop_limit");
      expect(result.orderDetails?.stopPrice).toBe(150);
      expect(result.orderDetails?.limitPrice).toBe(155);
    });
  });

  describe("Configuration Options", () => {
    test("respects custom max order value threshold", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      // Create flow with low threshold
      const lowThresholdFlow = new OrderConfirmationFlow({
        modeManager,
        maxOrderValueForWarning: 5000, // Low threshold
      });

      const order = createMockOrder({
        qty: 100,
        type: "limit",
        limitPrice: 60, // $6000 value, exceeds threshold
      });

      const result = await lowThresholdFlow.requestOrderConfirmation(order);

      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "order_value")).toBe(true);
    });

    test("respects custom max position size threshold", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const lowThresholdFlow = new OrderConfirmationFlow({
        modeManager,
        maxPositionSizeForWarning: 50, // Low threshold
      });

      const order = createMockOrder({
        qty: 100, // Exceeds threshold
      });

      const result = await lowThresholdFlow.requestOrderConfirmation(order);

      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "position_size")).toBe(true);
    });

    test("uses default thresholds when not specified", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({
        qty: 10,
        type: "limit",
        limitPrice: 100, // Small order, shouldn't trigger warnings
      });

      const result = await confirmationFlow.requestOrderConfirmation(order);

      // Should not have high severity warnings for small orders
      const criticalWarnings = result.riskWarnings?.filter((w: RiskWarning) => w.severity === "critical") ?? [];
      expect(criticalWarnings.length).toBe(0);
    });
  });

  describe("Integration with TradingModeManager", () => {
    test("reads current mode from TradingModeManager", async () => {
      // Start in simulation
      expect(modeManager.getCurrentMode()).toBe("simulation");

      const order = createMockOrder();
      const result = await confirmationFlow.requestOrderConfirmation(order);

      // Should not require confirmation in simulation
      expect(result.requiresConfirmation).toBe(false);
    });

    test("detects mode changes dynamically", async () => {
      const order1 = createMockOrder({ id: "order-sim" });
      const result1 = await confirmationFlow.requestOrderConfirmation(order1);
      expect(result1.requiresConfirmation).toBe(false);

      // Switch to live mode
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order2 = createMockOrder({ id: "order-live" });
      const result2 = await confirmationFlow.requestOrderConfirmation(order2);
      expect(result2.requiresConfirmation).toBe(true);
    });

    test("integrates with mode manager safety status", async () => {
      const safetyStatus = modeManager.getSafetyStatus();
      expect(safetyStatus.currentMode).toBeDefined();
      expect(safetyStatus.warningLevel).toBeDefined();
    });
  });

  describe("Event Handling", () => {
    test("emits events on confirmation request", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const events: OrderConfirmationRequest[] = [];
      confirmationFlow.on("confirmationRequested", (event) => {
        events.push(event);
      });

      const order = createMockOrder();
      await confirmationFlow.requestOrderConfirmation(order);

      expect(events).toHaveLength(1);
      expect(events[0]?.orderId).toBe(order.id);
    });

    test("emits events on successful confirmation", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const events: OrderConfirmationResult[] = [];
      confirmationFlow.on("orderConfirmed", (event) => {
        events.push(event);
      });

      const order = createMockOrder({ id: "confirm-event" });
      await confirmationFlow.requestOrderConfirmation(order);
      await confirmationFlow.confirmOrder(order.id);

      expect(events).toHaveLength(1);
      expect(events[0]?.success).toBe(true);
      expect(events[0]?.orderId).toBe("confirm-event");
    });

    test("emits events on cancellation", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const events: OrderConfirmationResult[] = [];
      confirmationFlow.on("orderCancelled", (event) => {
        events.push(event);
      });

      const order = createMockOrder({ id: "cancel-event" });
      await confirmationFlow.requestOrderConfirmation(order);
      confirmationFlow.cancelPendingOrder(order.id);

      expect(events).toHaveLength(1);
      expect(events[0]?.orderId).toBe("cancel-event");
    });

    test("emits events on timeout", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const shortTimeoutFlow = new OrderConfirmationFlow({
        modeManager,
        confirmationTimeoutMs: 50,
        cooldownPeriodMs: 1000,
      });

      const events: OrderConfirmationResult[] = [];
      shortTimeoutFlow.on("orderExpired", (event) => {
        events.push(event);
      });

      const order = createMockOrder({ id: "expire-event" });
      await shortTimeoutFlow.requestOrderConfirmation(order);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger cleanup
      shortTimeoutFlow.getPendingConfirmations();

      expect(events).toHaveLength(1);
      expect(events[0]?.orderId).toBe("expire-event");
    });

    test("removeListener removes event handler", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const events: OrderConfirmationRequest[] = [];
      const handler = (event: OrderConfirmationRequest) => {
        events.push(event);
      };

      confirmationFlow.on("confirmationRequested", handler);

      const order = createMockOrder();
      await confirmationFlow.requestOrderConfirmation(order);
      expect(events).toHaveLength(1);

      confirmationFlow.removeListener("confirmationRequested", handler);

      const order2 = createMockOrder({ id: "order2" });
      await confirmationFlow.requestOrderConfirmation(order2);
      expect(events).toHaveLength(1); // Still 1, no new event
    });
  });

  describe("Error Handling", () => {
    test("handles missing mode manager gracefully", async () => {
      const flowWithoutManager = new OrderConfirmationFlow({});
      const order = createMockOrder();

      // Should not throw, should default to safe behavior
      const result = await flowWithoutManager.requestOrderConfirmation(order);
      expect(result.requiresConfirmation).toBe(true); // Safe default
    });

    test("handles invalid order data", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const invalidOrder = createMockOrder({
        qty: -100, // Invalid negative quantity
      });

      const result = await confirmationFlow.requestOrderConfirmation(invalidOrder);

      expect(
        result.riskWarnings?.some(
          (w: RiskWarning) => w.type === "invalid_order" || w.message.toLowerCase().includes("invalid"),
        ),
      ).toBe(true);
    });

    test("handles zero quantity orders", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const zeroOrder = createMockOrder({
        qty: 0,
      });

      const result = await confirmationFlow.requestOrderConfirmation(zeroOrder);

      expect(result.riskWarnings?.some((w: RiskWarning) => w.type === "invalid_order")).toBe(true);
    });
  });

  describe("State Management", () => {
    test("can clear all pending confirmations", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order1 = createMockOrder({ id: "clear-1" });
      const order2 = createMockOrder({ id: "clear-2" });

      await confirmationFlow.requestOrderConfirmation(order1);
      await confirmationFlow.requestOrderConfirmation(order2);

      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(2);

      confirmationFlow.clearPendingConfirmations();

      expect(confirmationFlow.getPendingConfirmations()).toHaveLength(0);
    });

    test("can clear confirmation log", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder();
      await confirmationFlow.requestOrderConfirmation(order);

      expect(confirmationFlow.getConfirmationLog().length).toBeGreaterThan(0);

      confirmationFlow.clearConfirmationLog();

      expect(confirmationFlow.getConfirmationLog()).toHaveLength(0);
    });

    test("getPendingConfirmation returns specific order", async () => {
      await modeManager.requestModeChange("paper");
      await modeManager.requestModeChange("live", { confirmed: true });

      const order = createMockOrder({ id: "specific-order" });
      await confirmationFlow.requestOrderConfirmation(order);

      const pending = confirmationFlow.getPendingConfirmation(order.id);
      expect(pending).toBeDefined();
      expect(pending?.orderId).toBe("specific-order");
    });

    test("getPendingConfirmation returns null for non-existent order", () => {
      const pending = confirmationFlow.getPendingConfirmation("non-existent");
      expect(pending).toBeNull();
    });
  });
});
