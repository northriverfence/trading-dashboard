import { test, expect } from "bun:test";
import { MemoryCompressor } from "../../memory/compressor.js";

test("Compressor deduplicates similar embeddings", () => {
  const compressor = new MemoryCompressor({ similarityThreshold: 0.95 });

  const embeddings = [
    [1, 0, 0, 0],
    [1, 0.01, 0, 0], // Very similar to first
    [0, 1, 0, 0],
  ];

  const compressed = compressor.compress(embeddings);
  expect(compressed.length).toBeLessThan(embeddings.length);
});

test("Compressor preserves unique embeddings", () => {
  const compressor = new MemoryCompressor({ similarityThreshold: 0.95 });

  const embeddings = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ];

  const compressed = compressor.compress(embeddings);
  expect(compressed.length).toBe(3);
});
