// src/pattern-discovery/engine.ts
import type { TradeMemory } from "../agentdb-integration.js";
import { DBSCANClusterer, type DBSCANConfig } from "./clusterer.js";
import { PatternMiner, type MinerConfig } from "./miner.js";
import { QualityGate, type QualityGateConfig } from "./quality-gate.js";
import { EmergingDetector, type EmergingDetectorConfig } from "./emerging-detector.js";
import { PatternDeprecator, type DeprecatorConfig } from "./deprecator.js";
import type { DiscoveredPattern, EmergingPattern, DiscoveryOptions } from "./types.js";

export interface DiscoveryEngineConfig
  extends DBSCANConfig, MinerConfig, QualityGateConfig, EmergingDetectorConfig, DeprecatorConfig {
  // Inherits from all component configs
}

export interface DiscoveryResult {
  patterns: DiscoveredPattern[];
  emergingPatterns: EmergingPattern[];
  deprecatedPatterns: DiscoveredPattern[];
  clusterCount: number;
  noiseCount: number;
}

export interface DiscoveryStats {
  totalPatterns: number;
  validatedPatterns: number;
  activePatterns: number;
  deprecatedPatterns: number;
  emergingPatterns: number;
  fastTrackEligible: number;
}

export class PatternDiscoveryEngine {
  private clusterer: DBSCANClusterer;
  private miner: PatternMiner;
  private qualityGate: QualityGate;
  private emergingDetector: EmergingDetector;
  private deprecator: PatternDeprecator;
  private config: DiscoveryEngineConfig;
  private patterns: DiscoveredPattern[] = [];

  constructor(config: Partial<DiscoveryEngineConfig> = {}) {
    // Set defaults
    this.config = {
      minClusterSize: 2,
      minSamples: 1,
      minSupport: 0.1,
      minConfidence: 0.5,
      minWinRate: 0.6,
      minTrades: 3,
      fastTrackThreshold: 0.7,
      minTradesForFastTrack: 3,
      maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config,
    };

    // Initialize components
    this.clusterer = new DBSCANClusterer({
      minClusterSize: this.config.minClusterSize,
      minSamples: this.config.minSamples,
    });

    this.miner = new PatternMiner({
      minSupport: this.config.minSupport,
      minConfidence: this.config.minConfidence,
    });

    this.qualityGate = new QualityGate({
      minWinRate: this.config.minWinRate,
      minTrades: this.config.minTrades,
    });

    this.emergingDetector = new EmergingDetector({
      fastTrackThreshold: this.config.fastTrackThreshold,
      minTradesForFastTrack: this.config.minTradesForFastTrack,
    });

    this.deprecator = new PatternDeprecator({
      maxAgeMs: this.config.maxAgeMs,
      minWinRate: this.config.minWinRate,
      minTrades: this.config.minTrades,
    });
  }

  /**
   * Run the full pattern discovery pipeline
   */
  discover(trades: TradeMemory[], embeddings: number[][]): DiscoveryResult {
    // Step 1: Cluster trades using DBSCAN
    const clusterResult = this.clusterer.cluster(embeddings);

    // Step 2: Mine patterns from each cluster
    const allPatterns: DiscoveredPattern[] = [];

    for (const cluster of clusterResult.clusters) {
      const clusterTrades = cluster.indices.map((i) => trades[i]!);
      const patterns = this.miner.minePatterns(clusterTrades, cluster.id);
      allPatterns.push(...patterns);
    }

    // Step 3: Validate patterns through quality gate
    const validatedPatterns = this.validatePatterns(allPatterns);

    // Step 4: Detect emerging patterns
    const emergingPatterns = this.detectEmergingPatterns(validatedPatterns);

    // Step 5: Deprecate old patterns
    const { deprecatedPatterns, activePatterns } = this.deprecateOldPatterns(validatedPatterns);

    // Store patterns
    this.patterns = [...activePatterns, ...deprecatedPatterns];

    return {
      patterns: activePatterns,
      emergingPatterns,
      deprecatedPatterns,
      clusterCount: clusterResult.clusters.length,
      noiseCount: clusterResult.noise.length,
    };
  }

