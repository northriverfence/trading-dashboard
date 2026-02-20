import { test, expect } from "bun:test";
import { HDBSCANClusterer } from "../../pattern-discovery/clusterer";

test("HDBSCANClusterer clusters embeddings", () => {
    const clusterer = new HDBSCANClusterer({ minClusterSize: 2, minSamples: 1 });

    // Create simple 2D embeddings (first 2 dims matter)
    const embeddings = [
        [1, 1, 0, 0], // cluster 0
        [1.1, 1.1, 0, 0], // cluster 0
        [5, 5, 0, 0], // cluster 1
        [5.1, 5.1, 0, 0], // cluster 1
        [100, 100, 0, 0], // outlier
    ];

    const result = clusterer.cluster(embeddings);
    expect(result.labels.length).toBe(5);
    expect(result.clusters.length).toBeGreaterThanOrEqual(1);
});

test("HDBSCANClusterer identifies noise points", () => {
    const clusterer = new HDBSCANClusterer({ minClusterSize: 2, minSamples: 1 });

    const embeddings = [
        [1, 1], // cluster
        [1.1, 1.1], // cluster
        [100, 100], // outlier (isolated)
    ];

    const result = clusterer.cluster(embeddings);
    // At least one point should be noise (-1)
    const hasNoise = result.labels.some((l) => l === -1);
    expect(hasNoise || result.noise.length > 0).toBe(true);
});

test("HDBSCANClusterer handles empty input", () => {
    const clusterer = new HDBSCANClusterer({ minClusterSize: 2, minSamples: 1 });
    const result = clusterer.cluster([]);
    expect(result.labels).toEqual([]);
    expect(result.clusters).toEqual([]);
    expect(result.noise).toEqual([]);
});
