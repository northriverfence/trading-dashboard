/**
 * ML Strategy Base Class
 * Base class for machine learning-powered trading strategies
 */

import type { Strategy, StrategyContext, Signal, Bar } from "../backtesting/types.js";
import type { ExchangeAdapter } from "../adapters/types.js";
import { FeatureEngineer, type FeatureSet } from "./feature-engineer.js";
import { ModelManager, type PredictionResult, type ModelConfig } from "./model-manager.js";
import { eventLogger } from "../reporting/event-logger.js";

export interface MLStrategyConfig {
  /** Symbol to trade */
  symbol: string;
  /** Feature configuration */
  featureConfig: {
    lookbackWindow: number;
    featureGroups: ("price" | "volume" | "volatility" | "momentum" | "trend")[];
  };
  /** Model configuration */
  modelConfig: ModelConfig;
  /** Prediction threshold for signals */
  signalThreshold: number;
  /** Position sizing */
  positionSize: number;
  /** Minimum confidence to trade */
  minConfidence: number;
  /** Stop loss percentage */
  stopLossPercent: number;
  /** Take profit percentage */
  takeProfitPercent: number;
}

export interface MLStrategyState {
  isTrained: boolean;
  lastPrediction: PredictionResult | null;
  lastFeatureSet: FeatureSet | null;
  barHistory: Bar[];
  position: {
    side: "long" | "short" | null;
    entryPrice: number;
    qty: number;
  } | null;
}

export abstract class MLStrategy implements Strategy {
  protected config: MLStrategyConfig;
  protected featureEngineer: FeatureEngineer;
  protected modelManager: ModelManager;
  protected adapter: ExchangeAdapter;
  protected state: MLStrategyState;
  protected sessionId: string;

  constructor(adapter: ExchangeAdapter, config: MLStrategyConfig) {
    this.adapter = adapter;
    this.config = config;

    this.featureEngineer = new FeatureEngineer({
      lookbackWindow: config.featureConfig.lookbackWindow,
      featureGroups: config.featureConfig.featureGroups,
    });

    this.modelManager = new ModelManager(config.modelConfig);

    this.state = {
      isTrained: false,
      lastPrediction: null,
      lastFeatureSet: null,
      barHistory: [],
      position: null,
    };

    this.sessionId = crypto.randomUUID();
  }

  /**
   * Initialize the strategy and load the model
   */
  async initialize(): Promise<void> {
    await this.modelManager.load();
    this.state.isTrained = true;

    eventLogger.log("info", "strategy", `ML Strategy initialized for ${this.config.symbol}`, {
      sessionId: this.sessionId,
      strategyName: this.constructor.name,
      symbol: this.config.symbol,
      details: {
        featureGroups: this.config.featureConfig.featureGroups,
        signalThreshold: this.config.signalThreshold,
      },
    });
  }

  /**
   * Process a price update and generate signals
   */
  async onPriceUpdate(price: number, context: StrategyContext): Promise<void> {
    // Update bar history
    this.state.barHistory.push({
      timestamp: new Date(),
      symbol: this.config.symbol,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: context.volume ?? 0,
    });

    // Keep only necessary history
    if (this.state.barHistory.length > this.config.featureConfig.lookbackWindow * 2) {
      this.state.barHistory = this.state.barHistory.slice(-this.config.featureConfig.lookbackWindow * 2);
    }

    // Generate signal if we have enough data
    if (this.state.barHistory.length >= this.config.featureConfig.lookbackWindow) {
      const signal = await this.generateSignal(price, context);
      if (signal) {
        await this.executeSignal(signal, price, context);
      }
    }
  }

  /**
   * Generate trading signal based on ML prediction
   */
  protected async generateSignal(price: number, context: StrategyContext): Promise<Signal | null> {
    try {
      // Extract features
      const featureSet = this.featureEngineer.extractFeatures(this.state.barHistory);
      this.state.lastFeatureSet = featureSet;

      // Get prediction
      const prediction = this.modelManager.predict(featureSet);
      this.state.lastPrediction = prediction;

      // Check confidence threshold
      if (prediction.confidence < this.config.minConfidence) {
        return null;
      }

      // Generate signal based on prediction
      const signal = this.interpretPrediction(prediction, price, context);

      if (signal) {
        eventLogger.log("info", "signal", `ML Signal generated: ${signal.action}`, {
          sessionId: this.sessionId,
          strategyName: this.constructor.name,
          symbol: this.config.symbol,
          details: {
            prediction: prediction.prediction,
            confidence: prediction.confidence,
            signal: signal.action,
            qty: signal.qty,
          },
        });
      }

      return signal;
    } catch (error) {
      eventLogger.log("error", "strategy", `Error generating signal: ${(error as Error).message}`, {
        sessionId: this.sessionId,
        strategyName: this.constructor.name,
        symbol: this.config.symbol,
      });
      return null;
    }
  }

