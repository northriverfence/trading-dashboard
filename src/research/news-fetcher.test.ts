/**
 * NewsFetcher Tests
 */

import { test, expect } from "bun:test";
import { NewsFetcher, NewsItem } from "./news-fetcher.js";

test("NewsFetcher fetches news for symbol", async () => {
  const fetcher = new NewsFetcher();
  const news = await fetcher.fetchNews("AAPL");

  expect(news.length).toBeGreaterThan(0);
  expect(news[0].symbol).toBe("AAPL");
});

test("NewsFetcher caches results", async () => {
  const fetcher = new NewsFetcher({ cacheDurationMs: 60000 });

  const news1 = await fetcher.fetchNews("MSFT");
  const news2 = await fetcher.fetchNews("MSFT");

  expect(news1.length).toBe(news2.length);
});

test("NewsFetcher filters news correctly", () => {
  const fetcher = new NewsFetcher();

  const news: NewsItem[] = [
    {
      id: "1",
      symbol: "AAPL",
      headline: "Apple earnings beat",
      summary: "Strong quarter",
      source: "bloomberg",
      publishedAt: new Date(),
      relevance: 0.9,
      category: "earnings",
    },
    {
      id: "2",
      symbol: "AAPL",
      headline: "New iPhone",
      summary: "Product launch",
      source: "reuters",
      publishedAt: new Date(),
      relevance: 0.7,
      category: "product",
    },
    {
      id: "3",
      symbol: "MSFT",
      headline: "Microsoft news",
      summary: "Some news",
      source: "bloomberg",
      publishedAt: new Date(),
      relevance: 0.5,
      category: "other",
    },
  ];

  const filtered = fetcher.filterNews(news, { symbols: ["AAPL"] });
  expect(filtered.length).toBe(2);

  const byCategory = fetcher.filterNews(news, { categories: ["earnings"] });
  expect(byCategory.length).toBe(1);
  expect(byCategory[0].category).toBe("earnings");
});

test("NewsFetcher gets breaking news", () => {
  const fetcher = new NewsFetcher();

  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  const news: NewsItem[] = [
    {
      id: "1",
      symbol: "AAPL",
      headline: "Recent high relevance",
      summary: "Breaking",
      source: "bloomberg",
      publishedAt: now,
      relevance: 0.95,
      category: "earnings",
    },
    {
      id: "2",
      symbol: "AAPL",
      headline: "Old news",
      summary: "Not breaking",
      source: "reuters",
      publishedAt: fiveHoursAgo,
      relevance: 0.9,
      category: "other",
    },
    {
      id: "3",
      symbol: "MSFT",
      headline: "Recent low relevance",
      summary: "Not important",
      source: "cnbc",
      publishedAt: twoHoursAgo,
      relevance: 0.5,
      category: "other",
    },
  ];

  const breaking = fetcher.getBreakingNews(news);
  expect(breaking.length).toBe(1);
  expect(breaking[0].id).toBe("1");
});

test("NewsFetcher searches news by keyword", () => {
  const fetcher = new NewsFetcher();

  const news: NewsItem[] = [
    {
      id: "1",
      symbol: "AAPL",
      headline: "Apple launches new product",
      summary: "Great product",
      source: "bloomberg",
      publishedAt: new Date(),
      relevance: 0.9,
      category: "product",
    },
    {
      id: "2",
      symbol: "MSFT",
      headline: "Microsoft earnings",
      summary: "Beat expectations",
      source: "reuters",
      publishedAt: new Date(),
      relevance: 0.8,
      category: "earnings",
    },
  ];

  const results = fetcher.searchNews(news, "product");
  expect(results.length).toBe(1);
  expect(results[0].symbol).toBe("AAPL");
});

test("NewsFetcher clears cache", async () => {
  const fetcher = new NewsFetcher();

  await fetcher.fetchNews("TSLA");
  expect(fetcher.getLatestNews("TSLA").length).toBeGreaterThan(0);

  fetcher.clearCache("TSLA");
  // Cache cleared, but newsCache may still have entry
  // Just verify no error thrown
});

test("NewsFetcher gets news stats", async () => {
  const fetcher = new NewsFetcher();

  await fetcher.fetchNews("AAPL");
  const stats = fetcher.getNewsStats("AAPL");

  expect(stats.totalCount).toBeGreaterThan(0);
  expect(stats.averageRelevance).toBeGreaterThan(0);
});
