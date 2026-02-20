// src/memory/compressor.ts

export interface CompressorConfig {
  similarityThreshold?: number;
}

/**
 * Compresses memory embeddings by deduplicating similar vectors
 * Uses cosine similarity for comparison
 */
export class MemoryCompressor {
  private config: Required<CompressorConfig>;

  constructor(config: CompressorConfig = {}) {
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.95,
    };
  }

  /**
   * Compress embeddings by removing duplicates
   * Returns unique embeddings only
   */
  compress(embeddings: number[][]): number[][] {
    if (embeddings.length === 0) return [];
    if (embeddings.length === 1) return [...embeddings];

    const unique: number[][] = [];

    for (const embedding of embeddings) {
      const isDuplicate = unique.some(
        (existing) => this.cosineSimilarity(embedding, existing) >= this.config.similarityThreshold,
      );

      if (!isDuplicate) {
        unique.push(embedding);
      }
    }

    return unique;
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns value between -1 and 1 (1 = identical, 0 = orthogonal)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get compression ratio from last operation
   */
  getCompressionRatio(original: number[][], compressed: number[][]): number {
    if (original.length === 0) return 1;
    return compressed.length / original.length;
  }
}
