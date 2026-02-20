/**
 * SentimentAnalyzer
 * Analyzes sentiment of news and social media
 */

export interface SentimentResult {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1
  confidence: number; // 0 to 1
  label: "positive" | "negative" | "neutral";
  aspects: AspectSentiment[];
}

export interface AspectSentiment {
  aspect: string;
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
}

export interface SentimentTimeSeries {
  timestamp: Date;
  score: number;
  volume: number;
}

export interface AggregateSentiment {
  symbol: string;
  overallScore: number;
  trend: "improving" | "declining" | "stable";
  volume: number;
  timeSeries: SentimentTimeSeries[];
  summary: string;
}

export class SentimentAnalyzer {
  private sentimentHistory: Map<string, SentimentTimeSeries[]> = new Map();
  private readonly maxHistory = 100;

  /**
   * Analyze text sentiment
   */
  analyzeText(text: string): SentimentResult {
    // Simple keyword-based analysis (in production, use ML model)
    const positiveWords = ["beat", "exceeds", "growth", "strong", "profit", "gain", "rise", "surge", "bullish", "outperform"];
    const negativeWords = ["miss", "decline", "loss", "weak", "fall", "drop", "bearish", "underperform", "cut", "layoff"];

    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (lowerText.includes(word)) positiveCount++;
    }

    for (const word of negativeWords) {
      if (lowerText.includes(word)) negativeCount++;
    }

    const total = positiveCount + negativeCount;
    let score = 0;
    if (total > 0) {
      score = (positiveCount - negativeCount) / total;
    }

    const magnitude = Math.min(1, total / 5);
    const confidence = Math.min(1, total / 3);

    let label: "positive" | "negative" | "neutral" = "neutral";
    if (score > 0.2) label = "positive";
    else if (score < -0.2) label = "negative";

    return {
      score,
      magnitude,
      confidence,
      label,
      aspects: this.extractAspects(lowerText),
    };
  }

  /**
   * Analyze sentiment for a symbol
   */
  analyzeSymbol(symbol: string, texts: string[]): AggregateSentiment {
    const results = texts.map(t => this.analyzeText(t));

    const validResults = results.filter(r => r.confidence > 0.3);
    const overallScore = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length
      : 0;

    const timestamp = new Date();
    const volume = texts.length;

    // Update history
    if (!this.sentimentHistory.has(symbol)) {
      this.sentimentHistory.set(symbol, []);
    }

    const history = this.sentimentHistory.get(symbol)!;
    history.push({ timestamp, score: overallScore, volume });

    if (history.length > this.maxHistory) {
      history.shift();
    }

    const trend = this.calculateTrend(history);
    const summary = this.generateSummary(overallScore, trend, volume);

    return {
      symbol,
      overallScore,
      trend,
      volume,
      timeSeries: [...history],
      summary,
    };
  }

  /**
   * Get sentiment trend for symbol
   */
  getSentimentTrend(symbol: string): "improving" | "declining" | "stable" {
    const history = this.sentimentHistory.get(symbol) || [];
    return this.calculateTrend(history);
  }

  /**
   * Get latest sentiment score
   */
  getLatestSentiment(symbol: string): number {
    const history = this.sentimentHistory.get(symbol) || [];
    if (history.length === 0) return 0;
    return history[history.length - 1].score;
  }

  /**
   * Compare sentiment across symbols
   */
  compareSentiments(symbols: string[]): { symbol: string; score: number; rank: number }[] {
    const results = symbols.map(symbol => ({
      symbol,
      score: this.getLatestSentiment(symbol),
    }));

    results.sort((a, b) => b.score - a.score);

    return results.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /**
   * Detect sentiment shifts
   */
  detectSentimentShifts(symbol: string): {
    shifted: boolean;
    direction: "positive" | "negative" | "none";
    magnitude: number;
  } {
    const history = this.sentimentHistory.get(symbol) || [];
    if (history.length < 5) {
      return { shifted: false, direction: "none", magnitude: 0 };
    }

    const recent = history.slice(-3);
    const previous = history.slice(-6, -3);

    const recentAvg = recent.reduce((s, h) => s + h.score, 0) / recent.length;
    const previousAvg = previous.reduce((s, h) => s + h.score, 0) / previous.length;

    const change = recentAvg - previousAvg;
    const shifted = Math.abs(change) > 0.3;

    let direction: "positive" | "negative" | "none" = "none";
    if (change > 0.3) direction = "positive";
    else if (change < -0.3) direction = "negative";

    return {
      shifted,
      direction,
      magnitude: Math.abs(change),
    };
  }

  /**
   * Clear sentiment history
   */
  clearHistory(symbol?: string): void {
    if (symbol) {
      this.sentimentHistory.delete(symbol);
    } else {
      this.sentimentHistory.clear();
    }
  }

  private extractAspects(text: string): AspectSentiment[] {
    const aspects: AspectSentiment[] = [];
    const aspectsKeywords = [
      { aspect: "earnings", keywords: ["earnings", "revenue", "profit", "eps"] },
      { aspect: "guidance", keywords: ["guidance", "outlook", "forecast", "expect"] },
      { aspect: "management", keywords: ["ceo", "cfo", "executive", "management"] },
      { aspect: "product", keywords: ["product", "launch", "release", "update"] },
    ];

    for (const { aspect, keywords } of aspectsKeywords) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          // Simple sentiment for aspect
          const positive = ["beat", "exceeds", "strong", "growth"].some(w => text.includes(w));
          const negative = ["miss", "decline", "weak", "cut"].some(w => text.includes(w));

          const sentiment = positive ? "positive" : negative ? "negative" : "neutral";
          aspects.push({ aspect, sentiment, confidence: 0.6 });
          break;
        }
      }
    }

    return aspects;
  }

  private calculateTrend(history: SentimentTimeSeries[]): "improving" | "declining" | "stable" {
    if (history.length < 3) return "stable";

    const recent = history.slice(-3);
    const first = recent[0].score;
    const last = recent[recent.length - 1].score;
    const change = last - first;

    if (change > 0.2) return "improving";
    if (change < -0.2) return "declining";
    return "stable";
  }

  private generateSummary(score: number, trend: string, volume: number): string {
    const sentiment = score > 0.2 ? "positive" : score < -0.2 ? "negative" : "neutral";
    const trendDesc = trend === "improving" ? "improving" : trend === "declining" ? "declining" : "stable";

    return `${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} sentiment (${(score * 100).toFixed(0)}%) with ${trendDesc} trend. ${volume} mentions analyzed.`;
  }
}
