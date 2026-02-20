/**
 * SlippageAnalyzer
 * Analyzes execution slippage and market impact
 */

export interface TradeExecution {
  tradeId: string;
  symbol: string;
  intendedPrice: number;
  executedPrice: number;
  quantity: number;
  side: "buy" | "sell";
  orderType: "market" | "limit" | "stop";
  timestamp: Date;
  marketVolatility: number;
  spread: number;
  timeOfDay: number; // Hour (0-23)
}

export interface SlippageMetrics {
  avgSlippage: number;
  maxSlippage: number;
  slippageBySymbol: Map<string, number>;
  slippageByTime: Map<number, number>; // By hour
  slippageByVolatility: { low: number; normal: number; high: number };
}

export class SlippageAnalyzer {
  private executions: TradeExecution[] = [];

  /**
   * Add trade execution
   */
  addExecution(execution: TradeExecution): void {
    this.executions.push(execution);
  }

  /**
   * Add multiple executions
   */
  addExecutions(executions: TradeExecution[]): void {
    this.executions.push(...executions);
  }

  /**
   * Calculate slippage for execution
   */
  calculateSlippage(execution: TradeExecution): {
    slippageAmount: number;
    slippagePercent: number;
    direction: "favorable" | "adverse" | "none";
  } {
    const slippageAmount =
      execution.side === "buy"
        ? execution.executedPrice - execution.intendedPrice
        : execution.intendedPrice - execution.executedPrice;

    const slippagePercent = Math.abs(slippageAmount) / execution.intendedPrice;
    const direction = slippageAmount < 0 ? "favorable" : slippageAmount > 0 ? "adverse" : "none";

    return { slippageAmount, slippagePercent, direction };
  }

  /**
   * Get slippage metrics
   */
  getMetrics(): SlippageMetrics {
    if (this.executions.length === 0) {
      return {
        avgSlippage: 0,
        maxSlippage: 0,
        slippageBySymbol: new Map(),
        slippageByTime: new Map(),
        slippageByVolatility: { low: 0, normal: 0, high: 0 },
      };
    }

    // Calculate all slippages
    const slippages = this.executions.map((e) => ({
      execution: e,
      ...this.calculateSlippage(e),
    }));

    // Overall metrics
    const adverseSlippages = slippages.filter((s) => s.direction === "adverse");
    const avgSlippage =
      adverseSlippages.length > 0
        ? adverseSlippages.reduce((sum, s) => sum + s.slippagePercent, 0) / adverseSlippages.length
        : 0;
    const maxSlippage = adverseSlippages.length > 0 ? Math.max(...adverseSlippages.map((s) => s.slippagePercent)) : 0;

    // By symbol
    const slippageBySymbol = new Map<string, number>();
    const symbolGroups = this.groupBy(slippages, (s) => s.execution.symbol);
    for (const [symbol, group] of symbolGroups.entries()) {
      const adverse = group.filter((s) => s.direction === "adverse");
      if (adverse.length > 0) {
        const avg = adverse.reduce((sum, s) => sum + s.slippagePercent, 0) / adverse.length;
        slippageBySymbol.set(symbol, avg);
      }
    }

    // By time of day
    const slippageByTime = new Map<number, number>();
    const timeGroups = this.groupBy(slippages, (s) => s.execution.timeOfDay);
    for (const [hour, group] of timeGroups.entries()) {
      const adverse = group.filter((s) => s.direction === "adverse");
      if (adverse.length > 0) {
        const avg = adverse.reduce((sum, s) => sum + s.slippagePercent, 0) / adverse.length;
        slippageByTime.set(hour, avg);
      }
    }

    // By volatility
    const lowVol = slippages.filter((s) => s.execution.marketVolatility < 0.01);
    const normalVol = slippages.filter(
      (s) => s.execution.marketVolatility >= 0.01 && s.execution.marketVolatility < 0.03,
    );
    const highVol = slippages.filter((s) => s.execution.marketVolatility >= 0.03);

    const avgLow = this.avgAdverseSlippage(lowVol);
    const avgNormal = this.avgAdverseSlippage(normalVol);
    const avgHigh = this.avgAdverseSlippage(highVol);

    return {
      avgSlippage,
      maxSlippage,
      slippageBySymbol,
      slippageByTime,
      slippageByVolatility: { low: avgLow, normal: avgNormal, high: avgHigh },
    };
  }

