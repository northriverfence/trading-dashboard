// src/pattern-discovery/clusterer.ts
export interface DBSCANConfig {
  minClusterSize: number;
  minSamples: number;
}

export interface ClusterResult {
  labels: number[]; // -1 for noise
  clusters: Array<{ id: number; indices: number[] }>;
  noise: number[];
}

export class DBSCANClusterer {
  private config: DBSCANConfig;

  constructor(config: DBSCANConfig) {
    this.config = config;
  }

  cluster(embeddings: number[][]): ClusterResult {
    // Simplified HDBSCAN implementation
    // In production, use a proper HDBSCAN library

    const n = embeddings.length;
    if (n === 0) {
      return { labels: [], clusters: [], noise: [] };
    }

    const labels = new Array(n).fill(-1);
    const visited = new Set<number>();
    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (visited.has(i)) continue;

      const neighbors = this.getNeighbors(embeddings, i);

      // Use minSamples to determine if point can start a cluster (like DBSCAN core point)
      if (neighbors.length >= this.config.minSamples) {
        // Start new cluster
        this.expandCluster(embeddings, i, neighbors, labels, visited, clusterId);
        clusterId++;
      }
    }

    // Build result
    const clusters: Array<{ id: number; indices: number[] }> = [];
    for (let c = 0; c < clusterId; c++) {
      const indices = labels.map((l, i) => (l === c ? i : -1)).filter((i) => i !== -1);
      // Filter clusters that don't meet minClusterSize
      if (indices.length >= this.config.minClusterSize) {
        clusters.push({ id: c, indices });
      } else {
        // Mark as noise if cluster is too small
        for (const idx of indices) {
          labels[idx] = -1;
        }
      }
    }

    const noise = labels.map((l, i) => (l === -1 ? i : -1)).filter((i) => i !== -1);

    return { labels, clusters, noise };
  }

  private getNeighbors(embeddings: number[][], idx: number): number[] {
    const neighbors: number[] = [];
    const threshold = 0.5; // Distance threshold

    for (let i = 0; i < embeddings.length; i++) {
      if (i !== idx && this.euclideanDistance(embeddings[idx]!, embeddings[i]!) < threshold) {
        neighbors.push(i);
      }
    }

    return neighbors;
  }

  private expandCluster(
    embeddings: number[][],
    idx: number,
    neighbors: number[],
    labels: number[],
    visited: Set<number>,
    clusterId: number,
  ): void {
    labels[idx] = clusterId;
    visited.add(idx);

    const queue = [...neighbors];

    for (let i = 0; i < queue.length; i++) {
      const neighbor = queue[i]!;

      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const newNeighbors = this.getNeighbors(embeddings, neighbor);

        if (newNeighbors.length >= this.config.minSamples) {
          queue.push(...newNeighbors);
        }
      }

      if (labels[neighbor] === -1) {
        labels[neighbor] = clusterId;
      }
    }
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i]! - b[i]!;
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
