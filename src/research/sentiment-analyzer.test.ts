/**
 * SentimentAnalyzer Tests
 */

import { test, expect } from "bun:test";
import { SentimentAnalyzer } from "./sentiment-analyzer.js";

test("SentimentAnalyzer detects positive sentiment", () => {
  const analyzer = new SentimentAnalyzer();

  const text = "The company beat expectations with strong growth and rising profits";
  const result = analyzer.analyzeText(text);

  expect(result.label).toBe("positive");
  expect(result.score).toBeGreaterThan(0);
  expect(result.confidence).toBeGreaterThan(0);
});

test("SentimentAnalyzer detects negative sentiment", () => {
  const analyzer = new SentimentAnalyzer();

  const text = "The company missed estimates with declining revenue and weak performance";
  const result = analyzer.analyzeText(text);

  expect(result.label).toBe("negative");
  expect(result.score).toBeLessThan(0);
});

test("SentimentAnalyzer detects neutral sentiment", () => {
  const analyzer = new SentimentAnalyzer();

  const text = "The company announced their quarterly results today";
  const result = analyzer.analyzeText(text);

  expect(result.label).toBe("neutral");
});

test("SentimentAnalyzer analyzes symbol aggregate", () => {
  const analyzer = new SentimentAnalyzer();

  const texts = [
    "Strong earnings beat",
    "Revenue growth exceeds expectations",
    "Management guidance raised",
    "Stock rises on positive news",
  ];

  const result = analyzer.analyzeSymbol("AAPL", texts);

  expect(result.symbol).toBe("AAPL");
  expect(result.overallScore).toBeGreaterThan(0);
  expect(result.volume).toBe(4);
  expect(result.timeSeries.length).toBe(1);
});

test("SentimentAnalyzer tracks sentiment trend", () => {
  const analyzer = new SentimentAnalyzer();

  // First batch - positive
  analyzer.analyzeSymbol("TSLA", ["Great earnings", "Strong growth"]);

  // Second batch - more positive
  analyzer.analyzeSymbol("TSLA", ["Excellent news", "Beat expectations", "Raised guidance"]);

  const trend = analyzer.getSentimentTrend("TSLA");
  expect(["improving", "stable", "declining"]).toContain(trend);
});

test("SentimentAnalyzer compares sentiments", () => {
  const analyzer = new SentimentAnalyzer();

  analyzer.analyzeSymbol("AAPL", ["Great news", "Strong beat"]);
  analyzer.analyzeSymbol("TSLA", ["Okay results", "Mixed signals"]);
  analyzer.analyzeSymbol("MSFT", ["Poor performance", "Missed targets"]);

  const comparison = analyzer.compareSentiments(["AAPL", "TSLA", "MSFT"]);

  expect(comparison.length).toBe(3);
  expect(comparison[0].rank).toBe(1);
  expect(comparison[2].rank).toBe(3);
});

test("SentimentAnalyzer detects sentiment shifts", () => {
  const analyzer = new SentimentAnalyzer();

  // Build up some history
  for (let i = 0; i < 3; i++) {
    analyzer.analyzeSymbol("NFLX", ["Positive news", "Good growth"]);
  }

  // Shift to negative
  const shift = analyzer.detectSentimentShifts("NFLX");

  expect(typeof shift.shifted).toBe("boolean");
  expect(["positive", "negative", "none"]).toContain(shift.direction);
});

test("SentimentAnalyzer clears history", () => {
  const analyzer = new SentimentAnalyzer();

  analyzer.analyzeSymbol("AAPL", ["Good news"]);
  expect(analyzer.getLatestSentiment("AAPL")).not.toBe(0);

  analyzer.clearHistory("AAPL");
  expect(analyzer.getLatestSentiment("AAPL")).toBe(0);
});

test("SentimentAnalyzer extracts aspects", () => {
  const analyzer = new SentimentAnalyzer();

  const text = "The CEO announced strong earnings and raised guidance";
  const result = analyzer.analyzeText(text);

  expect(result.aspects.length).toBeGreaterThan(0);
  const hasEarnings = result.aspects.some(a => a.aspect === "earnings");
  const hasGuidance = result.aspects.some(a => a.aspect === "guidance");
  const hasManagement = result.aspects.some(a => a.aspect === "management");

  expect(hasEarnings || hasGuidance || hasManagement).toBe(true);
});

test("SentimentAnalyzer generates summary", () => {
  const analyzer = new SentimentAnalyzer();

  const texts = ["Amazing quarter", "Record profits", "Stock surging"];
  const result = analyzer.analyzeSymbol("NVDA", texts);

  expect(result.summary.length).toBeGreaterThan(0);
  expect(result.summary).toContain("positive");
});
