// src/memory/tiered-storage.ts
import type { TradeMemory } from "../agentdb-integration.js";
import { Database } from "bun:sqlite";

export interface TieredStorageConfig {
  hotSize: number; // In-memory limit (1000 trades)
  warmSize: number; // SQLite limit (10000 trades)
  dbPath?: string;
}

interface StoredTrade extends TradeMemory {
  tier: "hot" | "warm" | "cold";
  storedAt: number;
  accessCount: number;
}

/**
 * Three-tier storage system for trade memories:
 * - Hot tier: In-memory (AgentDB style), 1000 trades
 * - Warm tier: SQLite, 10000 trades
 * - Cold tier: Archive (not implemented - would be disk/file)
 */
export class TieredStorage {
  private config: TieredStorageConfig;
  private hotTier: Map<string, StoredTrade>;
  private db: Database | null = null;
  private warmCount: number = 0;

  constructor(config: TieredStorageConfig) {
    this.config = {
      ...config,
      dbPath: config.dbPath ?? ":memory:",
    };
    this.hotTier = new Map();
    this.initDatabase();
  }

  private initDatabase(): void {
    this.db = new Database(this.config.dbPath);

    // Create table for warm tier
    this.db.run(`
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                entryPrice REAL NOT NULL,
                exitPrice REAL,
                stopLoss REAL NOT NULL,
                takeProfit REAL NOT NULL,
                shares INTEGER NOT NULL,
                pnl REAL,
                outcome TEXT,
                strategy TEXT NOT NULL,
                marketCondition TEXT NOT NULL,
                reasoning TEXT NOT NULL,
                mistakes TEXT, -- JSON array
                lessons TEXT, -- JSON array
                timestamp INTEGER NOT NULL,
                storedAt INTEGER NOT NULL,
                accessCount INTEGER DEFAULT 0
            )
        `);

    // Create index for faster queries
    this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)
        `);

    // Count warm tier entries
    const count = this.db.query("SELECT COUNT(*) as count FROM trades").get() as { count: number };
    this.warmCount = count?.count ?? 0;
  }

  /**
   * Store a trade in appropriate tier
   */
  store(trade: TradeMemory): void {
    // First, try to store in hot tier
    if (this.hotTier.size < this.config.hotSize) {
      const stored: StoredTrade = {
        ...trade,
        tier: "hot",
        storedAt: Date.now(),
        accessCount: 0,
      };
      this.hotTier.set(trade.id, stored);
      return;
    }

    // Hot tier full - check if this trade is more important than lowest in hot
    const lowestHot = this.findLowestHot();
    const importance = this.estimateImportance(trade);
    const lowestImportance = lowestHot ? this.estimateImportance(lowestHot) : 0;

    if (lowestHot && importance > lowestImportance) {
      // Evict lowest to warm tier, add new to hot
      this.moveToWarm(lowestHot);
      this.hotTier.delete(lowestHot.id);

      const stored: StoredTrade = {
        ...trade,
        tier: "hot",
        storedAt: Date.now(),
        accessCount: 0,
      };
      this.hotTier.set(trade.id, stored);
    } else {
      // Store directly in warm tier
      this.moveToWarm(trade);
    }
  }

  /**
   * Get a trade by ID (from any tier)
   */
  get(id: string): TradeMemory | null {
    // Check hot tier first
    const hotEntry = this.hotTier.get(id);
    if (hotEntry) {
      hotEntry.accessCount++;
      hotEntry.storedAt = Date.now();
      return hotEntry;
    }

    // Check warm tier (SQLite)
    if (this.db) {
      const row = this.db.query("SELECT * FROM trades WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (row) {
        // Update access count
        this.db.run("UPDATE trades SET accessCount = accessCount + 1 WHERE id = ?", [id]);
        return this.rowToTrade(row);
      }
    }

    return null;
  }

  /**
   * Get count of entries in hot tier
   */
  getHotCount(): number {
    return this.hotTier.size;
  }

  /**
   * Get count of entries in warm tier
   */
  getWarmCount(): number {
    return this.warmCount;
  }

  /**
   * Get total count across all tiers
   */
  getTotalCount(): number {
    return this.getHotCount() + this.getWarmCount();
  }

  /**
   * Get recent trades from hot tier
   */
  getHotTrades(): TradeMemory[] {
    return Array.from(this.hotTier.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get trades from warm tier (with limit)
   */
  getWarmTrades(limit: number = 100): TradeMemory[] {
    if (!this.db) return [];

    const rows = this.db.query("SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?").all(limit) as Record<
      string,
      unknown
    >[];

    return rows.map((row) => this.rowToTrade(row));
  }

  /**
   * Clear all tiers
   */
  clear(): void {
    this.hotTier.clear();
    if (this.db) {
      this.db.run("DELETE FROM trades");
      this.warmCount = 0;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private findLowestHot(): StoredTrade | null {
    let lowest: StoredTrade | null = null;
    let lowestScore = Infinity;

    for (const trade of this.hotTier.values()) {
      const score = this.estimateImportance(trade) + trade.accessCount * 0.01;
      if (score < lowestScore) {
        lowestScore = score;
        lowest = trade;
      }
    }

    return lowest;
  }

  private estimateImportance(trade: TradeMemory): number {
    let score = 0.5;

    if (trade.outcome === "win") score += 0.3;
    else if (trade.outcome === "loss") score -= 0.2;

    if (trade.pnl && trade.pnl > 0) score += Math.min(0.2, trade.pnl / 1000);
    else if (trade.pnl && trade.pnl < 0) score -= Math.min(0.2, Math.abs(trade.pnl) / 1000);

    if (trade.lessons && trade.lessons.length > 0) score += 0.1;

    const age = Date.now() - trade.timestamp;
    const recency = Math.max(0, 1 - age / (30 * 24 * 60 * 60 * 1000));
    score += recency * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private moveToWarm(trade: TradeMemory): void {
    if (!this.db) return;

    // Check warm tier capacity
    if (this.warmCount >= this.config.warmSize) {
      // Remove oldest warm trade
      this.db.run(`
                DELETE FROM trades
                WHERE id = (SELECT id FROM trades ORDER BY storedAt ASC LIMIT 1)
            `);
      this.warmCount--;
    }

    // Insert trade
    this.db.run(
      `
            INSERT OR REPLACE INTO trades
            (id, symbol, side, entryPrice, exitPrice, stopLoss, takeProfit, shares, pnl, outcome,
             strategy, marketCondition, reasoning, mistakes, lessons, timestamp, storedAt, accessCount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        trade.id,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice ?? null,
        trade.stopLoss,
        trade.takeProfit,
        trade.shares,
        trade.pnl ?? null,
        trade.outcome ?? null,
        trade.strategy,
        trade.marketCondition,
        trade.reasoning,
        JSON.stringify(trade.mistakes ?? []),
        JSON.stringify(trade.lessons ?? []),
        trade.timestamp,
        Date.now(),
        0,
      ],
    );

    this.warmCount++;
  }

  private rowToTrade(row: Record<string, unknown>): TradeMemory {
    return {
      id: row.id as string,
      symbol: row.symbol as string,
      side: row.side as "buy" | "sell",
      entryPrice: row.entryPrice as number,
      exitPrice: row.exitPrice as number | undefined,
      stopLoss: row.stopLoss as number,
      takeProfit: row.takeProfit as number,
      shares: row.shares as number,
      pnl: row.pnl as number | undefined,
      outcome: row.outcome as "win" | "loss" | "breakeven" | undefined,
      strategy: row.strategy as string,
      marketCondition: row.marketCondition as string,
      reasoning: row.reasoning as string,
      mistakes: JSON.parse((row.mistakes as string) ?? "[]"),
      lessons: JSON.parse((row.lessons as string) ?? "[]"),
      timestamp: row.timestamp as number,
    };
  }
}