  /**
   * Get worst slippage trades
   */
  getWorstSlippage(count: number = 5): (TradeExecution & { slippagePercent: number })[] {
    const withSlippage = this.executions.map((e) => ({
      ...e,
      slippagePercent: this.calculateSlippage(e).slippagePercent,
    }));

    return withSlippage
      .filter((e) => (e.side === "buy" ? e.executedPrice > e.intendedPrice : e.executedPrice < e.intendedPrice))
      .sort((a, b) => b.slippagePercent - a.slippagePercent)
      .slice(0, count);
  }

  /**
   * Analyze slippage by order type
   */
  getSlippageByOrderType(): Record<string, { avgSlippage: number; tradeCount: number }> {
    const byType: Record<string, { totalSlippage: number; count: number }> = {
      market: { totalSlippage: 0, count: 0 },
      limit: { totalSlippage: 0, count: 0 },
      stop: { totalSlippage: 0, count: 0 },
    };

    for (const execution of this.executions) {
      const { slippagePercent, direction } = this.calculateSlippage(execution);
      if (direction === "adverse") {
        byType[execution.orderType].totalSlippage += slippagePercent;
        byType[execution.orderType].count++;
      }
    }

    return {
      market: {
        avgSlippage: byType.market.count > 0 ? byType.market.totalSlippage / byType.market.count : 0,
        tradeCount: byType.market.count,
      },
      limit: {
        avgSlippage: byType.limit.count > 0 ? byType.limit.totalSlippage / byType.limit.count : 0,
        tradeCount: byType.limit.count,
      },
      stop: {
        avgSlippage: byType.stop.count > 0 ? byType.stop.totalSlippage / byType.stop.count : 0,
        tradeCount: byType.stop.count,
      },
    };
  }

  /**
   * Estimate slippage for planned trade
   */
  estimateSlippage(
    symbol: string,
    quantity: number,
    timeOfDay: number,
  ): {
    estimatedSlippage: number;
    confidence: number;
    factors: string[];
  } {
    const metrics = this.getMetrics();
    let estimatedSlippage = metrics.avgSlippage;
    const factors: string[] = [];

    // Symbol-specific adjustment
    const symbolSlippage = metrics.slippageBySymbol.get(symbol);
    if (symbolSlippage) {
      estimatedSlippage = symbolSlippage;
      factors.push(`Symbol-specific average: ${(symbolSlippage * 100).toFixed(3)}%`);
    }

    // Time adjustment
    const timeSlippage = metrics.slippageByTime.get(timeOfDay);
    if (timeSlippage) {
      estimatedSlippage = (estimatedSlippage + timeSlippage) / 2;
      factors.push(`Time of day adjustment`);
    }

    // Quantity impact (larger = more slippage)
    if (quantity > 1000) {
      estimatedSlippage *= 1.5;
      factors.push("Large quantity premium");
    }

    const confidence = this.executions.length > 100 ? 0.8 : this.executions.length > 20 ? 0.6 : 0.4;

    return { estimatedSlippage, confidence, factors };
  }

  /**
   * Get recommendations to reduce slippage
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();
    const byOrderType = this.getSlippageByOrderType();

    // Order type recommendations
    if (byOrderType.market.avgSlippage > byOrderType.limit.avgSlippage * 2) {
      recommendations.push("Consider using limit orders more frequently");
    }

    // Time recommendations
    let worstHour = -1;
    let worstSlippage = 0;
    for (const [hour, slippage] of metrics.slippageByTime.entries()) {
      if (slippage > worstSlippage) {
        worstSlippage = slippage;
        worstHour = hour;
      }
    }
    if (worstHour !== -1 && worstSlippage > metrics.avgSlippage * 1.5) {
      recommendations.push(`Avoid trading at ${worstHour}:00 (high slippage: ${(worstSlippage * 100).toFixed(3)}%)`);
    }

    // Volatility recommendations
    if (metrics.slippageByVolatility.high > metrics.slippageByVolatility.normal * 2) {
      recommendations.push("Reduce position sizes during high volatility periods");
    }

    if (recommendations.length === 0) {
      recommendations.push("Slippage levels appear reasonable");
    }

    return recommendations;
  }

  /**
   * Clear old executions
   */
  clearOld(beforeDate: Date): void {
    this.executions = this.executions.filter((e) => e.timestamp >= beforeDate);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.executions = [];
  }

  private groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    for (const item of array) {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }

  private avgAdverseSlippage(slippages: { direction: string; slippagePercent: number }[]): number {
    const adverse = slippages.filter((s) => s.direction === "adverse");
    if (adverse.length === 0) return 0;
    return adverse.reduce((sum, s) => sum + s.slippagePercent, 0) / adverse.length;
  }
}
