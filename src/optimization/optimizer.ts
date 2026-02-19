/**
 * Strategy Optimization Framework
 * Parameter optimization and walk-forward analysis for trading strategies
 */

import type { BacktestResult, Strategy } from "../backtesting/types.js";
import { BacktestEngine } from "../backtesting/backtest-engine.js";
import { eventLogger } from "../reporting/event-logger.js";

export interface OptimizationConfig {
  /** Strategy class/constructor */
  strategyClass: new (...args: unknown[]) => Strategy;
  /** Base configuration for the strategy */
  baseConfig: Record<string, unknown>;
  /** Parameters to optimize */
  parameters: ParameterRange[];
  /** Optimization metric to maximize */
  optimizationMetric: "sharpeRatio" | "totalReturn" | "profitFactor" | "winRate" | "calmarRatio";
  /** Optimization method */
  method: "grid" | "genetic" | "random";
  /** Number of iterations for random search */
  maxIterations?: number;
  /** Whether to use walk-forward analysis */
  walkForward?: boolean;
  /** Walk-forward configuration */
  walkForwardConfig?: WalkForwardConfig;
}

export interface ParameterRange {
  name: string;
  type: "int" | "float" | "choice";
  min?: number;
  max?: number;
  step?: number;
  choices?: unknown[];
}

export interface WalkForwardConfig {
  /** Training period in days */
  trainPeriod: number;
  /** Testing period in days */
  testPeriod: number;
  /** Step size in days */
  stepSize: number;
}

export interface OptimizationResult {
  /** Best parameter combination found */
  bestParameters: Record<string, unknown>;
  /** Best score achieved */
  bestScore: number;
  /** Full backtest result for best parameters */
  backtestResult: BacktestResult;
  /** All parameter combinations tested */
  allResults: ParameterResult[];
  /** Optimization statistics */
  stats: {
    totalIterations: number;
    timeElapsed: number;
    averageScore: number;
    standardDeviation: number;
  };
}

export interface ParameterResult {
  parameters: Record<string, unknown>;
  score: number;
  backtestResult: BacktestResult;
}

export interface WalkForwardResult {
  /** Walk-forward periods */
  periods: WalkForwardPeriod[];
  /** Aggregated results across all periods */
  aggregated: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
  };
  /** Out-of-sample results summary */
  outOfSample: BacktestResult;
  /** Parameter stability score (0-1) */
  parameterStability: number;
}

export interface WalkForwardPeriod {
  trainStart: Date;
  trainEnd: Date;
  testStart: Date;
  testEnd: Date;
  bestParameters: Record<string, unknown>;
  trainScore: number;
  testScore: number;
  outOfSampleResult: BacktestResult;
}

