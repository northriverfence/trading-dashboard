import { test, expect } from "bun:test";
import { EmbeddingCache } from "../../ml/embedding-cache";

test("EmbeddingCache stores and retrieves embeddings", () => {
  const cache = new EmbeddingCache({ maxSize: 100 });
  const tradeId = "trade_123";
  const embedding = new Array(384).fill(0.5);

  cache.set(tradeId, embedding);
  const retrieved = cache.get(tradeId);

  expect(retrieved).toEqual(embedding);
});

test("EmbeddingCache returns null for missing keys", () => {
  const cache = new EmbeddingCache({ maxSize: 100 });
  const result = cache.get("nonexistent");
  expect(result).toBeNull();
});

test("EmbeddingCache evicts oldest entries when full", () => {
  const cache = new EmbeddingCache({ maxSize: 2 });

  cache.set("trade_1", [1, 2, 3]);
  cache.set("trade_2", [4, 5, 6]);
  cache.set("trade_3", [7, 8, 9]); // Should evict trade_1

  expect(cache.get("trade_1")).toBeNull();
  expect(cache.get("trade_2")).toEqual([4, 5, 6]);
  expect(cache.get("trade_3")).toEqual([7, 8, 9]);
});

test("EmbeddingCache updates LRU order on access", () => {
  const cache = new EmbeddingCache({ maxSize: 2 });

  cache.set("trade_1", [1, 2, 3]);
  cache.set("trade_2", [4, 5, 6]);
  cache.get("trade_1"); // trade_1 now most recently used
  cache.set("trade_3", [7, 8, 9]); // Should evict trade_2, not trade_1

  expect(cache.get("trade_1")).toEqual([1, 2, 3]);
  expect(cache.get("trade_2")).toBeNull();
});

test("EmbeddingCache tracks hit rate", () => {
  const cache = new EmbeddingCache({ maxSize: 10 });

  cache.set("trade_1", [1, 2, 3]);
  cache.get("trade_1"); // hit
  cache.get("trade_2"); // miss

  const stats = cache.getStats();
  expect(stats.hits).toBe(1);
  expect(stats.misses).toBe(1);
  expect(stats.hitRate).toBe(0.5);
});
