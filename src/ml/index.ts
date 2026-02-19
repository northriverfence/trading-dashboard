/**
 * Machine Learning Module
 * Feature engineering and ML-powered trading strategies
 */

export { FeatureEngineer } from "./feature-engineer.js";
export type { FeatureConfig, FeatureSet } from "./feature-engineer.js";

export { ModelManager, SimpleNeuralNetwork } from "./model-manager.js";
export type {
  ModelConfig,
  PredictionResult,
  ModelPerformance,
} from "./model-manager.js";

export { MLStrategy } from "./ml-strategy.js";
export type { MLStrategyConfig, MLStrategyState } from "./ml-strategy.js";
