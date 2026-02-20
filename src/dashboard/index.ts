/**
 * Dashboard Module
 * Real-time trading dashboard with WebSocket support
 */

export { DashboardServer } from "./dashboard-server.js";
export { MetricsAPI } from "./metrics-api.js";
export { WebSocketFeeds } from "./websocket-feeds.js";
export { ChartComponents } from "./chart-components.js";
export { PanelManager } from "./panel-manager.js";
export { EventAggregator } from "./event-aggregator.js";

export type { DashboardConfig, DashboardData, PositionUpdate, EquityUpdate, TradeUpdate } from "./dashboard-server.js";

export type { MetricValue, MetricQuery, MetricResponse } from "./metrics-api.js";

export type { WebSocketMessage, FeedSubscriber, FeedStats } from "./websocket-feeds.js";

export type { ChartConfig, ChartDataset, TimeSeriesData, CandleData } from "./chart-components.js";

export type { Panel, Layout, PanelUpdate } from "./panel-manager.js";

export type { DashboardEvent, EventFilter, EventStats } from "./event-aggregator.js";
