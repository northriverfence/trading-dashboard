/**
 * MetricsAPI Tests
 */

import { test, expect } from "bun:test";
import { MetricsAPI, MetricValue } from "./metrics-api.js";

test("MetricsAPI records and retrieves metrics", () => {
  const api = new MetricsAPI();

  const metric: MetricValue = {
    name: "cpu_usage",
    value: 45.5,
    timestamp: new Date(),
  };

  api.recordMetric(metric);

  const latest = api.getLatest("cpu_usage");
  expect(latest?.value).toBe(45.5);
});

test("MetricsAPI queries metrics by name", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "memory", value: 1024, timestamp: new Date() });
  api.recordMetric({ name: "memory", value: 2048, timestamp: new Date() });
  api.recordMetric({ name: "cpu", value: 50, timestamp: new Date() });

  const results = api.queryMetrics({ name: "memory" });
  expect(results.length).toBe(1);
  expect(results[0].values.length).toBe(2);
});

test("MetricsAPI filters by time range", () => {
  const api = new MetricsAPI();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);

  api.recordMetric({ name: "test", value: 1, timestamp: yesterday });
  api.recordMetric({ name: "test", value: 2, timestamp: now });

  const results = api.queryMetrics({
    name: "test",
    from: new Date(now.getTime() - 3600000),
  });

  expect(results[0].values.length).toBe(1);
  expect(results[0].values[0].value).toBe(2);
});

test("MetricsAPI calculates aggregations", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "values", value: 10, timestamp: new Date() });
  api.recordMetric({ name: "values", value: 20, timestamp: new Date() });
  api.recordMetric({ name: "values", value: 30, timestamp: new Date() });

  const results = api.queryMetrics({ name: "values", aggregation: "avg" });
  expect(results[0].aggregation?.value).toBe(20);
  expect(results[0].aggregation?.type).toBe("avg");
});

test("MetricsAPI gets statistics", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "metric1", value: 100, timestamp: new Date() });
  api.recordMetric({ name: "metric1", value: 200, timestamp: new Date() });

  const stats = api.getStats("metric1");
  expect(stats?.count).toBe(2);
  expect(stats?.avg).toBe(150);
  expect(stats?.min).toBe(100);
  expect(stats?.max).toBe(200);
});

test("MetricsAPI gets all metric names", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "metric_a", value: 1, timestamp: new Date() });
  api.recordMetric({ name: "metric_b", value: 2, timestamp: new Date() });

  const names = api.getMetricNames();
  expect(names).toContain("metric_a");
  expect(names).toContain("metric_b");
});

test("MetricsAPI gets dashboard summary", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "m1", value: 1, timestamp: new Date() });
  api.recordMetric({ name: "m2", value: 2, timestamp: new Date() });

  const summary = api.getDashboardSummary();
  expect(summary.totalMetrics).toBe(2);
  expect(summary.totalDataPoints).toBe(2);
});

test("MetricsAPI clears data", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "test", value: 1, timestamp: new Date() });
  api.clear("test");

  expect(api.getLatest("test")).toBeNull();
});

test("MetricsAPI exports and imports data", () => {
  const api = new MetricsAPI();

  api.recordMetric({ name: "export_test", value: 42, timestamp: new Date() });

  const exported = api.export();
  expect(exported.export_test).toBeDefined();

  const newApi = new MetricsAPI();
  newApi.import(exported);

  expect(newApi.getLatest("export_test")?.value).toBe(42);
});
