import { test, expect } from "bun:test";
import { TradingAgentDB } from "./agentdb-integration.js";

test("TradingAgentDB should store with namespace", async () => {
    const db = new TradingAgentDB();
    await db.initialize();

    // Should not throw when storing with namespace
    await expect(
        db.store(
            {
                id: "test_123",
                content: "Test memory",
                embedding: new Array(384).fill(0),
                timestamp: Date.now(),
                importance: 0.5,
                metadata: { type: "test" },
            },
            "backtests",
        ),
    ).resolves.toBeUndefined();
});
