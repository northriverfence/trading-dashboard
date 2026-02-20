/**
 * CorrelationEngine
 * Finds correlations between symbols and market factors
 */

export interface CorrelationResult {
  symbol1: string;
  symbol2: string;
  correlation: number; // -1 to 1
  confidence: number; // 0 to 1
  sampleSize: number;
  timeframe: string;
}

export interface MarketCorrelation {
  factor: string; // e.g., "SPY", "VIX", "sector"
  symbol: string;
  beta: number;
  rSquared: number;
  correlation: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  updatedAt: Date;
}

export class CorrelationEngine {
  private priceData: Map<string, number[]> = new Map();
  private correlations: Map<string, CorrelationResult> = new Map();
  private marketCorrelations: Map<string, MarketCorrelation[]> = new Map();

  /**
   * Add price data for symbol
   */
  addPriceData(symbol: string, prices: number[]): void {
    this.priceData.set(symbol, prices);
  }

  /**
   * Calculate correlation between two symbols
   */
  calculateCorrelation(symbol1: string, symbol2: string): CorrelationResult | null {
    const prices1 = this.priceData.get(symbol1);
    const prices2 = this.priceData.get(symbol2);

    if (!prices1 || !prices2 || prices1.length < 10 || prices2.length < 10) {
      return null;
    }

    // Calculate returns
    const returns1 = this.calculateReturns(prices1);
    const returns2 = this.calculateReturns(prices2);

    // Use minimum length
    const minLength = Math.min(returns1.length, returns2.length);
    const r1 = returns1.slice(-minLength);
    const r2 = returns2.slice(-minLength);

    const correlation = this.pearsonCorrelation(r1, r2);

    const result: CorrelationResult = {
      symbol1,
      symbol2,
      correlation,
      confidence: Math.min(1, minLength / 30),
      sampleSize: minLength,
      timeframe: `${minLength} periods`,
    };

    const key = `${symbol1}-${symbol2}`;
    this.correlations.set(key, result);

    return result;
  }

  /**
   * Build correlation matrix for symbols
   */
  buildCorrelationMatrix(symbols: string[]): CorrelationMatrix {
    const matrix: number[][] = [];

    for (let i = 0; i < symbols.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < symbols.length; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i];
        } else {
          const corr = this.calculateCorrelation(symbols[i], symbols[j]);
          matrix[i][j] = corr?.correlation || 0;
        }
      }
    }

    return {
      symbols,
      matrix,
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate market beta
   */
  calculateBeta(symbol: string, marketSymbol: string = "SPY"): number {
    const symbolPrices = this.priceData.get(symbol);
    const marketPrices = this.priceData.get(marketSymbol);

    if (!symbolPrices || !marketPrices) {
      return 1; // Default beta
    }

    const symbolReturns = this.calculateReturns(symbolPrices);
    const marketReturns = this.calculateReturns(marketPrices);

    const minLength = Math.min(symbolReturns.length, marketReturns.length);
    const s = symbolReturns.slice(-minLength);
    const m = marketReturns.slice(-minLength);

    const covariance = this.calculateCovariance(s, m);
    const marketVariance = this.calculateVariance(m);

    return marketVariance !== 0 ? covariance / marketVariance : 1;
  }

  /**
   * Find highly correlated pairs
   */
  findHighlyCorrelated(threshold: number = 0.8): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const symbols = Array.from(this.priceData.keys());

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const corr = this.calculateCorrelation(symbols[i], symbols[j]);
        if (corr && Math.abs(corr.correlation) >= threshold) {
          results.push(corr);
        }
      }
    }

    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Find diversification opportunities (low correlation)
   */
  findDiversificationOpportunities(targetSymbol: string, maxCorrelation: number = 0.3): string[] {
    const results: string[] = [];
    const symbols = Array.from(this.priceData.keys());

    for (const symbol of symbols) {
      if (symbol === targetSymbol) continue;

      const corr = this.calculateCorrelation(targetSymbol, symbol);
      if (corr && Math.abs(corr.correlation) <= maxCorrelation) {
        results.push(symbol);
      }
    }

    return results;
  }

  /**
   * Calculate sector correlation
   */
  calculateSectorCorrelation(symbol: string, sectorPrices: number[]): number {
    const symbolPrices = this.priceData.get(symbol);
    if (!symbolPrices) return 0;

    const symbolReturns = this.calculateReturns(symbolPrices);
    const sectorReturns = this.calculateReturns(sectorPrices);

    const minLength = Math.min(symbolReturns.length, sectorReturns.length);
    return this.pearsonCorrelation(
      symbolReturns.slice(-minLength),
      sectorReturns.slice(-minLength)
    );
  }

  /**
   * Detect correlation breakdowns
   */
  detectCorrelationBreakdown(
    symbol1: string,
    symbol2: string,
    windowSize: number = 20
  ): {
    broken: boolean;
    historicalCorr: number;
    recentCorr: number;
    change: number;
  } | null {
    const prices1 = this.priceData.get(symbol1);
    const prices2 = this.priceData.get(symbol2);

    if (!prices1 || !prices2 || prices1.length < windowSize * 2) {
      return null;
    }

    const returns1 = this.calculateReturns(prices1);
    const returns2 = this.calculateReturns(prices2);

    // Historical correlation (older half)
    const historicalCorr = this.pearsonCorrelation(
      returns1.slice(-windowSize * 2, -windowSize),
      returns2.slice(-windowSize * 2, -windowSize)
    );

    // Recent correlation (newer half)
    const recentCorr = this.pearsonCorrelation(
      returns1.slice(-windowSize),
      returns2.slice(-windowSize)
    );

    const change = Math.abs(recentCorr - historicalCorr);
    const broken = change > 0.3; // Significant change threshold

    return {
      broken,
      historicalCorr,
      recentCorr,
      change,
    };
  }

  /**
   * Get correlation for pair
   */
  getCorrelation(symbol1: string, symbol2: string): CorrelationResult | undefined {
    const key = `${symbol1}-${symbol2}`;
    return this.correlations.get(key);
  }

  /**
   * Clear data
   */
  clear(symbol?: string): void {
    if (symbol) {
      this.priceData.delete(symbol);
      // Clear correlations involving this symbol
      for (const key of this.correlations.keys()) {
        if (key.includes(symbol)) {
          this.correlations.delete(key);
        }
      }
    } else {
      this.priceData.clear();
      this.correlations.clear();
    }
  }

  /**
   * Get all correlations
   */
  getAllCorrelations(): CorrelationResult[] {
    return Array.from(this.correlations.values());
  }

  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateCovariance(x: number[], y: number[]): number {
    const meanX = x.reduce((a, b) => a + b, 0) / x.length;
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;

    let sum = 0;
    for (let i = 0; i < x.length; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }

    return sum / x.length;
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    return data.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / data.length;
  }
}