export class ParameterOptimizer {
  private config: OptimizationConfig;

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  /**
   * Run optimization based on configured method
   */
  async optimize(
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    eventLogger.log("info", "strategy", `Starting ${this.config.method} optimization`, {
      details: {
        method: this.config.method,
        metric: this.config.optimizationMetric,
        parameters: this.config.parameters.map((p) => p.name),
      },
    });

    let results: ParameterResult[];

    switch (this.config.method) {
      case "grid":
        results = await this.runGridSearch(getData, symbol, startDate, endDate);
        break;
      case "random":
        results = await this.runRandomSearch(getData, symbol, startDate, endDate);
        break;
      case "genetic":
        results = await this.runGeneticAlgorithm(getData, symbol, startDate, endDate);
        break;
      default:
        throw new Error(`Unknown optimization method: ${this.config.method}`);
    }

    // Find best result
    const bestResult = results.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    const timeElapsed = Date.now() - startTime;
    const scores = results.map((r) => r.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const standardDeviation = Math.sqrt(
      scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length
    );

    eventLogger.log("info", "strategy", "Optimization complete", {
      details: {
        bestScore: bestResult.score,
        bestParameters: bestResult.parameters,
        totalIterations: results.length,
        timeElapsed: `${(timeElapsed / 1000).toFixed(2)}s`,
      },
    });

    return {
      bestParameters: bestResult.parameters,
      bestScore: bestResult.score,
      backtestResult: bestResult.backtestResult,
      allResults: results,
      stats: {
        totalIterations: results.length,
        timeElapsed,
        averageScore,
        standardDeviation,
      },
    };
  }

  /**
   * Grid search - exhaustive search over all parameter combinations
   */
  private async runGridSearch(
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<ParameterResult[]> {
    const combinations = this.generateParameterCombinations();
    const results: ParameterResult[] = [];

    for (const params of combinations) {
      const result = await this.evaluateParameters(params, getData, symbol, startDate, endDate);
      results.push(result);
    }

    return results;
  }

  /**
   * Random search - sample random parameter combinations
   */
  private async runRandomSearch(
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<ParameterResult[]> {
    const iterations = this.config.maxIterations ?? 100;
    const results: ParameterResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const params = this.generateRandomParameters();
      const result = await this.evaluateParameters(params, getData, symbol, startDate, endDate);
      results.push(result);
    }

    return results;
  }

  /**
   * Genetic algorithm - evolutionary optimization
   */
  private async runGeneticAlgorithm(
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<ParameterResult[]> {
    const populationSize = 20;
    const generations = 10;
    const mutationRate = 0.1;

    // Initialize population
    let population: Record<string, unknown>[] = [];
    for (let i = 0; i < populationSize; i++) {
      population.push(this.generateRandomParameters());
    }

    const results: ParameterResult[] = [];

    for (let generation = 0; generation < generations; generation++) {
      // Evaluate population
      const fitnessResults: ParameterResult[] = [];
      for (const params of population) {
        const result = await this.evaluateParameters(params, getData, symbol, startDate, endDate);
        fitnessResults.push(result);
      }

      results.push(...fitnessResults);

      // Sort by fitness
      fitnessResults.sort((a, b) => b.score - a.score);

      // Select top half as parents
      const parents = fitnessResults.slice(0, Math.floor(populationSize / 2)).map((r) => r.parameters).filter((p): p is Record<string, unknown> => p !== undefined);

      // Create new generation through crossover and mutation
      const newPopulation: Record<string, unknown>[] = [];
      while (newPopulation.length < populationSize) {
        const parent1 = parents[Math.floor(Math.random() * parents.length)] ?? {};
        const parent2 = parents[Math.floor(Math.random() * parents.length)] ?? {};
        const child = this.crossover(parent1, parent2);
        this.mutate(child, mutationRate);
        newPopulation.push(child);
      }

      population = newPopulation;
    }

    return results;
  }

  /**
   * Generate all combinations of parameters for grid search
   */
  private generateParameterCombinations(): Record<string, unknown>[] {
    const ranges = this.config.parameters;
    let combinations: Record<string, unknown>[] = [{}];

    for (const range of ranges) {
      const values: unknown[] = [];

      if (range.type === "choice" && range.choices) {
        values.push(...range.choices);
      } else if (range.type === "int" && range.min !== undefined && range.max !== undefined) {
        const step = range.step ?? 1;
        for (let v = range.min; v <= range.max; v += step) {
          values.push(Math.floor(v));
        }
      } else if (range.type === "float" && range.min !== undefined && range.max !== undefined) {
        const step = range.step ?? 0.1;
        for (let v = range.min; v <= range.max; v += step) {
          values.push(parseFloat(v.toFixed(4)));
        }
      }

      const newCombinations: Record<string, unknown>[] = [];
      for (const combo of combinations) {
        for (const value of values) {
          newCombinations.push({ ...combo, [range.name]: value });
        }
      }
      combinations = newCombinations;
    }

    return combinations;
  }

  /**
   * Generate random parameter set
   */
  private generateRandomParameters(): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    for (const range of this.config.parameters) {
      if (range.type === "choice" && range.choices && range.choices.length > 0) {
        params[range.name] = range.choices[Math.floor(Math.random() * range.choices.length)];
      } else if (range.type === "int" && range.min !== undefined && range.max !== undefined) {
        params[range.name] = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      } else if (range.type === "float" && range.min !== undefined && range.max !== undefined) {
        params[range.name] = parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));
      }
    }

    return params;
  }

  /**
   * Crossover two parent parameter sets
   */
  private crossover(parent1: Record<string, unknown>, parent2: Record<string, unknown>): Record<string, unknown> {
    const child: Record<string, unknown> = {};
    const keys = Object.keys(parent1);

    for (const key of keys) {
      child[key] = Math.random() < 0.5 ? parent1[key] : parent2[key];
    }

    return child;
  }

  /**
   * Mutate parameters with given probability
   */
  private mutate(params: Record<string, unknown>, mutationRate: number): void {
    for (const range of this.config.parameters) {
      if (Math.random() < mutationRate) {
        params[range.name] = this.generateRandomParameterValue(range);
      }
    }
  }

