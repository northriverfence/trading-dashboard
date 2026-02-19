/**
 * Market Regime Detection
 * Identifies market conditions for dynamic strategy selection
 */

import type { Bar } from "../backtesting/types.js";
import { eventLogger } from "../reporting/event-logger.js";

export type MarketRegime =
  | "trending_up"
  | "trending_down"
  | "mean_reverting"
  | "volatile"
  | "low_volatility"
  | "normal";

export interface RegimeConfig {
  /** Lookback period for analysis */
  lookbackPeriod: number;
  /** Volatility threshold for high/low classification */
  volatilityThreshold: number;
  /** Trend strength threshold */
  trendStrengthThreshold: number;
  /** Mean reversion threshold (Hurst exponent) */
  hurstThreshold: number;
  /** Minimum observations for regime detection */
  minObservations: number;
}

export interface RegimeState {
  regime: MarketRegime;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp of detection */
  timestamp: Date;
  /** Metrics used for detection */
  metrics: {
    volatility: number;
    trendStrength: number;
    hurstExponent: number;
    adfStatistic: number;
    rsi: number;
  };
  /** Duration of current regime in bars */
  duration: number;
  /** Previous regime */
  previousRegime: MarketRegime | null;
}

export interface RegimeTransition {
  from: MarketRegime;
  to: MarketRegime;
  timestamp: Date;
  confidence: number;
}

export class MarketRegimeDetector {
  private config: RegimeConfig;
  private currentRegime: RegimeState | null = null;
  private history: RegimeState[] = [];
  private transitions: RegimeTransition[] = [];
  private barHistory: Bar[] = [];

  constructor(config: Partial<RegimeConfig> = {}) {
    this.config = {
      lookbackPeriod: 50,
      volatilityThreshold: 0.02,
      trendStrengthThreshold: 0.6,
      hurstThreshold: 0.5,
      minObservations: 30,
      ...config,
    };
  }

  /**
   * Add new bar data and detect regime
   */
  update(bar: Bar): RegimeState {
    this.barHistory.push(bar);

    // Keep only necessary history
    const maxHistory = Math.max(this.config.lookbackPeriod * 2, this.config.minObservations * 2);
    if (this.barHistory.length > maxHistory) {
      this.barHistory = this.barHistory.slice(-maxHistory);
    }

    // Check if we have enough data
    if (this.barHistory.length < this.config.minObservations) {
      return this.getCurrentRegime();
    }

    // Detect regime
    const newRegime = this.detectRegime();

    // Check for transition
    if (this.currentRegime && this.currentRegime.regime !== newRegime.regime) {
      const transition: RegimeTransition = {
        from: this.currentRegime.regime,
        to: newRegime.regime,
        timestamp: bar.timestamp,
        confidence: newRegime.confidence,
      };
      this.transitions.push(transition);

      eventLogger.log("info", "market", `Regime transition: ${transition.from} → ${transition.to}`, {
        symbol: bar.symbol,
        details: {
          confidence: newRegime.confidence,
          metrics: newRegime.metrics,
        },
      });
    }

    this.currentRegime = newRegime;
    this.history.push(newRegime);

    // Keep history manageable
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }

