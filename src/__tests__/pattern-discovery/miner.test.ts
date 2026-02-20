import { test, expect } from "bun:test";
import { PatternMiner } from "../../pattern-discovery/miner.js";
import type { TradeMemory } from "../../agentdb-integration.js";
import type { DiscoveredPattern } from "../../pattern-discovery/types.js";

test("PatternMiner mines patterns from trades", () => {
    const miner = new PatternMiner({ minSupport: 0.3, minConfidence: 0.6 });

    const trades: TradeMemory[] = [
        { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, strategy: "breakout", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
        { id: "t2", symbol: "AAPL", side: "buy", entryPrice: 101, shares: 10, strategy: "breakout", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
        { id: "t3", symbol: "TSLA", side: "buy", entryPrice: 200, shares: 5, strategy: "momentum", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
    ];

    const patterns = miner.minePatterns(trades, 1);
    expect(patterns.length).toBeGreaterThan(0);
});

test("PatternMiner filters by minimum support", () => {
    const miner = new PatternMiner({ minSupport: 0.5, minConfidence: 0.6 });

    const trades: TradeMemory[] = [
        { id: "t1", symbol: "AAPL", side: "buy", entryPrice: 100, shares: 10, strategy: "breakout", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
        { id: "t2", symbol: "AAPL", side: "buy", entryPrice: 101, shares: 10, strategy: "breakout", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
        { id: "t3", symbol: "TSLA", side: "buy", entryPrice: 200, shares: 5, strategy: "momentum", marketCondition: "bullish", timestamp: Date.now(), mistakes: [], lessons: [] },
    ];

    const patterns = miner.minePatterns(trades, 1);
    // With minSupport 0.5, need at least 2/3 trades to have same feature
    expect(patterns.every(p => p.winRate >= 0.5)).toBe(true);
});

test("PatternMiner handles empty trades", () => {
    const miner = new PatternMiner({ minSupport: 0.3, minConfidence: 0.6 });
    const patterns = miner.minePatterns([], 1);
    expect(patterns).toEqual([]);
});
