/**
 * MetricsAPI
 * REST API endpoints for dashboard metrics
 */

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricQuery {
  name?: string;
  from?: Date;
  to?: Date;
  labels?: Record<string, string>;
  aggregation?: "avg" | "sum" | "min" | "max" | "count";
  timeBucket?: string; // e.g., "1m", "5m", "1h"
}

export interface MetricResponse {
  metric: string;
  values: { timestamp: Date; value: number }[];
  aggregation?: { value: number; type: string };
}

export class MetricsAPI {
  private metrics: Map<string, MetricValue[]> = new Map();
  private maxHistory = 10000;

  /**
   * Record a metric value
   */
  recordMetric(metric: MetricValue): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const history = this.metrics.get(metric.name)!;
    history.push(metric);

    // Trim history
    if (history.length > this.maxHistory) {
      history.shift();
    }
  }

  /**
   * Query metrics
   */
  queryMetrics(query: MetricQuery): MetricResponse[] {
    const results: MetricResponse[] = [];

    for (const [name, values] of this.metrics.entries()) {
      if (query.name && !name.includes(query.name)) continue;

      let filtered = values;

      // Time filter
      if (query.from) {
        filtered = filtered.filter((v) => v.timestamp >= query.from!);
      }
      if (query.to) {
        filtered = filtered.filter((v) => v.timestamp <= query.to!);
      }

      // Label filter
      if (query.labels) {
        filtered = filtered.filter((v) => {
          if (!v.labels) return false;
          return Object.entries(query.labels!).every(([key, val]) => v.labels?.[key] === val);
        });
      }

      if (filtered.length === 0) continue;

      // Apply time bucketing if specified
      const timeSeries = query.timeBucket
        ? this.bucketTimeSeries(filtered, query.timeBucket)
        : filtered.map((v) => ({ timestamp: v.timestamp, value: v.value }));

      // Apply aggregation if specified
      let aggregation: { value: number; type: string } | undefined;
      if (query.aggregation) {
        const values_array = filtered.map((v) => v.value);
        aggregation = {
          value: this.calculateAggregation(values_array, query.aggregation),
          type: query.aggregation,
        };
      }

      results.push({
        metric: name,
        values: timeSeries,
        aggregation,
      });
    }

    return results;
  }

  /**
   * Get latest value for metric
   */
  getLatest(name: string): MetricValue | null {
    const history = this.metrics.get(name);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }

  /**
   * Get metric statistics
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    last: number;
  } | null {
    const history = this.metrics.get(name);
    if (!history || history.length === 0) return null;

    const values = history.map((h) => h.value);
    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      last: values[values.length - 1],
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get dashboard summary metrics
   */
  getDashboardSummary(): {
    totalMetrics: number;
    totalDataPoints: number;
    oldestDataPoint: Date | null;
    newestDataPoint: Date | null;
  } {
    let totalDataPoints = 0;
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const values of this.metrics.values()) {
      totalDataPoints += values.length;
      for (const v of values) {
        if (!oldest || v.timestamp < oldest) oldest = v.timestamp;
        if (!newest || v.timestamp > newest) newest = v.timestamp;
      }
    }

    return {
      totalMetrics: this.metrics.size,
      totalDataPoints,
      oldestDataPoint: oldest,
      newestDataPoint: newest,
    };
  }

  /**
   * Clear metrics
   */
  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Export metrics data
   */
  export(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {};
    for (const [name, values] of this.metrics.entries()) {
      result[name] = [...values];
    }
    return result;
  }

  /**
   * Import metrics data
   */
  import(data: Record<string, MetricValue[]>): void {
    for (const [name, values] of Object.entries(data)) {
      this.metrics.set(name, values);
    }
  }

  private bucketTimeSeries(values: MetricValue[], bucket: string): { timestamp: Date; value: number }[] {
    // Parse bucket (e.g., "5m", "1h")
    const match = bucket.match(/(\d+)([mhd])/);
    if (!match) return values.map((v) => ({ timestamp: v.timestamp, value: v.value }));

    const [, num, unit] = match;
    let ms = parseInt(num) * 60 * 1000; // minutes
    if (unit === "h") ms *= 60;
    if (unit === "d") ms *= 24 * 60;

    const buckets = new Map<number, number[]>();

    for (const v of values) {
      const bucketTime = Math.floor(v.timestamp.getTime() / ms) * ms;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(v.value);
    }

    return Array.from(buckets.entries())
      .map(([time, vals]) => ({
        timestamp: new Date(time),
        value: vals.reduce((a, b) => a + b, 0) / vals.length,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateAggregation(values: number[], type: string): number {
    switch (type) {
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "count":
        return values.length;
      default:
        return 0;
    }
  }
}
