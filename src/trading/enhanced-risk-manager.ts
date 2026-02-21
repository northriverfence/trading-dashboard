// src/trading/enhanced-risk-manager.ts

/**
 * Enhanced Risk Manager
 *
 * Provides stricter risk controls for live trading with:
 * - Daily loss limits (circuit breaker)
 * - Maximum position size per symbol
 * - Maximum total exposure (portfolio level)
 * - Order size limits based on average daily volume
 * - Rejection of orders outside market hours (for live)
 * - Additional confirmation for high-risk orders
 * - Real-time risk metrics tracking
 * - Warning emissions when approaching limits
 */

import type { Order, Portfolio, Position } from "./types.js";
import { TradingModeManager, type TradingMode } from "./trading-mode-manager.js";

export type RiskLimitType =
  | "daily_loss"
  | "position_size"
  | "total_exposure"
  | "adv_check"
  | "market_hours"
  | "high_risk_order"
  | "invalid_order";

export const RiskLimitType = {
  DAILY_LOSS: "daily_loss" as const,
  POSITION_SIZE: "position_size" as const,
  TOTAL_EXPOSURE: "total_exposure" as const,
  ADV_CHECK: "adv_check" as const,
  MARKET_HOURS: "market_hours" as const,
  HIGH_RISK_ORDER: "high_risk_order" as const,
  INVALID_ORDER: "invalid_order" as const,
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskWarning {
  type: RiskLimitType;
  message: string;
  severity: RiskSeverity;
  timestamp: Date;
  details?: Record<string, unknown>;
}

export interface SymbolData {
  symbol: string;
  avgDailyVolume?: number;
  lastPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
}

export interface EnhancedRiskConfig {
  dailyLossLimit: number;
  maxPositionSizePerSymbol: number;
  maxTotalExposure: number;
  maxOrderSizeAsPercentOfADV: number;
  marketHoursOnly: boolean;
  highRiskThreshold: number;
  requireConfirmationForHighRisk: boolean;
  warningThresholdPercent: number;
  liveModeMultipliers: {
    dailyLossLimit: number;
    maxPositionSize: number;
    maxTotalExposure: number;
  };
}

export interface RiskCheckResult {
  orderId: string;
  approved: boolean;
  reason?: string;
  warnings?: RiskWarning[];
  requiresConfirmation?: boolean;
  timestamp: Date;
}

export interface RiskMetrics {
  dailyLossUsed: number;
  dailyLossRemaining: number;
  dailyLossLimit: number;
  totalExposureUsed: number;
  totalExposureLimit: number;
  totalPositions: number;
  uniqueSymbols: number;
}

export interface RejectedOrder {
  orderId: string;
  timestamp: Date;
  reason: string;
  symbol: string;
}

export interface EnhancedRiskManagerEvents {
  riskWarning: RiskWarning;
  orderChecked: RiskCheckResult;
  orderRejected: RiskCheckResult;
}

type EventHandler<T> = (event: T) => void;

// Market hours: 9:30 AM - 4:00 PM EST (14:30 - 21:00 UTC)
const MARKET_OPEN_HOUR_UTC = 14; // 9:30 AM EST = 2:30 PM UTC
const MARKET_OPEN_MINUTE_UTC = 30;
const MARKET_CLOSE_HOUR_UTC = 21; // 4:00 PM EST = 9:00 PM UTC
const MARKET_CLOSE_MINUTE_UTC = 0;

export class EnhancedRiskManager {
  private config: EnhancedRiskConfig;
  private modeManager?: TradingModeManager;
  private warningHistory: RiskWarning[] = [];
  private rejectedOrders: RejectedOrder[] = [];
  private currentMetrics: RiskMetrics;
  private listeners: {
    [K in keyof EnhancedRiskManagerEvents]?: EventHandler<EnhancedRiskManagerEvents[K]>[];
  } = {};

  constructor(config: EnhancedRiskConfig, modeManager?: TradingModeManager) {
    this.config = config;
    this.modeManager = modeManager;
    this.currentMetrics = this.initializeMetrics();
  }

  /**
   * Check an order against all risk limits
   */
  async checkOrder(order: Order, portfolio: Portfolio, symbolData: SymbolData): Promise<RiskCheckResult> {
    const warnings: RiskWarning[] = [];
    const timestamp = new Date();

    // Check basic order validity
    if (order.qty <= 0) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: "Invalid order quantity: must be positive",
        warnings: [
          {
            type: RiskLimitType.INVALID_ORDER,
            message: `Invalid order quantity: ${order.qty}`,
            severity: "critical",
            timestamp: new Date(),
            details: { qty: order.qty },
          },
        ],
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }

    // Get current mode
    const mode = this.modeManager?.getCurrentMode() ?? "paper";

    // Check daily loss limit
    const dailyLossCheck = this.checkDailyLossLimit(portfolio, mode);
    if (!dailyLossCheck.passed) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: dailyLossCheck.reason,
        warnings,
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }
    if (dailyLossCheck.warning) {
      warnings.push(dailyLossCheck.warning);
    }

    // Check position size limit
    const positionSizeCheck = this.checkPositionSizeLimit(order, portfolio, mode);
    if (!positionSizeCheck.passed) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: positionSizeCheck.reason,
        warnings,
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }
    if (positionSizeCheck.warning) {
      warnings.push(positionSizeCheck.warning);
    }

    // Check total exposure limit
    const exposureCheck = this.checkTotalExposureLimit(order, portfolio, symbolData, mode);
    if (!exposureCheck.passed) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: exposureCheck.reason,
        warnings,
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }
    if (exposureCheck.warning) {
      warnings.push(exposureCheck.warning);
    }

    // Check ADV limit
    const advCheck = this.checkADVLimit(order, symbolData);
    if (!advCheck.passed) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: advCheck.reason,
        warnings,
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }
    if (advCheck.warning) {
      warnings.push(advCheck.warning);
    }

    // Check market hours (for live mode)
    const marketHoursCheck = this.checkMarketHours(mode);
    if (!marketHoursCheck.passed) {
      const result: RiskCheckResult = {
        orderId: order.id,
        approved: false,
        reason: marketHoursCheck.reason,
        warnings,
        timestamp,
      };
      this.recordRejectedOrder(order, result.reason);
      this.emit("orderRejected", result);
      return result;
    }

    // Check high-risk orders requiring confirmation
    const highRiskCheck = this.checkHighRiskOrder(order, symbolData);
    const requiresConfirmation = highRiskCheck.requiresConfirmation;
    if (highRiskCheck.warning) {
      warnings.push(highRiskCheck.warning);
      // Store in history
      this.warningHistory.push(highRiskCheck.warning);
    }

    // Update risk metrics
    this.updateRiskMetrics(portfolio);

    const result: RiskCheckResult = {
      orderId: order.id,
      approved: true,
      reason: requiresConfirmation ? "high risk order requires confirmation" : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      requiresConfirmation,
      timestamp,
    };

    this.emit("orderChecked", result);
    return result;
  }

  /**
   * Get current risk metrics
   */
  getRiskMetrics(): RiskMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get warning history
   */
  getWarningHistory(): RiskWarning[] {
    return [...this.warningHistory];
  }

  /**
   * Get rejected orders
   */
  getRejectedOrders(): RejectedOrder[] {
    return [...this.rejectedOrders];
  }

  /**
   * Get current effective limits based on mode
   */
  getCurrentLimits(): {
    dailyLossLimit: number;
    maxPositionSizePerSymbol: number;
    maxTotalExposure: number;
  } {
    const mode = this.modeManager?.getCurrentMode() ?? "paper";
    return this.getEffectiveLimits(mode);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<EnhancedRiskConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Clear warning history
   */
  clearWarningHistory(): void {
    this.warningHistory = [];
  }

  /**
   * Clear rejected orders
   */
  clearRejectedOrders(): void {
    this.rejectedOrders = [];
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.currentMetrics = this.initializeMetrics();
    this.clearWarningHistory();
    this.clearRejectedOrders();
  }

  /**
   * Register an event listener
   */
  on<K extends keyof EnhancedRiskManagerEvents>(event: K, handler: EventHandler<EnhancedRiskManagerEvents[K]>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  /**
   * Remove an event listener
   */
  removeListener<K extends keyof EnhancedRiskManagerEvents>(
    event: K,
    handler: EventHandler<EnhancedRiskManagerEvents[K]>,
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter((h) => h !== handler) as EventHandler<EnhancedRiskManagerEvents[K]>[];
    }
  }

  // Private helper methods

  private initializeMetrics(): RiskMetrics {
    return {
      dailyLossUsed: 0,
      dailyLossRemaining: this.config.dailyLossLimit,
      dailyLossLimit: this.config.dailyLossLimit,
      totalExposureUsed: 0,
      totalExposureLimit: this.config.maxTotalExposure,
      totalPositions: 0,
      uniqueSymbols: 0,
    };
  }

  private getEffectiveLimits(mode: TradingMode): {
    dailyLossLimit: number;
    maxPositionSizePerSymbol: number;
    maxTotalExposure: number;
  } {
    if (mode === "live") {
      return {
        dailyLossLimit: this.config.dailyLossLimit * this.config.liveModeMultipliers.dailyLossLimit,
        maxPositionSizePerSymbol:
          this.config.maxPositionSizePerSymbol * this.config.liveModeMultipliers.maxPositionSize,
        maxTotalExposure: this.config.maxTotalExposure * this.config.liveModeMultipliers.maxTotalExposure,
      };
    }
    return {
      dailyLossLimit: this.config.dailyLossLimit,
      maxPositionSizePerSymbol: this.config.maxPositionSizePerSymbol,
      maxTotalExposure: this.config.maxTotalExposure,
    };
  }

  private checkDailyLossLimit(
    portfolio: Portfolio,
    mode: TradingMode,
  ): { passed: boolean; reason?: string; warning?: RiskWarning } {
    const limits = this.getEffectiveLimits(mode);
    const dailyLoss = Math.abs(Math.min(0, portfolio.dailyPnl));

    if (dailyLoss >= limits.dailyLossLimit) {
      return {
        passed: false,
        reason: `daily loss limit reached: $${dailyLoss.toFixed(2)} >= $${limits.dailyLossLimit.toFixed(2)}`,
      };
    }

    // Warn at threshold
    if (dailyLoss >= limits.dailyLossLimit * this.config.warningThresholdPercent) {
      const percentUsed = (dailyLoss / limits.dailyLossLimit) * 100;
      const warning: RiskWarning = {
        type: RiskLimitType.DAILY_LOSS,
        message: `Daily loss at ${percentUsed.toFixed(0)}% of limit: $${dailyLoss.toFixed(2)} / $${limits.dailyLossLimit.toFixed(2)}`,
        severity: "high",
        timestamp: new Date(),
        details: { dailyLoss, limit: limits.dailyLossLimit, percentUsed },
      };
      this.emit("riskWarning", warning);
      return { passed: true, warning };
    }

    return { passed: true };
  }

  private checkPositionSizeLimit(
    order: Order,
    portfolio: Portfolio,
    mode: TradingMode,
  ): { passed: boolean; reason?: string; warning?: RiskWarning } {
    const limits = this.getEffectiveLimits(mode);

    // Get existing position for this symbol
    const existingPosition = portfolio.positions.find((p) => p.symbol === order.symbol);
    const existingQty = existingPosition?.qty ?? 0;

    // For sell orders, we're reducing position, so only check if it's a buy
    if (order.side === "sell") {
      return { passed: true };
    }

    const newTotalQty = existingQty + order.qty;

    if (newTotalQty > limits.maxPositionSizePerSymbol) {
      return {
        passed: false,
        reason: `position size limit exceeded for ${order.symbol}: ${newTotalQty} > ${limits.maxPositionSizePerSymbol}`,
      };
    }

    // Warn at threshold
    if (newTotalQty >= limits.maxPositionSizePerSymbol * this.config.warningThresholdPercent) {
      const percentUsed = (newTotalQty / limits.maxPositionSizePerSymbol) * 100;
      const warning: RiskWarning = {
        type: RiskLimitType.POSITION_SIZE,
        message: `Position size at ${percentUsed.toFixed(0)}% of limit for ${order.symbol}: ${newTotalQty} / ${limits.maxPositionSizePerSymbol}`,
        severity: "medium",
        timestamp: new Date(),
        details: {
          symbol: order.symbol,
          existingQty,
          orderQty: order.qty,
          newTotalQty,
          limit: limits.maxPositionSizePerSymbol,
        },
      };
      this.emit("riskWarning", warning);
      return { passed: true, warning };
    }

    return { passed: true };
  }

  private checkTotalExposureLimit(
    order: Order,
    portfolio: Portfolio,
    symbolData: SymbolData,
    mode: TradingMode,
  ): { passed: boolean; reason?: string; warning?: RiskWarning } {
    const limits = this.getEffectiveLimits(mode);

    // Calculate current exposure
    const currentExposure = portfolio.positions.reduce((sum, pos) => sum + pos.currentPrice * pos.qty, 0);

    // Calculate order value
    const orderPrice =
      order.type === "limit" && order.limitPrice
        ? order.limitPrice
        : order.type === "stop" && order.stopPrice
          ? order.stopPrice
          : symbolData.lastPrice;

    const orderValue = orderPrice * order.qty;
    const newTotalExposure = currentExposure + orderValue;

    if (newTotalExposure > limits.maxTotalExposure) {
      return {
        passed: false,
        reason: `total exposure limit exceeded: $${newTotalExposure.toFixed(2)} > $${limits.maxTotalExposure.toFixed(2)}`,
      };
    }

    // Warn at threshold
    if (newTotalExposure >= limits.maxTotalExposure * this.config.warningThresholdPercent) {
      const percentUsed = (newTotalExposure / limits.maxTotalExposure) * 100;
      const warning: RiskWarning = {
        type: RiskLimitType.TOTAL_EXPOSURE,
        message: `Total exposure at ${percentUsed.toFixed(0)}% of limit: $${newTotalExposure.toFixed(2)} / $${limits.maxTotalExposure.toFixed(2)}`,
        severity: "medium",
        timestamp: new Date(),
        details: {
          currentExposure,
          orderValue,
          newTotalExposure,
          limit: limits.maxTotalExposure,
        },
      };
      this.emit("riskWarning", warning);
      return { passed: true, warning };
    }

    return { passed: true };
  }

  private checkADVLimit(
    order: Order,
    symbolData: SymbolData,
  ): { passed: boolean; reason?: string; warning?: RiskWarning } {
    if (!symbolData.avgDailyVolume) {
      // Missing ADV data - allow but warn
      const warning: RiskWarning = {
        type: RiskLimitType.ADV_CHECK,
        message: `Missing ADV data for ${order.symbol}, cannot verify order size`,
        severity: "low",
        timestamp: new Date(),
        details: { symbol: order.symbol, orderQty: order.qty },
      };
      this.emit("riskWarning", warning);
      return { passed: true, warning };
    }

    const orderPercentOfADV = order.qty / symbolData.avgDailyVolume;

    if (orderPercentOfADV > this.config.maxOrderSizeAsPercentOfADV) {
      return {
        passed: false,
        reason: `order size exceeds ADV limit: ${(orderPercentOfADV * 100).toFixed(2)}% > ${(this.config.maxOrderSizeAsPercentOfADV * 100).toFixed(2)}%`,
      };
    }

    return { passed: true };
  }

  private checkMarketHours(mode: TradingMode): { passed: boolean; reason?: string } {
    // Market hours check only applies to live mode
    if (mode !== "live" || !this.config.marketHoursOnly) {
      return { passed: true };
    }

    const now = new Date();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    const totalMinutes = hours * 60 + minutes;

    const marketOpenMinutes = MARKET_OPEN_HOUR_UTC * 60 + MARKET_OPEN_MINUTE_UTC;
    const marketCloseMinutes = MARKET_CLOSE_HOUR_UTC * 60 + MARKET_CLOSE_MINUTE_UTC;

    if (totalMinutes < marketOpenMinutes || totalMinutes >= marketCloseMinutes) {
      return {
        passed: false,
        reason: `Order rejected: Outside market hours (9:30 AM - 4:00 PM EST)`,
      };
    }

    return { passed: true };
  }

  private checkHighRiskOrder(
    order: Order,
    symbolData: SymbolData,
  ): { requiresConfirmation: boolean; warning?: RiskWarning } {
    if (!this.config.requireConfirmationForHighRisk) {
      return { requiresConfirmation: false };
    }

    const orderPrice =
      order.type === "limit" && order.limitPrice
        ? order.limitPrice
        : order.type === "stop" && order.stopPrice
          ? order.stopPrice
          : symbolData.lastPrice;

    const orderValue = orderPrice * order.qty;

    if (orderValue >= this.config.highRiskThreshold) {
      const warning: RiskWarning = {
        type: RiskLimitType.HIGH_RISK_ORDER,
        message: `High risk order: $${orderValue.toFixed(2)} >= $${this.config.highRiskThreshold.toFixed(2)} threshold`,
        severity: "medium",
        timestamp: new Date(),
        details: {
          orderValue,
          threshold: this.config.highRiskThreshold,
          symbol: order.symbol,
        },
      };
      this.emit("riskWarning", warning);
      return { requiresConfirmation: true, warning };
    }

    return { requiresConfirmation: false };
  }

  private updateRiskMetrics(portfolio: Portfolio): void {
    const dailyLoss = Math.abs(Math.min(0, portfolio.dailyPnl));
    const currentExposure = portfolio.positions.reduce((sum, pos) => sum + pos.currentPrice * pos.qty, 0);

    this.currentMetrics = {
      dailyLossUsed: dailyLoss,
      dailyLossRemaining: this.config.dailyLossLimit - dailyLoss,
      dailyLossLimit: this.config.dailyLossLimit,
      totalExposureUsed: currentExposure,
      totalExposureLimit: this.config.maxTotalExposure,
      totalPositions: portfolio.positions.length,
      uniqueSymbols: new Set(portfolio.positions.map((p) => p.symbol)).size,
    };
  }

  private recordRejectedOrder(order: Order, reason: string): void {
    this.rejectedOrders.push({
      orderId: order.id,
      timestamp: new Date(),
      reason,
      symbol: order.symbol,
    });
  }

  private emit<K extends keyof EnhancedRiskManagerEvents>(event: K, data: EnhancedRiskManagerEvents[K]): void {
    // Store risk warnings in history
    if (event === "riskWarning" && this.isRiskWarning(data)) {
      this.warningHistory.push(data);
    }

    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private isRiskWarning(data: unknown): data is RiskWarning {
    return (
      typeof data === "object" &&
      data !== null &&
      "type" in data &&
      "message" in data &&
      "severity" in data &&
      "timestamp" in data
    );
  }
}

export default EnhancedRiskManager;
