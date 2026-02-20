// src/memory/pruner.ts

export interface PrunerEntry {
  id: string;
  importance: number;
  lastAccessed?: number;
  timestamp?: number;
}

export interface PrunerConfig {
  maxSize: number;
  lruWeight?: number;
  importanceWeight?: number;
}

/**
 * Memory pruner using LRU + importance score eviction
 * Combines recency and importance to decide what to keep
 */
export class MemoryPruner {
  private config: Required<PrunerConfig>;

  constructor(config: PrunerConfig) {
    this.config = {
      maxSize: config.maxSize,
      lruWeight: config.lruWeight ?? 0.3,
      importanceWeight: config.importanceWeight ?? 0.7,
    };
  }

  /**
   * Prune entries to maxSize using combined LRU + importance scoring
   * Higher score = keep, lower score = evict
   */
  prune<T extends PrunerEntry>(entries: T[]): T[] {
    if (entries.length <= this.config.maxSize) {
      return [...entries];
    }

    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

    // Calculate combined score for each entry
    const scored = entries.map((entry) => {
      // Normalize importance (already 0-1)
      const importanceComponent = entry.importance * this.config.importanceWeight;

      // Calculate LRU score (0-1, higher = more recent)
      const lastAccess = entry.lastAccessed ?? entry.timestamp ?? now;
      const age = now - lastAccess;
      const lruComponent = Math.max(0, 1 - age / maxAge) * this.config.lruWeight;

      const score = importanceComponent + lruComponent;

      return { entry, score };
    });

    // Sort by score descending (keep highest)
    scored.sort((a, b) => b.score - a.score);

    // Return top maxSize entries
    return scored.slice(0, this.config.maxSize).map((s) => s.entry);
  }

  /**
   * Get entries that would be pruned (for analysis)
   */
  getPrunedEntries<T extends PrunerEntry>(entries: T[]): T[] {
    if (entries.length <= this.config.maxSize) {
      return [];
    }

    const pruned = this.prune(entries);
    const prunedSet = new Set(pruned.map((p) => p.id));
    return entries.filter((e) => !prunedSet.has(e.id));
  }
}
