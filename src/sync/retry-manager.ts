export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier?: number;
}

export class RetryManager {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      backoffMultiplier: 2,
      ...config,
    };
  }

  getDelay(retryCount: number): number {
    const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, retryCount);
    return Math.min(delay, this.config.maxDelayMs);
  }

  shouldRetry(retryCount: number): boolean {
    return retryCount < this.config.maxRetries;
  }

  async execute<T>(operation: () => Promise<T>, onRetry?: (attempt: number, error: Error) => void): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          onRetry?.(attempt + 1, lastError);
          const delay = this.getDelay(attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }
}
