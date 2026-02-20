import type { EmbeddingModel, TradeMemory } from "./types.js";

export class EmbeddingRegistry {
  private models = new Map<string, EmbeddingModel>();
  private defaultModel?: EmbeddingModel;

  registerModel(model: EmbeddingModel): void {
    this.models.set(model.strategy, model);
    if (!this.defaultModel) {
      this.defaultModel = model;
    }
  }

  getModel(strategy: string): EmbeddingModel {
    return this.models.get(strategy) ?? this.defaultModel ?? this.createFallbackModel();
  }

  routeAndEmbed(trade: TradeMemory, strategy: string): number[] {
    const model = this.getModel(strategy);
    return model.generate(trade);
  }

  getDefaultModel(): EmbeddingModel {
    return this.defaultModel ?? this.createFallbackModel();
  }

  listModels(): EmbeddingModel[] {
    return Array.from(this.models.values());
  }

  private createFallbackModel(): EmbeddingModel {
    // Simple fallback that creates zero vectors
    return {
      name: "Fallback",
      dimensions: 384,
      strategy: "fallback",
      generate: () => new Array(384).fill(0),
      generateBatch: (trades) => trades.map(() => new Array(384).fill(0)),
      compare: () => 0,
      getFeatureImportance: () => [],
    };
  }
}
