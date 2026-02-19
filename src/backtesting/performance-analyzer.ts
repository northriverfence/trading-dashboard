/**
 * Performance Analyzer
 * Calculates trading performance metrics from backtest results
 */

import type { TradeRecord, EquityPoint, PerformanceMetrics, DrawdownPoint } from "./types.js";
import type { PerformanceAnalyzer as IPerformanceAnalyzer } from "./types.js";

export class PerformanceAnalyzer implements IPerformanceAnalyzer {
  analyze(trades: TradeRecord[], equityCurve: EquityPoint[]): PerformanceMetrics {
    const metrics: PerformanceMetrics = {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      lossRate: 0,
      breakevenRate: 0,
      avgWin: 0,
      avgLoss: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      largestWin: 0,
      largestLoss: 0,
      largestWinPercent: 0,
      largestLossPercent: 0,
      profitFactor: 0,
      expectancy: 0,
      expectancyPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      maxDrawdownDuration: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      annualizedReturn: 0,
      annualizedReturnPercent: 0,
      volatility: 0,
      volatilityPercent: 0,
      avgBarsHeld: 0,
      avgTradePerDay: 0,
      avgTradePerMonth: 0,
    };

    if (trades.length === 0) {
      return metrics;
    }

    // Calculate trade statistics
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl < 0);
    const breakevenTrades = trades.filter((t) => t.pnl === 0);

    metrics.winningTrades = winningTrades.length;
    metrics.losingTrades = losingTrades.length;
    metrics.breakevenTrades = breakevenTrades.length;

    metrics.winRate = metrics.totalTrades > 0 ? metrics.winningTrades / metrics.totalTrades : 0;
    metrics.lossRate = metrics.totalTrades > 0 ? metrics.losingTrades / metrics.totalTrades : 0;
    metrics.breakevenRate = metrics.totalTrades > 0 ? metrics.breakevenTrades / metrics.totalTrades : 0;

    // Average win/loss
    if (winningTrades.length > 0) {
      metrics.avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
      metrics.avgWinPercent = winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length;
      metrics.largestWin = Math.max(...winningTrades.map((t) => t.pnl));
      metrics.largestWinPercent = Math.max(...winningTrades.map((t) => t.pnlPercent));
    }

