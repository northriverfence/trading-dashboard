// src/pattern-discovery/types.ts
import type { TradeMemory } from "../agentdb-integration.js";

export interface PatternFeatures {
    [key: string]: number;
}

export interface DiscoveredPattern {
    id: string;
    clusterId: number;
    features: PatternFeatures;
    trades: TradeMemory[];
    winRate: number;
    avgPnl: number;
    confidence: number;
    discoveredAt: number;
    status: "discovered" | "validated" | "active" | "deprecated";
}

export interface EmergingPattern {
    id: string;
    patternId: string;
    tradesCount: number;
    winRate: number;
    fastTrackEligible: boolean;
}

export interface DiscoveryOptions {
    minClusterSize?: number;
    minSamples?: number;
    validationWinRate?: number;
    validationMinTrades?: number;
}

export interface ClusterGraph {
    nodes: Array<{ id: number; size: number; winRate: number }>;
    edges: Array<{ source: number; target: number; similarity: number }>;
}

export interface ClusterAnalysis {
    clusterId: number;
    tradeCount: number;
    winRate: number;
    avgPnl: number;
    commonFeatures: PatternFeatures;
    dominantStrategy: string;
}
