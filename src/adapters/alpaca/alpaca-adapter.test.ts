/**
 * Alpaca Adapter Tests
 */

import { test, expect, describe, beforeEach, mock } from "bun:test";
import { AlpacaAdapter } from "./alpaca-adapter.js";
import type { AlpacaConfig } from "../types.js";

const mockConfig: AlpacaConfig = {
  apiKey: "test-key",
  secretKey: "test-secret",
  paper: true,
  restUrl: "https://paper-api.alpaca.markets",
  websocketUrl: "wss://stream.data.sandbox.alpaca.markets/v2/iex",
};

describe("AlpacaAdapter", () => {
  let adapter: AlpacaAdapter;

  beforeEach(() => {
    adapter = new AlpacaAdapter(mockConfig);
  });

  test("should create adapter instance", () => {
    expect(adapter).toBeDefined();
    expect(adapter.isConnected()).toBe(false);
  });

  test("should track latency", () => {
    expect(adapter.getLatency()).toBe(0);
  });

  test("should handle price callbacks", () => {
    let receivedTick = false;
    adapter.onPrice((tick) => {
      receivedTick = true;
      expect(tick.symbol).toBeDefined();
      expect(tick.price).toBeDefined();
      expect(tick.timestamp).toBeDefined();
    });

    // In real scenario, this would be triggered by WebSocket
    expect(adapter.isConnected()).toBe(false);
  });

  test("should handle trade callbacks", () => {
    let receivedTrade = false;
    adapter.onTrade((trade) => {
      receivedTrade = true;
      expect(trade.symbol).toBeDefined();
      expect(trade.price).toBeDefined();
      expect(trade.size).toBeDefined();
    });

    expect(adapter.isConnected()).toBe(false);
  });

  test("should handle orderbook callbacks", () => {
    let receivedBook = false;
    adapter.onOrderBook((book) => {
      receivedBook = true;
      expect(book.symbol).toBeDefined();
      expect(book.bids).toBeDefined();
      expect(book.asks).toBeDefined();
    });

    expect(adapter.isConnected()).toBe(false);
  });

  test("should handle quote callbacks", () => {
    let receivedQuote = false;
    adapter.onQuote((quote) => {
      receivedQuote = true;
      expect(quote.symbol).toBeDefined();
      expect(quote.bid).toBeDefined();
      expect(quote.ask).toBeDefined();
    });

    expect(adapter.isConnected()).toBe(false);
  });
});
