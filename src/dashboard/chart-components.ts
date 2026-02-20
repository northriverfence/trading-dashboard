/**
 * ChartComponents
 * Data structures and utilities for dashboard charts
 */

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDataset {
  label: string;
  data: number[] | TimeSeriesData[];
  color?: string;
  type?: "line" | "bar" | "area";
  fill?: boolean;
}

export interface ChartConfig {
  title: string;
  type: "line" | "bar" | "candlestick" | "pie" | "area";
  xAxis: { label: string; type: "time" | "category" | "linear" };
  yAxis: { label: string; min?: number; max?: number };
  datasets: ChartDataset[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface PerformanceChartData {
  dates: Date[];
  equity: number[];
  benchmark?: number[];
  drawdowns: number[];
  returns: number[];
}

export interface TradeDistributionData {
  labels: string[];
  winning: number[];
  losing: number[];
}

export class ChartComponents {
  private colorPalette = [
    "#10b981", // Green
    "#ef4444", // Red
    "#3b82f6", // Blue
    "#f59e0b", // Yellow
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#84cc16", // Lime
  ];

  /**
   * Create equity curve chart config
   */
  createEquityCurveChart(data: PerformanceChartData, showBenchmark = true): ChartConfig {
    const datasets: ChartDataset[] = [
      {
        label: "Portfolio",
        data: data.dates.map((d, i) => ({ timestamp: d, value: data.equity[i] })),
        color: this.colorPalette[0],
        type: "line",
        fill: false,
      },
    ];

    if (showBenchmark && data.benchmark) {
      datasets.push({
        label: "Benchmark",
        data: data.dates.map((d, i) => ({ timestamp: d, value: data.benchmark![i] })),
        color: this.colorPalette[2],
        type: "line",
        fill: false,
      });
    }

    return {
      title: "Equity Curve",
      type: "line",
      xAxis: { label: "Date", type: "time" },
      yAxis: { label: "Value ($)" },
      datasets,
      showLegend: true,
      showGrid: true,
    };
  }

  /**
   * Create drawdown chart config
   */
  createDrawdownChart(data: PerformanceChartData): ChartConfig {
    return {
      title: "Drawdown Analysis",
      type: "area",
      xAxis: { label: "Date", type: "time" },
      yAxis: { label: "Drawdown (%)", max: 0 },
      datasets: [
        {
          label: "Drawdown",
          data: data.dates.map((d, i) => ({ timestamp: d, value: data.drawdowns[i] * 100 })),
          color: this.colorPalette[1],
          type: "area",
          fill: true,
        },
      ],
      showLegend: false,
      showGrid: true,
    };
  }

  /**
   * Create monthly returns chart
   */
  createMonthlyReturnsChart(months: string[], returns: number[]): ChartConfig {
    const colors = returns.map((r) => (r >= 0 ? this.colorPalette[0] : this.colorPalette[1]));

    return {
      title: "Monthly Returns",
      type: "bar",
      xAxis: { label: "Month", type: "category" },
      yAxis: { label: "Return (%)" },
      datasets: [
        {
          label: "Return",
          data: returns.map((r, i) => ({ timestamp: new Date(months[i]), value: r * 100, label: months[i] })),
          color: colors[0],
          type: "bar",
        },
      ],
      showLegend: false,
      showGrid: true,
    };
  }

  /**
   * Create trade distribution chart
   */
  createTradeDistributionChart(data: TradeDistributionData): ChartConfig {
    return {
      title: "Trade Distribution",
      type: "bar",
      xAxis: { label: "Category", type: "category" },
      yAxis: { label: "Count" },
      datasets: [
        {
          label: "Winning",
          data: data.winning,
          color: this.colorPalette[0],
          type: "bar",
        },
        {
          label: "Losing",
          data: data.losing,
          color: this.colorPalette[1],
          type: "bar",
        },
      ],
      showLegend: true,
      showGrid: true,
    };
  }

  /**
   * Create win rate pie chart
   */
  createWinRateChart(winning: number, losing: number, breakeven = 0): ChartConfig {
    return {
      title: "Win Rate",
      type: "pie",
      xAxis: { label: "", type: "category" },
      yAxis: { label: "" },
      datasets: [
        {
          label: "Trades",
          data: [winning, losing, breakeven],
          color: this.colorPalette[0],
        },
      ],
      showLegend: true,
      showGrid: false,
    };
  }

  /**
   * Create position size distribution chart
   */
  createPositionSizeChart(sizes: number[], labels: string[]): ChartConfig {
    return {
      title: "Position Size Distribution",
      type: "bar",
      xAxis: { label: "Size Range", type: "category" },
      yAxis: { label: "Frequency" },
      datasets: [
        {
          label: "Positions",
          data: sizes,
          color: this.colorPalette[2],
          type: "bar",
        },
      ],
      showLegend: false,
      showGrid: true,
    };
  }

  /**
   * Create candlestick chart config
   */
  createCandlestickChart(data: CandleData[], symbol: string): ChartConfig {
    return {
      title: `${symbol} Price Chart`,
      type: "candlestick",
      xAxis: { label: "Date", type: "time" },
      yAxis: { label: "Price ($)" },
      datasets: [
        {
          label: symbol,
          data: data.map((d) => ({
            timestamp: d.timestamp,
            value: d.close,
          })),
          color: this.colorPalette[0],
          type: "line",
        },
      ],
      showLegend: false,
      showGrid: true,
    };
  }

  /**
   * Create real-time price chart
   */
  createRealtimePriceChart(symbol: string, data: TimeSeriesData[]): ChartConfig {
    return {
      title: `${symbol} - Real-time Price`,
      type: "line",
      xAxis: { label: "Time", type: "time" },
      yAxis: { label: "Price ($)" },
      datasets: [
        {
          label: "Price",
          data,
          color: this.colorPalette[0],
          type: "line",
          fill: false,
        },
      ],
      showLegend: false,
      showGrid: true,
      height: 300,
    };
  }

  /**
   * Create metrics gauge chart
   */
  createGaugeChart(title: string, value: number, min: number, max: number, unit = "%"): ChartConfig {
    return {
      title,
      type: "line",
      xAxis: { label: "", type: "linear" },
      yAxis: { label: unit, min, max },
      datasets: [
        {
          label: title,
          data: [value],
          color: this.getColorForValue(value, min, max),
          type: "bar",
        },
      ],
      showLegend: false,
      showGrid: false,
      height: 150,
    };
  }

  /**
   * Generate color based on value range
   */
  getColorForValue(value: number, min: number, max: number): string {
    const ratio = (value - min) / (max - min);
    if (ratio < 0.33) return this.colorPalette[1]; // Red
    if (ratio > 0.66) return this.colorPalette[0]; // Green
    return this.colorPalette[3]; // Yellow
  }

  /**
   * Format chart data for export
   */
  formatForExport(config: ChartConfig): Record<string, unknown> {
    return {
      title: config.title,
      type: config.type,
      xAxis: config.xAxis,
      yAxis: config.yAxis,
      series: config.datasets.map((d) => ({
        name: d.label,
        data: d.data,
        color: d.color,
      })),
    };
  }

  /**
   * Create empty chart config
   */
  createEmptyChart(title: string): ChartConfig {
    return {
      title,
      type: "line",
      xAxis: { label: "", type: "time" },
      yAxis: { label: "" },
      datasets: [],
      showLegend: false,
      showGrid: true,
    };
  }
}
