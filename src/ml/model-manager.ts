/**
 * Model Manager
 * Manages ML model loading, caching, and inference
 */

import type { FeatureSet } from "./feature-engineer.js";
import { eventLogger } from "../reporting/event-logger.js";

export interface ModelConfig {
  /** Model file path or URL */
  modelPath: string;
  /** Model type/format */
  format: "onnx" | "tensorflow" | "pytorch" | "sklearn" | "custom";
  /** Input feature count */
  inputSize: number;
  /** Output classes or values */
  outputSize: number;
  /** Normalization parameters */
  normalization?: {
    mean: number[];
    std: number[];
  };
  /** Classification or regression */
  taskType: "classification" | "regression";
  /** Model metadata */
  metadata?: Record<string, unknown>;
}

export interface PredictionResult {
  /** Predicted class or value */
  prediction: number;
  /** Confidence scores for each class (classification) */
  probabilities?: number[];
  /** Confidence score */
  confidence: number;
  /** Processing time in ms */
  inferenceTime: number;
}

export interface ModelPerformance {
  /** Total predictions made */
  totalPredictions: number;
  /** Average inference time in ms */
  avgInferenceTime: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Last prediction timestamp */
  lastPredictionTime: Date | null;
  /** Model load time */
  loadTime: number;
}

/**
 * Simple neural network implementation for demonstration
 * In production, use ONNX Runtime or TensorFlow.js
 */
class SimpleNeuralNetwork {
  private weights: number[][] = [];
  private biases: number[] = [];
  private inputSize: number;
  private outputSize: number;

  constructor(inputSize: number, outputSize: number) {
    this.inputSize = inputSize;
    this.outputSize = outputSize;
    this.initializeWeights();
  }

  private initializeWeights(): void {
    // Xavier initialization
    const scale = Math.sqrt(2.0 / (this.inputSize + this.outputSize));
    this.weights = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.inputSize }, () => (Math.random() - 0.5) * 2 * scale)
    );
    this.biases = Array.from({ length: this.outputSize }, () => 0);
  }

  predict(input: number[]): number[] {
    const output: number[] = [];
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.biases[i];
      for (let j = 0; j < this.inputSize; j++) {
        sum += input[j] * this.weights[i][j];
      }
      output.push(sum);
    }

    // Apply softmax for classification
    if (this.outputSize > 1) {
      const maxVal = Math.max(...output);
      const expSum = output.reduce((sum, val) => sum + Math.exp(val - maxVal), 0);
      return output.map((val) => Math.exp(val - maxVal) / expSum);
    }

    // Sigmoid for single output
    return [1 / (1 + Math.exp(-output[0]))];
  }

  /**
   * Load model weights from a file or object
   */
  loadWeights(weights: { weights: number[][]; biases: number[] }): void {
    this.weights = weights.weights;
    this.biases = weights.biases;
  }
}

export class ModelManager {
  private config: ModelConfig;
  private model: SimpleNeuralNetwork | null = null;
  private isLoaded = false;
  private cache: Map<string, PredictionResult> = new Map();
  private cacheSize = 1000;

  // Performance tracking
  private performance: ModelPerformance = {
    totalPredictions: 0,
    avgInferenceTime: 0,
    cacheHitRate: 0,
    lastPredictionTime: null,
    loadTime: 0,
  };

  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /**
   * Load the model
   */
  async load(): Promise<void> {
    const startTime = Date.now();

    try {
      switch (this.config.format) {
        case "onnx":
          await this.loadONNXModel();
          break;
        case "tensorflow":
          await this.loadTensorFlowModel();
          break;
        case "pytorch":
        case "sklearn":
        case "custom":
          // For demo, create a simple neural network
          this.model = new SimpleNeuralNetwork(this.config.inputSize, this.config.outputSize);
          break;
        default:
          throw new Error(`Unsupported model format: ${this.config.format}`);
      }

      this.isLoaded = true;
      this.performance.loadTime = Date.now() - startTime;

      eventLogger.log("info", "system", `Model loaded successfully`, {
        details: {
          format: this.config.format,
          inputSize: this.config.inputSize,
          outputSize: this.config.outputSize,
          loadTime: this.performance.loadTime,
        },
      });
    } catch (error) {
      eventLogger.log("error", "system", `Failed to load model: ${(error as Error).message}`, {
        details: { path: this.config.modelPath },
      });
      throw error;
    }
  }

