/**
 * Risk Orchestrator
 * Coordinates all risk management modules
 */

import type {
  RiskConfig,
  TradeRequest,
  Portfolio,
  Position,
  SizingResult,
  PortfolioCheckResult,
  CircuitBreakerResult,
  StopLevel,
  RiskCheck,
} from "./types.js";

import { FixedFractionalSizer } from "./sizing/fixed-fractional-sizer.js";
import { SectorExposureLimiter } from "./portfolio/sector-exposure-limiter.js";
import { PortfolioHeatMonitor } from "./portfolio/portfolio-heat-monitor.js";
import { ConcentrationRiskChecker } from "./portfolio/concentration-risk-checker.js";
import { DailyLossLimiter } from "./breakers/daily-loss-limiter.js";
import { ConsecutiveLossHalt } from "./breakers/consecutive-loss-halt.js";
import { DrawdownReducer } from "./breakers/drawdown-reducer.js";
import { VolatilityBreaker } from "./breakers/volatility-breaker.js";
import { TrailingStopEngine } from "./stops/trailing-stop-engine.js";
import { RiskDatabase } from "./database.js";
import { DynamicRiskAdjuster, type RiskAdjustment } from "./dynamic-risk-adjuster.js";

export interface RiskValidationResult {
  approved: boolean;
  reason?: string;
  shares: number;
  stopLevel?: StopLevel;
  reductionFactor?: number;
  riskAdjustment?: RiskAdjustment;
}

export class RiskOrchestrator {
  private config: RiskConfig;
  private database: RiskDatabase | null;

  // Sizing
  private sizer: FixedFractionalSizer;

  // Portfolio Controls
  private sectorLimiter: SectorExposureLimiter;
  private heatMonitor: PortfolioHeatMonitor;
  private concentrationChecker: ConcentrationRiskChecker;

  // Circuit Breakers
  private dailyLossLimiter: DailyLossLimiter;
  private consecutiveLossHalt: ConsecutiveLossHalt;
  private drawdownReducer: DrawdownReducer;
  private volatilityBreaker: VolatilityBreaker;

  // Stop Management
  private trailingStop: TrailingStopEngine;
  private riskAdjuster!: DynamicRiskAdjuster;

  constructor(config: RiskConfig, database?: RiskDatabase) {
    this.config = config;
    this.database = database ?? null;

    // Initialize modules
    this.sizer = new FixedFractionalSizer(config);
    this.sectorLimiter = new SectorExposureLimiter(config);
    this.heatMonitor = new PortfolioHeatMonitor(config);
    this.concentrationChecker = new ConcentrationRiskChecker(config);
    this.dailyLossLimiter = new DailyLossLimiter(config);
    this.consecutiveLossHalt = new ConsecutiveLossHalt(config);
    this.drawdownReducer = new DrawdownReducer(config);
    this.volatilityBreaker = new VolatilityBreaker(config);
    this.trailingStop = new TrailingStopEngine(config);
    this.riskAdjuster = new DynamicRiskAdjuster();
  }

