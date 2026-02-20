import { test, expect } from "bun:test";
import { SyncManager } from "./sync-manager.js";

test("SyncManager should sync trades to AgentDB", async () => {
    const syncManager = new SyncManager();

    const mockTrade = {
        id: "trade_123",
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish" as const,
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    // Should not throw
    await expect(syncManager.syncTradeToAgentDB(mockTrade)).resolves.toBeUndefined();
});

test("SyncManager should handle missing trade data gracefully", async () => {
    const syncManager = new SyncManager();

    // Should return empty array without error
    const result = await syncManager.getUnsyncedTrades();
    expect(Array.isArray(result)).toBe(true);
});
