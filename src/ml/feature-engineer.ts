/**
 * Feature Engineer
 * Generates ML features from market data
 */

import type { Bar } from "../backtesting/types.js";

export interface FeatureConfig {
  /** Lookback window for feature calculation */
  lookbackWindow: number;
  /** Which feature groups to include */
  featureGroups: ("price" | "volume" | "volatility" | "momentum" | "trend")[];
  /** Custom feature functions */
  customFeatures?: Record<string, (bars: Bar[]) => number>;
}

export interface FeatureSet {
  /** Timestamp of the feature */
  timestamp: Date;
  /** Symbol */
  symbol: string;
  /** Feature values */
  features: Record<string, number>;
  /** Raw feature vector (for model input) */
  vector: number[];
}

export class FeatureEngineer {
  private config: FeatureConfig;
  private featureHistory: Map<string, FeatureSet[]> = new Map();

  constructor(config: FeatureConfig) {
    this.config = {
      lookbackWindow: 50,
      featureGroups: ["price", "volume", "momentum"],
      ...config,
    };
  }

  /**
   * Extract features from a series of bars
   */
  extractFeatures(bars: Bar[]): FeatureSet {
    if (bars.length < this.config.lookbackWindow) {
      throw new Error(
        `Insufficient data: need ${this.config.lookbackWindow} bars, got ${bars.length}`
      );
    }

    const recentBars = bars.slice(-this.config.lookbackWindow);
    const currentBar = recentBars[recentBars.length - 1];
    const features: Record<string, number> = {};

    // Price-based features
    if (this.config.featureGroups.includes("price")) {
      Object.assign(features, this.calculatePriceFeatures(recentBars));
    }

    // Volume features
    if (this.config.featureGroups.includes("volume")) {
      Object.assign(features, this.calculateVolumeFeatures(recentBars));
    }

    // Volatility features
    if (this.config.featureGroups.includes("volatility")) {
      Object.assign(features, this.calculateVolatilityFeatures(recentBars));
    }

    // Momentum features
    if (this.config.featureGroups.includes("momentum")) {
      Object.assign(features, this.calculateMomentumFeatures(recentBars));
    }

    // Trend features
    if (this.config.featureGroups.includes("trend")) {
      Object.assign(features, this.calculateTrendFeatures(recentBars));
    }

    // Custom features
    if (this.config.customFeatures) {
      for (const [name, fn] of Object.entries(this.config.customFeatures)) {
        features[name] = fn(recentBars);
      }
    }

    // Create feature vector
    const vector = Object.values(features);

    const featureSet: FeatureSet = {
      timestamp: currentBar.timestamp,
      symbol: currentBar.symbol,
      features,
      vector,
    };

    // Store in history
    const symbolHistory = this.featureHistory.get(currentBar.symbol) ?? [];
    symbolHistory.push(featureSet);
    if (symbolHistory.length > this.config.lookbackWindow) {
      symbolHistory.shift();
    }
    this.featureHistory.set(currentBar.symbol, symbolHistory);

    return featureSet;
  }

  /**
   * Calculate price-based features
   */
  private calculatePriceFeatures(bars: Bar[]): Record<string, number> {
    const closes = bars.map((b) => b.close);
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const current = closes[closes.length - 1];

    const sma20 = this.sma(closes, 20);
    const sma50 = this.sma(closes, Math.min(50, closes.length));

    return {
      price_sma20_ratio: current / sma20,
      price_sma50_ratio: current / sma50,
      sma20_sma50_ratio: sma20 / sma50,
      price_position_in_range: (current - Math.min(...lows)) / (Math.max(...highs) - Math.min(...lows)),
      price_change_1d: (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2],
      price_change_5d: (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6],
      price_change_10d: (closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11],
      high_low_range: Math.max(...highs) - Math.min(...lows),
    };
  }

