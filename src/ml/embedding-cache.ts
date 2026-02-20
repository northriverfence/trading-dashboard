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
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  set(tradeId: string, embedding: number[]): void {
    if (this.cache.has(tradeId)) {
      // Update existing: remove from order first
      this.accessOrder = this.accessOrder.filter((id) => id !== tradeId);
    } else if (this.cache.size >= this.config.maxSize) {
      // Evict oldest
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(tradeId, [...embedding]); // Copy to avoid mutation
    this.accessOrder.push(tradeId);
  }

  get(tradeId: string): number[] | null {
    const embedding = this.cache.get(tradeId);

    if (embedding === undefined) {
      this.misses++;
      return null;
    }

    // Update LRU order
    this.accessOrder = this.accessOrder.filter((id) => id !== tradeId);
    this.accessOrder.push(tradeId);

    this.hits++;
    return [...embedding]; // Return copy
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
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
