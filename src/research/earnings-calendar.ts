/**
 * EarningsCalendar
 * Tracks earnings dates and provides alerts
 */

export interface EarningsEvent {
  symbol: string;
  date: Date;
  timing: "before_open" | "after_close" | "unknown";
  expectedEps?: number;
  actualEps?: number;
  expectedRevenue?: number;
  surprise?: number; // Percentage surprise
  quarter: string; // e.g., "Q1 2024"
}

export interface EarningsAlert {
  type: "upcoming" | "today" | "surprise" | "miss";
  symbol: string;
  message: string;
  priority: "low" | "medium" | "high";
  timestamp: Date;
}

export interface EarningsCalendarConfig {
  alertDaysBefore: number;
  trackSurprises: boolean;
  minSurprisePercent: number;
}

export class EarningsCalendar {
  private config: EarningsCalendarConfig;
  private earnings: Map<string, EarningsEvent[]> = new Map();
  private alerts: EarningsAlert[] = [];

  constructor(config?: Partial<EarningsCalendarConfig>) {
    this.config = {
      alertDaysBefore: 3,
      trackSurprises: true,
      minSurprisePercent: 10,
      ...config,
    };
  }

  /**
   * Add earnings event
   */
  addEarnings(event: EarningsEvent): void {
    if (!this.earnings.has(event.symbol)) {
      this.earnings.set(event.symbol, []);
    }

    const events = this.earnings.get(event.symbol)!;
    events.push(event);

    // Sort by date descending
    events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Get earnings for a symbol
   */
  getEarnings(symbol: string): EarningsEvent[] {
    return this.earnings.get(symbol) || [];
  }

  /**
   * Get next earnings date for symbol
   */
  getNextEarnings(symbol: string, fromDate: Date = new Date()): EarningsEvent | null {
    const events = this.earnings.get(symbol) || [];
    return events.find(e => e.date >= fromDate) || null;
  }

  /**
   * Get upcoming earnings for date range
   */
  getUpcomingEarnings(days: number = 7, fromDate: Date = new Date()): EarningsEvent[] {
    const cutoff = new Date(fromDate);
    cutoff.setDate(cutoff.getDate() + days);

    const upcoming: EarningsEvent[] = [];

    for (const events of this.earnings.values()) {
      for (const event of events) {
        if (event.date >= fromDate && event.date <= cutoff) {
          upcoming.push(event);
        }
      }
    }

    return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get earnings for specific date
   */
  getEarningsForDate(date: Date): EarningsEvent[] {
    const results: EarningsEvent[] = [];
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    for (const events of this.earnings.values()) {
      for (const event of events) {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        if (eventDate.getTime() === targetDate.getTime()) {
          results.push(event);
        }
      }
    }

    return results;
  }

  /**
   * Check for earnings alerts
   */
  checkAlerts(date: Date = new Date()): EarningsAlert[] {
    this.alerts = [];

    for (const [symbol, events] of this.earnings.entries()) {
      for (const event of events) {
        const daysUntil = this.daysBetween(date, event.date);

        // Upcoming earnings alert
        if (daysUntil > 0 && daysUntil <= this.config.alertDaysBefore) {
          this.alerts.push({
            type: "upcoming",
            symbol,
            message: `${symbol} reports earnings in ${daysUntil} day${daysUntil > 1 ? "s" : ""} (${event.timing})`,
            priority: daysUntil === 1 ? "high" : "medium",
            timestamp: date,
          });
        }

        // Today's earnings
        if (daysUntil === 0) {
          this.alerts.push({
            type: "today",
            symbol,
            message: `${symbol} reports earnings today (${event.timing})`,
            priority: "high",
            timestamp: date,
          });
        }

        // Surprise alert
        if (this.config.trackSurprises && event.actualEps && event.expectedEps) {
          const surprise = ((event.actualEps - event.expectedEps) / Math.abs(event.expectedEps)) * 100;
          if (Math.abs(surprise) >= this.config.minSurprisePercent) {
            this.alerts.push({
              type: surprise > 0 ? "surprise" : "miss",
              symbol,
              message: `${symbol} ${surprise > 0 ? "beat" : "missed"} by ${Math.abs(surprise).toFixed(1)}%`,
              priority: "high",
              timestamp: event.date,
            });
          }
        }
      }
    }

    return this.alerts;
  }

  /**
   * Get high priority alerts
   */
  getHighPriorityAlerts(): EarningsAlert[] {
    return this.alerts.filter(a => a.priority === "high");
  }

  /**
   * Get symbols with earnings in range
   */
  getSymbolsWithEarnings(days: number = 7, fromDate: Date = new Date()): string[] {
    const symbols: string[] = [];
    const cutoff = new Date(fromDate);
    cutoff.setDate(cutoff.getDate() + days);

    for (const [symbol, events] of this.earnings.entries()) {
      const hasUpcoming = events.some(e => e.date >= fromDate && e.date <= cutoff);
      if (hasUpcoming) {
        symbols.push(symbol);
      }
    }

    return symbols;
  }

  /**
   * Update actual earnings results
   */
  updateResults(symbol: string, date: Date, actualEps: number, actualRevenue?: number): void {
    const events = this.earnings.get(symbol) || [];
    const event = events.find(e => this.isSameDay(e.date, date));

    if (event) {
      event.actualEps = actualEps;
      if (actualRevenue) event.expectedRevenue = actualRevenue;
      if (event.expectedEps) {
        event.surprise = ((actualEps - event.expectedEps) / Math.abs(event.expectedEps)) * 100;
      }
    }
  }

  /**
   * Get earnings statistics
   */
  getStatistics(): {
    totalSymbols: number;
    totalEvents: number;
    withSurprises: number;
    avgSurprise: number;
  } {
    let totalEvents = 0;
    let withSurprises = 0;
    let totalSurprise = 0;

    for (const events of this.earnings.values()) {
      totalEvents += events.length;
      for (const event of events) {
        if (event.surprise !== undefined) {
          withSurprises++;
          totalSurprise += event.surprise;
        }
      }
    }

    return {
      totalSymbols: this.earnings.size,
      totalEvents,
      withSurprises,
      avgSurprise: withSurprises > 0 ? totalSurprise / withSurprises : 0,
    };
  }

  /**
   * Clear old earnings (before date)
   */
  clearOldEarnings(beforeDate: Date): void {
    for (const [symbol, events] of this.earnings.entries()) {
      const filtered = events.filter(e => e.date >= beforeDate);
      if (filtered.length === 0) {
        this.earnings.delete(symbol);
      } else {
        this.earnings.set(symbol, filtered);
      }
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.earnings.clear();
    this.alerts = [];
  }

  private daysBetween(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return d1.getTime() === d2.getTime();
  }
}
