import type { Trade } from "../adapters/types.js";

interface PerformanceMetrics {
  totalReturn: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
}

export class ResultsFormatter {
  formatEquity(equityCurve: { timestamp: Date; equity: number }[]): string {
    let output = "Equity Curve\n";
    output += "============\n";

    for (const point of equityCurve) {
      const date = point.timestamp.toLocaleDateString();
      const equity = point.equity.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      output += `${date}: ${equity}\n`;
    }

    return output;
  }

  formatTrades(trades: Trade[]): string {
    let output = "Trade History\n";
    output += "=============\n";
    output += "ID | Symbol | Side | Qty | Price | Date\n";
    output += "---|--------|------|-----|-------|------\n";

    for (const trade of trades) {
      const date = trade.timestamp.toLocaleDateString();
      const price = trade.price.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      output += `${trade.id} | ${trade.symbol} | ${trade.side.toUpperCase()} | ${trade.qty} | ${price} | ${date}\n`;
    }

    return output;
  }

  formatMetrics(metrics: PerformanceMetrics): string {
    let output = "Performance Metrics\n";
    output += "===================\n";
    output += `Total Return: ${metrics.totalReturn.toFixed(2)}%\n`;
    output += `Total Trades: ${metrics.totalTrades}\n`;
    output += `Win Rate: ${metrics.winRate.toFixed(1)}%\n`;
    output += `Average Win: $${metrics.avgWin}\n`;
    output += `Average Loss: $${metrics.avgLoss}\n`;
    output += `Max Drawdown: ${metrics.maxDrawdown.toFixed(2)}%\n`;

    return output;
  }
}
