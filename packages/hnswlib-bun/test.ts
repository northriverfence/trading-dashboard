// test.ts
// Simple test for hnswlib-bun

import { createL2Index, createCosineIndex } from "./src/index.js";

test("L2 index - basic operations", () => {
  const dim = 128;
  const maxElements = 1000;

  const index = createL2Index(dim, maxElements);

  // Add some vectors
  for (let i = 0; i < 10; i++) {
    const vector = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      vector[j] = Math.random();
    }
    index.addVector(vector, i);
  }

  expect(index.getCurrentCount()).toBe(10);

  // Search
  const query = new Float32Array(dim);
  for (let j = 0; j < dim; j++) {
    query[j] = Math.random();
  }

  const result = index.searchKnn(query, 5);
  expect(result.indices.length).toBe(5);
  expect(result.distances.length).toBe(5);

  index.free();
});

test("Cosine index - basic operations", () => {
  const dim = 128;
  const maxElements = 1000;

  const index = createCosineIndex(dim, maxElements);

  // Add normalized vectors
  for (let i = 0; i < 10; i++) {
    const vector = new Float32Array(dim);
    let norm = 0;
    for (let j = 0; j < dim; j++) {
      vector[j] = Math.random() - 0.5;
      norm += vector[j] * vector[j];
    }
    // Normalize for cosine
    norm = Math.sqrt(norm);
    for (let j = 0; j < dim; j++) {
      vector[j] /= norm;
    }
    index.addVector(vector, i);
  }

  expect(index.getCurrentCount()).toBe(10);

  index.free();
});

test("Batch operations", () => {
  const dim = 64;
  const maxElements = 1000;

  const index = createL2Index(dim, maxElements);

  // Batch add
  const vectors: Float32Array[] = [];
  const labels: number[] = [];

  for (let i = 0; i < 100; i++) {
    const vector = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      vector[j] = Math.random();
    }
    vectors.push(vector);
    labels.push(i);
  }

  index.addVectors(vectors, labels);
  expect(index.getCurrentCount()).toBe(100);

  index.free();
});

test("Save and load index", () => {
  const dim = 32;
  const maxElements = 100;

  const index = createL2Index(dim, maxElements);

  // Add vectors
  for (let i = 0; i < 10; i++) {
    const vector = new Float32Array(dim);
    for (let j = 0; j < dim; j++) {
      vector[j] = Math.random();
    }
    index.addVector(vector, i);
  }

  // Save
  const testFile = "/tmp/hnswlib_test_index.bin";
  index.saveIndex(testFile);

  // Load into new index
  const index2 = createL2Index(dim, maxElements);
  index2.loadIndex(testFile);

  expect(index2.getCurrentCount()).toBe(10);

  index.free();
  index2.free();
});

console.log("Running hnswlib-bun tests...");
