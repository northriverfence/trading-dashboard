/**
 * ChartComponents Tests
 */

import { test, expect } from "bun:test";
import { ChartComponents, CandleData, PerformanceChartData } from "./chart-components.js";

test("ChartComponents creates equity curve chart", () => {
  const charts = new ChartComponents();

  const data: PerformanceChartData = {
    dates: [new Date("2024-01-01"), new Date("2024-01-02"), new Date("2024-01-03")],
    equity: [10000, 10200, 10100],
    benchmark: [10000, 10100, 10150],
    drawdowns: [0, 0, -0.01],
    returns: [0, 0.02, -0.01],
  };

  const chart = charts.createEquityCurveChart(data, true);
  expect(chart.title).toBe("Equity Curve");
  expect(chart.type).toBe("line");
  expect(chart.datasets.length).toBe(2); // Portfolio + Benchmark
});

test("ChartComponents creates drawdown chart", () => {
  const charts = new ChartComponents();

  const data: PerformanceChartData = {
    dates: [new Date("2024-01-01"), new Date("2024-01-02")],
    equity: [10000, 9000],
    drawdowns: [0, -0.1],
    returns: [0, -0.1],
  };

  const chart = charts.createDrawdownChart(data);
  expect(chart.title).toBe("Drawdown Analysis");
  expect(chart.type).toBe("area");
});

test("ChartComponents creates monthly returns chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createMonthlyReturnsChart(["Jan", "Feb", "Mar"], [0.05, -0.02, 0.03]);

  expect(chart.title).toBe("Monthly Returns");
  expect(chart.type).toBe("bar");
});

test("ChartComponents creates trade distribution chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createTradeDistributionChart({
    labels: ["Tech", "Finance", "Health"],
    winning: [10, 5, 8],
    losing: [3, 4, 2],
  });

  expect(chart.title).toBe("Trade Distribution");
  expect(chart.datasets.length).toBe(2);
});

test("ChartComponents creates win rate pie chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createWinRateChart(15, 5, 2);
  expect(chart.title).toBe("Win Rate");
  expect(chart.type).toBe("pie");
});

test("ChartComponents creates position size chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createPositionSizeChart([5, 10, 15, 8, 12], ["XS", "S", "M", "L", "XL"]);
  expect(chart.title).toBe("Position Size Distribution");
});

test("ChartComponents creates candlestick chart", () => {
  const charts = new ChartComponents();

  const data: CandleData[] = [
    { timestamp: new Date(), open: 100, high: 105, low: 98, close: 102, volume: 10000 },
    { timestamp: new Date(), open: 102, high: 108, low: 101, close: 107, volume: 15000 },
  ];

  const chart = charts.createCandlestickChart(data, "AAPL");
  expect(chart.title).toContain("AAPL");
  expect(chart.type).toBe("candlestick");
});

test("ChartComponents creates real-time price chart", () => {
  const charts = new ChartComponents();

  const data = [
    { timestamp: new Date(), value: 150 },
    { timestamp: new Date(), value: 151 },
    { timestamp: new Date(), value: 150.5 },
  ];

  const chart = charts.createRealtimePriceChart("TSLA", data);
  expect(chart.title).toContain("TSLA");
  expect(chart.datasets[0].data.length).toBe(3);
});

test("ChartComponents creates gauge chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createGaugeChart("Win Rate", 65, 0, 100, "%");
  expect(chart.title).toBe("Win Rate");
  expect(chart.yAxis.min).toBe(0);
  expect(chart.yAxis.max).toBe(100);
});

test("ChartComponents gets color for value", () => {
  const charts = new ChartComponents();

  const lowColor = charts.getColorForValue(10, 0, 100);
  const midColor = charts.getColorForValue(50, 0, 100);
  const highColor = charts.getColorForValue(90, 0, 100);

  expect(typeof lowColor).toBe("string");
  expect(typeof midColor).toBe("string");
  expect(typeof highColor).toBe("string");
});

test("ChartComponents formats for export", () => {
  const charts = new ChartComponents();

  const chart = charts.createWinRateChart(10, 5, 0);
  const exported = charts.formatForExport(chart);

  expect(exported.title).toBe("Win Rate");
  expect(exported.type).toBe("pie");
  expect(exported.series).toBeDefined();
});

test("ChartComponents creates empty chart", () => {
  const charts = new ChartComponents();

  const chart = charts.createEmptyChart("No Data");
  expect(chart.title).toBe("No Data");
  expect(chart.datasets.length).toBe(0);
});
