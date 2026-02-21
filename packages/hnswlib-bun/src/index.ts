// src/index.ts
// High-level API for hnswlib-bun

import { lib, spaceToCString, checkError } from "./hnswlib.js";
import { ptr, toArrayBuffer } from "bun:ffi";
import type { HNSWConfig, HNSWIndex, SearchResult } from "./types.js";

export { HNSWConfig, HNSWIndex, SearchResult } from "./types.js";

export class Index implements HNSWIndex {
  private indexPtr: number;
  private config: HNSWConfig;

  constructor(config: HNSWConfig) {
    this.config = config;

    const spaceStr = spaceToCString(config.space);
    const m = config.m ?? 16;
    const efConstruction = config.efConstruction ?? 200;
    const efSearch = config.efSearch ?? 200;
    const seed = config.seed ?? 100;

    this.indexPtr = lib.symbols.createIndex(
      ptr(Buffer.from(spaceStr + "\0")),
      config.dim,
      config.maxElements,
      m,
      efConstruction,
      seed
    );

    checkError();

    // Set initial ef parameter
    lib.symbols.setEf(this.indexPtr, efSearch);
  }

  addVector(vector: Float32Array, label: number): void {
    const vectorPtr = ptr(Buffer.from(vector.buffer));
    lib.symbols.addVector(this.indexPtr, vectorPtr, label, vector.length);
    checkError();
  }

  addVectors(vectors: Float32Array[], labels: number[]): void {
    if (vectors.length !== labels.length) {
      throw new Error("Vectors and labels must have the same length");
    }

    for (let i = 0; i < vectors.length; i++) {
      this.addVector(vectors[i], labels[i]);
    }
  }

  searchKnn(query: Float32Array, k: number): SearchResult {
    const queryPtr = ptr(Buffer.from(query.buffer));

    // Allocate result buffers
    const indicesBuffer = new Uint32Array(k);
    const distancesBuffer = new Float32Array(k);

    const indicesPtr = ptr(Buffer.from(indicesBuffer.buffer));
    const distancesPtr = ptr(Buffer.from(distancesBuffer.buffer));

    lib.symbols.searchKnn(
      this.indexPtr,
      queryPtr,
      k,
      query.length,
      indicesPtr,
      distancesPtr
    );

    checkError();

    return {
      indices: Array.from(indicesBuffer),
      distances: Array.from(distancesBuffer),
    };
  }

  markDelete(label: number): void {
    lib.symbols.markDelete(this.indexPtr, label);
    checkError();
  }

  resizeIndex(newMaxElements: number): void {
    lib.symbols.resizeIndex(this.indexPtr, newMaxElements);
    checkError();
  }

  getCurrentCount(): number {
    return lib.symbols.getCurrentCount(this.indexPtr);
  }

  saveIndex(filename: string): void {
    const filenamePtr = ptr(Buffer.from(filename + "\0"));
    lib.symbols.saveIndex(this.indexPtr, filenamePtr);
    checkError();
  }

  loadIndex(filename: string): void {
    const filenamePtr = ptr(Buffer.from(filename + "\0"));
    lib.symbols.loadIndex(this.indexPtr, filenamePtr);
    checkError();
  }

  setEf(ef: number): void {
    lib.symbols.setEf(this.indexPtr, ef);
  }

  free(): void {
    lib.symbols.freeIndex(this.indexPtr);
  }
}

// Factory function
export function createIndex(config: HNSWConfig): Index {
  return new Index(config);
}

// Convenience function for L2 space
export function createL2Index(dim: number, maxElements: number): Index {
  return new Index({
    space: "l2",
    dim,
    maxElements,
  });
}

// Convenience function for cosine similarity
export function createCosineIndex(dim: number, maxElements: number): Index {
  return new Index({
    space: "cosine",
    dim,
    maxElements,
  });
}

// Convenience function for inner product
export function createIPIndex(dim: number, maxElements: number): Index {
  return new Index({
    space: "ip",
    dim,
    maxElements,
  });
}
