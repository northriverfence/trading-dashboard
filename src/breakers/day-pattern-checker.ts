/**
 * DayPatternChecker
 * Checks historical day patterns to identify high-risk trading days
 */

export interface DayPattern {
  dayOfWeek: number;
  month: number;
  dayOfMonth: number;
  isMonthStart: boolean;
  isMonthEnd: boolean;
  isQuarterEnd: boolean;
  volatilityPattern: "high" | "normal" | "low";
}

export interface DayPatternResult {
  allowed: boolean;
  riskLevel: "low" | "medium" | "high" | "extreme";
  reason?: string;
  historicalVolatility: number;
  avgReturn: number;
  winRate: number;
}

export interface HistoricalDayData {
  date: string;
  volatility: number;
  return: number;
  wasProfitable: boolean;
}

export class DayPatternChecker {
  private historicalData: Map<string, HistoricalDayData[]> = new Map();
  private blockedPatterns: Set<string> = new Set();

  constructor() {
    this.loadDefaultPatterns();
  }

  /**
   * Check if today is suitable for trading based on historical patterns
   */
  checkDayPattern(date: Date = new Date()): DayPatternResult {
    const pattern = this.extractPattern(date);
    const patternKey = this.getPatternKey(pattern);
    const historical = this.historicalData.get(patternKey) || [];

    if (historical.length === 0) {
      return {
        allowed: true,
        riskLevel: "medium",
        reason: "No historical data for this pattern",
        historicalVolatility: 0,
        avgReturn: 0,
        winRate: 0.5,
      };
    }

    const stats = this.calculateStats(historical);
    const riskLevel = this.determineRiskLevel(stats);

    // Check for explicitly blocked patterns
    if (this.blockedPatterns.has(patternKey)) {
      return {
        allowed: false,
        riskLevel: "extreme",
        reason: "Pattern explicitly blocked due to historical performance",
        ...stats,
      };
    }

    // Block extreme risk days
    if (riskLevel === "extreme") {
      return {
        allowed: false,
        riskLevel,
        reason: "Historical volatility too high for this pattern",
        ...stats,
      };
    }

    // Warn on high risk days but allow with reduced size
    return {
      allowed: true,
      riskLevel,
      reason: riskLevel === "high" ? "High historical volatility - reduce position size" : undefined,
      ...stats,
    };
  }

  /**
   * Add historical data for a specific date pattern
   */
  addHistoricalData(pattern: DayPattern, data: HistoricalDayData): void {
    const key = this.getPatternKey(pattern);
    const existing = this.historicalData.get(key) || [];
    existing.push(data);
    this.historicalData.set(key, existing);
  }

  /**
   * Block a specific pattern from trading
   */
  blockPattern(pattern: DayPattern): void {
    this.blockedPatterns.add(this.getPatternKey(pattern));
  }

  /**
   * Unblock a previously blocked pattern
   */
  unblockPattern(pattern: DayPattern): void {
    this.blockedPatterns.delete(this.getPatternKey(pattern));
  }

  /**
   * Extract pattern from a date
   */
  extractPattern(date: Date): DayPattern {
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    const isMonthStart = dayOfMonth <= 5;
    const isMonthEnd = dayOfMonth >= 25;
    const isQuarterEnd = isMonthEnd && [2, 5, 8, 11].includes(month);

    // Determine volatility pattern based on day of week
    let volatilityPattern: "high" | "normal" | "low" = "normal";
    if (dayOfWeek === 1 || dayOfWeek === 5) volatilityPattern = "high"; // Monday/Friday
    if (dayOfWeek === 2 || dayOfWeek === 3) volatilityPattern = "low"; // Tuesday/Wednesday

    return {
      dayOfWeek,
      month,
      dayOfMonth,
      isMonthStart,
      isMonthEnd,
      isQuarterEnd,
      volatilityPattern,
    };
  }

  private getPatternKey(pattern: DayPattern): string {
    return `${pattern.dayOfWeek}-${pattern.month}-${pattern.isMonthStart}-${pattern.isMonthEnd}-${pattern.isQuarterEnd}`;
  }

  private calculateStats(data: HistoricalDayData[]): {
    historicalVolatility: number;
    avgReturn: number;
    winRate: number;
  } {
    if (data.length === 0) {
      return { historicalVolatility: 0, avgReturn: 0, winRate: 0.5 };
    }

    const returns = data.map((d) => d.return);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const historicalVolatility = Math.sqrt(variance);
    const winRate = data.filter((d) => d.wasProfitable).length / data.length;

    return { historicalVolatility, avgReturn, winRate };
  }

  private determineRiskLevel(stats: {
    historicalVolatility: number;
    winRate: number;
  }): "low" | "medium" | "high" | "extreme" {
    if (stats.historicalVolatility > 0.05 || stats.winRate < 0.3) return "extreme";
    if (stats.historicalVolatility > 0.03 || stats.winRate < 0.45) return "high";
    if (stats.historicalVolatility > 0.02 || stats.winRate < 0.5) return "medium";
    return "low";
  }

  private loadDefaultPatterns(): void {
    // Load some default high-risk patterns
    // Fridays in certain months tend to be volatile
    const highRiskPatterns: DayPattern[] = [
      {
        dayOfWeek: 5,
        month: 0,
        dayOfMonth: 1,
        isMonthStart: false,
        isMonthEnd: false,
        isQuarterEnd: false,
        volatilityPattern: "high",
      },
      {
        dayOfWeek: 1,
        month: 9,
        dayOfMonth: 1,
        isMonthStart: false,
        isMonthEnd: false,
        isQuarterEnd: false,
        volatilityPattern: "high",
      }, // October Mondays
    ];

    highRiskPatterns.forEach((p) => this.blockPattern(p));
  }

  getBlockedPatterns(): string[] {
    return Array.from(this.blockedPatterns);
  }
}
