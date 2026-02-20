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

test("EmbeddingCache throws error for maxSize = 0", () => {
  expect(() => new EmbeddingCache({ maxSize: 0 })).toThrow("maxSize must be a positive integer");
});

test("EmbeddingCache throws error for negative maxSize", () => {
  expect(() => new EmbeddingCache({ maxSize: -1 })).toThrow("maxSize must be a positive integer");
});

test("EmbeddingCache throws error for undefined maxSize", () => {
  expect(() => new EmbeddingCache({ maxSize: undefined as unknown as number })).toThrow(
    "maxSize must be a positive integer",
  );
});

test("EmbeddingCache handles empty embedding arrays", () => {
  const cache = new EmbeddingCache({ maxSize: 10 });

  cache.set("trade_1", []);
  const retrieved = cache.get("trade_1");

  expect(retrieved).toEqual([]);
});

test("EmbeddingCache updates value when setting same tradeId", () => {
  const cache = new EmbeddingCache({ maxSize: 2 });

  cache.set("trade_1", [1, 2, 3]);
  cache.set("trade_2", [4, 5, 6]);
  cache.set("trade_1", [10, 20, 30]); // Update trade_1, should become most recent

  // trade_1 should now be most recent, trade_2 is oldest
  cache.set("trade_3", [7, 8, 9]); // Should evict trade_2, not trade_1

  expect(cache.get("trade_1")).toEqual([10, 20, 30]);
  expect(cache.get("trade_2")).toBeNull();
  expect(cache.get("trade_3")).toEqual([7, 8, 9]);
});

test("EmbeddingCache clear followed by operations works correctly", () => {
  const cache = new EmbeddingCache({ maxSize: 10 });

  cache.set("trade_1", [1, 2, 3]);
  cache.get("trade_1"); // hit

  let stats = cache.getStats();
  expect(stats.hits).toBe(1);
  expect(stats.size).toBe(1);

  cache.clear();

  stats = cache.getStats();
  expect(stats.hits).toBe(0);
  expect(stats.misses).toBe(0);
  expect(stats.size).toBe(0);
  expect(stats.hitRate).toBe(0);

  // Should be able to use cache after clear
  cache.set("trade_2", [4, 5, 6]);
  expect(cache.get("trade_2")).toEqual([4, 5, 6]);

  stats = cache.getStats();
  expect(stats.hits).toBe(1);
  expect(stats.size).toBe(1);
});
