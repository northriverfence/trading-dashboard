import { test, expect } from "bun:test";
import { EmbeddingRegistry } from "../../ml/embedding-registry.js";
import type { EmbeddingModel } from "../../ml/types.js";

const mockModel: EmbeddingModel = {
  name: "MockModel",
  dimensions: 384,
  strategy: "test",
  generate: () => new Array(384).fill(0.5),
  generateBatch: (trades) => trades.map(() => new Array(384).fill(0.5)),
  compare: () => 0.9,
  getFeatureImportance: () => [],
};

test("EmbeddingRegistry registers and retrieves models", () => {
  const registry = new EmbeddingRegistry();
  registry.registerModel(mockModel);

  expect(registry.getModel("test")).toBe(mockModel);
  expect(registry.listModels()).toHaveLength(1);
});

test("EmbeddingRegistry returns default for unknown strategy", () => {
  const registry = new EmbeddingRegistry();
  registry.registerModel(mockModel);

  const defaultModel = registry.getModel("unknown");
  expect(defaultModel).toBe(mockModel); // fallback to first registered
});
