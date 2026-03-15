import { test, expect } from "bun:test";
import {
    EmbeddingRegistry,
    EmbeddingCache,
    PriceActionEmbedder,
    StatisticalEmbedder,
    MomentumEmbedder,
} from "../../ml/index";
import type { EmbeddingModel, CacheConfig, CacheStats } from "../../ml/index";

test("ML module exports EmbeddingRegistry", () => {
    expect(EmbeddingRegistry).toBeDefined();
    const registry = new EmbeddingRegistry();
    expect(registry).toBeInstanceOf(EmbeddingRegistry);
});

test("ML module exports EmbeddingCache", () => {
    expect(EmbeddingCache).toBeDefined();
    const cache = new EmbeddingCache({ maxSize: 10 });
    expect(cache).toBeInstanceOf(EmbeddingCache);
});

test("ML module exports PriceActionEmbedder", () => {
    const embedder = new PriceActionEmbedder();
    expect(embedder.name).toBe("PriceActionV1");
    expect(embedder.dimensions).toBe(384);
    expect(embedder.strategy).toBe("breakout");
});

test("ML module exports StatisticalEmbedder", () => {
    const embedder = new StatisticalEmbedder();
    expect(embedder.name).toBe("StatisticalV1");
    expect(embedder.dimensions).toBe(256);
    expect(embedder.strategy).toBe("mean_reversion");
});

test("ML module exports MomentumEmbedder", () => {
    const embedder = new MomentumEmbedder();
    expect(embedder.name).toBe("MomentumV1");
    expect(embedder.dimensions).toBe(512);
    expect(embedder.strategy).toBe("trend_following");
});

test("ML module exports types", () => {
    // Type imports are compile-time only, just verify no runtime errors
    const config: CacheConfig = { maxSize: 100 };
    expect(config.maxSize).toBe(100);
});