  /**
   * Validate a single pattern through quality gate
   */
  validate(pattern: DiscoveredPattern, tradeCount: number) {
    return this.qualityGate.validate(pattern, tradeCount);
  }

  /**
   * Analyze a pattern for emerging/fast-track eligibility
   */
  analyzeEmerging(pattern: DiscoveredPattern, tradeCount: number) {
    return this.emergingDetector.analyze(pattern, tradeCount);
  }

  /**
   * Get all stored patterns
   */
  getPatterns(): DiscoveredPattern[] {
    return [...this.patterns];
  }

  /**
   * Get patterns by status
   */
  getPatternsByStatus(status: DiscoveredPattern["status"]): DiscoveredPattern[] {
    return this.patterns.filter((p) => p.status === status);
  }

  /**
   * Get discovery statistics
   */
  getStats(): DiscoveryStats {
    const patterns = this.patterns;
    const emerging = this.emergingDetector.filterFastTrackEligible(
      patterns.map((p) => ({ pattern: p, tradeCount: p.trades.length })),
    );

    return {
      totalPatterns: patterns.length,
      validatedPatterns: patterns.filter((p) => p.status === "validated").length,
      activePatterns: patterns.filter((p) => p.status === "active").length,
      deprecatedPatterns: patterns.filter((p) => p.status === "deprecated").length,
      emergingPatterns: emerging.length,
      fastTrackEligible: emerging.filter((e) => e.fastTrackEligible).length,
    };
  }

  /**
   * Clear all stored patterns
   */
  clear(): void {
    this.patterns = [];
  }

  /**
   * Validate patterns through quality gate
   */
  private validatePatterns(patterns: DiscoveredPattern[]): DiscoveredPattern[] {
    return patterns.filter((pattern) => {
      const result = this.qualityGate.validate(pattern, pattern.trades.length);

      // Update pattern status based on validation
      if (this.qualityGate.shouldPromote(pattern, pattern.trades.length)) {
        pattern.status = "active";
      } else if (this.qualityGate.shouldDeprecate(pattern, pattern.trades.length)) {
        pattern.status = "deprecated";
      } else {
        pattern.status = "validated";
      }

      return result.valid;
    });
  }

  /**
   * Detect emerging patterns eligible for fast-track
   */
  private detectEmergingPatterns(patterns: DiscoveredPattern[]): EmergingPattern[] {
    const patternsWithCounts = patterns.map((pattern) => ({
      pattern,
      tradeCount: pattern.trades.length,
    }));

    return this.emergingDetector.filterFastTrackEligible(patternsWithCounts);
  }

  /**
   * Deprecate old patterns
   */
  private deprecateOldPatterns(patterns: DiscoveredPattern[]): {
    deprecatedPatterns: DiscoveredPattern[];
    activePatterns: DiscoveredPattern[];
  } {
    const { deprecated, kept } = this.deprecator.processPatterns(patterns);
    return { deprecatedPatterns: deprecated, activePatterns: kept };
  }

  /**
   * Get current configuration
   */
  getConfig(): DiscoveryEngineConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DiscoveryEngineConfig>): void {
    this.config = { ...this.config, ...config };

    // Re-initialize components with new config
    this.clusterer = new DBSCANClusterer({
      minClusterSize: this.config.minClusterSize,
      minSamples: this.config.minSamples,
    });

    this.miner = new PatternMiner({
      minSupport: this.config.minSupport,
      minConfidence: this.config.minConfidence,
    });

    this.qualityGate = new QualityGate({
      minWinRate: this.config.minWinRate,
      minTrades: this.config.minTrades,
    });

    this.emergingDetector = new EmergingDetector({
      fastTrackThreshold: this.config.fastTrackThreshold,
      minTradesForFastTrack: this.config.minTradesForFastTrack,
    });

    this.deprecator = new PatternDeprecator({
      maxAgeMs: this.config.maxAgeMs,
      minWinRate: this.config.minWinRate,
      minTrades: this.config.minTrades,
    });
  }
}
