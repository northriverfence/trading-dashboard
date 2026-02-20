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
