import { test, expect } from "bun:test";
import { PriceActionEmbedder } from "../../../ml/models/price-action-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("PriceActionEmbedder generates 384-dim vector", () => {
  const embedder = new PriceActionEmbedder();
  const trade: TradeMemory = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 150,
    stopLoss: 145,
    takeProfit: 160,
    shares: 10,
    strategy: "breakout",
    marketCondition: "bullish",
    reasoning: "Breakout above resistance",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  };

  const embedding = embedder.generate(trade);
  expect(embedding).toHaveLength(384);
  expect(embedder.dimensions).toBe(384);
});

test("PriceActionEmbedder compares embeddings with cosine similarity", () => {
  const embedder = new PriceActionEmbedder();
  const a = new Array(384).fill(0);
  const b = new Array(384).fill(0);
  a[0] = 1;
  b[0] = 1;

  const similarity = embedder.compare(a, b);
  expect(similarity).toBeGreaterThan(0.99);
});