    if (losingTrades.length > 0) {
      metrics.avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);
      metrics.avgLossPercent = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / losingTrades.length);
      metrics.largestLoss = Math.min(...losingTrades.map((t) => t.pnl));
      metrics.largestLossPercent = Math.min(...losingTrades.map((t) => t.pnlPercent));
    }

    // Profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    metrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Expectancy
    metrics.expectancy = metrics.winRate * metrics.avgWin - metrics.lossRate * metrics.avgLoss;
    metrics.expectancyPercent = metrics.winRate * metrics.avgWinPercent - metrics.lossRate * metrics.avgLossPercent;

    // Drawdown analysis
    const drawdownResult = this.calculateMaxDrawdown(equityCurve);
    metrics.maxDrawdown = drawdownResult.maxDrawdown;
    metrics.maxDrawdownPercent = drawdownResult.maxDrawdownPercent;
    metrics.maxDrawdownDuration = this.calculateMaxDrawdownDuration(equityCurve);

    // Returns analysis
    if (equityCurve.length > 1) {
      const returns = this.calculateReturns(equityCurve);
      const initialEquity = equityCurve[0]?.equity ?? 0;
      const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? 0;

      metrics.totalReturn = finalEquity - initialEquity;
      metrics.totalReturnPercent = (metrics.totalReturn / initialEquity) * 100;

      // Annualized return
      const days = this.getTradingDays(equityCurve);
      metrics.annualizedReturn = this.calculateAnnualizedReturn(initialEquity, finalEquity, days);
      metrics.annualizedReturnPercent = (metrics.annualizedReturn / initialEquity) * 100;

      // Volatility
      metrics.volatility = this.calculateVolatility(returns);
      metrics.volatilityPercent = metrics.volatility * 100;

      // Ratios
      metrics.sharpeRatio = this.calculateSharpeRatio(returns);
      metrics.sortinoRatio = this.calculateSortinoRatio(returns);
      metrics.calmarRatio = this.calculateCalmarRatio(metrics.annualizedReturnPercent, metrics.maxDrawdownPercent);
    }

    // Trade frequency
    metrics.avgBarsHeld = trades.length > 0 ? trades.reduce((sum, t) => sum + t.barsHeld, 0) / trades.length : 0;

    if (equityCurve.length > 1) {
      const tradingDays = this.getTradingDays(equityCurve);
      metrics.avgTradePerDay = tradingDays > 0 ? trades.length / tradingDays : 0;
      metrics.avgTradePerMonth = tradingDays > 0 ? (trades.length / tradingDays) * 21 : 0;
    }

    return metrics;
  }

  calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;

    // Assume returns are daily, annualize
    const excessReturns = returns.map((r) => r - riskFreeRate / 252);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
    const stdDev = Math.sqrt(
      excessReturns.reduce((sum, r) => sum + Math.pow(r - avgExcessReturn, 2), 0) / excessReturns.length,
    );

    return stdDev > 0 ? (avgExcessReturn / stdDev) * Math.sqrt(252) : 0;
  }

  calculateMaxDrawdown(equityCurve: EquityPoint[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    let peak = equityCurve[0]?.equity ?? 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = peak - point.equity;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  private calculateMaxDrawdownDuration(equityCurve: EquityPoint[]): number {
    if (equityCurve.length < 2) return 0;

    let peakIdx = 0;
    let maxDuration = 0;

    for (let i = 1; i < equityCurve.length; i++) {
      const current = equityCurve[i];
      const peak = equityCurve[peakIdx];
      if (!current || !peak) continue;

      if (current.equity > peak.equity) {
        peakIdx = i;
      } else {
        const duration = (current.timestamp.getTime() - peak.timestamp.getTime()) / (1000 * 60 * 60 * 24);
        maxDuration = Math.max(maxDuration, duration);
      }
    }

    return maxDuration;
  }

  private calculateReturns(equityCurve: EquityPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevPoint = equityCurve[i - 1];
      const currPoint = equityCurve[i];
      if (!prevPoint || !currPoint) continue;
      const prevEquity = prevPoint.equity;
      if (prevEquity > 0) {
        returns.push((currPoint.equity - prevEquity) / prevEquity);
      }
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const avg = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length < 2) return 0;

    const excessReturns = returns.map((r) => r - riskFreeRate / 252);
    const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;

    // Downside deviation (only negative returns)
    const downsideReturns = excessReturns.filter((r) => r < 0);
    const downsideDeviation =
      downsideReturns.length > 0
        ? Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
        : 0;

    return downsideDeviation > 0 ? (avgExcessReturn / downsideDeviation) * Math.sqrt(252) : 0;
  }

  private calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    return maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  }

  private calculateAnnualizedReturn(initial: number, final: number, days: number): number {
    if (initial <= 0 || days <= 0) return 0;
    const totalReturn = (final - initial) / initial;
    const years = days / 252; // Trading days per year
    return initial * (Math.pow(1 + totalReturn, 1 / years) - 1);
  }

  private getTradingDays(equityCurve: EquityPoint[]): number {
    if (equityCurve.length < 2) return 0;
    const firstPoint = equityCurve[0];
    const lastPoint = equityCurve[equityCurve.length - 1];
    if (!firstPoint || !lastPoint) return 0;
    return (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) / (1000 * 60 * 60 * 24);
  }

  calculateDrawdownCurve(equityCurve: EquityPoint[]): DrawdownPoint[] {
    const drawdownCurve: DrawdownPoint[] = [];
    let peak = equityCurve[0]?.equity ?? 0;

    for (const point of equityCurve) {
      if (point.equity > peak) {
        peak = point.equity;
      }

      const drawdown = peak - point.equity;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      drawdownCurve.push({
        timestamp: point.timestamp,
        drawdown,
        drawdownPercent,
      });
    }

    return drawdownCurve;
  }
}
