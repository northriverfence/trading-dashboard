/**
 * DynamicThresholds
 * Adjusts risk thresholds based on market volatility and other factors
 */

export interface ThresholdConfig {
  baseDailyLossLimit: number;
  baseConsecutiveLossLimit: number;
  basePositionSize: number;
  volatilityMultiplier: number;
  drawdownMultiplier: number;
  minThreshold: number;
  maxThreshold: number;
}

export interface VolatilityMetrics {
  vix: number; // VIX level
  atr20: number; // 20-day ATR
  realizedVol: number; // Realized volatility
}

export interface AdjustedThresholds {
  dailyLossLimit: number;
  consecutiveLossLimit: number;
  maxPositionSize: number;
  volatilityFactor: number;
  reasoning: string[];
}

export class DynamicThresholds {
  private config: ThresholdConfig;
  private volatilityHistory: VolatilityMetrics[] = [];
  private maxHistoryLength = 20;

  constructor(config?: Partial<ThresholdConfig>) {
    this.config = {
      baseDailyLossLimit: 1000,
      baseConsecutiveLossLimit: 3,
      basePositionSize: 0.1, // 10% of portfolio
      volatilityMultiplier: 1.5,
      drawdownMultiplier: 0.8,
      minThreshold: 0.3,
      maxThreshold: 2.0,
      ...config,
    };
  }

  /**
   * Calculate adjusted thresholds based on current market conditions
   */
  calculateThresholds(metrics: VolatilityMetrics): AdjustedThresholds {
    this.volatilityHistory.push(metrics);
    if (this.volatilityHistory.length > this.maxHistoryLength) {
      this.volatilityHistory.shift();
    }

    const avgVolatility = this.getAverageVolatility();
    const volFactor = this.calculateVolatilityFactor(metrics, avgVolatility);
    const drawdownFactor = this.calculateDrawdownFactor();

    // Combined factor - lower during high volatility/drawdowns
    const combinedFactor = Math.max(
      this.config.minThreshold,
      Math.min(this.config.maxThreshold, volFactor * drawdownFactor),
    );

    const reasoning: string[] = [];

    if (metrics.vix > 30) {
      reasoning.push(`High VIX (${metrics.vix.toFixed(1)}) - reducing limits`);
    } else if (metrics.vix < 15) {
      reasoning.push(`Low VIX (${metrics.vix.toFixed(1)}) - can increase limits`);
    }

    if (metrics.realizedVol > 0.03) {
      reasoning.push(`High realized volatility (${(metrics.realizedVol * 100).toFixed(1)}%)`);
    }

    if (drawdownFactor < 1) {
      reasoning.push(`In drawdown - defensive positioning`);
    }

    return {
      dailyLossLimit: Math.round(this.config.baseDailyLossLimit * combinedFactor),
      consecutiveLossLimit: Math.max(1, Math.round(this.config.baseConsecutiveLossLimit * combinedFactor)),
      maxPositionSize: this.config.basePositionSize * combinedFactor,
      volatilityFactor: combinedFactor,
      reasoning,
    };
  }

  /**
   * Get current volatility regime
   */
  getVolatilityRegime(): "low" | "normal" | "high" | "extreme" {
    if (this.volatilityHistory.length === 0) return "normal";

    const latest = this.volatilityHistory[this.volatilityHistory.length - 1];
    const avgVix = latest.vix;

    if (avgVix > 40) return "extreme";
    if (avgVix > 30) return "high";
    if (avgVix < 15) return "low";
    return "normal";
  }

  /**
   * Get recommended action based on volatility
   */
  getRecommendedAction(): "normal" | "cautious" | "defensive" | "halt" {
    const regime = this.getVolatilityRegime();

    switch (regime) {
      case "extreme":
        return "halt";
      case "high":
        return "defensive";
      case "low":
        return "normal";
      default:
        return "cautious";
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ThresholdConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ThresholdConfig {
    return { ...this.config };
  }

  /**
   * Reset volatility history
   */
  resetHistory(): void {
    this.volatilityHistory = [];
  }

  /**
   * Get volatility trend (increasing/decreasing/stable)
   */
  getVolatilityTrend(): "increasing" | "decreasing" | "stable" {
    if (this.volatilityHistory.length < 5) return "stable";

    const recent = this.volatilityHistory.slice(-5);
    const first = recent[0].realizedVol;
    const last = recent[recent.length - 1].realizedVol;

    const change = (last - first) / first;

    if (change > 0.2) return "increasing";
    if (change < -0.2) return "decreasing";
    return "stable";
  }

  private getAverageVolatility(): number {
    if (this.volatilityHistory.length === 0) return 0.02; // Default 2%

    const sum = this.volatilityHistory.reduce((acc, v) => acc + v.realizedVol, 0);
    return sum / this.volatilityHistory.length;
  }

  private calculateVolatilityFactor(current: VolatilityMetrics, average: number): number {
    // Higher volatility = lower thresholds (more conservative)
    let factor = 1;

    // VIX impact
    if (current.vix > 35) {
      factor *= 0.4;
    } else if (current.vix > 25) {
      factor *= 0.6;
    } else if (current.vix < 15) {
      factor *= 1.2;
    }

    // Realized vol impact
    if (current.realizedVol > average * 2) {
      factor *= 0.5;
    } else if (current.realizedVol < average * 0.5) {
      factor *= 1.3;
    }

    return Math.max(this.config.minThreshold, Math.min(this.config.maxThreshold, factor));
  }

  private calculateDrawdownFactor(): number {
    // This would integrate with portfolio data
    // For now, return neutral
    return 1;
  }

  /**
   * Calculate position size adjustment
   */
  calculatePositionAdjustment(baseSize: number, metrics: VolatilityMetrics): number {
    const thresholds = this.calculateThresholds(metrics);
    return baseSize * thresholds.volatilityFactor;
  }
}
