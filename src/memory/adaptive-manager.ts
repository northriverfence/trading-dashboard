// src/memory/adaptive-manager.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface MemoryConfig {
  maxSize: number;
}

interface MemoryEntry {
  trade: TradeMemory;
  importance: number;
  lastAccessed: number;
}

export class AdaptiveMemoryManager {
  private trades = new Map<string, MemoryEntry>();
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  store(trade: TradeMemory): void {
    // Calculate importance score
    const importance = this.calculateImportance(trade);

    // If at capacity, evict lowest importance trade
    if (this.trades.size >= this.config.maxSize && !this.trades.has(trade.id)) {
      this.evictLowestImportance();
    }

    this.trades.set(trade.id, {
      trade,
      importance,
      lastAccessed: Date.now(),
    });
  }

  get(tradeId: string): TradeMemory | null {
    const entry = this.trades.get(tradeId);
    if (!entry) return null;

    // Update last accessed
    entry.lastAccessed = Date.now();
    return entry.trade;
  }

  size(): number {
    return this.trades.size;
  }

  clear(): void {
    this.trades.clear();
  }

  /**
   * Calculate importance score for a trade
   * I = shares * recency * strategy_factor
   */
  private calculateImportance(trade: TradeMemory): number {
    const sizeScore = Math.min(trade.shares / 100, 1); // Normalize to 0-1

    const ageMs = Date.now() - trade.timestamp;
    const recencyScore = Math.max(0, 1 - ageMs / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days

    const strategyFactor = trade.strategy === "breakout" || trade.strategy === "momentum" ? 1.2 : 1.0;

    return sizeScore * 0.4 + recencyScore * 0.4 + (strategyFactor - 1) * 0.2;
  }

  private evictLowestImportance(): void {
    let lowestId: string | null = null;
    let lowestImportance = Infinity;

    for (const [id, entry] of this.trades) {
      // Combine importance with LRU
      const score = entry.importance * 0.7 + (entry.lastAccessed / Date.now()) * 0.3;
      if (score < lowestImportance) {
        lowestImportance = score;
        lowestId = id;
      }
    }

    if (lowestId) {
      this.trades.delete(lowestId);
    }
  }
}
