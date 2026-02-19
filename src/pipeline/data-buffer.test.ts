/**
 * Data Buffer Tests
 */

import { test, expect, describe, beforeEach } from "bun:test";
import { DataBuffer } from "./data-buffer.js";
import type { PriceTick, Trade, OrderBookUpdate, Bar } from "../adapters/types.js";

describe("DataBuffer", () => {
  let buffer: DataBuffer;

  beforeEach(() => {
    buffer = new DataBuffer("AAPL", 100);
  });

  test("should create buffer with symbol", () => {
    expect(buffer.symbol).toBe("AAPL");
    expect(buffer.getSize()).toBe(0);
    expect(buffer.getUtilization()).toBe(0);
  });

  test("should add and retrieve prices", () => {
    const tick: PriceTick = {
      symbol: "AAPL",
      timestamp: new Date(),
      price: 150.0,
      size: 100,
      exchange: "NASDAQ",
    };

    buffer.addPrice(tick);
    expect(buffer.getSize()).toBe(1);
    expect(buffer.getLatestPrice()).toEqual(tick);
    expect(buffer.getPrices(1)).toEqual([tick]);
  });

  test("should add and retrieve trades", () => {
    const trade: Trade = {
      symbol: "AAPL",
      timestamp: new Date(),
      price: 150.0,
      size: 100,
      side: "buy",
      exchange: "NASDAQ",
    };

    buffer.addTrade(trade);
    expect(buffer.getSize()).toBe(1);
    expect(buffer.getLatestTrade()).toEqual(trade);
    expect(buffer.getTrades(1)).toEqual([trade]);
  });

  test("should add and retrieve bars", () => {
    const bar: Bar = {
      symbol: "AAPL",
      timestamp: new Date(),
      open: 149.0,
      high: 151.0,
      low: 148.0,
      close: 150.0,
      volume: 10000,
    };

    buffer.addBar(bar);
    expect(buffer.getSize()).toBe(1);
    expect(buffer.getLatestBar()).toEqual(bar);
    expect(buffer.getBars(1)).toEqual([bar]);
  });

  test("should add and retrieve orderbook updates", () => {
    const update: OrderBookUpdate = {
      symbol: "AAPL",
      timestamp: new Date(),
      bids: [{ price: 149.5, size: 100 }],
      asks: [{ price: 150.5, size: 100 }],
      sequence: 1,
      isSnapshot: false,
    };

    buffer.addOrderBook(update);
    expect(buffer.getSize()).toBe(1);
    expect(buffer.getLatestOrderBook()).toEqual(update);
    expect(buffer.getOrderBookUpdates(1)).toEqual([update]);
  });

  test("should respect max size limit", () => {
    const smallBuffer = new DataBuffer("AAPL", 5);

    for (let i = 0; i < 10; i++) {
      smallBuffer.addPrice({
        symbol: "AAPL",
        timestamp: new Date(),
        price: 150 + i,
        size: 100,
        exchange: "NASDAQ",
      });
    }

    expect(smallBuffer.getPrices().length).toBe(5);
    expect(smallBuffer.getLatestPrice()?.price).toBe(159);
  });

  test("should clear all data", () => {
    buffer.addPrice({
      symbol: "AAPL",
      timestamp: new Date(),
      price: 150.0,
      size: 100,
      exchange: "NASDAQ",
    });

    expect(buffer.getSize()).toBeGreaterThan(0);
    buffer.clear();
    expect(buffer.getSize()).toBe(0);
    expect(buffer.getLatestPrice()).toBeUndefined();
  });

  test("should calculate utilization", () => {
    const smallBuffer = new DataBuffer("AAPL", 10);

    for (let i = 0; i < 5; i++) {
      smallBuffer.addPrice({
        symbol: "AAPL",
        timestamp: new Date(),
        price: 150 + i,
        size: 100,
        exchange: "NASDAQ",
      });
    }

    // 5 prices out of max 10 * 4 data types = 40 slots
    expect(smallBuffer.getUtilization()).toBe(5 / 40);
  });

  test("should return last n items with slice", () => {
    for (let i = 0; i < 5; i++) {
      buffer.addPrice({
        symbol: "AAPL",
        timestamp: new Date(),
        price: 150 + i,
        size: 100,
        exchange: "NASDAQ",
      });
    }

    const prices = buffer.getPrices(3);
    expect(prices.length).toBe(3);
    const first = prices[0];
    const last = prices[2];
    if (first) expect(first.price).toBe(152);
    if (last) expect(last.price).toBe(154);
  });
});
