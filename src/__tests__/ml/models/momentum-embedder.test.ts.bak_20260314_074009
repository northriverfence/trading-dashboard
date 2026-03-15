// src/__tests__/ml/models/momentum-embedder.test.ts
import { test, expect } from "bun:test";
import { MomentumEmbedder } from "../../../ml/models/momentum-embedder.js";
import type { TradeMemory } from "../../../agentdb-integration.js";

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

test("MomentumEmbedder has correct name and strategy", () => {
    const embedder = new MomentumEmbedder();
    expect(embedder.name).toBe("MomentumV1");
    expect(embedder.strategy).toBe("trend_following");
});

test("MomentumEmbedder generateBatch returns correct number of embeddings", () => {
    const embedder = new MomentumEmbedder();
    const trades: TradeMemory[] = [
        {
            id: "t1",
            symbol: "AAPL",
            side: "buy",
            entryPrice: 155,
            stopLoss: 150,
            takeProfit: 165,
            shares: 10,
            strategy: "trend_following",
            marketCondition: "bullish",
            reasoning: "Breakout",
            mistakes: [],
            lessons: [],
            timestamp: Date.now(),
        },
        {
            id: "t2",
            symbol: "TSLA",
            side: "buy",
            entryPrice: 250,
            stopLoss: 240,
            takeProfit: 270,
            shares: 5,
            strategy: "trend_following",
            marketCondition: "bullish",
            reasoning: "Momentum play",
            mistakes: [],
            lessons: [],
            timestamp: Date.now(),
        },
    ];

    const embeddings = embedder.generateBatch(trades);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(512);
    expect(embeddings[1]).toHaveLength(512);
});

test("MomentumEmbedder compare returns cosine similarity", () => {
    const embedder = new MomentumEmbedder();
    const a = new Array(512).fill(0);
    const b = new Array(512).fill(0);
    a[0] = 1;
    b[0] = 1;

    const similarity = embedder.compare(a, b);
    expect(similarity).toBeCloseTo(1, 5);

    // Orthogonal vectors should have 0 similarity
    const c = new Array(512).fill(0);
    const d = new Array(512).fill(0);
    c[0] = 1;
    d[1] = 1;
    expect(embedder.compare(c, d)).toBeCloseTo(0, 5);
});

test("MomentumEmbedder compare handles zero vectors", () => {
    const embedder = new MomentumEmbedder();
    const a = new Array(512).fill(0);
    const b = new Array(512).fill(0);

    expect(embedder.compare(a, b)).toBe(0);
});

test("MomentumEmbedder getFeatureImportance returns feature weights", () => {
    const embedder = new MomentumEmbedder();
    const importance = embedder.getFeatureImportance();

    expect(importance.length).toBeGreaterThan(0);
    expect(importance[0]).toHaveProperty("feature");
    expect(importance[0]).toHaveProperty("importance");

    // Verify all importance values sum to approximately 1
    const total = importance.reduce((sum, f) => sum + f.importance, 0);
    expect(total).toBeCloseTo(1, 1);
});

test("MomentumEmbedder includes momentum-specific features", () => {
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
        reasoning: "Strong upward momentum",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    const embedding = embedder.generate(trade);

    // First 20 features should be non-zero (momentum indicators)
    const firstFeatures = embedding.slice(0, 20);
    const hasNonZero = firstFeatures.some(f => f !== 0);
    expect(hasNonZero).toBe(true);

    // Verify all values are within reasonable bounds
    for (const value of embedding) {
        expect(value).toBeGreaterThanOrEqual(-10);
        expect(value).toBeLessThanOrEqual(10);
    }
});

test("MomentumEmbedder handles edge cases gracefully", () => {
    const embedder = new MomentumEmbedder();

    // Trade with minimal data
    const minimalTrade: TradeMemory = {
        id: "t1",
        symbol: "AAPL",
        side: "buy",
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 110,
        shares: 1,
        strategy: "trend_following",
        marketCondition: "neutral",
        reasoning: "",
        mistakes: [],
        lessons: [],
        timestamp: 0,
    };

    const embedding = embedder.generate(minimalTrade);
    expect(embedding).toHaveLength(512);
    expect(embedder.dimensions).toBe(512);
});
