// src/__tests__/trading/audit-logger.test.ts
import { test, expect, beforeEach, afterEach } from "bun:test";
import { AuditLogger, AuditEventType, TradingMode, ConfirmationResult } from "../../trading/audit-logger.js";
import type { Order } from "../../trading/types.js";
import { unlinkSync } from "fs";

const TEST_DB_PATH = "/tmp/test-audit-logger.db";

let auditLogger: AuditLogger;

beforeEach(() => {
    // Clean up any existing test database
    try {
        unlinkSync(TEST_DB_PATH);
    } catch {
        // File may not exist
    }
    auditLogger = new AuditLogger(TEST_DB_PATH);
});

afterEach(() => {
    auditLogger.close();
    try {
        unlinkSync(TEST_DB_PATH);
    } catch {
        // File may not exist
    }
});

// Test: Log order submission with details
test("AuditLogger logs order submission with details", () => {
    const order: Order = {
        id: "ord_123",
        symbol: "AAPL",
        side: "buy",
        qty: 100,
        type: "limit",
        limitPrice: 150.5,
        timeInForce: "day",
        status: "pending",
        createdAt: new Date("2026-02-21T10:00:00Z"),
    };

    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderSubmitted(order, sessionInfo);

    const logs = auditLogger.getLogsByDateRange(
        new Date("2026-02-21T00:00:00Z"),
        new Date("2026-02-21T23:59:59Z")
    );

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.ORDER_SUBMITTED);
    expect(logs[0].symbol).toBe("AAPL");
    expect(logs[0].orderId).toBe("ord_123");
    expect(logs[0].details).toContain("100");
    expect(logs[0].details).toContain("buy");
    expect(logs[0].userId).toBe("user_001");
    expect(logs[0].sessionId).toBe("sess_abc");
});

// Test: Log order fill with execution price
test("AuditLogger logs order fill with execution price", () => {
    const orderId = "ord_456";
    const symbol = "TSLA";
    const filledQty = 50;
    const executionPrice = 245.75;
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled(orderId, symbol, filledQty, executionPrice, sessionInfo);

    const logs = auditLogger.getLogsBySymbol("TSLA");

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.ORDER_FILLED);
    expect(logs[0].orderId).toBe("ord_456");
    expect(logs[0].symbol).toBe("TSLA");
    expect(logs[0].details).toContain("245.75");
    expect(logs[0].details).toContain("50");
});

// Test: Log mode switches with timestamps
test("AuditLogger logs mode switches with timestamps", () => {
    const fromMode = TradingMode.SIMULATION;
    const toMode = TradingMode.PAPER;
    const reason = "Strategy testing complete";
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    const beforeLog = Date.now();
    auditLogger.logModeSwitch(fromMode, toMode, reason, sessionInfo);
    const afterLog = Date.now();

    const logs = auditLogger.getLogsByEventType(AuditEventType.MODE_SWITCHED);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.MODE_SWITCHED);
    expect(logs[0].details).toContain("SIMULATION");
    expect(logs[0].details).toContain("PAPER");
    expect(logs[0].details).toContain(reason);
    expect(logs[0].timestamp).toBeGreaterThanOrEqual(beforeLog);
    expect(logs[0].timestamp).toBeLessThanOrEqual(afterLog);
});

// Test: Log risk limit breaches
test("AuditLogger logs risk limit breaches", () => {
    const limitType = "max_position_size";
    const currentValue = 10000;
    const limitValue = 5000;
    const action = "rejected";
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logRiskLimitBreached(limitType, currentValue, limitValue, action, sessionInfo);

    const logs = auditLogger.getLogsByEventType(AuditEventType.RISK_LIMIT_BREACH);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.RISK_LIMIT_BREACH);
    expect(logs[0].details).toContain(limitType);
    expect(logs[0].details).toContain("10000");
    expect(logs[0].details).toContain("5000");
    expect(logs[0].details).toContain(action);
});

// Test: Log risk limit warnings
test("AuditLogger logs risk limit warnings", () => {
    const limitType = "daily_loss";
    const currentValue = 4500;
    const warningThreshold = 5000;
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logRiskLimitWarning(limitType, currentValue, warningThreshold, sessionInfo);

    const logs = auditLogger.getLogsByEventType(AuditEventType.RISK_LIMIT_WARNING);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.RISK_LIMIT_WARNING);
    expect(logs[0].details).toContain(limitType);
    expect(logs[0].details).toContain("4500");
    expect(logs[0].details).toContain("5000");
});