  /**
   * Pre-trade validation: sizing, portfolio checks, circuit breakers
   */
  async validateTrade(request: TradeRequest, portfolio: Portfolio): Promise<RiskValidationResult> {
    // Step 1: Check circuit breakers
    const breakerResult = this.checkCircuitBreakers(portfolio);
    if (breakerResult.halted) {
      await this.logRiskCheck("circuit_breaker", request.symbol, false, { breakerResult });
      return {
        approved: false,
        reason: breakerResult.haltReason,
        shares: 0,
        reductionFactor: breakerResult.reductionFactor,
      };
    }

    // Step 2: Calculate position size
    const sizingResult = this.sizer.calculateSize(request, portfolio);
    if (sizingResult.rejected) {
      await this.logRiskCheck("sizing", request.symbol, false, { sizingResult });
      return {
        approved: false,
        reason: sizingResult.rejectionReason,
        shares: 0,
      };
    }

    // Step 3: Check portfolio limits
    const tempPosition: Position = {
      symbol: request.symbol,
      qty: sizingResult.shares,
      entryPrice: request.entryPrice,
      currentPrice: request.entryPrice,
      entryTime: new Date(),
      unrealizedPnl: 0,
      sector: undefined,
    };

    const portfolioChecks = [
      this.sectorLimiter.check(tempPosition, portfolio),
      this.heatMonitor.check(tempPosition, portfolio),
      this.concentrationChecker.check(tempPosition, portfolio),
    ];

    for (const check of portfolioChecks) {
      if (!check.allowed) {
        await this.logRiskCheck("portfolio", request.symbol, false, { check });
        return {
          approved: false,
          reason: check.reason,
          shares: check.adjustedSize ?? 0,
        };
      }
    }

    // Step 4: Calculate stop level
    const stopLevel = this.trailingStop.calculateStop(tempPosition, request.entryPrice);

    // Log successful validation
    await this.logRiskCheck("sizing", request.symbol, true, {
      sizingResult,
      portfolioChecks,
      stopLevel,
    });

    // NEW: Dynamic risk adjustment from AgentDB
    let riskAdjustment: RiskAdjustment;
    try {
      const baseStopLoss = request.stopLoss ?? stopLevel.stopPrice;
      const baseTakeProfit = request.takeProfit ?? request.entryPrice * 1.04;

      riskAdjustment = await this.riskAdjuster.adjustRisk({
        ...request,
        shares: sizingResult.shares,
        stopLoss: baseStopLoss,
        takeProfit: baseTakeProfit,
      });
    } catch (error) {
      console.error("Dynamic risk adjustment failed:", error);
      // Fallback to neutral adjustment
      riskAdjustment = {
        positionSizeMultiplier: 1.0,
        stopLossMultiplier: 1.0,
        confidence: 0,
        reasoning: "Risk adjustment service unavailable - using defaults",
      };
    }

    if (riskAdjustment.positionSizeMultiplier < 0.1) {
      await this.logRiskCheck("dynamic_risk", request.symbol, false, { riskAdjustment });
      return {
        approved: false,
        reason: `Dynamic risk check failed: ${riskAdjustment.reasoning}`,
        shares: 0,
      };
    }

    // Apply dynamic adjustment to position sizing
    const adjustedShares = Math.floor(sizingResult.shares * riskAdjustment.positionSizeMultiplier);

    if (adjustedShares < 1) {
      return {
        approved: false,
        reason: `Position size too small after risk adjustment (${riskAdjustment.positionSizeMultiplier}x)`,
        shares: 0,
      };
    }

    const adjustedStopPrice = (request.stopLoss ?? stopLevel.stopPrice) * riskAdjustment.stopLossMultiplier;

    console.log(`Risk adjustment: ${riskAdjustment.reasoning}`);
    console.log(
      `Position size: ${sizingResult.shares} -> ${adjustedShares} (${riskAdjustment.positionSizeMultiplier}x)`,
    );

    // Update log with adjusted values
    await this.logRiskCheck("sizing", request.symbol, true, {
      sizingResult,
      portfolioChecks,
      stopLevel,
      riskAdjustment,
      adjustedShares,
      adjustedStopPrice,
    });

    return {
      approved: true,
      shares: adjustedShares,
      stopLevel: {
        ...stopLevel,
        stopPrice: adjustedStopPrice,
      },
      reductionFactor: breakerResult.reductionFactor,
      riskAdjustment,
    };
  }

  /**
   * Check all circuit breakers
   */
  private checkCircuitBreakers(portfolio: Portfolio): CircuitBreakerResult {
    const breakers = [this.dailyLossLimiter, this.consecutiveLossHalt, this.drawdownReducer, this.volatilityBreaker];

    for (const breaker of breakers) {
      const result = breaker.check(portfolio);
      if (result.halted) {
        return result;
      }
      if (result.reductionFactor !== undefined && result.reductionFactor < 1) {
        return result;
      }
    }

    return { halted: false };
  }

  /**
   * Post-trade monitoring: trailing stops
   */
  monitorPosition(position: Position, currentPrice: number): StopLevel | null {
    return this.trailingStop.updateStop(position, currentPrice);
  }

  /**
   * Record trade outcome for circuit breakers
   */
  recordTradeOutcome(outcome: "win" | "loss" | "breakeven"): void {
    this.consecutiveLossHalt.recordTrade(outcome);
  }

  /**
   * Log risk check to database
   */
  private async logRiskCheck(
    type: "sizing" | "portfolio" | "circuit_breaker" | "stop" | "dynamic_risk",
    symbol: string | undefined,
    passed: boolean,
    details: Record<string, unknown>,
  ): Promise<void> {
    if (!this.database) return;

    const check: RiskCheck = {
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      symbol,
      passed,
      details,
    };

    await this.database.logRiskCheck(check);
  }

  /**
   * Get current risk status
   */
  getStatus(): { config: RiskConfig; databaseConnected: boolean } {
    return {
      config: this.config,
      databaseConnected: this.database !== null,
    };
  }
}
