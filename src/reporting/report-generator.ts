/**
 * Report Generator
 * Creates comprehensive HTML/PDF reports from backtest results
 */

import type { BacktestResult, TradeRecord, EquityPoint, PerformanceMetrics } from "../backtesting/types.js";
import { getDatabaseClient } from "../database/db-client.js";

export interface ReportConfig {
  outputFormat: "html" | "json" | "markdown";
  includeCharts: boolean;
  includeTradeLog: boolean;
  includeMonthlyBreakdown: boolean;
  maxTradesInReport: number;
}

export const defaultReportConfig: ReportConfig = {
  outputFormat: "html",
  includeCharts: true,
  includeTradeLog: true,
  includeMonthlyBreakdown: true,
  maxTradesInReport: 100,
};

interface MonthlyStats {
  month: string;
  trades: number;
  wins: number;
  losses: number;
  grossProfit: number;
  grossLoss: number;
  netPnL: number;
  avgTrade: number;
  winRate: number;
}

export class ReportGenerator {
  private config: ReportConfig;

  constructor(config: Partial<ReportConfig> = {}) {
    this.config = { ...defaultReportConfig, ...config };
  }

  /**
   * Generate a complete HTML report
   */
  generateHTMLReport(result: BacktestResult, strategyName: string): string {
    const metrics = result.metrics;
    const monthlyStats = this.calculateMonthlyStats(result.trades);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest Report: ${strategyName}</title>
    <style>
        :root {
            --primary: #2563eb;
            --success: #10b981;
            --danger: #ef4444;
            --warning: #f59e0b;
            --bg: #f8fafc;
            --text: #1e293b;
            --border: #e2e8f0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; color: var(--text); }
        .subtitle { color: #64748b; margin-bottom: 2rem; }
        .section {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section h2 {
            font-size: 1.25rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        .metric-card {
            background: var(--bg);
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid var(--primary);
        }
        .metric-label {
            font-size: 0.875rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 0.25rem;
        }
        .positive { color: var(--success); }
        .negative { color: var(--danger); }
        .neutral { color: var(--warning); }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        th, td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        th {
            background: var(--bg);
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            color: #64748b;
        }
        .trade-win { background: rgba(16, 185, 129, 0.1); }
        .trade-loss { background: rgba(239, 68, 68, 0.1); }
        .chart-container {
            height: 300px;
            background: var(--bg);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            margin: 1rem 0;
        }
        .summary-box {
            display: flex;
            gap: 2rem;
            flex-wrap: wrap;
        }
        .summary-item {
            display: flex;
            flex-direction: column;
        }
        .summary-label {
            font-size: 0.875rem;
            color: #64748b;
        }
        .summary-value {
            font-size: 1.25rem;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Backtest Report: ${strategyName}</h1>
        <p class="subtitle">${result.startDate.toISOString().split("T")[0]} to ${result.endDate.toISOString().split("T")[0]}</p>

        <div class="section">
            <h2>Performance Summary</h2>
            <div class="summary-box">
                <div class="summary-item">
                    <span class="summary-label">Total Return</span>
                    <span class="summary-value ${metrics.totalReturn >= 0 ? "positive" : "negative"}">${metrics.totalReturn >= 0 ? "+" : ""}${metrics.totalReturn.toFixed(2)}%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Annualized Return</span>
                    <span class="summary-value ${metrics.annualizedReturn >= 0 ? "positive" : "negative"}">${metrics.annualizedReturn >= 0 ? "+" : ""}${metrics.annualizedReturn.toFixed(2)}%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Sharpe Ratio</span>
                    <span class="summary-value">${metrics.sharpeRatio.toFixed(2)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Max Drawdown</span>
                    <span class="summary-value negative">${metrics.maxDrawdownPercent.toFixed(2)}%</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Key Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Trades</div>
                    <div class="metric-value">${metrics.totalTrades}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Win Rate</div>
                    <div class="metric-value">${(metrics.winRate * 100).toFixed(1)}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Profit Factor</div>
                    <div class="metric-value">${metrics.profitFactor.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Expectancy</div>
                    <div class="metric-value ${metrics.expectancy >= 0 ? "positive" : "negative"}">$${metrics.expectancy.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Win</div>
                    <div class="metric-value positive">$${metrics.avgWin.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Loss</div>
                    <div class="metric-value negative">-$${Math.abs(metrics.avgLoss).toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Largest Win</div>
                    <div class="metric-value positive">$${metrics.largestWin.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Largest Loss</div>
                    <div class="metric-value negative">-$${Math.abs(metrics.largestLoss).toFixed(2)}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Risk Metrics</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Volatility</div>
                    <div class="metric-value">${metrics.volatilityPercent.toFixed(2)}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Sortino Ratio</div>
                    <div class="metric-value">${metrics.sortinoRatio.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Calmar Ratio</div>
                    <div class="metric-value">${metrics.calmarRatio.toFixed(2)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Max Drawdown Duration</div>
                    <div class="metric-value">${metrics.maxDrawdownDuration} days</div>
                </div>
            </div>
        </div>

        ${
          this.config.includeMonthlyBreakdown
            ? `
        <div class="section">
            <h2>Monthly Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Trades</th>
                        <th>Win Rate</th>
                        <th>Gross Profit</th>
                        <th>Gross Loss</th>
                        <th>Net P&L</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthlyStats
                      .map(
                        (m) => `
                    <tr>
                        <td>${m.month}</td>
                        <td>${m.trades}</td>
                        <td class="${m.winRate >= 50 ? "positive" : "negative"}">${m.winRate.toFixed(1)}%</td>
                        <td class="positive">$${m.grossProfit.toFixed(2)}</td>
                        <td class="negative">-$${Math.abs(m.grossLoss).toFixed(2)}</td>
                        <td class="${m.netPnL >= 0 ? "positive" : "negative"}">${m.netPnL >= 0 ? "+" : ""}$${m.netPnL.toFixed(2)}</td>
                    </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        ${
          this.config.includeTradeLog
            ? `
        <div class="section">
            <h2>Recent Trades</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Qty</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>P&L</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.trades
                      .slice(-this.config.maxTradesInReport)
                      .reverse()
                      .map(
                        (t) => `
                    <tr class="${t.pnl >= 0 ? "trade-win" : "trade-loss"}">
                        <td>${t.timestamp.toISOString().split("T")[0]}</td>
                        <td>${t.symbol}</td>
                        <td>${t.side}</td>
                        <td>${t.qty}</td>
                        <td>$${t.entryPrice.toFixed(2)}</td>
                        <td>${t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : "-"}</td>
                        <td class="${t.pnl >= 0 ? "positive" : "negative"}">${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}</td>
                        <td>${t.exitReason || "-"}</td>
                    </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        `
            : ""
        }

        <div class="section">
            <h2>Trade Distribution</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Winning Trades</div>
                    <div class="metric-value positive">${metrics.winningTrades}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Losing Trades</div>
                    <div class="metric-value negative">${metrics.losingTrades}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Breakeven Trades</div>
                    <div class="metric-value">${metrics.breakevenTrades}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Bars Held</div>
                    <div class="metric-value">${metrics.avgBarsHeld.toFixed(1)}</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(result: BacktestResult, strategyName: string): string {
    const report = {
      meta: {
        strategy: strategyName,
        generatedAt: new Date().toISOString(),
        version: "1.0.0",
      },
      summary: {
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        duration: result.duration,
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        maxDrawdown: result.maxDrawdown,
        sharpeRatio: result.sharpeRatio,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
      },
      metrics: result.metrics,
      equityCurve: result.equityCurve.map((p) => ({
        timestamp: p.timestamp.toISOString(),
        equity: p.equity,
        cash: p.cash,
        positionsValue: p.positionsValue,
        unrealizedPnl: p.unrealizedPnl,
        realizedPnl: p.realizedPnl,
      })),
      trades: result.trades.map((t) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
        exitTime: t.exitTime?.toISOString(),
      })),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Save report to file
   */
  async saveReport(result: BacktestResult, strategyName: string, outputPath: string): Promise<void> {
    let content: string;

    switch (this.config.outputFormat) {
      case "html":
        content = this.generateHTMLReport(result, strategyName);
        break;
      case "json":
        content = this.generateJSONReport(result, strategyName);
        break;
      default:
        content = this.generateHTMLReport(result, strategyName);
    }

    await Bun.write(outputPath, content);
    console.log(`Report saved to: ${outputPath}`);

    // Also save to database
    try {
      const db = getDatabaseClient();
      db.saveStrategyResult({
        strategyName,
        symbol: result.trades[0]?.symbol || "",
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        initialCapital: 0, // Should be passed through
        finalEquity: result.equityCurve[result.equityCurve.length - 1]?.equity || 0,
        totalReturn: result.totalReturn,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        totalTrades: result.metrics.totalTrades,
      });
    } catch (e) {
      // Database might not be connected, that's ok
    }
  }

  private calculateMonthlyStats(trades: TradeRecord[]): MonthlyStats[] {
    const monthlyMap = new Map<string, MonthlyStats>();

    for (const trade of trades) {
      const month = trade.timestamp.toISOString().slice(0, 7); // YYYY-MM

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          trades: 0,
          wins: 0,
          losses: 0,
          grossProfit: 0,
          grossLoss: 0,
          netPnL: 0,
          avgTrade: 0,
          winRate: 0,
        });
      }

      const stats = monthlyMap.get(month)!;
      stats.trades++;

      if (trade.pnl > 0) {
        stats.wins++;
        stats.grossProfit += trade.pnl;
      } else if (trade.pnl < 0) {
        stats.losses++;
        stats.grossLoss += trade.pnl;
      }

      stats.netPnL += trade.pnl;
    }

    // Calculate averages and win rates
    for (const stats of Array.from(monthlyMap.values())) {
      stats.winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
      stats.avgTrade = stats.trades > 0 ? stats.netPnL / stats.trades : 0;
    }

    return Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate MAE (Maximum Adverse Excursion) and MFE (Maximum Favorable Excursion)
   */
  calculateMAEMFE(_trades: TradeRecord[]): {
    avgMAE: number;
    avgMFE: number;
    avgMAEPercent: number;
    avgMFEPercent: number;
  } {
    // Placeholder - in real implementation would need intraday data
    return {
      avgMAE: 0,
      avgMFE: 0,
      avgMAEPercent: 0,
      avgMFEPercent: 0,
    };
  }

  /**
   * Calculate R-multiples (expectancy in terms of initial risk)
   */
  calculateRMultiples(trades: TradeRecord[]): {
    avgR: number;
    rMultipleDistribution: { r: number; count: number }[];
  } {
    // R-multiple = profit / initial risk
    // Placeholder implementation
    return {
      avgR: 0,
      rMultipleDistribution: [],
    };
  }
}
