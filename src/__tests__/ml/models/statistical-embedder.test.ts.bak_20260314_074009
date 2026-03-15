import { test, expect } from "bun:test";
import { StatisticalEmbedder } from "../../../ml/models/statistical-embedder";
import type { TradeMemory } from "../../../agentdb-integration";

test("StatisticalEmbedder generates 256-dim vector", () => {
  const embedder = new StatisticalEmbedder();
  const trade: TradeMemory = {
    id: "t1",
    symbol: "AAPL",
    side: "buy",
    entryPrice: 145,
    stopLoss: 142,
    takeProfit: 150,
    shares: 10,
    strategy: "mean_reversion",
    marketCondition: "neutral",
    reasoning: "Oversold bounce",
    mistakes: [],
    lessons: [],
    timestamp: Date.now(),
  };

  const embedding = embedder.generate(trade);
  expect(embedding).toHaveLength(256);
  expect(embedder.dimensions).toBe(256);
});
