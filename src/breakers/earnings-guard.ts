/**
 * EarningsGuard
 * Blocks or restricts trading around earnings announcements
 */

export interface EarningsDate {
  symbol: string;
  date: Date;
  timing: "before_open" | "after_close" | "unknown";
  expectedVolatility?: number;
}

export interface EarningsGuardResult {
  allowed: boolean;
  restriction: "none" | "reduce" | "block";
  daysToEarnings: number;
  reason?: string;
  reduceFactor?: number;
}

export class EarningsGuard {
  private earningsCalendar: Map<string, EarningsDate> = new Map();
  private defaultBlockDays = 1; // Days before/after to block
  private defaultReduceDays = 3; // Days before/after to reduce
  private reduceFactor = 0.5; // Position size reduction factor

  constructor(config?: { blockDays?: number; reduceDays?: number; reduceFactor?: number }) {
    if (config?.blockDays !== undefined) this.defaultBlockDays = config.blockDays;
    if (config?.reduceDays !== undefined) this.defaultReduceDays = config.reduceDays;
    if (config?.reduceFactor !== undefined) this.reduceFactor = config.reduceFactor;
  }

  /**
   * Check if trading is allowed for a symbol around earnings
   */
  checkSymbol(symbol: string, date: Date = new Date()): EarningsGuardResult {
    const earnings = this.earningsCalendar.get(symbol);

    if (!earnings) {
      return {
        allowed: true,
        restriction: "none",
        daysToEarnings: Infinity,
        reason: "No earnings data for symbol",
      };
    }

    const daysToEarnings = this.calculateDaysBetween(date, earnings.date);
    const absDays = Math.abs(daysToEarnings);

    // Block period
    if (absDays <= this.defaultBlockDays) {
      return {
        allowed: false,
        restriction: "block",
        daysToEarnings,
        reason: `Earnings ${daysToEarnings === 0 ? "today" : daysToEarnings > 0 ? `in ${daysToEarnings} days` : `${Math.abs(daysToEarnings)} days ago`} - trading blocked`,
      };
    }

    // Reduce period
    if (absDays <= this.defaultReduceDays) {
      return {
        allowed: true,
        restriction: "reduce",
        daysToEarnings,
        reduceFactor: this.reduceFactor,
        reason: `Earnings ${daysToEarnings > 0 ? `in ${daysToEarnings} days` : `${Math.abs(daysToEarnings)} days ago`} - position size reduced`,
      };
    }

    return {
      allowed: true,
      restriction: "none",
      daysToEarnings,
    };
  }

  /**
   * Add an earnings date to the calendar
   */
  addEarningsDate(earnings: EarningsDate): void {
    this.earningsCalendar.set(earnings.symbol, earnings);
  }

  /**
   * Remove an earnings date from the calendar
   */
  removeEarningsDate(symbol: string): void {
    this.earningsCalendar.delete(symbol);
  }

  /**
   * Bulk update earnings calendar
   */
  updateCalendar(earnings: EarningsDate[]): void {
    earnings.forEach(e => this.earningsCalendar.set(e.symbol, e));
  }

  /**
   * Clear old earnings dates
   */
  clearOldEarnings(beforeDate: Date): void {
    for (const [symbol, earnings] of this.earningsCalendar.entries()) {
      if (earnings.date < beforeDate) {
        this.earningsCalendar.delete(symbol);
      }
    }
  }

  /**
   * Get upcoming earnings for the next N days
   */
  getUpcomingEarnings(days: number = 7, fromDate: Date = new Date()): EarningsDate[] {
    const upcoming: EarningsDate[] = [];
    const cutoff = new Date(fromDate);
    cutoff.setDate(cutoff.getDate() + days);

    for (const earnings of this.earningsCalendar.values()) {
      if (earnings.date >= fromDate && earnings.date <= cutoff) {
        upcoming.push(earnings);
      }
    }

    return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if any positions need attention due to upcoming earnings
   */
  checkPortfolio(symbols: string[], date: Date = new Date()): Map<string, EarningsGuardResult> {
    const results = new Map<string, EarningsGuardResult>();

    for (const symbol of symbols) {
      results.set(symbol, this.checkSymbol(symbol, date));
    }

    return results;
  }

  /**
   * Get symbols with active restrictions
   */
  getRestrictedSymbols(date: Date = new Date()): { symbol: string; restriction: string; reason: string }[] {
    const restricted: { symbol: string; restriction: string; reason: string }[] = [];

    for (const [symbol, earnings] of this.earningsCalendar.entries()) {
      const result = this.checkSymbol(symbol, date);
      if (result.restriction !== "none") {
        restricted.push({
          symbol,
          restriction: result.restriction,
          reason: result.reason || "",
        });
      }
    }

    return restricted;
  }

  private calculateDaysBetween(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
  }

  /**
   * Get all earnings in calendar
   */
  getCalendar(): Map<string, EarningsDate> {
    return new Map(this.earningsCalendar);
  }

  /**
   * Clear all earnings data
   */
  clearCalendar(): void {
    this.earningsCalendar.clear();
  }
}
