// src/sync/types.ts
export interface TradeRecord {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice?: number;
  shares: number;
  timestamp: number;
  pnl?: number;
  outcome?: "win" | "loss" | "breakeven";
}

export type SyncPriority = "high" | "normal" | "low";

export interface SyncJob {
  id: string;
  trade: TradeRecord;
  priority: SyncPriority;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface BatchConfig {
  maxSize: number;
  maxWaitMs: number;
  flushOnError: boolean;
}

export interface BatchSyncResult {
  success: boolean;
  processed: number;
  failed: string[];
  durationMs: number;
}

export interface SyncHealthMetrics {
  queueDepth: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  conflictsDetected: number;
}

export type SyncJobId = string;
