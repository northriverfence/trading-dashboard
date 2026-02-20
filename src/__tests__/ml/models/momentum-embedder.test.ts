import { test, expect } from "bun:test";
import { MomentumEmbedder } from "../../../ml/models/momentum-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("MomentumEmbedder generates 512-dim vector", () => {
  const embedder = new MomentumEmbedder();
  const trade: TradeMemory = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 155,
    stopLoss: 150,
    takeProfit: 165,
    shares: 10,
    strategy: "trend_following",
    marketCondition: "bullish",
    reasoning: "Breakout with momentum",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  };

  const embedding = embedder.generate(trade);
  expect(embedding).toHaveLength(512);
  expect(embedder.dimensions).toBe(512);
});
