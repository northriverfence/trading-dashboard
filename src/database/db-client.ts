/**
 * Database Client
 * SQLite for local development, PostgreSQL for production
 * Uses Bun's built-in sqlite module
 */

import { Database } from "bun:sqlite";

export interface DatabaseConfig {
  path?: string; // For SQLite
  // PostgreSQL config (for future use)
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface BarRecord {
  id: string;
  symbol: string;
  timestamp: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  timestamp: string;
  price: number;
  size: number;
  side: string;
  exchange?: string;
}

export interface QuoteRecord {
  id: string;
  symbol: string;
  timestamp: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
}

export class DatabaseClient {
  private db: Database | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig = {}) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const dbPath = this.config.path || "./data/trading.db";
      this.db = new Database(dbPath, { create: true });

      // Enable WAL mode for better concurrent performance
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA foreign_keys = ON;");

      // Initialize schema
      this.initializeSchema();

      console.log(`SQLite database connected: ${dbPath}`);
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log("Database connection closed");
    }
  }

  private initializeSchema(): void {
    if (!this.db) return;

    // Symbols table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        symbol TEXT UNIQUE NOT NULL,
        name TEXT,
        exchange TEXT,
        asset_class TEXT DEFAULT 'us_equity',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bars table (OHLCV)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS bars (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER NOT NULL,
        vwap REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, timestamp, timeframe)
      )
    `);

    // Trades table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        price REAL NOT NULL,
        size INTEGER NOT NULL,
        side TEXT,
        exchange TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Quotes table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        bid REAL NOT NULL,
        ask REAL NOT NULL,
        bid_size INTEGER NOT NULL,
        ask_size INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Strategy results table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS strategy_results (
        id TEXT PRIMARY KEY,
        strategy_name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        initial_capital REAL NOT NULL,
        final_equity REAL NOT NULL,
        total_return REAL NOT NULL,
        sharpe_ratio REAL,
        max_drawdown REAL,
        win_rate REAL,
        profit_factor REAL,
        total_trades INTEGER,
        params TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Event log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS event_log (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        session_id TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_bars_symbol_time ON bars(symbol, timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_bars_symbol_timeframe ON bars(symbol, timeframe, timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trades_symbol_time ON trades(symbol, timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_quotes_symbol_time ON quotes(symbol, timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON event_log(session_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_time ON event_log(timestamp)`);
  }

  getDb(): Database {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  // Bars operations
  insertBar(bar: Omit<BarRecord, "id">): void {
    const db = this.getDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT OR REPLACE INTO bars (id, symbol, timestamp, timeframe, open, high, low, close, volume, vwap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        bar.symbol,
        bar.timestamp,
        bar.timeframe,
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
        bar.vwap || null,
      ],
    );
  }

  getBars(symbol: string, timeframe: string, start: string, end: string): BarRecord[] {
    const db = this.getDb();
    return db
      .query<
        BarRecord,
        [string, string, string, string]
      >(`SELECT * FROM bars WHERE symbol = ? AND timeframe = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp`)
      .all(symbol, timeframe, start, end);
  }

  // Event log operations
  logEvent(level: string, message: string, sessionId?: string): void {
    const db = this.getDb();
    const id = crypto.randomUUID();
    db.run(`INSERT INTO event_log (id, level, message, session_id) VALUES (?, ?, ?, ?)`, [
      id,
      level,
      message,
      sessionId || null,
    ]);
  }

  getEvents(level?: string, limit = 100): unknown[] {
    const db = this.getDb();
    if (level) {
      return db.query(`SELECT * FROM event_log WHERE level = ? ORDER BY timestamp DESC LIMIT ?`).all(level, limit);
    }
    return db.query(`SELECT * FROM event_log ORDER BY timestamp DESC LIMIT ?`).all(limit);
  }

  // Strategy results
  saveStrategyResult(result: {
    strategyName: string;
    symbol: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    finalEquity: number;
    totalReturn: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    profitFactor?: number;
    totalTrades: number;
    params?: Record<string, unknown>;
  }): void {
    const db = this.getDb();
    const id = crypto.randomUUID();
    db.run(
      `INSERT INTO strategy_results
       (id, strategy_name, symbol, start_date, end_date, initial_capital, final_equity,
        total_return, sharpe_ratio, max_drawdown, win_rate, profit_factor, total_trades, params)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        result.strategyName,
        result.symbol,
        result.startDate,
        result.endDate,
        result.initialCapital,
        result.finalEquity,
        result.totalReturn,
        result.sharpeRatio || null,
        result.maxDrawdown || null,
        result.winRate || null,
        result.profitFactor || null,
        result.totalTrades,
        result.params ? JSON.stringify(result.params) : null,
      ],
    );
  }

  getStrategyResults(strategyName?: string, limit = 100): unknown[] {
    const db = this.getDb();
    if (strategyName) {
      return db
        .query(`SELECT * FROM strategy_results WHERE strategy_name = ? ORDER BY created_at DESC LIMIT ?`)
        .all(strategyName, limit);
    }
    return db.query(`SELECT * FROM strategy_results ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.getDb().query(`SELECT 1`).get();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let globalClient: DatabaseClient | null = null;

export function initializeDatabase(config?: DatabaseConfig): DatabaseClient {
  globalClient = new DatabaseClient(config);
  return globalClient;
}

export function getDatabaseClient(): DatabaseClient {
  if (!globalClient) {
    globalClient = new DatabaseClient();
    globalClient.connect();
  }
  return globalClient;
}
