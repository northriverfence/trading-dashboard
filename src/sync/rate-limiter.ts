export interface RateLimitConfig {
  burstLimit: number;
  sustainedLimit: number;
  windowMs: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.burstLimit;
    this.lastRefill = Date.now();
  }

  async tryAcquire(): Promise<boolean> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  async acquire(): Promise<void> {
    while (!(await this.tryAcquire())) {
      const waitMs = this.config.windowMs / this.config.sustainedLimit;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillRate = this.config.sustainedLimit / this.config.windowMs;
    const tokensToAdd = elapsed * refillRate;

    this.tokens = Math.min(this.config.burstLimit, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
