/**
 * Reporting Module
 * Exports reporting and event logging utilities
 */

export { ReportGenerator, defaultReportConfig } from "./report-generator.js";
export type { ReportConfig } from "./report-generator.js";

export {
  EventLogger,
  eventLogger,
} from "./event-logger.js";
export type {
  EventLevel,
  EventCategory,
  EventEntry,
  SignalDecision,
  RiskManagementAction,
  MarketStateSnapshot,
} from "./event-logger.js";