// Test: Log confirmation attempts (confirmed)
test("AuditLogger logs confirmation attempts - confirmed", () => {
    const orderId = "ord_789";
    const symbol = "MSFT";
    const result = ConfirmationResult.CONFIRMED;
    const confirmationTime = 1250; // ms
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logConfirmationAttempt(orderId, symbol, result, confirmationTime, sessionInfo);

    const logs = auditLogger.getLogsByEventType(AuditEventType.CONFIRMATION_ATTEMPT);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.CONFIRMATION_ATTEMPT);
    expect(logs[0].orderId).toBe("ord_789");
    expect(logs[0].symbol).toBe("MSFT");
    expect(logs[0].details).toContain("CONFIRMED");
    expect(logs[0].details).toContain("1250");
});

// Test: Log confirmation attempts (rejected)
test("AuditLogger logs confirmation attempts - rejected", () => {
    const orderId = "ord_999";
    const symbol = "GOOGL";
    const result = ConfirmationResult.REJECTED;
    const confirmationTime = 500;
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logConfirmationAttempt(orderId, symbol, result, confirmationTime, sessionInfo);

    const logs = auditLogger.getAllLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].details).toContain("REJECTED");
});

// Test: Log confirmation attempts (timeout)
test("AuditLogger logs confirmation attempts - timeout", () => {
    const orderId = "ord_timeout";
    const symbol = "AMZN";
    const result = ConfirmationResult.TIMEOUT;
    const confirmationTime = 30000; // 30s timeout
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logConfirmationAttempt(orderId, symbol, result, confirmationTime, sessionInfo);

    const logs = auditLogger.getAllLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].details).toContain("TIMEOUT");
});

// Test: Query logs by date range
test("AuditLogger supports querying by date range", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    // Add logs on different dates
    auditLogger.logOrderCanceled("ord_old", "AAPL", "user_request", sessionInfo);

    // Simulate waiting by manually adding with different timestamp
    auditLogger.logOrderSubmitted(
        {
            id: "ord_new",
            symbol: "TSLA",
            side: "buy",
            qty: 10,
            type: "market",
            timeInForce: "day",
            status: "pending",
            createdAt: new Date(),
        },
        sessionInfo
    );

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneHourFromNow = now + 3600000;

    const recentLogs = auditLogger.getLogsByDateRange(
        new Date(oneHourAgo),
        new Date(oneHourFromNow)
    );

    expect(recentLogs.length).toBeGreaterThanOrEqual(1);
});

// Test: Query logs by symbol
test("AuditLogger supports querying by symbol", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150, sessionInfo);
    auditLogger.logOrderFilled("ord_2", "TSLA", 50, 250, sessionInfo);
    auditLogger.logOrderFilled("ord_3", "AAPL", 200, 155, sessionInfo);

    const aaplLogs = auditLogger.getLogsBySymbol("AAPL");

    expect(aaplLogs).toHaveLength(2);
    expect(aaplLogs.every((log) => log.symbol === "AAPL")).toBe(true);
});

// Test: Query logs by event type
test("AuditLogger supports querying by event type", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150, sessionInfo);
    auditLogger.logOrderCanceled("ord_2", "TSLA", "user_request", sessionInfo);
    auditLogger.logOrderFilled("ord_3", "MSFT", 50, 300, sessionInfo);

    const filledLogs = auditLogger.getLogsByEventType(AuditEventType.ORDER_FILLED);

    expect(filledLogs).toHaveLength(2);
    expect(filledLogs.every((log) => log.eventType === AuditEventType.ORDER_FILLED)).toBe(true);
});

// Test: Query logs by trading mode
test("AuditLogger supports querying by trading mode", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logModeSwitch(TradingMode.SIMULATION, TradingMode.PAPER, "test", sessionInfo);
    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150, sessionInfo, TradingMode.PAPER);

    const paperLogs = auditLogger.getLogsByTradingMode(TradingMode.PAPER);

    expect(paperLogs.length).toBeGreaterThanOrEqual(1);
    expect(paperLogs[0].tradingMode).toBe(TradingMode.PAPER);
});

// Test: Export logs to JSON
test("AuditLogger exports logs to JSON", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150.5, sessionInfo);
    auditLogger.logOrderCanceled("ord_2", "TSLA", "user_request", sessionInfo);

    const jsonExport = auditLogger.exportToJSON();

    expect(typeof jsonExport).toBe("string");
    const parsed = JSON.parse(jsonExport);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toHaveProperty("eventType");
    expect(parsed[0]).toHaveProperty("timestamp");
    expect(parsed[0]).toHaveProperty("symbol");
    expect(parsed[0]).toHaveProperty("details");
});

