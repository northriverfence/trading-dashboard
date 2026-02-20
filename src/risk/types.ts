/**
 * Risk Management Types
 * Core interfaces for the Risk Management Layer
 */

export interface Position {
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  entryTime: Date;
  sector?: string;
  unrealizedPnl: number;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  totalValue: number;
  dailyPnl: number;
  totalPnl: number;
}

export interface TradeRequest {
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
  strategy: string;
}

export interface SizingResult {
  shares: number;
  positionValue: number;
  riskAmount: number;
  riskPercent: number;
  rejected: boolean;
  rejectionReason?: string;
}

export interface PortfolioCheckResult {
  allowed: boolean;
  reason?: string;
  adjustedSize?: number;
  riskContribution: number;
}

export interface CircuitBreakerResult {
  halted: boolean;
  haltReason?: string;
  resumeTime?: Date;
  cooldownMinutes?: number;
  reductionFactor?: number;
}

export interface StopLevel {
  stopPrice: number;
  stopType: "fixed" | "trailing" | "atr" | "volatility" | "time";
  activationPrice?: number;
  expiresAt?: Date;
}

export interface RiskCheck {
  id: string;
  timestamp: Date;
  type: "sizing" | "portfolio" | "circuit_breaker" | "stop" | "dynamic_risk";
  symbol?: string;
  passed: boolean;
  details: Record<string, unknown>;
}

export interface RiskConfig {
  sizingType: "fixed_fractional" | "kelly" | "volatility_adjusted" | "atr";
  maxPositionPct: number;
  kellyFraction: number;
  riskPerTrade: number;
  maxSectorExposure: number;
  maxPortfolioHeat: number;
  maxCorrelation: number;
  dailyLossLimit: number;
  consecutiveLosses: number;
  drawdownThresholds: number[];
  volatilityThreshold: number;
  stopType: "trailing" | "atr" | "volatility" | "time";
  atrMultiplier: number;
  trailingActivation: number;
  timeLimit: number;
}