    return newRegime;
  }

  /**
   * Detect current market regime
   */
  private detectRegime(): RegimeState {
    const bars = this.barHistory.slice(-this.config.lookbackPeriod);
    const closes = bars.map((b) => b.close);

    // Calculate metrics
    const volatility = this.calculateVolatility(closes);
    const trendStrength = this.calculateTrendStrength(closes);
    const hurstExponent = this.calculateHurstExponent(closes);
    const adfStatistic = this.calculateADFStatistic(closes);
    const rsi = this.calculateRSI(closes);

    // Determine regime
    let regime: MarketRegime;
    let confidence = 0.5;

    // Check volatility first
    const isHighVolatility = volatility > this.config.volatilityThreshold;
    const isLowVolatility = volatility < this.config.volatilityThreshold / 2;

    if (isHighVolatility) {
      regime = "volatile";
      confidence = Math.min(1, volatility / (this.config.volatilityThreshold * 2));
    } else if (isLowVolatility) {
      regime = "low_volatility";
      confidence = 1 - volatility / this.config.volatilityThreshold;
    } else if (Math.abs(trendStrength) > this.config.trendStrengthThreshold) {
      // Strong trend
      regime = trendStrength > 0 ? "trending_up" : "trending_down";
      confidence = Math.abs(trendStrength);
    } else if (hurstExponent < this.config.hurstThreshold) {
      // Mean reverting
      regime = "mean_reverting";
      confidence = 1 - hurstExponent / this.config.hurstThreshold;
    } else {
      regime = "normal";
      confidence = 0.5;
    }

    const duration = this.currentRegime?.regime === regime
      ? this.currentRegime.duration + 1
      : 1;

    return {
      regime,
      confidence,
      timestamp: bars[bars.length - 1].timestamp,
      metrics: {
        volatility,
        trendStrength,
        hurstExponent,
        adfStatistic,
        rsi,
      },
      duration,
      previousRegime: this.currentRegime?.regime ?? null,
    };
  }

  /**
   * Calculate volatility (annualized standard deviation of returns)
   */
  private calculateVolatility(closes: number[]): number {
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming daily data)
    return stdDev * Math.sqrt(252);
  }

  /**
   * Calculate trend strength (-1 to 1)
   * Uses linear regression slope normalized by price
   */
  private calculateTrendStrength(closes: number[]): number {
    const n = closes.length;
    const xMean = (n - 1) / 2;
    const yMean = closes.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (closes[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = numerator / denominator;
    const normalizedSlope = slope / yMean;

    // Normalize to -1 to 1 range (assuming daily data)
    return Math.tanh(normalizedSlope * 100);
  }

  /**
   * Calculate Hurst exponent
   * H < 0.5: Mean reverting
   * H = 0.5: Random walk
   * H > 0.5: Trending
   */
  private calculateHurstExponent(closes: number[]): number {
    const n = closes.length;
    const returns: number[] = [];
    for (let i = 1; i < n; i++) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }

    // R/S analysis
    const maxLag = Math.min(100, Math.floor(returns.length / 2));
    const lags: number[] = [];
    const rsValues: number[] = [];

    for (let lag = 10; lag <= maxLag; lag += 10) {
      const chunks = Math.floor(returns.length / lag);
      let rsSum = 0;

      for (let i = 0; i < chunks; i++) {
        const chunk = returns.slice(i * lag, (i + 1) * lag);
        const mean = chunk.reduce((a, b) => a + b, 0) / chunk.length;

        // Cumulative deviation
        let cumulative = 0;
        let maxDev = -Infinity;
        let minDev = Infinity;

        for (const r of chunk) {
          cumulative += r - mean;
          maxDev = Math.max(maxDev, cumulative);
          minDev = Math.min(minDev, cumulative);
        }

        const range = maxDev - minDev;
        const stdDev = Math.sqrt(
          chunk.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / chunk.length
        );

        if (stdDev > 0) {
          rsSum += range / stdDev;
        }
      }

      lags.push(Math.log(lag));
      rsValues.push(Math.log(rsSum / chunks));
    }

    // Linear regression to get Hurst exponent
    const nLags = lags.length;
    const xMeanL = lags.reduce((a, b) => a + b, 0) / nLags;
    const yMeanL = rsValues.reduce((a, b) => a + b, 0) / nLags;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < nLags; i++) {
      numerator += (lags[i] - xMeanL) * (rsValues[i] - yMeanL);
      denominator += Math.pow(lags[i] - xMeanL, 2);
    }

    return denominator > 0 ? numerator / denominator : 0.5;
  }

  /**
   * Calculate Augmented Dickey-Fuller statistic (simplified)
   * More negative values indicate stronger mean reversion
   */
  private calculateADFStatistic(closes: number[]): number {
    // Simplified ADF-like statistic based on first-order autocorrelation
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    if (changes.length < 2) return 0;

    const lagged = changes.slice(0, -1);
    const current = changes.slice(1);

    const lagMean = lagged.reduce((a, b) => a + b, 0) / lagged.length;
    const currMean = current.reduce((a, b) => a + b, 0) / current.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < lagged.length; i++) {
      numerator += (lagged[i] - lagMean) * (current[i] - currMean);
      denominator += Math.pow(lagged[i] - lagMean, 2);
    }

    const beta = denominator > 0 ? numerator / denominator : 0;
    return -Math.abs(beta) * 100; // Negative and scaled
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Get current regime
   */
  getCurrentRegime(): RegimeState {
    return (
      this.currentRegime ?? {
        regime: "normal",
        confidence: 0,
        timestamp: new Date(),
        metrics: {
          volatility: 0,
          trendStrength: 0,
          hurstExponent: 0.5,
          adfStatistic: 0,
          rsi: 50,
        },
        duration: 0,
        previousRegime: null,
      }
    );
  }

  /**
   * Get regime history
   */
  getHistory(): RegimeState[] {
    return [...this.history];
  }

  /**
   * Get regime transitions
   */
  getTransitions(): RegimeTransition[] {
    return [...this.transitions];
  }

  /**
   * Get regime statistics
   */
  getStatistics(): Record<MarketRegime, number> {
    const stats: Record<string, number> = {
      trending_up: 0,
      trending_down: 0,
      mean_reverting: 0,
      volatile: 0,
      low_volatility: 0,
      normal: 0,
    };

    for (const state of this.history) {
      stats[state.regime]++;
    }

    return stats as Record<MarketRegime, number>;
  }

  /**
   * Check if regime is suitable for a strategy type
   */
  isSuitableForStrategy(strategyType: "trend" | "mean_reversion" | "momentum" | "breakout"): boolean {
    const regime = this.currentRegime?.regime ?? "normal";

    switch (strategyType) {
      case "trend":
        return regime === "trending_up" || regime === "trending_down";
      case "mean_reversion":
        return regime === "mean_reverting";
      case "momentum":
        return regime === "trending_up" || regime === "trending_down" || regime === "volatile";
      case "breakout":
        return regime === "low_volatility" || regime === "normal";
      default:
        return true;
    }
  }

  /**
   * Get recommended strategy type for current regime
   */
  getRecommendedStrategy(): "trend" | "mean_reversion" | "momentum" | "breakout" | null {
    const regime = this.currentRegime?.regime;

    switch (regime) {
      case "trending_up":
      case "trending_down":
        return "trend";
      case "mean_reverting":
        return "mean_reversion";
      case "volatile":
        return "momentum";
      case "low_volatility":
      case "normal":
        return "breakout";
      default:
        return null;
    }
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.currentRegime = null;
    this.history = [];
    this.transitions = [];
    this.barHistory = [];
  }
}

export { MarketRegimeDetector };
