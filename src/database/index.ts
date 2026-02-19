/**
 * Database Module
 * Exports database clients and utilities
 */

export { DatabaseClient, initializeDatabase, getDatabaseClient } from "./db-client.js";
export type { DatabaseConfig, BarRecord, TradeRecord, QuoteRecord } from "./db-client.js";

export { RedisCache, initializeCache, getCache } from "./redis-cache.js";
export type { RedisConfig } from "./redis-cache.js";
