import { test, expect } from "bun:test";
import { AlpacaProvider } from "../../trading/alpaca-provider.js";

test("AlpacaProvider fetches quote for symbol", async () => {
  const provider = new AlpacaProvider({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });

  // Mock the API call
  const quote = await provider.getQuote("AAPL");

  expect(quote.symbol).toBe("AAPL");
  expect(quote.lastPrice).toBeGreaterThan(0);
  expect(quote.bid).toBeGreaterThan(0);
  expect(quote.ask).toBeGreaterThan(0);
});

test("AlpacaProvider fetches historical bars", async () => {
  const provider = new AlpacaProvider({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });

  const bars = await provider.getBars("AAPL", "1D", {
    start: new Date("2024-01-01"),
    end: new Date("2024-01-31"),
  });

  expect(bars.length).toBeGreaterThan(0);
  expect(bars[0]).toHaveProperty("open");
  expect(bars[0]).toHaveProperty("high");
  expect(bars[0]).toHaveProperty("low");
  expect(bars[0]).toHaveProperty("close");
  expect(bars[0]).toHaveProperty("volume");
});
