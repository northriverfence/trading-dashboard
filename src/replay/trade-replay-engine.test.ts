/**
 * TradeReplayEngine Tests
 */

import { test, expect } from "bun:test";
import { TradeReplayEngine, HistoricalTrade } from "./trade-replay-engine.js";

const createMockTrade = (id: string, pnl: number): HistoricalTrade => ({
  id,
  symbol: "AAPL",
  entryPrice: 150,
  exitPrice: pnl > 0 ? 155 : 145,
  entryTime: new Date("2024-01-01T10:00:00"),
  exitTime: new Date("2024-01-01T11:00:00"),
  quantity: 100,
  side: "long",
  pnl,
  pnlPercent: pnl / (150 * 100),
  strategy: "momentum",
  exitReason: pnl > 0 ? "target" : "stop_loss",
  marketConditions: {
    volatility: 0.02,
    trend: "up",
    volume: 1000000,
  },
});

test("TradeReplayEngine adds and replays trades", () => {
  const engine = new TradeReplayEngine();
  const trade = createMockTrade("trade-1", 500);

  engine.addTrade(trade);
  const replay = engine.replayTrade("trade-1");

  expect(replay).not.toBeNull();
  expect(replay?.trade.id).toBe("trade-1");
  expect(replay?.whatIfScenarios.length).toBeGreaterThan(0);
  expect(replay?.lessons.length).toBeGreaterThan(0);
});

test("TradeReplayEngine creates and runs sessions", () => {
  const engine = new TradeReplayEngine();

  engine.addTrades([
    createMockTrade("t1", 500),
    createMockTrade("t2", -300),
    createMockTrade("t3", 200),
  ]);

  const session = engine.createSession();
  const result = engine.runSession(session.id);

  expect(result).not.toBeNull();
  expect(result?.summary.totalTrades).toBe(3);
});

test("TradeReplayEngine replays by strategy", () => {
  const engine = new TradeReplayEngine();

  const trade1 = createMockTrade("t1", 500);
  trade1.strategy = "momentum";
  const trade2 = createMockTrade("t2", -200);
  trade2.strategy = "mean_reversion";
  const trade3 = createMockTrade("t3", 300);
  trade3.strategy = "momentum";

  engine.addTrades([trade1, trade2, trade3]);

  const momentumReplays = engine.replayByStrategy("momentum");
  expect(momentumReplays.length).toBe(2);
});

test("TradeReplayEngine replays by symbol", () => {
  const engine = new TradeReplayEngine();

  const aapl = createMockTrade("t1", 500);
  const msft: HistoricalTrade = { ...createMockTrade("t2", -200), symbol: "MSFT" };

  engine.addTrades([aapl, msft]);

  const aaplReplays = engine.replayBySymbol("AAPL");
  expect(aaplReplays.length).toBe(1);
});

test("TradeReplayEngine gets extreme trades", () => {
  const engine = new TradeReplayEngine();

  engine.addTrades([
    createMockTrade("t1", 1000),
    createMockTrade("t2", 500),
    createMockTrade("t3", 100),
    createMockTrade("t4", -100),
    createMockTrade("t5", -500),
    createMockTrade("t6", -1000),
  ]);

  const extremes = engine.getExtremeTrades(2);
  expect(extremes.best.length).toBe(2);
  expect(extremes.worst.length).toBe(2);
  expect(extremes.best[0].pnl).toBe(1000);
  expect(extremes.worst[0].pnl).toBe(-1000);
});

test("TradeReplayEngine analyzes exit timing", () => {
  const engine = new TradeReplayEngine();

  engine.addTrades([
    createMockTrade("t1", 500),
    createMockTrade("t2", 600),
    createMockTrade("t3", -300),
  ]);

  const analysis = engine.analyzeExitTiming();
  expect(typeof analysis.earlyExits).toBe("number");
  expect(typeof analysis.optimalExits).toBe("number");
  expect(typeof analysis.lateExits).toBe("number");
});

test("TradeReplayEngine manages sessions", () => {
  const engine = new TradeReplayEngine();

  const session = engine.createSession();
  expect(engine.getSession(session.id)).toBeDefined();

  const allSessions = engine.getAllSessions();
  expect(allSessions.length).toBe(1);
});

test("TradeReplayEngine clears data", () => {
  const engine = new TradeReplayEngine();

  engine.addTrade(createMockTrade("t1", 500));
  const session = engine.createSession();
  engine.runSession(session.id);

  engine.clear();

  expect(engine.getAllSessions().length).toBe(0);
  expect(engine.replayTrade("t1")).toBeNull();
});
