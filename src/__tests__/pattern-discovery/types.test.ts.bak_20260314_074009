import { test, expect } from "bun:test";
import type { DiscoveredPattern, EmergingPattern, DiscoveryOptions, ClusterGraph, ClusterAnalysis } from "../../pattern-discovery/types";

test("DiscoveredPattern interface structure", () => {
    const pattern: DiscoveredPattern = {
        id: "pattern_001",
        clusterId: 1,
        features: { price: 0.5, volume: 0.8 },
        trades: [],
        winRate: 0.65,
        avgPnl: 125.5,
        confidence: 0.7,
        discoveredAt: Date.now(),
        status: "validated",
    };

    expect(pattern.winRate).toBe(0.65);
    expect(pattern.status).toBe("validated");
});

test("EmergingPattern interface structure", () => {
    const pattern: EmergingPattern = {
        id: "emerging_001",
        patternId: "pattern_001",
        tradesCount: 5,
        winRate: 0.8,
        fastTrackEligible: true,
    };

    expect(pattern.fastTrackEligible).toBe(true);
});

test("DiscoveryOptions interface structure", () => {
    const options: DiscoveryOptions = {
        minClusterSize: 3,
        minSamples: 2,
        validationWinRate: 0.6,
        validationMinTrades: 10,
    };

    expect(options.minClusterSize).toBe(3);
});

test("ClusterGraph interface structure", () => {
    const graph: ClusterGraph = {
        nodes: [{ id: 1, size: 5, winRate: 0.7 }],
        edges: [{ source: 1, target: 2, similarity: 0.8 }],
    };

    expect(graph.nodes.length).toBe(1);
    expect(graph.nodes[0]!.id).toBe(1);
    expect(graph.nodes[0]!.size).toBe(5);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]!.source).toBe(1);
    expect(graph.edges[0]!.target).toBe(2);
});

test("ClusterAnalysis interface structure", () => {
    const analysis: ClusterAnalysis = {
        clusterId: 1,
        tradeCount: 10,
        winRate: 0.75,
        avgPnl: 100,
        commonFeatures: { price: 0.5 },
        dominantStrategy: "momentum",
    };

    expect(analysis.clusterId).toBe(1);
    expect(analysis.tradeCount).toBe(10);
    expect(analysis.winRate).toBe(0.75);
    expect(analysis.dominantStrategy).toBe("momentum");
});