  /**
   * Make a prediction
   */
  predict(featureSet: FeatureSet): PredictionResult {
    if (!this.isLoaded || !this.model) {
      throw new Error("Model not loaded. Call load() first.");
    }

    const startTime = Date.now();

    // Normalize features
    const normalizedFeatures = this.normalize(featureSet.vector);

    // Check cache
    const cacheKey = JSON.stringify(normalizedFeatures.map((f) => f.toFixed(4)));
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    // Run inference
    const output = this.model.predict(normalizedFeatures);

    const inferenceTime = Date.now() - startTime;

    // Process output
    let prediction: number;
    let probabilities: number[] | undefined;
    let confidence: number;

    if (this.config.taskType === "classification") {
      // Get predicted class
      prediction = output.indexOf(Math.max(...output));
      probabilities = output;
      confidence = output[prediction];
    } else {
      // Regression
      prediction = output[0];
      confidence = 1 - Math.abs(prediction); // Simple confidence based on distance from 0
    }

    const result: PredictionResult = {
      prediction,
      probabilities,
      confidence,
      inferenceTime,
    };

    // Update cache
    this.cache.set(cacheKey, result);
    if (this.cache.size > this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Update performance
    this.performance.totalPredictions++;
    this.performance.avgInferenceTime =
      (this.performance.avgInferenceTime * (this.performance.totalPredictions - 1) +
        inferenceTime) /
      this.performance.totalPredictions;
    this.performance.lastPredictionTime = new Date();
    this.performance.cacheHitRate =
      this.cacheHits / (this.cacheHits + this.cacheMisses);

    return result;
  }

  /**
   * Batch prediction
   */
  predictBatch(featureSets: FeatureSet[]): PredictionResult[] {
    return featureSets.map((fs) => this.predict(fs));
  }

  /**
   * Get model performance metrics
   */
  getPerformance(): ModelPerformance {
    return { ...this.performance };
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.performance.cacheHitRate = 0;
  }

  /**
   * Normalize features
   */
  private normalize(features: number[]): number[] {
    if (!this.config.normalization) {
      return features;
    }

    const { mean, std } = this.config.normalization;
    return features.map((f, i) => (f - (mean[i] ?? 0)) / ((std[i] ?? 1) || 1));
  }

  /**
   * Load ONNX model
   */
  private async loadONNXModel(): Promise<void> {
    // In production, use onnxruntime-node
    // For demo, create simple network
    this.model = new SimpleNeuralNetwork(this.config.inputSize, this.config.outputSize);

    try {
      // Try to load actual model weights if file exists
      const file = Bun.file(this.config.modelPath);
      if (await file.exists()) {
        const weights = await file.json();
        if (weights.weights && weights.biases) {
          this.model.loadWeights(weights);
        }
      }
    } catch {
      // Use default random weights
    }
  }

  /**
   * Load TensorFlow model
   */
  private async loadTensorFlowModel(): Promise<void> {
    // In production, use @tensorflow/tfjs-node
    // For demo, create simple network
    this.model = new SimpleNeuralNetwork(this.config.inputSize, this.config.outputSize);
  }

  /**
   * Get feature importance (for supported models)
   */
  getFeatureImportance(): Record<string, number> | null {
    // For neural networks, this would require gradient-based methods
    // Return null for now
    return null;
  }

  /**
   * Export model performance report
   */
  exportPerformanceReport(): string {
    const report = {
      config: this.config,
      performance: this.performance,
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(report, null, 2);
  }
}

export { ModelManager, SimpleNeuralNetwork };
