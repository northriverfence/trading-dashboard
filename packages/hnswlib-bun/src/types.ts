// src/types.ts
// Type definitions for hnswlib-bun

export interface HNSWConfig {
  /** Space type: 'l2', 'ip', or 'cosine' */
  space: 'l2' | 'ip' | 'cosine';
  /** Dimension of vectors */
  dim: number;
  /** Maximum number of elements (capacity) */
  maxElements: number;
  /** M parameter (number of connections per layer) */
  m?: number;
  /** efConstruction parameter (size of dynamic candidate list) */
  efConstruction?: number;
  /** efSearch parameter (size of dynamic candidate list for search) */
  efSearch?: number;
  /** Random seed */
  seed?: number;
}

export interface SearchResult {
  /** Indices of nearest neighbors */
  indices: number[];
  /** Distances to nearest neighbors */
  distances: number[];
}

export interface HNSWIndex {
  /** Add a single vector with its label */
  addVector(vector: Float32Array, label: number): void;

  /** Add multiple vectors in batch */
  addVectors(vectors: Float32Array[], labels: number[]): void;

  /** Search for k nearest neighbors */
  searchKnn(query: Float32Array, k: number): SearchResult;

  /** Mark element as deleted */
  markDelete(label: number): void;

  /** Resize the index */
  resizeIndex(newMaxElements: number): void;

  /** Get current element count */
  getCurrentCount(): number;

  /** Save index to file */
  saveIndex(filename: string): void;

  /** Load index from file */
  loadIndex(filename: string): void;

  /** Set ef parameter for search */
  setEf(ef: number): void;

  /** Free native resources */
  free(): void;
}

export type SpaceType = 'l2' | 'ip' | 'cosine';