// Test: Export logs to CSV
test("AuditLogger exports logs to CSV", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150.5, sessionInfo);
    auditLogger.logRiskLimitBreached("max_position", 10000, 5000, "rejected", sessionInfo);

    const csvExport = auditLogger.exportToCSV();

    expect(typeof csvExport).toBe("string");
    expect(csvExport).toContain("timestamp");
    expect(csvExport).toContain("eventType");
    expect(csvExport).toContain("symbol");
    expect(csvExport).toContain("AAPL");
    expect(csvExport).toContain("ORDER_FILLED");
});

// Test: Prevent log deletion (immutable)
test("AuditLogger prevents log deletion - logs are immutable", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150, sessionInfo);

    // Attempting to delete should throw or be a no-op
    expect(() => auditLogger.deleteLog(1)).toThrow();
    expect(() => auditLogger.deleteAllLogs()).toThrow();

    // Verify logs still exist
    const logs = auditLogger.getAllLogs();
    expect(logs).toHaveLength(1);
});

// Test: Include session info in logs
test("AuditLogger includes session info in logs", () => {
    const sessionInfo = {
        userId: "user_123",
        sessionId: "sess_xyz789",
        ipAddress: "192.168.1.1",
        userAgent: "TestAgent/1.0",
    };

    auditLogger.logOrderSubmitted(
        {
            id: "ord_session",
            symbol: "NVDA",
            side: "buy",
            qty: 50,
            type: "market",
            timeInForce: "day",
            status: "pending",
            createdAt: new Date(),
        },
        sessionInfo
    );

    const logs = auditLogger.getAllLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe("user_123");
    expect(logs[0].sessionId).toBe("sess_xyz789");
    expect(logs[0].ipAddress).toBe("192.168.1.1");
    expect(logs[0].userAgent).toBe("TestAgent/1.0");
});

// Test: Log order cancellation
test("AuditLogger logs order cancellation", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderCanceled("ord_cancel", "META", "market_conditions", sessionInfo);

    const logs = auditLogger.getLogsByEventType(AuditEventType.ORDER_CANCELED);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.ORDER_CANCELED);
    expect(logs[0].orderId).toBe("ord_cancel");
    expect(logs[0].symbol).toBe("META");
    expect(logs[0].details).toContain("market_conditions");
});

// Test: Log order rejection
test("AuditLogger logs order rejection", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    auditLogger.logOrderRejected("ord_reject", "NFLX", "insufficient_funds", sessionInfo);

    const logs = auditLogger.getLogsByEventType(AuditEventType.ORDER_REJECTED);

    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe(AuditEventType.ORDER_REJECTED);
    expect(logs[0].orderId).toBe("ord_reject");
    expect(logs[0].symbol).toBe("NFLX");
    expect(logs[0].details).toContain("insufficient_funds");
});

// Test: Logs maintain chronological order
test("AuditLogger maintains chronological order of logs", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    // Add logs with slight delays
    auditLogger.logOrderFilled("ord_1", "AAPL", 100, 150, sessionInfo);
    auditLogger.logOrderFilled("ord_2", "TSLA", 50, 250, sessionInfo);
    auditLogger.logOrderFilled("ord_3", "MSFT", 75, 300, sessionInfo);

    const logs = auditLogger.getAllLogs();

    // Verify timestamps are in ascending order
    for (let i = 1; i < logs.length; i++) {
        expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp);
    }
});

// Test: Default database path
test("AuditLogger uses default database path when not specified", () => {
    const defaultLogger = new AuditLogger();
    expect(defaultLogger).toBeDefined();
    defaultLogger.close();

    // Clean up default db
    try {
        unlinkSync("./audit-logs.db");
    } catch {
        // File may not exist
    }
});

// Test: Get logs with limit
test("AuditLogger supports limiting number of returned logs", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    for (let i = 0; i < 10; i++) {
        auditLogger.logOrderFilled(`ord_${i}`, "AAPL", 10, 150, sessionInfo);
    }

    const allLogs = auditLogger.getAllLogs();
    expect(allLogs).toHaveLength(10);

    const limitedLogs = auditLogger.getAllLogs(5);
    expect(limitedLogs).toHaveLength(5);
});

// Test: Get logs with offset and limit
test("AuditLogger supports pagination with offset and limit", () => {
    const sessionInfo = { userId: "user_001", sessionId: "sess_abc" };

    for (let i = 0; i < 10; i++) {
        auditLogger.logOrderFilled(`ord_${i}`, "AAPL", 10, 150, sessionInfo);
    }

    const page2 = auditLogger.getAllLogs(5, 5);
    expect(page2).toHaveLength(5);
    expect(page2[0].orderId).toBe("ord_5");
});
