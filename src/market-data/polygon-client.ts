export interface PolygonTickerSnapshot {
  ticker: string;
  todaysChangePerc?: number;
  todaysChange?: number;
  updated?: number;
  day?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  prevDay?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  min?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
}

export interface PolygonNewsArticle {
  id?: string;
  title: string;
  article_url?: string;
  published_utc?: string;
  tickers?: string[];
}

export class PolygonClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.polygon.io";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Missing POLYGON_API_KEY environment variable");
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    url.searchParams.set("apiKey", this.apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Polygon request failed: ${response.status} ${response.statusText} - ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async getGroupedDailyBars(date: string): Promise<Array<{ T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }>> {
    const payload = await this.request<{ results?: Array<{ T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }> }>(
      `/v2/aggs/grouped/locale/us/market/stocks/${date}`,
      { adjusted: true },
    );

    return payload.results ?? [];
  }

  async getSnapshot(symbol: string): Promise<PolygonTickerSnapshot | null> {
    const payload = await this.request<{ ticker?: PolygonTickerSnapshot }>(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`);
    return payload.ticker ?? null;
  }

  async getRecentNews(symbol: string, limit = 3): Promise<PolygonNewsArticle[]> {
    const payload = await this.request<{ results?: PolygonNewsArticle[] }>("/v2/reference/news", {
      ticker: symbol,
      limit,
      order: "desc",
      sort: "published_utc",
    });

    return payload.results ?? [];
  }
}
