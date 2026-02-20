import { test, expect } from "bun:test";
import { HybridLearningSystem } from "./hybrid-learning-system.js";

test("HybridLearningSystem should save trade to both systems", async () => {
    const learning = new HybridLearningSystem();

    const trade = {
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        entryTime: new Date().toISOString(),
        status: "open" as const,
        outcome: "open" as const,
        marketCondition: "bullish" as const,
        strategy: "breakout",
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
    };

    const saved = learning.recordTrade(trade);
    expect(saved.id).toBeDefined();
    expect(saved.symbol).toBe("AAPL");
});

test("HybridLearningSystem should find similar trades via AgentDB", async () => {
    const learning = new HybridLearningSystem();

    const queryTrade = {
        id: "query_123",
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish" as const,
        reasoning: "Query",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    // Should return array (may be empty if no trades yet)
    const similar = await learning.findSimilarTrades(queryTrade, 5);
    expect(Array.isArray(similar)).toBe(true);
});