  /**
   * Calculate volume features
   */
  private calculateVolumeFeatures(bars: Bar[]): Record<string, number> {
    const volumes = bars.map((b) => b.volume);
    const currentVol = volumes[volumes.length - 1];

    const volSma20 = this.sma(volumes, 20);

    return {
      volume_sma20_ratio: currentVol / volSma20,
      volume_change: (volumes[volumes.length - 1] - volumes[volumes.length - 2]) / volumes[volumes.length - 2],
      relative_volume: currentVol / volSma20,
      volume_trend: this.calculateSlope(volumes.slice(-10)),
    };
  }

  /**
   * Calculate volatility features
   */
  private calculateVolatilityFeatures(bars: Bar[]): Record<string, number> {
    const closes = bars.map((b) => b.close);
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }

    const volatility = this.standardDeviation(returns);
    const atr = this.calculateATR(bars, 14);

    return {
      volatility_20d: volatility,
      atr_14: atr,
      atr_percent: (atr / closes[closes.length - 1]) * 100,
      bollinger_position: this.calculateBollingerPosition(closes, 20, 2),
    };
  }

  /**
   * Calculate momentum features
   */
  private calculateMomentumFeatures(bars: Bar[]): Record<string, number> {
    const closes = bars.map((b) => b.close);

    return {
      rsi_14: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      momentum_10d: closes[closes.length - 1] - closes[closes.length - 11],
      momentum_20d: closes[closes.length - 1] - closes[closes.length - 21],
      roc_10d: ((closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11]) * 100,
    };
  }

  /**
   * Calculate trend features
   */
  private calculateTrendFeatures(bars: Bar[]): Record<string, number> {
    const closes = bars.map((b) => b.close);

    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);

    return {
      trend_slope_10d: this.calculateSlope(closes.slice(-10)),
      trend_slope_20d: this.calculateSlope(closes.slice(-20)),
      ema12_ema26_ratio: ema12 / ema26,
      price_above_ema20: closes[closes.length - 1] > this.ema(closes, 20) ? 1 : 0,
      price_above_ema50: closes[closes.length - 1] > this.ema(closes, Math.min(50, closes.length)) ? 1 : 0,
    };
  }

  /**
   * Get feature history for a symbol
   */
  getFeatureHistory(symbol: string): FeatureSet[] {
    return this.featureHistory.get(symbol) ?? [];
  }

  /**
   * Clear feature history
   */
  clearHistory(symbol?: string): void {
    if (symbol) {
      this.featureHistory.delete(symbol);
    } else {
      this.featureHistory.clear();
    }
  }

  /**
   * Get feature names
   */
  getFeatureNames(): string[] {
    // Extract features from a dummy calculation
    const dummyBars: Bar[] = Array.from({ length: this.config.lookbackWindow }, (_, i) => ({
      timestamp: new Date(Date.now() - (this.config.lookbackWindow - i) * 86400000),
      symbol: "DUMMY",
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume: 1000000,
    }));

    const featureSet = this.extractFeatures(dummyBars);
    return Object.keys(featureSet.features);
  }

  // Technical indicator helpers
  private sma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private ema(data: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private standardDeviation(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }

  private calculateSlope(data: number[]): number {
    const n = data.length;
    const sumX = ((n - 1) * n) / 2;
    const sumY = data.reduce((a, b) => a + b, 0);
    const sumXY = data.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateRSI(closes: number[], period: number): number {
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

  private calculateMACD(closes: number[]): number {
    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);
    return ema12 - ema26;
  }

  private calculateATR(bars: Bar[], period: number): number {
    if (bars.length < period) return 0;

    const trValues: number[] = [];
    for (let i = bars.length - period; i < bars.length; i++) {
      const bar = bars[i];
      const prevClose = bars[i - 1]?.close ?? bar.close;
      const tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prevClose),
        Math.abs(bar.low - prevClose)
      );
      trValues.push(tr);
    }

    return trValues.reduce((a, b) => a + b, 0) / trValues.length;
  }

  private calculateBollingerPosition(closes: number[], period: number, stdDev: number): number {
    const sma = this.sma(closes, period);
    const std = this.standardDeviation(closes.slice(-period));
    const upper = sma + stdDev * std;
    const lower = sma - stdDev * std;
    const current = closes[closes.length - 1];

    return (current - lower) / (upper - lower);
  }
}

