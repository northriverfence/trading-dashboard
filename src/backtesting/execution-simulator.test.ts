/**
 * Execution Simulator Tests
 */

import { test, expect, describe } from "bun:test";
import { ExecutionSimulator } from "./execution-simulator.js";
import type { OrderRequest, Bar } from "../adapters/types.js";

describe("ExecutionSimulator", () => {
  const simulator = new ExecutionSimulator(0.001, 0.001); // 0.1% commission and slippage

  const createBar = (close: number, volume: number = 10000): Bar => ({
    symbol: "AAPL",
    timestamp: new Date("2024-01-01"),
    open: close * 0.99,
    high: close * 1.01,
    low: close * 0.98,
    close,
    volume,
  });

  const createOrder = (
    side: "buy" | "sell",
    qty: number,
    type: "market" | "limit" = "market",
    limitPrice?: number,
  ): OrderRequest => ({
    symbol: "AAPL",
    side,
    qty,
    type,
    limitPrice,
    timeInForce: "day",
  });

  test("should simulate immediate buy fill", () => {
    const bar = createBar(150);
    const order = createOrder("buy", 100);

    const fill = simulator.simulateFill(order, bar, "immediate");

    expect(fill).not.toBeNull();
    expect(fill!.side).toBe("buy");
    expect(fill!.qty).toBe(100);
    expect(fill!.price).toBeGreaterThan(bar.close); // Includes slippage
    expect(fill!.commission).toBeGreaterThan(0);
    expect(fill!.slippage).toBeGreaterThan(0);
  });

  test("should simulate immediate sell fill", () => {
    const bar = createBar(150);
    const order = createOrder("sell", 100);

    const fill = simulator.simulateFill(order, bar, "immediate");

    expect(fill).not.toBeNull();
    expect(fill!.side).toBe("sell");
    expect(fill!.qty).toBe(100);
    expect(fill!.price).toBeLessThan(bar.close); // Includes slippage for sells
  });

  test("should simulate market order fill at open", () => {
    const bar = createBar(150);
    const order = createOrder("buy", 100);

    const fill = simulator.simulateFill(order, bar, "market");

    expect(fill).not.toBeNull();
    expect(fill!.price).toBeGreaterThan(bar.open); // Buy includes slippage
  });

  test("should fill limit buy order when price is low enough", () => {
    const bar = createBar(150, 10000);
    // Limit buy at 152 should fill if low <= 152
    const order = createOrder("buy", 100, "limit", 152);

    const fill = simulator.simulateFill(order, bar, "limit");

    expect(fill).not.toBeNull();
    expect(fill!.side).toBe("buy");
  });

  test("should not fill limit buy order when price is too high", () => {
    const bar = createBar(150, 10000);
    bar.low = 149;
    // Limit buy at 148 should not fill if low > 148
    const order = createOrder("buy", 100, "limit", 148);

    const fill = simulator.simulateFill(order, bar, "limit");

    expect(fill).toBeNull();
  });

  test("should fill limit sell order when price is high enough", () => {
    const bar = createBar(150, 10000);
    // Limit sell at 148 should fill if high >= 148
    const order = createOrder("sell", 100, "limit", 148);

    const fill = simulator.simulateFill(order, bar, "limit");

    expect(fill).not.toBeNull();
    expect(fill!.side).toBe("sell");
  });

  test("should not fill limit sell order when price is too low", () => {
    const bar = createBar(150, 10000);
    bar.high = 151;
    // Limit sell at 152 should not fill if high < 152
    const order = createOrder("sell", 100, "limit", 152);

    const fill = simulator.simulateFill(order, bar, "limit");

    expect(fill).toBeNull();
  });

  test("should calculate slippage based on volume", () => {
    const highVolumePrice = simulator.calculateSlippage(150, "buy", 1000000);
    const lowVolumePrice = simulator.calculateSlippage(150, "buy", 1000);

    // Lower volume should result in higher slippage (higher price for buys)
    expect(lowVolumePrice).toBeGreaterThan(highVolumePrice);
  });

  test("should calculate commission correctly", () => {
    const notional = 15000; // 100 shares at $150
    const commission = simulator.calculateCommission(notional);

    expect(commission).toBe(notional * 0.001); // 0.1%
  });

  test("should generate unique order IDs", () => {
    const bar = createBar(150);
    const order = createOrder("buy", 100);

    const fill1 = simulator.simulateFill(order, bar, "immediate");
    const fill2 = simulator.simulateFill(order, bar, "immediate");

    expect(fill1!.orderId).not.toBe(fill2!.orderId);
  });

  test("should handle limit order without limit price as market order", () => {
    const bar = createBar(150);
    const order = createOrder("buy", 100, "limit"); // No limit price

    const fill = simulator.simulateFill(order, bar, "limit");

    expect(fill).not.toBeNull();
  });
});
