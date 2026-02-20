/**
 * PreMarketIntelligence
 * Gathers pre-market data for trading decisions
 */

export interface PreMarketData {
  symbol: string;
  preMarketPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: Date;
}

export interface MarketScanResult {
  symbol: string;
  gapPercent: number;
  volumeRatio: number;
  momentum: "up" | "down" | "neutral";
  alertLevel: "none" | "low" | "medium" | "high";
}

export interface PreMarketIntelligenceConfig {
  gapThreshold: number;
  volumeThreshold: number;
  scanIntervalMs: number;
  maxSymbols: number;
}

export class PreMarketIntelligence {
  private config: PreMarketIntelligenceConfig;
  private preMarketData: Map<string, PreMarketData> = new Map();
  private scanResults: Map<string, MarketScanResult> = new Map();
  private symbols: string[] = [];
  private scanInterval: Timer | null = null;

  constructor(config?: Partial<PreMarketIntelligenceConfig>) {
    this.config = {
      gapThreshold: 0.02, // 2%
      volumeThreshold: 2.0, // 2x average
      scanIntervalMs: 60000, // 1 minute
      maxSymbols: 100,
      ...config,
    };
  }

  /**
   * Set symbols to monitor
   */
  setSymbols(symbols: string[]): void {
    this.symbols = symbols.slice(0, this.config.maxSymbols);
  }

  /**
   * Add pre-market data for a symbol
   */
  addPreMarketData(data: PreMarketData): void {
    this.preMarketData.set(data.symbol, data);
  }

  /**
   * Scan all symbols for opportunities
   */
  scanMarket(): MarketScanResult[] {
    const results: MarketScanResult[] = [];

    for (const symbol of this.symbols) {
      const data = this.preMarketData.get(symbol);
      if (!data) continue;

      const result = this.analyzeSymbol(symbol, data);
      this.scanResults.set(symbol, result);
      results.push(result);
    }

    return results.sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));
  }

  /**
   * Get high alert symbols
   */
  getHighAlertSymbols(): MarketScanResult[] {
    return Array.from(this.scanResults.values())
      .filter(r => r.alertLevel === "high")
      .sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));
  }

  /**
   * Get symbols with gap ups
   */
  getGapUps(minGap: number = this.config.gapThreshold): MarketScanResult[] {
    return Array.from(this.scanResults.values())
      .filter(r => r.gapPercent >= minGap)
      .sort((a, b) => b.gapPercent - a.gapPercent);
  }

  /**
   * Get symbols with gap downs
   */
  getGapDowns(minGap: number = this.config.gapThreshold): MarketScanResult[] {
    return Array.from(this.scanResults.values())
      .filter(r => r.gapPercent <= -minGap)
      .sort((a, b) => a.gapPercent - b.gapPercent);
  }

  /**
   * Start continuous scanning
   */
  startScanning(): void {
    if (this.scanInterval) return;

    this.scanMarket(); // Initial scan
    this.scanInterval = setInterval(() => {
      this.scanMarket();
    }, this.config.scanIntervalMs);
  }

  /**
   * Stop continuous scanning
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Get data for specific symbol
   */
  getSymbolData(symbol: string): PreMarketData | undefined {
    return this.preMarketData.get(symbol);
  }

  /**
   * Get scan result for specific symbol
   */
  getScanResult(symbol: string): MarketScanResult | undefined {
    return this.scanResults.get(symbol);
  }

  /**
   * Get market summary
   */
  getMarketSummary(): {
    totalSymbols: number;
    gapUps: number;
    gapDowns: number;
    highAlerts: number;
    averageGap: number;
  } {
    const results = Array.from(this.scanResults.values());
    const gapUps = results.filter(r => r.gapPercent > 0).length;
    const gapDowns = results.filter(r => r.gapPercent < 0).length;
    const highAlerts = results.filter(r => r.alertLevel === "high").length;
    const averageGap = results.length > 0
      ? results.reduce((sum, r) => sum + r.gapPercent, 0) / results.length
      : 0;

    return {
      totalSymbols: results.length,
      gapUps,
      gapDowns,
      highAlerts,
      averageGap,
    };
  }

  private analyzeSymbol(symbol: string, data: PreMarketData): MarketScanResult {
    const gapPercent = data.changePercent;
    const volumeRatio = 1.0; // Would compare to average volume

    let momentum: "up" | "down" | "neutral" = "neutral";
    if (gapPercent > 0.01) momentum = "up";
    else if (gapPercent < -0.01) momentum = "down";

    let alertLevel: "none" | "low" | "medium" | "high" = "none";
    if (Math.abs(gapPercent) > this.config.gapThreshold * 2) {
      alertLevel = "high";
    } else if (Math.abs(gapPercent) > this.config.gapThreshold) {
      alertLevel = "medium";
    } else if (volumeRatio > this.config.volumeThreshold) {
      alertLevel = "low";
    }

    return {
      symbol,
      gapPercent,
      volumeRatio,
      momentum,
      alertLevel,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.preMarketData.clear();
    this.scanResults.clear();
    this.stopScanning();
  }

  /**
   * Check if scanning is active
   */
  isScanning(): boolean {
    return this.scanInterval !== null;
  }
}
