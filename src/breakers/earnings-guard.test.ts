/**
 * EarningsGuard Tests
 */

import { test, expect } from "bun:test";
import { EarningsGuard, EarningsDate } from "./earnings-guard.js";

test("EarningsGuard allows trading when no earnings data", () => {
  const guard = new EarningsGuard();
  const result = guard.checkSymbol("AAPL");

  expect(result.allowed).toBe(true);
  expect(result.restriction).toBe("none");
  expect(result.reason).toContain("No earnings data");
});

test("EarningsGuard blocks trading on earnings day", () => {
  const guard = new EarningsGuard();
  const today = new Date();

  const earnings: EarningsDate = {
    symbol: "AAPL",
    date: today,
    timing: "after_close",
    expectedVolatility: 0.05,
  };

  guard.addEarningsDate(earnings);
  const result = guard.checkSymbol("AAPL", today);

  expect(result.allowed).toBe(false);
  expect(result.restriction).toBe("block");
  expect(result.reason).toContain("today");
});

test("EarningsGuard blocks trading day before earnings", () => {
  const guard = new EarningsGuard();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const earnings: EarningsDate = {
    symbol: "TSLA",
    date: tomorrow,
    timing: "before_open",
    expectedVolatility: 0.08,
  };

  guard.addEarningsDate(earnings);
  const result = guard.checkSymbol("TSLA", today);

  expect(result.allowed).toBe(false);
  expect(result.restriction).toBe("block");
});

test("EarningsGuard reduces position size near earnings", () => {
  const guard = new EarningsGuard({ blockDays: 1, reduceDays: 3, reduceFactor: 0.5 });
  const today = new Date();
  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);

  const earnings: EarningsDate = {
    symbol: "MSFT",
    date: inTwoDays,
    timing: "after_close",
  };

  guard.addEarningsDate(earnings);
  const result = guard.checkSymbol("MSFT", today);

  expect(result.allowed).toBe(true);
  expect(result.restriction).toBe("reduce");
  expect(result.reduceFactor).toBe(0.5);
});

test("EarningsGuard allows trading far from earnings", () => {
  const guard = new EarningsGuard();
  const today = new Date();
  const inTenDays = new Date(today);
  inTenDays.setDate(inTenDays.getDate() + 10);

  const earnings: EarningsDate = {
    symbol: "GOOGL",
    date: inTenDays,
    timing: "after_close",
  };

  guard.addEarningsDate(earnings);
  const result = guard.checkSymbol("GOOGL", today);

  expect(result.allowed).toBe(true);
  expect(result.restriction).toBe("none");
  expect(result.daysToEarnings).toBe(10);
});

test("EarningsGuard tracks upcoming earnings", () => {
  const guard = new EarningsGuard();
  const today = new Date();

  const earnings: EarningsDate[] = [
    { symbol: "AAPL", date: new Date(today.getTime() + 86400000), timing: "after_close" },
    { symbol: "MSFT", date: new Date(today.getTime() + 172800000), timing: "before_open" },
    { symbol: "TSLA", date: new Date(today.getTime() + 259200000), timing: "after_close" },
  ];

  guard.updateCalendar(earnings);
  const upcoming = guard.getUpcomingEarnings(7, today);

  expect(upcoming.length).toBe(3);
});

test("EarningsGuard checks portfolio for earnings conflicts", () => {
  const guard = new EarningsGuard();
  const today = new Date();

  const earnings: EarningsDate = {
    symbol: "AAPL",
    date: today,
    timing: "after_close",
  };

  guard.addEarningsDate(earnings);

  const portfolio = ["AAPL", "MSFT", "GOOGL"];
  const results = guard.checkPortfolio(portfolio, today);

  expect(results.get("AAPL")?.allowed).toBe(false);
  expect(results.get("MSFT")?.allowed).toBe(true);
});

test("EarningsGuard clears old earnings", () => {
  const guard = new EarningsGuard();
  const oldDate = new Date("2024-01-01");
  const recentDate = new Date();

  guard.addEarningsDate({ symbol: "OLD", date: oldDate, timing: "after_close" });
  guard.addEarningsDate({ symbol: "RECENT", date: recentDate, timing: "after_close" });

  const cutoff = new Date("2024-02-01");
  guard.clearOldEarnings(cutoff);

  const calendar = guard.getCalendar();
  expect(calendar.has("OLD")).toBe(false);
  expect(calendar.has("RECENT")).toBe(true);
});

test("EarningsGuard removes earnings dates", () => {
  const guard = new EarningsGuard();

  guard.addEarningsDate({ symbol: "AAPL", date: new Date(), timing: "after_close" });
  expect(guard.getCalendar().has("AAPL")).toBe(true);

  guard.removeEarningsDate("AAPL");
  expect(guard.getCalendar().has("AAPL")).toBe(false);
});

test("EarningsGuard clears entire calendar", () => {
  const guard = new EarningsGuard();

  guard.addEarningsDate({ symbol: "AAPL", date: new Date(), timing: "after_close" });
  guard.addEarningsDate({ symbol: "MSFT", date: new Date(), timing: "after_close" });

  guard.clearCalendar();
  expect(guard.getCalendar().size).toBe(0);
});
