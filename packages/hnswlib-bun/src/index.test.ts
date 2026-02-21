import { test, expect } from "bun:test";
import { createL2Index, createCosineIndex, Index } from "../src/index.js";

test("createIndex creates L2 index", () => {
  const index = createL2Index(128, 1000);
  expect(index).toBeDefined();
  index.free();
});

test("createIndex creates cosine index", () => {
  const index = createCosineIndex(128, 1000);
  expect(index).toBeDefined();
  index.free();
});

test("addVector and searchKnn work", () => {
  const index = createL2Index(3, 100);

  // Add some vectors
  const v1 = new Float32Array([1, 2, 3]);
  const v2 = new Float32Array([4, 5, 6]);
  const v3 = new Float32Array([1, 2, 3.1]); // Close to v1

  index.addVector(v1, 1);
  index.addVector(v2, 2);
  index.addVector(v3, 3);

  // Search for nearest to v1
  const result = index.searchKnn(v1, 2);

  expect(result.indices.length).toBe(2);
  expect(result.distances.length).toBe(2);

  // First result should be v1 itself (distance ~0)
  expect(result.indices[0]).toBe(1);
  expect(result.distances[0]).toBeCloseTo(0, 5);

  index.free();
});

test("getCurrentCount returns correct count", () => {
  const index = createL2Index(3, 100);

  expect(index.getCurrentCount()).toBe(0);

  index.addVector(new Float32Array([1, 2, 3]), 1);
  expect(index.getCurrentCount()).toBe(1);

  index.addVector(new Float32Array([4, 5, 6]), 2);
  expect(index.getCurrentCount()).toBe(2);

  index.free();
});

test("save and load index", () => {
  const index = createL2Index(3, 100);

  index.addVector(new Float32Array([1, 2, 3]), 1);
  index.addVector(new Float32Array([4, 5, 6]), 2);

  const filename = "/tmp/test_index.bin";
  index.saveIndex(filename);

  // Load into new index
  const index2 = createL2Index(3, 100);
  index2.loadIndex(filename);

  expect(index2.getCurrentCount()).toBe(2);

  const result = index2.searchKnn(new Float32Array([1, 2, 3]), 1);
  expect(result.indices[0]).toBe(1);

  index.free();
  index2.free();
});
