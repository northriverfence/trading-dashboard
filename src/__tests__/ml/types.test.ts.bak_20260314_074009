import { test, expect } from "bun:test";
import type { EmbeddingModel, FeatureImportance } from "../../ml/types";

test("EmbeddingModel interface structure", () => {
  const model: EmbeddingModel = {
    name: "TestModel",
    dimensions: 384,
    strategy: "breakout",
    generate: (trade) => new Array(384).fill(0),
    generateBatch: (trades) => trades.map(() => new Array(384).fill(0)),
    compare: (a, b) => 0.95,
    getFeatureImportance: () => [{ feature: "price", importance: 0.5 }],
  };

  expect(model.name).toBe("TestModel");
  expect(model.dimensions).toBe(384);
  expect(model.generate({} as any)).toHaveLength(384);
});
