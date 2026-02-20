import { test, expect, beforeEach, afterEach } from "bun:test";
import { RealtimeQuotes } from "../../trading/realtime-quotes.js";

let quotes: RealtimeQuotes;

beforeEach(() => {
  quotes = new RealtimeQuotes({
    apiKey: "test_key",
    apiSecret: "test_secret",
    paper: true,
  });
});

afterEach(() => {
  quotes.disconnect();
});

test("RealtimeQuotes subscribes to symbols", () => {
  quotes.subscribe(["AAPL", "TSLA"]);
  const subscribed = quotes.getSubscribedSymbols();
  expect(subscribed).toContain("AAPL");
  expect(subscribed).toContain("TSLA");
});

test("RealtimeQuotes calls callback on quote update", (done) => {
  quotes.subscribe(["AAPL"]);

  quotes.onQuote((quote) => {
    expect(quote.symbol).toBe("AAPL");
    expect(quote.lastPrice).toBeGreaterThan(0);
    done();
  });

  // Simulate quote update
  quotes.simulateQuoteUpdate("AAPL", 155.5);
});

test("RealtimeQuotes unsubscribes from symbols", () => {
  quotes.subscribe(["AAPL", "TSLA"]);
  quotes.unsubscribe(["TSLA"]);

  const subscribed = quotes.getSubscribedSymbols();
  expect(subscribed).toContain("AAPL");
  expect(subscribed).not.toContain("TSLA");
});