  /**
   * Generate a single random parameter value
   */
  private generateRandomParameterValue(range: ParameterRange): unknown {
    if (range.type === "choice" && range.choices && range.choices.length > 0) {
      return range.choices[Math.floor(Math.random() * range.choices.length)];
    } else if (range.type === "int" && range.min !== undefined && range.max !== undefined) {
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    } else if (range.type === "float" && range.min !== undefined && range.max !== undefined) {
      return parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));
    }
    return null;
  }

  /**
   * Evaluate a parameter set by running a backtest
   */
  private async evaluateParameters(
    params: Record<string, unknown>,
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<ParameterResult> {
    // Create strategy with parameters
    const strategyConfig = { ...this.config.baseConfig, ...params };
    const strategy = new this.config.strategyClass(strategyConfig);

    // Run backtest
    const backtestConfig = {
      startDate,
      endDate,
      initialCapital: 10000,
      commission: 0.001,
      slippage: 0.001,
      fillModel: "immediate" as const,
      dataSource: "files" as const,
      replaySpeed: 0,
      warmupBars: 100,
    };

    const engine = new BacktestEngine(backtestConfig);
    await engine.loadHistoricalData([symbol]);
    const backtestResult = await engine.run(strategy);

    // Calculate score based on optimization metric
    const score = this.calculateScore(backtestResult);

    return {
      parameters: params,
      score,
      backtestResult,
    };
  }

  /**
   * Calculate optimization score from backtest result
   */
  private calculateScore(result: BacktestResult): number {
    switch (this.config.optimizationMetric) {
      case "sharpeRatio":
        return result.sharpeRatio;
      case "totalReturn":
        return result.totalReturn;
      case "profitFactor":
        return result.profitFactor;
      case "winRate":
        return result.winRate * 100;
      case "calmarRatio":
        return result.annualizedReturn / (result.maxDrawdown || 1);
      default:
        return result.sharpeRatio;
    }
  }
}

