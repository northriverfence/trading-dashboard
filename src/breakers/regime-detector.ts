/**
 * RegimeDetector
 * Detects market regime changes that may affect trading strategies
 */

export interface MarketRegime {
  type: "trending_up" | "trending_down" | "ranging" | "volatile" | "crisis";
  strength: number; // 0-1
  duration: number; // days in current regime
  confidence: number; // 0-1
}

export interface RegimeChangeResult {
  changed: boolean;
  previousRegime?: MarketRegime;
  currentRegime: MarketRegime;
  action: "continue" | "reduce_size" | "halt" | "switch_strategy";
  reason: string;
}

export interface PriceData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class RegimeDetector {
  private currentRegime: MarketRegime | null = null;
  private priceHistory: PriceData[] = [];
  private regimeHistory: MarketRegime[] = [];
  private readonly lookbackPeriod = 20;
  private readonly volatilityThreshold = 0.02;
  private readonly trendThreshold = 0.01;

  /**
   * Add new price data and detect regime changes
   */
  addPriceData(data: PriceData): RegimeChangeResult {
    this.priceHistory.push(data);

    // Keep only recent history
    if (this.priceHistory.length > this.lookbackPeriod * 2) {
      this.priceHistory = this.priceHistory.slice(-this.lookbackPeriod * 2);
    }

    if (this.priceHistory.length < this.lookbackPeriod) {
      return {
        changed: false,
        currentRegime: this.currentRegime || { type: "ranging", strength: 0, duration: 0, confidence: 0 },
        action: "continue",
        reason: "Insufficient data for regime detection",
      };
    }

    const newRegime = this.detectRegime();
    const previousRegime = this.currentRegime;
    // First regime detection counts as changed
    const changed = !previousRegime || previousRegime.type !== newRegime.type || this.regimeHistory.length === 0;

    if (changed) {
      newRegime.duration = 1;
    } else if (previousRegime) {
      newRegime.duration = previousRegime.duration + 1;
    }

    this.currentRegime = newRegime;
    this.regimeHistory.push(newRegime);

    const action = this.determineAction(newRegime, previousRegime);
    const reason = this.generateReason(newRegime, previousRegime, changed);

    return {
      changed,
      previousRegime: previousRegime || undefined,
      currentRegime: newRegime,
      action,
      reason,
    };
  }

  /**
   * Get current market regime
   */
  getCurrentRegime(): MarketRegime | null {
    return this.currentRegime;
  }

  /**
   * Get regime history
   */
  getRegimeHistory(): MarketRegime[] {
    return [...this.regimeHistory];
  }

  /**
   * Check if specific regime is active
   */
  isRegimeActive(regimeType: MarketRegime["type"]): boolean {
    return this.currentRegime?.type === regimeType;
  }

  /**
   * Get recommended position size multiplier based on regime
   */
  getPositionMultiplier(): number {
    if (!this.currentRegime) return 1.0;

    const multipliers: Record<MarketRegime["type"], number> = {
      trending_up: 1.0,
      trending_down: 0.8,
      ranging: 0.6,
      volatile: 0.4,
      crisis: 0.0,
    };

    return multipliers[this.currentRegime.type] * this.currentRegime.confidence;
  }

  private detectRegime(): MarketRegime {
    const recent = this.priceHistory.slice(-this.lookbackPeriod);
    const prices = recent.map((r) => r.close);
    const volumes = recent.map((r) => r.volume);

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const volatility = this.calculateVolatility(returns);
    const trend = this.calculateTrend(prices);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeSpike = volumes[volumes.length - 1] > avgVolume * 1.5;

    // Detect crisis first
    if (volatility > this.volatilityThreshold * 3 && trend < -this.trendThreshold * 2) {
      return {
        type: "crisis",
        strength: Math.min(1, volatility / 0.1),
        duration: 1,
        confidence: 0.9,
      };
    }

    // Detect volatile
    if (volatility > this.volatilityThreshold * 1.5) {
      return {
        type: "volatile",
        strength: Math.min(1, volatility / 0.05),
        duration: 1,
        confidence: 0.8,
      };
    }

    // Detect trending (only if not too volatile)
    if (Math.abs(trend) > this.trendThreshold && volatility < this.volatilityThreshold) {
      return {
        type: trend > 0 ? "trending_up" : "trending_down",
        strength: Math.min(1, Math.abs(trend) / 0.02),
        duration: 1,
        confidence: volumeSpike ? 0.85 : 0.7,
      };
    }

    // Default to ranging
    return {
      type: "ranging",
      strength: 1 - Math.min(1, Math.abs(trend) / this.trendThreshold),
      duration: 1,
      confidence: 0.6,
    };
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0;
    const first = prices[0];
    const last = prices[prices.length - 1];
    return (last - first) / first;
  }

  private determineAction(newRegime: MarketRegime, previousRegime: MarketRegime | null): RegimeChangeResult["action"] {
    // Crisis regime - halt trading
    if (newRegime.type === "crisis") return "halt";

    // High volatility - reduce size
    if (newRegime.type === "volatile") return "reduce_size";

    // Regime change detected - may need strategy switch
    if (previousRegime && newRegime.type !== previousRegime.type) {
      if (newRegime.confidence > 0.7) {
        return "switch_strategy";
      }
      return "reduce_size";
    }

    return "continue";
  }

  private generateReason(newRegime: MarketRegime, previousRegime: MarketRegime | null, changed: boolean): string {
    if (changed && previousRegime) {
      return `Regime changed from ${previousRegime.type} to ${newRegime.type} (confidence: ${(newRegime.confidence * 100).toFixed(1)}%)`;
    }

    if (newRegime.type === "crisis") {
      return "Market crisis detected - trading halted";
    }

    if (newRegime.type === "volatile") {
      return "High volatility regime - position sizes reduced";
    }

    return `Current regime: ${newRegime.type} (${newRegime.duration} days)`;
  }

  /**
   * Clear all history
   */
  reset(): void {
    this.currentRegime = null;
    this.priceHistory = [];
    this.regimeHistory = [];
  }
}
