/**
 * Redis Cache Client
 * High-speed caching for real-time market data
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(entries: Record<string, string>): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  lpush(key: string, value: string): Promise<void>;
  lrange(key: string, start: number, end: number): Promise<string[]>;
  close(): Promise<void>;
}

export class RedisCache {
  private client: RedisClient | null = null;
  private config: RedisConfig;
  private connected = false;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Store config for later use when Redis is available
    void this.config;

    try {
      // For now, use in-memory cache as Redis client for Bun 1.3
      // Can be replaced with actual Redis client library later
      console.log("Using in-memory cache (Redis not configured)");
      this.client = new InMemoryCache() as unknown as RedisClient;
      this.connected = true;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      // Fallback to in-memory cache
      this.client = new InMemoryCache() as unknown as RedisClient;
      this.connected = true;
      console.log("Using in-memory cache fallback");
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
      console.log("Redis connection closed");
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private getClient(): RedisClient {
    if (!this.client) {
      throw new Error("Redis not connected. Call connect() first.");
    }
    return this.client;
  }

  // Cache market data
  async cacheQuote(symbol: string, quote: unknown, ttlSeconds = 60): Promise<void> {
    const key = `quote:${symbol}`;
    await this.getClient().set(key, JSON.stringify(quote), { EX: ttlSeconds });
  }

  async getQuote(symbol: string): Promise<unknown | null> {
    const key = `quote:${symbol}`;
    const value = await this.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  async cacheBar(symbol: string, timeframe: string, bar: unknown, ttlSeconds = 300): Promise<void> {
    const key = `bar:${symbol}:${timeframe}`;
    await this.getClient().set(key, JSON.stringify(bar), { EX: ttlSeconds });
  }

  async getBar(symbol: string, timeframe: string): Promise<unknown | null> {
    const key = `bar:${symbol}:${timeframe}`;
    const value = await this.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  // Time-series data (last N bars)
  async pushBarHistory(symbol: string, timeframe: string, bar: unknown, maxHistory = 100): Promise<void> {
    const key = `bars:${symbol}:${timeframe}`;
    const client = this.getClient();
    await client.lpush(key, JSON.stringify(bar));
    // Trim to keep only maxHistory items
    await client.lrange(key, 0, maxHistory - 1).then(async (items) => {
      if (items.length > maxHistory) {
        // Clear and re-add trimmed items (simplified approach)
        await client.del(key);
        for (const item of items.slice(0, maxHistory)) {
          await client.lpush(key, item);
        }
      }
    });
  }

  async getBarHistory(symbol: string, timeframe: string, count = 50): Promise<unknown[]> {
    const key = `bars:${symbol}:${timeframe}`;
    const items = await this.getClient().lrange(key, 0, count - 1);
    return items.map((item) => JSON.parse(item));
  }

  // Strategy state caching
  async cacheStrategyState(strategyId: string, state: unknown, ttlSeconds = 3600): Promise<void> {
    const key = `strategy:${strategyId}:state`;
    await this.getClient().set(key, JSON.stringify(state), { EX: ttlSeconds });
  }

  async getStrategyState(strategyId: string): Promise<unknown | null> {
    const key = `strategy:${strategyId}:state`;
    const value = await this.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  // Session data
  async cacheSession(sessionId: string, data: unknown, ttlSeconds = 86400): Promise<void> {
    const key = `session:${sessionId}`;
    await this.getClient().set(key, JSON.stringify(data), { EX: ttlSeconds });
  }

  async getSession(sessionId: string): Promise<unknown | null> {
    const key = `session:${sessionId}`;
    const value = await this.getClient().get(key);
    return value ? JSON.parse(value) : null;
  }

  // Rate limiting helper
  async incrementCounter(key: string, windowSeconds = 60): Promise<number> {
    const client = this.getClient();
    const exists = await client.exists(key);
    const value = await client.get(key);
    const count = value ? parseInt(value, 10) + 1 : 1;
    await client.set(key, count.toString());
    if (!exists) {
      await client.expire(key, windowSeconds);
    }
    return count;
  }

  // Cache invalidation
  async invalidatePattern(pattern: string): Promise<void> {
    // Note: In production, use SCAN with MATCH
    // For now, simplified approach
    console.log(`Invalidating cache pattern: ${pattern}`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getClient().set("health:check", "1", { EX: 10 });
      const value = await this.getClient().get("health:check");
      return value === "1";
    } catch {
      return false;
    }
  }
}

// In-memory cache fallback when Redis is not available
class InMemoryCache implements RedisClient {
  private data = new Map<string, { value: string; expiry?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    const expiry = options?.EX ? Date.now() + options.EX * 1000 : undefined;
    this.data.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }

  async exists(key: string): Promise<number> {
    const entry = this.data.get(key);
    if (!entry) return 0;
    if (entry.expiry && entry.expiry < Date.now()) {
      this.data.delete(key);
      return 0;
    }
    return 1;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.data.get(key);
    if (entry) {
      entry.expiry = Date.now() + seconds * 1000;
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return keys.map((k) => this.data.get(k)?.value ?? null);
  }

  async mset(entries: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      this.data.set(key, { value });
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key)!.set(field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async lpush(key: string, value: string): Promise<void> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(value);
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) return [];
    return list.slice(start, end + 1);
  }

  async close(): Promise<void> {
    this.data.clear();
    this.hashes.clear();
    this.lists.clear();
  }
}

// Singleton instance
let globalCache: RedisCache | null = null;

export function initializeCache(config: RedisConfig): RedisCache {
  globalCache = new RedisCache(config);
  return globalCache;
}

export function getCache(): RedisCache {
  if (!globalCache) {
    globalCache = new RedisCache({ host: "localhost", port: 6379 });
  }
  return globalCache;
}