export class WalkForwardAnalyzer {
  /**
   * Perform walk-forward analysis
   */
  async analyze(
    strategyClass: new (...args: unknown[]) => Strategy,
    baseConfig: Record<string, unknown>,
    parameters: ParameterRange[],
    getData: (symbol: string, start: Date, end: Date) => Promise<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }[]>,
    symbol: string,
    startDate: Date,
    endDate: Date,
    config: WalkForwardConfig
  ): Promise<WalkForwardResult> {
    const periods: WalkForwardPeriod[] = [];
    const currentDate = new Date(startDate);

    while (currentDate.getTime() + config.trainPeriod * 24 * 60 * 60 * 1000 < endDate.getTime()) {
      const trainStart = new Date(currentDate);
      const trainEnd = new Date(currentDate.getTime() + config.trainPeriod * 24 * 60 * 60 * 1000);
      const testStart = new Date(trainEnd);
      const testEnd = new Date(testStart.getTime() + config.testPeriod * 24 * 60 * 60 * 1000);

      if (testEnd > endDate) break;

      // Optimize on training period
      const optimizer = new ParameterOptimizer({
        strategyClass,
        baseConfig,
        parameters,
        optimizationMetric: "sharpeRatio",
        method: "grid",
      });

      const optimizationResult = await optimizer.optimize(getData, symbol, trainStart, trainEnd);

      // Test on out-of-sample period
      const strategy = new strategyClass({ ...baseConfig, ...(optimizationResult.bestParameters || {}) });
      const backtestConfig = {
        startDate: testStart,
        endDate: testEnd,
        initialCapital: 10000,
        commission: 0.001,
        slippage: 0.001,
        fillModel: "immediate" as const,
        dataSource: "files" as const,
        replaySpeed: 0,
        warmupBars: 100,
      };

      const engine = new BacktestEngine(backtestConfig);
      await engine.loadHistoricalData([symbol]);
      const outOfSampleResult = await engine.run(strategy);

      periods.push({
        trainStart,
        trainEnd,
        testStart,
        testEnd,
        bestParameters: optimizationResult.bestParameters,
        trainScore: optimizationResult.bestScore,
        testScore: this.calculateOutOfSampleScore(outOfSampleResult),
        outOfSampleResult,
      });

      // Move forward
      currentDate.setTime(currentDate.getTime() + config.stepSize * 24 * 60 * 60 * 1000);
    }

    // Calculate aggregated results
    const aggregated = this.calculateAggregatedResults(periods);

    // Calculate parameter stability
    const parameterStability = this.calculateParameterStability(periods);

    // Create combined out-of-sample result
    const outOfSample = this.combineOutOfSampleResults(periods);

    return {
      periods,
      aggregated,
      outOfSample,
      parameterStability,
    };
  }

  /**
   * Calculate out-of-sample score
   */
  private calculateOutOfSampleScore(result: BacktestResult): number {
    // Combine multiple metrics for a robust score
    const weights = {
      sharpeRatio: 0.4,
      totalReturn: 0.3,
      winRate: 0.2,
      maxDrawdown: 0.1,
    };

    const normalizedReturn = result.totalReturn / 100;
    const normalizedDrawdown = 1 - result.maxDrawdown / 100;

    return (
      result.sharpeRatio * weights.sharpeRatio +
      normalizedReturn * weights.totalReturn +
      result.winRate * weights.winRate +
      normalizedDrawdown * weights.maxDrawdown
    );
  }

  /**
   * Calculate aggregated results across all periods
   */
  private calculateAggregatedResults(periods: WalkForwardPeriod[]): WalkForwardResult["aggregated"] {
    const totalTrades = periods.reduce((sum, p) => sum + p.outOfSampleResult.metrics.totalTrades, 0);
    const avgReturn = periods.reduce((sum, p) => sum + p.outOfSampleResult.totalReturn, 0) / periods.length;
    const avgSharpe = periods.reduce((sum, p) => sum + p.outOfSampleResult.sharpeRatio, 0) / periods.length;
    const avgDrawdown = periods.reduce((sum, p) => sum + p.outOfSampleResult.maxDrawdown, 0) / periods.length;
    const avgWinRate = periods.reduce((sum, p) => sum + p.outOfSampleResult.winRate, 0) / periods.length;
    const avgProfitFactor = periods.reduce((sum, p) => sum + p.outOfSampleResult.profitFactor, 0) / periods.length;

    return {
      totalReturn: avgReturn,
      sharpeRatio: avgSharpe,
      maxDrawdown: avgDrawdown,
      winRate: avgWinRate,
      profitFactor: avgProfitFactor,
      totalTrades,
    };
  }

  /**
   * Calculate parameter stability score
   */
  private calculateParameterStability(periods: WalkForwardPeriod[]): number {
    if (periods.length < 2) return 1;

    const firstPeriod = periods[0];
    if (!firstPeriod) {
      return 1;
    }
    const parameterNames = Object.keys(firstPeriod.bestParameters);
    const stabilities: number[] = [];

    for (const paramName of parameterNames) {
      const values = periods.map((p) => p.bestParameters[paramName] as number);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;
      stabilities.push(1 - Math.min(coefficientOfVariation, 1));
    }

    return stabilities.reduce((a, b) => a + b, 0) / stabilities.length;
  }

  /**
   * Combine out-of-sample results from all periods
   */
  private combineOutOfSampleResults(periods: WalkForwardPeriod[]): BacktestResult {
    // Combine trades and equity curves from all periods
    const allTrades = periods.flatMap((p) => p.outOfSampleResult.trades);
    const equityCurve = periods.flatMap((p) => p.outOfSampleResult.equityCurve);

    // Use metrics from aggregated calculations
    const aggregated = this.calculateAggregatedResults(periods);

    return {
      trades: allTrades,
      equityCurve,
      drawdownCurve: [],
      startDate: periods[0]?.testStart ?? new Date(),
      endDate: periods[periods.length - 1]?.testEnd ?? new Date(),
      duration: periods.length,
      totalReturn: aggregated.totalReturn,
      annualizedReturn: aggregated.totalReturn, // Simplified
      maxDrawdown: aggregated.maxDrawdown,
      sharpeRatio: aggregated.sharpeRatio,
      winRate: aggregated.winRate,
      profitFactor: aggregated.profitFactor,
      volatility: 0,
      metrics: {
        totalTrades: aggregated.totalTrades,
        winningTrades: Math.floor(aggregated.totalTrades * aggregated.winRate),
        losingTrades: Math.floor(aggregated.totalTrades * (1 - aggregated.winRate)),
        breakevenTrades: 0,
        winRate: aggregated.winRate,
        lossRate: 1 - aggregated.winRate,
        breakevenRate: 0,
        profitFactor: aggregated.profitFactor,
        totalReturn: aggregated.totalReturn,
        totalReturnPercent: aggregated.totalReturn,
        annualizedReturn: aggregated.totalReturn,
        annualizedReturnPercent: aggregated.totalReturn,
        maxDrawdown: aggregated.maxDrawdown,
        maxDrawdownPercent: aggregated.maxDrawdown,
        maxDrawdownDuration: 0,
        sharpeRatio: aggregated.sharpeRatio,
        sortinoRatio: aggregated.sharpeRatio,
        calmarRatio: aggregated.totalReturn / (aggregated.maxDrawdown || 1),
        volatility: 0,
        volatilityPercent: 0,
        avgWin: 0,
        avgLoss: 0,
        avgWinPercent: 0,
        avgLossPercent: 0,
        largestWin: 0,
        largestLoss: 0,
        largestWinPercent: 0,
        largestLossPercent: 0,
        expectancy: 0,
        expectancyPercent: 0,
        avgBarsHeld: 0,
        avgTradePerDay: 0,
        avgTradePerMonth: 0,
      },
    };
  }
}

