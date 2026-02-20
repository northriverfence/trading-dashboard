// src/ml/types.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface EmbeddingModel {
  readonly name: string;
  readonly dimensions: number;
  readonly strategy: string;

  generate(trade: TradeMemory): number[];
  generateBatch(trades: TradeMemory[]): number[][];
  compare(a: number[], b: number[]): number;
  getFeatureImportance(): FeatureImportance[];
}

export interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
  hitCount: number;
}
