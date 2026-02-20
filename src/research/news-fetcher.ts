/**
 * NewsFetcher
 * Fetches news from various APIs and sources
 */

export interface NewsItem {
  id: string;
  symbol: string;
  headline: string;
  summary: string;
  source: string;
  url?: string;
  publishedAt: Date;
  sentiment?: "positive" | "negative" | "neutral";
  relevance: number; // 0-1
  category: "earnings" | "product" | "legal" | "management" | "economic" | "other";
}

export interface NewsFilter {
  symbols?: string[];
  sources?: string[];
  categories?: NewsItem["category"][];
  minRelevance?: number;
  since?: Date;
  until?: Date;
}

export interface NewsFetcherConfig {
  apiKey?: string;
  maxResults: number;
  cacheDurationMs: number;
  sources: string[];
}

export class NewsFetcher {
  private config: NewsFetcherConfig;
  private newsCache: Map<string, NewsItem[]> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();

  constructor(config?: Partial<NewsFetcherConfig>) {
    this.config = {
      maxResults: 50,
      cacheDurationMs: 300000, // 5 minutes
      sources: ["bloomberg", "reuters", "cnbc", "wsj"],
      ...config,
    };
  }

  /**
   * Fetch news for specific symbol
   */
  async fetchNews(symbol: string): Promise<NewsItem[]> {
    // Check cache first
    const cached = this.getFromCache(symbol);
    if (cached) return cached;

    // Mock implementation - in production, would call actual API
    const news = this.mockFetchNews(symbol);
    this.setCache(symbol, news);
    return news;
  }

  /**
   * Fetch news for multiple symbols
   */
  async fetchBatchNews(symbols: string[]): Promise<Map<string, NewsItem[]>> {
    const results = new Map<string, NewsItem[]>();

    for (const symbol of symbols) {
      const news = await this.fetchNews(symbol);
      results.set(symbol, news);
    }

    return results;
  }

  /**
   * Filter news items
   */
  filterNews(news: NewsItem[], filter: NewsFilter): NewsItem[] {
    return news.filter(item => {
      if (filter.symbols?.length && !filter.symbols.includes(item.symbol)) return false;
      if (filter.sources?.length && !filter.sources.includes(item.source)) return false;
      if (filter.categories?.length && !filter.categories.includes(item.category)) return false;
      if (filter.minRelevance && item.relevance < filter.minRelevance) return false;
      if (filter.since && item.publishedAt < filter.since) return false;
      if (filter.until && item.publishedAt > filter.until) return false;
      return true;
    });
  }

  /**
   * Get breaking news (high relevance, recent)
   */
  getBreakingNews(news: NewsItem[]): NewsItem[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 4); // Last 4 hours

    return news
      .filter(n => n.relevance > 0.8 && n.publishedAt >= cutoff)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }

  /**
   * Get news by category
   */
  getNewsByCategory(news: NewsItem[], category: NewsItem["category"]): NewsItem[] {
    return news.filter(n => n.category === category);
  }

  /**
   * Get latest news for symbol
   */
  getLatestNews(symbol: string, limit: number = 5): NewsItem[] {
    const cached = this.newsCache.get(symbol) || [];
    return cached
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Clear cache for symbol
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.newsCache.delete(symbol);
      this.cacheTimestamp.delete(symbol);
    } else {
      this.newsCache.clear();
      this.cacheTimestamp.clear();
    }
  }

  /**
   * Search news by keyword
   */
  searchNews(news: NewsItem[], keyword: string): NewsItem[] {
    const lower = keyword.toLowerCase();
    return news.filter(
      n =>
        n.headline.toLowerCase().includes(lower) ||
        n.summary.toLowerCase().includes(lower),
    );
  }

  private getFromCache(symbol: string): NewsItem[] | null {
    const timestamp = this.cacheTimestamp.get(symbol);
    if (!timestamp) return null;

    if (Date.now() - timestamp > this.config.cacheDurationMs) {
      this.clearCache(symbol);
      return null;
    }

    return this.newsCache.get(symbol) || null;
  }

  private setCache(symbol: string, news: NewsItem[]): void {
    this.newsCache.set(symbol, news);
    this.cacheTimestamp.set(symbol, Date.now());
  }

  private mockFetchNews(symbol: string): NewsItem[] {
    // Mock data for testing
    return [
      {
        id: `${symbol}-1`,
        symbol,
        headline: `${symbol} reports strong quarterly earnings`,
        summary: `${symbol} beat analyst expectations with revenue up 20% YoY`,
        source: "bloomberg",
        publishedAt: new Date(),
        relevance: 0.9,
        category: "earnings",
      },
      {
        id: `${symbol}-2`,
        symbol,
        headline: `${symbol} announces new product launch`,
        summary: `Upcoming product expected to drive growth in Q3`,
        source: "reuters",
        publishedAt: new Date(Date.now() - 3600000),
        relevance: 0.7,
        category: "product",
      },
    ];
  }

  /**
   * Get news statistics
   */
  getNewsStats(symbol: string): {
    totalCount: number;
    byCategory: Record<NewsItem["category"], number>;
    averageRelevance: number;
    latestTimestamp: Date | null;
  } {
    const news = this.newsCache.get(symbol) || [];

    const byCategory: Record<NewsItem["category"], number> = {
      earnings: 0,
      product: 0,
      legal: 0,
      management: 0,
      economic: 0,
      other: 0,
    };

    for (const item of news) {
      byCategory[item.category]++;
    }

    const averageRelevance = news.length > 0
      ? news.reduce((sum, n) => sum + n.relevance, 0) / news.length
      : 0;

    const latestTimestamp = news.length > 0
      ? news.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())[0].publishedAt
      : null;

    return {
      totalCount: news.length,
      byCategory,
      averageRelevance,
      latestTimestamp,
    };
  }
}
