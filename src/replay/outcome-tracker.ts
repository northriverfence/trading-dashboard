/**
 * OutcomeTracker
 * Tracks trade outcomes and performance metrics
 */

export interface OutcomeRecord {
  id: string;
  symbol: string;
  prediction: "up" | "down" | "neutral";
  actual: "up" | "down" | "neutral";
  predictedMagnitude: number;
  actualMagnitude: number;
  timestamp: Date;
  timeToOutcome: number; // hours
  factors: string[];
  confidence: number;
  correct: boolean;
}

export interface OutcomeStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  byDirection: Record<"up" | "down" | "neutral", { total: number; correct: number }>;
  avgMagnitudeError: number;
  avgTimeToOutcome: number;
  streak: { current: number; best: number; worst: number };
}

export class OutcomeTracker {
  private outcomes: OutcomeRecord[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private worstStreak = 0;

  /**
   * Record an outcome
   */
  recordOutcome(outcome: OutcomeRecord): void {
    this.outcomes.push(outcome);

    // Update streaks
    if (outcome.correct) {
      this.currentStreak = this.currentStreak > 0 ? this.currentStreak + 1 : 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    } else {
      this.currentStreak = this.currentStreak < 0 ? this.currentStreak - 1 : -1;
      this.worstStreak = Math.min(this.worstStreak, this.currentStreak);
    }
  }

  /**
   * Get statistics
   */
  getStats(timeframe?: { from: Date; to: Date }): OutcomeStats {
    let filtered = this.outcomes;
    if (timeframe) {
      filtered = this.outcomes.filter(
        o => o.timestamp >= timeframe.from && o.timestamp <= timeframe.to
      );
    }

    const total = filtered.length;
    const correct = filtered.filter(o => o.correct).length;

    const byDirection: OutcomeStats["byDirection"] = {
      up: { total: 0, correct: 0 },
      down: { total: 0, correct: 0 },
      neutral: { total: 0, correct: 0 },
    };

    let totalMagnitudeError = 0;
    let totalTime = 0;

    for (const outcome of filtered) {
      byDirection[outcome.prediction].total++;
      if (outcome.correct) {
        byDirection[outcome.prediction].correct++;
      }

      totalMagnitudeError += Math.abs(outcome.predictedMagnitude - outcome.actualMagnitude);
      totalTime += outcome.timeToOutcome;
    }

    return {
      totalPredictions: total,
      correctPredictions: correct,
      accuracy: total > 0 ? correct / total : 0,
      byDirection,
      avgMagnitudeError: total > 0 ? totalMagnitudeError / total : 0,
      avgTimeToOutcome: total > 0 ? totalTime / total : 0,
      streak: {
        current: this.currentStreak,
        best: this.bestStreak,
        worst: this.worstStreak,
      },
    };
  }

  /**
   * Get outcomes by symbol
   */
  getBySymbol(symbol: string): OutcomeRecord[] {
    return this.outcomes.filter(o => o.symbol === symbol);
  }

  /**
   * Get outcomes by factor
   */
  getByFactor(factor: string): OutcomeRecord[] {
    return this.outcomes.filter(o => o.factors.includes(factor));
  }

  /**
   * Get accuracy by confidence level
   */
  getAccuracyByConfidence(): {
    high: { total: number; correct: number; accuracy: number };
    medium: { total: number; correct: number; accuracy: number };
    low: { total: number; correct: number; accuracy: number };
  } {
    const result = {
      high: { total: 0, correct: 0, accuracy: 0 },
      medium: { total: 0, correct: 0, accuracy: 0 },
      low: { total: 0, correct: 0, accuracy: 0 },
    };

    for (const outcome of this.outcomes) {
      let level: "high" | "medium" | "low";
      if (outcome.confidence >= 0.7) level = "high";
      else if (outcome.confidence >= 0.4) level = "medium";
      else level = "low";

      result[level].total++;
      if (outcome.correct) {
        result[level].correct++;
      }
    }

    for (const level of Object.keys(result) as ("high" | "medium" | "low")[]) {
      if (result[level].total > 0) {
        result[level].accuracy = result[level].correct / result[level].total;
      }
    }

    return result;
  }

  /**
   * Get recent accuracy trend
   */
  getAccuracyTrend(windowSize: number = 20): "improving" | "declining" | "stable" {
    if (this.outcomes.length < windowSize * 2) return "stable";

    const recent = this.outcomes.slice(-windowSize);
    const previous = this.outcomes.slice(-windowSize * 2, -windowSize);

    const recentAccuracy = recent.filter(o => o.correct).length / recent.length;
    const previousAccuracy = previous.filter(o => o.correct).length / previous.length;

    const change = recentAccuracy - previousAccuracy;
    if (change > 0.1) return "improving";
    if (change < -0.1) return "declining";
    return "stable";
  }

  /**
   * Get best performing factors
   */
  getBestFactors(minSamples: number = 10): { factor: string; accuracy: number; count: number }[] {
    const factorStats: Map<string, { total: number; correct: number }> = new Map();

    for (const outcome of this.outcomes) {
      for (const factor of outcome.factors) {
        if (!factorStats.has(factor)) {
          factorStats.set(factor, { total: 0, correct: 0 });
        }
        const stats = factorStats.get(factor)!;
        stats.total++;
        if (outcome.correct) stats.correct++;
      }
    }

    const results: { factor: string; accuracy: number; count: number }[] = [];
    for (const [factor, stats] of factorStats.entries()) {
      if (stats.total >= minSamples) {
        results.push({
          factor,
          accuracy: stats.correct / stats.total,
          count: stats.total,
        });
      }
    }

    return results.sort((a, b) => b.accuracy - a.accuracy);
  }

  /**
   * Get outcomes for time period
   */
  getForPeriod(start: Date, end: Date): OutcomeRecord[] {
    return this.outcomes.filter(o => o.timestamp >= start && o.timestamp <= end);
  }

  /**
   * Get win rate by day of week
   */
  getWinRateByDay(): Record<string, { total: number; wins: number; rate: number }> {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const byDay: Record<string, { total: number; wins: number }> = {};

    for (const day of days) {
      byDay[day] = { total: 0, wins: 0 };
    }

    for (const outcome of this.outcomes) {
      const day = days[outcome.timestamp.getDay()];
      byDay[day].total++;
      if (outcome.correct) byDay[day].wins++;
    }

    const result: Record<string, { total: number; wins: number; rate: number }> = {};
    for (const day of days) {
      result[day] = {
        ...byDay[day],
        rate: byDay[day].total > 0 ? byDay[day].wins / byDay[day].total : 0,
      };
    }

    return result;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.outcomes = [];
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.worstStreak = 0;
  }

  /**
   * Export data
   */
  export(): OutcomeRecord[] {
    return [...this.outcomes];
  }

  /**
   * Import data
   */
  import(data: OutcomeRecord[]): void {
    this.outcomes = data;
    this.recalculateStreaks();
  }

  private recalculateStreaks(): void {
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.worstStreak = 0;

    let currentStreak = 0;
    for (const outcome of this.outcomes) {
      if (outcome.correct) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        this.bestStreak = Math.max(this.bestStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        this.worstStreak = Math.min(this.worstStreak, currentStreak);
      }
    }
    this.currentStreak = currentStreak;
  }
}
