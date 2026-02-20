/**
 * EarningsCalendar Tests
 */

import { test, expect } from "bun:test";
import { EarningsCalendar, EarningsEvent } from "./earnings-calendar.js";

test("EarningsCalendar adds and retrieves earnings", () => {
  const calendar = new EarningsCalendar();

  const event: EarningsEvent = {
    symbol: "AAPL",
    date: new Date("2024-07-25"),
    timing: "after_close",
    expectedEps: 1.2,
    quarter: "Q3 2024",
  };

  calendar.addEarnings(event);
  const earnings = calendar.getEarnings("AAPL");

  expect(earnings.length).toBe(1);
  expect(earnings[0].symbol).toBe("AAPL");
});

test("EarningsCalendar gets next earnings", () => {
  const calendar = new EarningsCalendar();
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const event: EarningsEvent = {
    symbol: "MSFT",
    date: nextWeek,
    timing: "before_open",
    quarter: "Q2 2024",
  };

  calendar.addEarnings(event);
  const next = calendar.getNextEarnings("MSFT", today);

  expect(next).not.toBeNull();
  expect(next?.symbol).toBe("MSFT");
});

test("EarningsCalendar gets upcoming earnings", () => {
  const calendar = new EarningsCalendar();
  const today = new Date();

  const events: EarningsEvent[] = [
    {
      symbol: "AAPL",
      date: new Date(today.getTime() + 86400000),
      timing: "after_close",
      quarter: "Q3 2024",
    },
    {
      symbol: "TSLA",
      date: new Date(today.getTime() + 172800000),
      timing: "before_open",
      quarter: "Q2 2024",
    },
    {
      symbol: "GOOGL",
      date: new Date(today.getTime() + 604800000), // 7 days out
      timing: "after_close",
      quarter: "Q2 2024",
    },
  ];

  events.forEach((e) => calendar.addEarnings(e));
  const upcoming = calendar.getUpcomingEarnings(5, today);

  expect(upcoming.length).toBe(2); // GOOGL is outside the 5-day window
});

test("EarningsCalendar checks for alerts", () => {
  const calendar = new EarningsCalendar({ alertDaysBefore: 3 });
  const today = new Date();

  const event: EarningsEvent = {
    symbol: "NVDA",
    date: new Date(today.getTime() + 86400000 * 2), // 2 days from now
    timing: "after_close",
    quarter: "Q1 2025",
  };

  calendar.addEarnings(event);
  const alerts = calendar.checkAlerts(today);

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts[0].type).toBe("upcoming");
  expect(alerts[0].priority).toBe("medium");
});

test("EarningsCalendar detects high priority today alerts", () => {
  const calendar = new EarningsCalendar();
  const today = new Date();

  const event: EarningsEvent = {
    symbol: "META",
    date: today,
    timing: "after_close",
    quarter: "Q3 2024",
  };

  calendar.addEarnings(event);
  const alerts = calendar.checkAlerts(today);

  const todayAlert = alerts.find((a) => a.type === "today");
  expect(todayAlert).toBeDefined();
  expect(todayAlert?.priority).toBe("high");
});

test("EarningsCalendar tracks earnings surprises", () => {
  const calendar = new EarningsCalendar({ trackSurprises: true, minSurprisePercent: 10 });

  calendar.addEarnings({
    symbol: "AMZN",
    date: new Date("2024-07-30"),
    timing: "after_close",
    expectedEps: 1.0,
    actualEps: 1.25, // 25% beat
    quarter: "Q2 2024",
  });

  calendar.updateResults("AMZN", new Date("2024-07-30"), 1.25);

  const alerts = calendar.checkAlerts(new Date("2024-07-30"));
  const surpriseAlert = alerts.find((a) => a.type === "surprise");

  expect(surpriseAlert).toBeDefined();
  expect(surpriseAlert?.message).toContain("beat");
});

test("EarningsCalendar gets symbols with upcoming earnings", () => {
  const calendar = new EarningsCalendar();
  const today = new Date();

  calendar.addEarnings({
    symbol: "NFLX",
    date: new Date(today.getTime() + 86400000),
    timing: "after_close",
    quarter: "Q2 2024",
  });

  calendar.addEarnings({
    symbol: "DIS",
    date: new Date(today.getTime() + 86400000 * 10),
    timing: "before_open",
    quarter: "Q3 2024",
  });

  const symbols = calendar.getSymbolsWithEarnings(7, today);
  expect(symbols).toContain("NFLX");
  expect(symbols).not.toContain("DIS");
});

test("EarningsCalendar provides statistics", () => {
  const calendar = new EarningsCalendar();

  calendar.addEarnings({
    symbol: "AAPL",
    date: new Date(),
    timing: "after_close",
    quarter: "Q3 2024",
  });

  calendar.addEarnings({
    symbol: "MSFT",
    date: new Date(),
    timing: "before_open",
    quarter: "Q2 2024",
  });

  const stats = calendar.getStatistics();

  expect(stats.totalSymbols).toBe(2);
  expect(stats.totalEvents).toBe(2);
});

test("EarningsCalendar clears old earnings", () => {
  const calendar = new EarningsCalendar();

  calendar.addEarnings({
    symbol: "OLD",
    date: new Date("2024-01-01"),
    timing: "after_close",
    quarter: "Q4 2023",
  });

  calendar.clearOldEarnings(new Date("2024-02-01"));

  expect(calendar.getEarnings("OLD").length).toBe(0);
});

test("EarningsCalendar clears all data", () => {
  const calendar = new EarningsCalendar();

  calendar.addEarnings({
    symbol: "AAPL",
    date: new Date(),
    timing: "after_close",
    quarter: "Q3 2024",
  });

  calendar.clear();

  expect(calendar.getStatistics().totalSymbols).toBe(0);
});
