/**
 * FuturesMonitor
 * Monitors futures markets for signals
 */

export interface FuturesData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest: number;
  timestamp: Date;
}

export interface FuturesSignal {
  type: "bullish" | "bearish" | "neutral" | "warning";
  symbol: string;
  message: string;
  strength: number; // 0-1
  timestamp: Date;
}

export interface MarketContext {
  trend: "up" | "down" | "sideways";
  volatility: "low" | "normal" | "high";
  volumeProfile: "normal" | "elevated" | "extreme";
  conviction: number; // 0-1
}

export class FuturesMonitor {
  private futuresData: Map<string, FuturesData> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private readonly historyLength = 50;

  /**
   * Update futures data
   */
  updateData(data: FuturesData): void {
    this.futuresData.set(data.symbol, data);

    // Update price history
    if (!this.priceHistory.has(data.symbol)) {
      this.priceHistory.set(data.symbol, []);
    }

    const history = this.priceHistory.get(data.symbol)!;
    history.push(data.price);

    if (history.length > this.historyLength) {
      history.shift();
    }
  }

  /**
   * Get futures data for symbol
   */
  getData(symbol: string): FuturesData | undefined {
    return this.futuresData.get(symbol);
  }

  /**
   * Get all monitored futures
   */
  getAllData(): FuturesData[] {
    return Array.from(this.futuresData.values());
  }

  /**
   * Analyze market context
   */
  analyzeMarketContext(symbol: string): MarketContext {
    const data = this.futuresData.get(symbol);
    const history = this.priceHistory.get(symbol) || [];

    if (!data || history.length < 10) {
      return {
        trend: "sideways",
        volatility: "normal",
        volumeProfile: "normal",
        conviction: 0,
      };
    }

    // Calculate trend
    const sma20 = this.calculateSMA(history, 20);
    const sma10 = this.calculateSMA(history.slice(-10), 10);
    let trend: "up" | "down" | "sideways" = "sideways";
    if (sma10 > sma20 * 1.001) trend = "up";
    else if (sma10 < sma20 * 0.999) trend = "down";

    // Calculate volatility
    const volatility = this.calculateVolatility(history);
    let volProfile: "low" | "normal" | "high" = "normal";
    if (volatility > 0.02) volProfile = "high";
    else if (volatility < 0.005) volProfile = "low";

    // Volume analysis
    let volumeProfile: "normal" | "elevated" | "extreme" = "normal";
    // Simplified - would compare to average volume
    if (data.volume > 1000000) volumeProfile = "elevated";
    if (data.volume > 2000000) volumeProfile = "extreme";

    // Conviction based on alignment
    const conviction = this.calculateConviction(trend, volProfile, data.changePercent);

    return {
      trend,
      volatility: volProfile,
      volumeProfile,
      conviction,
    };
  }

  /**
   * Generate trading signals
   */
  generateSignals(): FuturesSignal[] {
    const signals: FuturesSignal[] = [];

    for (const [symbol, data] of this.futuresData.entries()) {
      const context = this.analyzeMarketContext(symbol);
      const history = this.priceHistory.get(symbol) || [];

      // Check for significant moves
      if (Math.abs(data.changePercent) > 1) {
        signals.push({
          type: data.changePercent > 0 ? "bullish" : "bearish",
          symbol,
          message: `${symbol} ${data.changePercent > 0 ? "up" : "down"} ${Math.abs(data.changePercent).toFixed(2)}%`,
          strength: Math.min(1, Math.abs(data.changePercent) / 2),
          timestamp: data.timestamp,
        });
      }

      // Check for extreme volume
      if (context.volumeProfile === "extreme") {
        signals.push({
          type: "warning",
          symbol,
          message: `${symbol} showing extreme volume activity`,
          strength: 0.8,
          timestamp: data.timestamp,
        });
      }

      // Trend confirmation signal
      if (history.length >= 20) {
        const sma20 = this.calculateSMA(history, 20);
        if (data.price > sma20 * 1.01 && context.trend === "up") {
          signals.push({
            type: "bullish",
            symbol,
            message: `${symbol} confirmed above 20-period average`,
            strength: context.conviction,
            timestamp: data.timestamp,
          });
        } else if (data.price < sma20 * 0.99 && context.trend === "down") {
          signals.push({
            type: "bearish",
            symbol,
            message: `${symbol} confirmed below 20-period average`,
            strength: context.conviction,
            timestamp: data.timestamp,
          });
        }
      }
    }

    return signals.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Get market bias based on futures
   */
  getMarketBias(): "bullish" | "bearish" | "neutral" {
    const signals = this.generateSignals();
    if (signals.length === 0) return "neutral";

    const bullish = signals.filter((s) => s.type === "bullish").length;
    const bearish = signals.filter((s) => s.type === "bearish").length;

    if (bullish > bearish * 1.5) return "bullish";
    if (bearish > bullish * 1.5) return "bearish";
    return "neutral";
  }

  /**
   * Check if futures are signaling volatility
   */
  isVolatilityExpected(): boolean {
    for (const symbol of this.priceHistory.keys()) {
      const context = this.analyzeMarketContext(symbol);
      if (context.volatility === "high") {
        return true;
      }
    }
    return false;
  }

  /**
   * Get pre-market bias
   */
  getPremarketBias(): {
    bias: "bullish" | "bearish" | "neutral";
    confidence: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let bullishCount = 0;
    let bearishCount = 0;
    let totalConfidence = 0;

    for (const [symbol, data] of this.futuresData.entries()) {
      if (data.changePercent > 0.5) {
        bullishCount++;
        totalConfidence += Math.abs(data.changePercent) / 2;
        factors.push(`${symbol} up ${data.changePercent.toFixed(2)}%`);
      } else if (data.changePercent < -0.5) {
        bearishCount++;
        totalConfidence += Math.abs(data.changePercent) / 2;
        factors.push(`${symbol} down ${data.changePercent.toFixed(2)}%`);
      }
    }

    const total = bullishCount + bearishCount;
    if (total === 0) {
      return { bias: "neutral", confidence: 0, factors: ["No significant futures movement"] };
    }

    const confidence = Math.min(1, totalConfidence / total);

    if (bullishCount > bearishCount) {
      return { bias: "bullish", confidence, factors };
    } else if (bearishCount > bullishCount) {
      return { bias: "bearish", confidence, factors };
    }

    return { bias: "neutral", confidence, factors };
  }

  /**
   * Clear data for symbol
   */
  clear(symbol?: string): void {
    if (symbol) {
      this.futuresData.delete(symbol);
      this.priceHistory.delete(symbol);
    } else {
      this.futuresData.clear();
      this.priceHistory.clear();
    }
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
      period = prices.length;
    }
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateConviction(trend: string, volatility: string, changePercent: number): number {
    let conviction = 0.5;

    // Strong trend increases conviction
    if (trend === "up" && changePercent > 0) conviction += 0.2;
    if (trend === "down" && changePercent < 0) conviction += 0.2;

    // Low volatility increases conviction
    if (volatility === "low") conviction += 0.1;
    if (volatility === "high") conviction -= 0.1;

    // Large move increases conviction
    conviction += Math.min(0.2, Math.abs(changePercent) / 10);

    return Math.max(0, Math.min(1, conviction));
  }
}
