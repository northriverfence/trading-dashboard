/**
 * Dashboard Module
 * Real-time trading dashboard with WebSocket support
 */

export { DashboardServer } from "./dashboard-server.js";

export type {
  DashboardConfig,
  DashboardData,
  PositionUpdate,
  EquityUpdate,
  TradeUpdate,
} from "./dashboard-server.js";
