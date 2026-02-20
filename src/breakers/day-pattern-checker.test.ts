/**
 * DayPatternChecker Tests
 */

import { test, expect } from "bun:test";
import { DayPatternChecker, HistoricalDayData } from "./day-pattern-checker.js";

test("DayPatternChecker allows trading on normal days", () => {
  const checker = new DayPatternChecker();
  const result = checker.checkDayPattern(new Date("2024-06-12")); // Wednesday

  expect(result.allowed).toBe(true);
  expect(result.riskLevel).toBe("medium");
});

test("DayPatternChecker blocks explicitly blocked patterns", () => {
  const checker = new DayPatternChecker();

  // Block a specific pattern
  const pattern = checker.extractPattern(new Date("2024-01-05")); // Friday in January
  checker.blockPattern(pattern);

  const result = checker.checkDayPattern(new Date("2024-01-05"));
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain("explicitly blocked");
});

test("DayPatternChecker detects high volatility patterns", () => {
  const checker = new DayPatternChecker();

  // Add historical data showing extreme volatility
  const pattern = checker.extractPattern(new Date("2024-03-15"));
  const highVolData: HistoricalDayData = {
    date: "2024-03-15",
    volatility: 0.08,
    return: -0.05,
    wasProfitable: false,
  };

  // Add multiple data points to trigger extreme risk
  for (let i = 0; i < 5; i++) {
    checker.addHistoricalData(pattern, highVolData);
  }

  const result = checker.checkDayPattern(new Date("2024-03-15"));
  expect(result.historicalVolatility).toBeGreaterThan(0);
});

test("DayPatternChecker extracts correct day patterns", () => {
  const checker = new DayPatternChecker();

  // Monday
  const monday = checker.extractPattern(new Date("2024-06-10"));
  expect(monday.dayOfWeek).toBe(1);
  expect(monday.volatilityPattern).toBe("high");

  // Wednesday
  const wednesday = checker.extractPattern(new Date("2024-06-12"));
  expect(wednesday.dayOfWeek).toBe(3);
  expect(wednesday.volatilityPattern).toBe("low");

  // Friday
  const friday = checker.extractPattern(new Date("2024-06-14"));
  expect(friday.dayOfWeek).toBe(5);
  expect(friday.volatilityPattern).toBe("high");
});

test("DayPatternChecker detects month-end patterns", () => {
  const checker = new DayPatternChecker();

  // End of month but NOT quarter end (May 28, 2024 - month 4 is not a quarter end month)
  const monthEnd = checker.extractPattern(new Date("2024-05-28"));
  expect(monthEnd.isMonthEnd).toBe(true);
  expect(monthEnd.isQuarterEnd).toBe(false);

  // Quarter end (June 28, 2024 - month 5 is Q2 end)
  const quarterEnd = checker.extractPattern(new Date("2024-06-28"));
  expect(quarterEnd.isQuarterEnd).toBe(true); // June is month 5, quarter end
});

test("DayPatternChecker tracks blocked patterns", () => {
  const checker = new DayPatternChecker();

  // Get initial count of default blocked patterns
  const initialBlockedCount = checker.getBlockedPatterns().length;

  const pattern = checker.extractPattern(new Date("2024-07-04"));
  checker.blockPattern(pattern);

  const blocked = checker.getBlockedPatterns();
  expect(blocked.length).toBe(initialBlockedCount + 1);

  checker.unblockPattern(pattern);
  // After unblocking, should return to initial count (default blocked patterns remain)
  expect(checker.getBlockedPatterns().length).toBe(initialBlockedCount);
});
