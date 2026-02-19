/**
 * Risk Management Module
 * Comprehensive risk management for trading strategies
 */

// Types
export type {
  Position,
  Portfolio,
  TradeRequest,
  SizingResult,
  PortfolioCheckResult,
  CircuitBreakerResult,
  StopLevel,
  RiskCheck,
  RiskConfig,
} from "./types.js";

// Orchestrator
export { RiskOrchestrator, type RiskValidationResult } from "./orchestrator.js";

// Sizing
export { FixedFractionalSizer } from "./sizing/fixed-fractional-sizer.js";
export { KellyCriterionSizer } from "./sizing/kelly-criterion-sizer.js";
export { VolatilityAdjustedSizer } from "./sizing/volatility-adjusted-sizer.js";
export { ATRSizer } from "./sizing/atr-sizer.js";
export { BaseSizer } from "./sizing/base-sizer.js";

// Portfolio Analysis
export { SectorExposureLimiter } from "./portfolio/sector-exposure-limiter.js";
export { PortfolioHeatMonitor } from "./portfolio/portfolio-heat-monitor.js";
export { ConcentrationRiskChecker } from "./portfolio/concentration-risk-checker.js";
export { CorrelationAnalyzer } from "./portfolio/correlation-analyzer.js";
export { BaseAnalyzer } from "./portfolio/base-analyzer.js";

// Circuit Breakers
export { DailyLossLimiter } from "./breakers/daily-loss-limiter.js";
export { ConsecutiveLossHalt } from "./breakers/consecutive-loss-halt.js";
export { DrawdownReducer } from "./breakers/drawdown-reducer.js";
export { VolatilityBreaker } from "./breakers/volatility-breaker.js";
export { BaseBreaker } from "./breakers/base-breaker.js";

// Stop Management
export { TrailingStopEngine } from "./stops/trailing-stop-engine.js";
export { VolatilityBasedStop } from "./stops/volatility-based-stop.js";
export { ATRStop } from "./stops/atr-stop.js";
export { TimeBasedExit } from "./stops/time-based-exit.js";
export { BaseStop } from "./stops/base-stop.js";

// Database
export { RiskDatabase } from "./database.js";

// Config
export { defaultRiskConfig, validateRiskConfig } from "./config.js";
