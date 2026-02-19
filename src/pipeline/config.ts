/**
 * Pipeline Configuration
 */

import type { PipelineConfig } from "./types.js";

export const defaultPipelineConfig: PipelineConfig = {
  autoReconnect: true,
  reconnectStrategy: "exponential",
  maxReconnectDelay: 60000,
  baseReconnectDelay: 1000,
  maxReconnectAttempts: 10,
  bufferSize: 1000,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
  batchInterval: 100,
};

export function loadPipelineConfig(overrides?: Partial<PipelineConfig>): PipelineConfig {
  return {
    ...defaultPipelineConfig,
    ...overrides,
  };
}

export function validatePipelineConfig(config: PipelineConfig): string[] {
  const errors: string[] = [];

  if (config.bufferSize <= 0) {
    errors.push("bufferSize must be positive");
  }

  if (config.heartbeatInterval < 5000) {
    errors.push("heartbeatInterval must be at least 5000ms");
  }

  if (config.maxReconnectAttempts < 0) {
    errors.push("maxReconnectAttempts must be non-negative");
  }

  return errors;
}
