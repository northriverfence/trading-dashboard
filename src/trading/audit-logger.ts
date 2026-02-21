// src/trading/audit-logger.ts
import { Database } from "bun:sqlite";
import type { Order } from "./types.js";

// Custom error for immutable audit logs
class ImmutableLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImmutableLogError";
  }
}

export enum AuditEventType {
  ORDER_SUBMITTED = "ORDER_SUBMITTED",
  ORDER_FILLED = "ORDER_FILLED",
  ORDER_CANCELED = "ORDER_CANCELED",
  ORDER_REJECTED = "ORDER_REJECTED",
  MODE_SWITCHED = "MODE_SWITCHED",
  RISK_LIMIT_BREACH = "RISK_LIMIT_BREACH",
  RISK_LIMIT_WARNING = "RISK_LIMIT_WARNING",
  CONFIRMATION_ATTEMPT = "CONFIRMATION_ATTEMPT",
}

export enum TradingMode {
  SIMULATION = "SIMULATION",
  PAPER = "PAPER",
  LIVE = "LIVE",
}

export enum ConfirmationResult {
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
  TIMEOUT = "TIMEOUT",
}

export interface SessionInfo {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: number;
  eventType: AuditEventType;
  orderId?: string;
  symbol?: string;
  tradingMode?: TradingMode;
  details: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogger {
  private db: Database;

  constructor(dbPath: string = "./audit-logs.db") {
    this.db = new Database(dbPath);
    this.initializeTable();
  }

  private initializeTable(): void {
    this.db.run(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                order_id TEXT,
                symbol TEXT,
                trading_mode TEXT,
                details TEXT NOT NULL,
                user_id TEXT,
                session_id TEXT,
                ip_address TEXT,
                user_agent TEXT
            )
        `);

    // Create indexes for efficient querying
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_logs(timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_symbol ON audit_logs(symbol)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_event_type ON audit_logs(event_type)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trading_mode ON audit_logs(trading_mode)`);
  }

