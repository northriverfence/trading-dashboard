export interface CacheConfig {
  maxSize: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

export class EmbeddingCache {
  private cache = new Map<string, number[]>();
  private config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig) {
    if (!config.maxSize || config.maxSize <= 0) {
      throw new Error("maxSize must be a positive integer");
    }
    this.config = config;
  }

  set(tradeId: string, embedding: number[]): void {
    if (this.cache.has(tradeId)) {
      // Update existing: delete and re-set to move to end (most recent)
      this.cache.delete(tradeId);
    } else if (this.cache.size >= this.config.maxSize) {
      // Evict oldest (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(tradeId, [...embedding]); // Copy to avoid mutation
  }

  get(tradeId: string): number[] | null {
    const embedding = this.cache.get(tradeId);

    if (embedding === undefined) {
      this.misses++;
      return null;
    }

    // Update LRU order: delete and re-set to move to end (most recent)
    this.cache.delete(tradeId);
    this.cache.set(tradeId, embedding);

    this.hits++;
    return [...embedding]; // Return copy
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
    };
  }
}