  /**
   * Interpret model prediction and convert to trading signal
   * Override this method for custom interpretation logic
   */
  protected abstract interpretPrediction(
    prediction: PredictionResult,
    price: number,
    context: StrategyContext
  ): Signal | null;

  /**
   * Execute a trading signal
   */
  protected async executeSignal(signal: Signal, price: number, _context: StrategyContext): Promise<void> {
    if (signal.action === "buy") {
      // Close short position if exists
      if (this.state.position?.side === "short") {
        await this.closePosition(price, "signal_reverse");
      }

      // Open long position if not already in one
      if (!this.state.position) {
        await this.openPosition("long", signal.qty, price);
      }
    } else if (signal.action === "sell") {
      // Close long position if exists
      if (this.state.position?.side === "long") {
        await this.closePosition(price, "signal_reverse");
      }

      // Open short position if not already in one and shorting is allowed
      if (!this.state.position) {
        await this.openPosition("short", signal.qty, price);
      }
    } else if (signal.action === "exit") {
      // Close any open position
      if (this.state.position) {
        await this.closePosition(price, "signal_exit");
      }
    }
  }

  /**
   * Open a position
   */
  protected async openPosition(side: "long" | "short", qty: number, price: number): Promise<void> {
    this.state.position = {
      side,
      entryPrice: price,
      qty,
    };

    // Submit order through adapter
    await this.adapter.submitOrder({
      symbol: this.config.symbol,
      side: side === "long" ? "buy" : "sell",
      qty,
      type: "market",
    });

    eventLogger.log("info", "position", `Position opened: ${side} ${qty} @ $${price}`, {
      sessionId: this.sessionId,
      strategyName: this.constructor.name,
      symbol: this.config.symbol,
      details: { side, qty, entryPrice: price },
    });
  }

  /**
   * Close a position
   */
  protected async closePosition(price: number, reason: string): Promise<void> {
    if (!this.state.position) return;

    const { side, qty, entryPrice } = this.state.position;
    const pnl = side === "long" ? (price - entryPrice) * qty : (entryPrice - price) * qty;

    // Submit order through adapter
    await this.adapter.submitOrder({
      symbol: this.config.symbol,
      side: side === "long" ? "sell" : "buy",
      qty,
      type: "market",
    });

    eventLogger.log("info", "position", `Position closed: ${side} ${qty} @ $${price} PnL: $${pnl.toFixed(2)}`, {
      sessionId: this.sessionId,
      strategyName: this.constructor.name,
      symbol: this.config.symbol,
      details: { side, qty, exitPrice: price, entryPrice, pnl, reason },
    });

    this.state.position = null;
  }

  /**
   * Handle bar updates (for OHLC data)
   */
  onBar(bar: Bar): void {
    this.state.barHistory.push(bar);
    if (this.state.barHistory.length > this.config.featureConfig.lookbackWindow * 2) {
      this.state.barHistory = this.state.barHistory.slice(-this.config.featureConfig.lookbackWindow * 2);
    }
  }

  /**
   * Get current position
   */
  getPosition(): { side: "long" | "short" | null; qty: number } {
    return {
      side: this.state.position?.side ?? null,
      qty: this.state.position?.qty ?? 0,
    };
  }

  /**
   * Get last prediction
   */
  getLastPrediction(): PredictionResult | null {
    return this.state.lastPrediction;
  }

  /**
   * Get strategy state
   */
  getState(): MLStrategyState {
    return { ...this.state };
  }

  /**
   * Reset strategy state
   */
  reset(): void {
    this.state = {
      isTrained: false,
      lastPrediction: null,
      lastFeatureSet: null,
      barHistory: [],
      position: null,
    };
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(): import("./model-manager.js").ModelPerformance {
    return this.modelManager.getPerformance();
  }
}

export { MLStrategy };