  private createLogEntry(
    eventType: AuditEventType,
    details: string,
    sessionInfo?: SessionInfo,
    orderId?: string,
    symbol?: string,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const timestamp = Date.now();

    const result = this.db.run(
      `INSERT INTO audit_logs (
                timestamp, event_type, order_id, symbol, trading_mode, details,
                user_id, session_id, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        timestamp,
        eventType,
        orderId || null,
        symbol || null,
        tradingMode || null,
        details,
        sessionInfo?.userId || null,
        sessionInfo?.sessionId || null,
        sessionInfo?.ipAddress || null,
        sessionInfo?.userAgent || null,
      ],
    );

    return {
      id: Number(result.lastInsertRowid),
      timestamp,
      eventType,
      orderId,
      symbol,
      tradingMode,
      details,
      userId: sessionInfo?.userId,
      sessionId: sessionInfo?.sessionId,
      ipAddress: sessionInfo?.ipAddress,
      userAgent: sessionInfo?.userAgent,
    };
  }

  logOrderSubmitted(order: Order, sessionInfo?: SessionInfo, tradingMode?: TradingMode): AuditLogEntry {
    const details = JSON.stringify({
      side: order.side,
      qty: order.qty,
      type: order.type,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      status: order.status,
    });

    return this.createLogEntry(
      AuditEventType.ORDER_SUBMITTED,
      details,
      sessionInfo,
      order.id,
      order.symbol,
      tradingMode,
    );
  }

  logOrderFilled(
    orderId: string,
    symbol: string,
    filledQty: number,
    executionPrice: number,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      filledQty,
      executionPrice,
      totalValue: filledQty * executionPrice,
    });

    return this.createLogEntry(AuditEventType.ORDER_FILLED, details, sessionInfo, orderId, symbol, tradingMode);
  }

  logOrderCanceled(
    orderId: string,
    symbol: string,
    reason: string,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      reason,
      canceledAt: new Date().toISOString(),
    });

    return this.createLogEntry(AuditEventType.ORDER_CANCELED, details, sessionInfo, orderId, symbol, tradingMode);
  }

  logOrderRejected(
    orderId: string,
    symbol: string,
    reason: string,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      reason,
      rejectedAt: new Date().toISOString(),
    });

    return this.createLogEntry(AuditEventType.ORDER_REJECTED, details, sessionInfo, orderId, symbol, tradingMode);
  }

  logModeSwitch(fromMode: TradingMode, toMode: TradingMode, reason: string, sessionInfo?: SessionInfo): AuditLogEntry {
    const details = JSON.stringify({
      fromMode,
      toMode,
      reason,
      switchedAt: new Date().toISOString(),
    });

    return this.createLogEntry(AuditEventType.MODE_SWITCHED, details, sessionInfo, undefined, undefined, toMode);
  }

  logRiskLimitBreached(
    limitType: string,
    currentValue: number,
    limitValue: number,
    action: string,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      limitType,
      currentValue,
      limitValue,
      action,
      breachedAt: new Date().toISOString(),
    });

    return this.createLogEntry(
      AuditEventType.RISK_LIMIT_BREACH,
      details,
      sessionInfo,
      undefined,
      undefined,
      tradingMode,
    );
  }

  logRiskLimitWarning(
    limitType: string,
    currentValue: number,
    warningThreshold: number,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      limitType,
      currentValue,
      warningThreshold,
      warnedAt: new Date().toISOString(),
    });

    return this.createLogEntry(
      AuditEventType.RISK_LIMIT_WARNING,
      details,
      sessionInfo,
      undefined,
      undefined,
      tradingMode,
    );
  }

  logConfirmationAttempt(
    orderId: string,
    symbol: string,
    result: ConfirmationResult,
    confirmationTime: number,
    sessionInfo?: SessionInfo,
    tradingMode?: TradingMode,
  ): AuditLogEntry {
    const details = JSON.stringify({
      result,
      confirmationTimeMs: confirmationTime,
      attemptedAt: new Date().toISOString(),
    });

    return this.createLogEntry(AuditEventType.CONFIRMATION_ATTEMPT, details, sessionInfo, orderId, symbol, tradingMode);
  }

  getAllLogs(limit?: number, offset?: number): AuditLogEntry[] {
    let query = `SELECT * FROM audit_logs ORDER BY timestamp ASC`;
    const params: (number | undefined)[] = [];

    if (limit !== undefined) {
      query += ` LIMIT ?`;
      params.push(limit);

      if (offset !== undefined) {
        query += ` OFFSET ?`;
        params.push(offset);
      }
    }

    const stmt = this.db.query(query);
    const rows = stmt.all(...params) as Array<{
      id: number;
      timestamp: number;
      event_type: string;
      order_id: string | null;
      symbol: string | null;
      trading_mode: string | null;
      details: string;
      user_id: string | null;
      session_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      orderId: row.order_id || undefined,
      symbol: row.symbol || undefined,
      tradingMode: (row.trading_mode as TradingMode) || undefined,
      details: row.details,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  getLogsByDateRange(startDate: Date, endDate: Date): AuditLogEntry[] {
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const stmt = this.db.query(
      `SELECT * FROM audit_logs 
             WHERE timestamp >= ? AND timestamp <= ? 
             ORDER BY timestamp ASC`,
    );

    const rows = stmt.all(startTimestamp, endTimestamp) as Array<{
      id: number;
      timestamp: number;
      event_type: string;
      order_id: string | null;
      symbol: string | null;
      trading_mode: string | null;
      details: string;
      user_id: string | null;
      session_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      orderId: row.order_id || undefined,
      symbol: row.symbol || undefined,
      tradingMode: (row.trading_mode as TradingMode) || undefined,
      details: row.details,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  getLogsBySymbol(symbol: string): AuditLogEntry[] {
    const stmt = this.db.query(`SELECT * FROM audit_logs WHERE symbol = ? ORDER BY timestamp ASC`);

    const rows = stmt.all(symbol) as Array<{
      id: number;
      timestamp: number;
      event_type: string;
      order_id: string | null;
      symbol: string | null;
      trading_mode: string | null;
      details: string;
      user_id: string | null;
      session_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      orderId: row.order_id || undefined,
      symbol: row.symbol || undefined,
      tradingMode: (row.trading_mode as TradingMode) || undefined,
      details: row.details,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  getLogsByEventType(eventType: AuditEventType): AuditLogEntry[] {
    const stmt = this.db.query(`SELECT * FROM audit_logs WHERE event_type = ? ORDER BY timestamp ASC`);

    const rows = stmt.all(eventType) as Array<{
      id: number;
      timestamp: number;
      event_type: string;
      order_id: string | null;
      symbol: string | null;
      trading_mode: string | null;
      details: string;
      user_id: string | null;
      session_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      orderId: row.order_id || undefined,
      symbol: row.symbol || undefined,
      tradingMode: (row.trading_mode as TradingMode) || undefined,
      details: row.details,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  getLogsByTradingMode(tradingMode: TradingMode): AuditLogEntry[] {
    const stmt = this.db.query(`SELECT * FROM audit_logs WHERE trading_mode = ? ORDER BY timestamp ASC`);

    const rows = stmt.all(tradingMode) as Array<{
      id: number;
      timestamp: number;
      event_type: string;
      order_id: string | null;
      symbol: string | null;
      trading_mode: string | null;
      details: string;
      user_id: string | null;
      session_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      orderId: row.order_id || undefined,
      symbol: row.symbol || undefined,
      tradingMode: (row.trading_mode as TradingMode) || undefined,
      details: row.details,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  exportToJSON(): string {
    const logs = this.getAllLogs();
    return JSON.stringify(logs, null, 2);
  }

  exportToCSV(): string {
    const logs = this.getAllLogs();

    // CSV header
    const header = [
      "id",
      "timestamp",
      "eventType",
      "orderId",
      "symbol",
      "tradingMode",
      "details",
      "userId",
      "sessionId",
      "ipAddress",
      "userAgent",
    ].join(",");

    if (logs.length === 0) {
      return header;
    }

    // CSV rows
    const rows = logs.map((log) => {
      return [
        log.id,
        log.timestamp,
        log.eventType,
        log.orderId || "",
        log.symbol || "",
        log.tradingMode || "",
        JSON.stringify(log.details),
        log.userId || "",
        log.sessionId || "",
        log.ipAddress || "",
        log.userAgent || "",
      ].join(",");
    });

    return [header, ...rows].join("\n");
  }

  // Immutable logs - deletion methods throw errors
  deleteLog(_id: number): never {
    throw new ImmutableLogError("Audit logs are immutable and cannot be deleted");
  }

  deleteAllLogs(): never {
    throw new ImmutableLogError("Audit logs are immutable and cannot be deleted");
  }

  close(): void {
    this.db.close();
  }
}
