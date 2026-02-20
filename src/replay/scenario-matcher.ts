/**
 * ScenarioMatcher
 * Matches current market scenarios to historical patterns
 */

export interface MarketScenario {
  id: string;
  timestamp: Date;
  volatility: number;
  trend: "up" | "down" | "sideways";
  volumeProfile: "low" | "normal" | "high";
  marketPhase: "accumulation" | "markup" | "distribution" | "markdown";
  keyLevels: {
    support: number;
    resistance: number;
    pivot: number;
  };
}

export interface ScenarioMatch {
  current: MarketScenario;
  historical: MarketScenario;
  similarity: number; // 0-1
  outcomes: {
    direction: "up" | "down" | "neutral";
    magnitude: number;
    probability: number;
  }[];
}

export interface ScenarioLibrary {
  scenarios: MarketScenario[];
  outcomes: Map<string, { direction: string; magnitude: number; timeToOutcome: number }[]>;
}

export class ScenarioMatcher {
  private scenarioLibrary: ScenarioLibrary = {
    scenarios: [],
    outcomes: new Map(),
  };
  private currentScenario: MarketScenario | null = null;

  /**
   * Add historical scenario with outcomes
   */
  addHistoricalScenario(
    scenario: MarketScenario,
    outcomes: { direction: string; magnitude: number; timeToOutcome: number }[]
  ): void {
    this.scenarioLibrary.scenarios.push(scenario);
    this.scenarioLibrary.outcomes.set(scenario.id, outcomes);
  }

  /**
   * Set current market scenario
   */
  setCurrentScenario(scenario: MarketScenario): void {
    this.currentScenario = scenario;
  }

  /**
   * Find matching historical scenarios
   */
  findMatches(minSimilarity: number = 0.7): ScenarioMatch[] {
    if (!this.currentScenario) return [];

    const matches: ScenarioMatch[] = [];

    for (const historical of this.scenarioLibrary.scenarios) {
      const similarity = this.calculateSimilarity(this.currentScenario, historical);

      if (similarity >= minSimilarity) {
        const outcomes = this.scenarioLibrary.outcomes.get(historical.id) || [];
        const aggregatedOutcomes = this.aggregateOutcomes(outcomes);

        matches.push({
          current: this.currentScenario,
          historical,
          similarity,
          outcomes: aggregatedOutcomes,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get predicted outcomes based on matches
   */
  getPredictedOutcome(): {
    direction: "up" | "down" | "neutral";
    confidence: number;
    expectedMagnitude: number;
    timeframe: string;
  } | null {
    const matches = this.findMatches(0.6);
    if (matches.length === 0) return null;

    // Weight by similarity
    let upWeight = 0;
    let downWeight = 0;
    let neutralWeight = 0;
    let totalMagnitude = 0;
    let totalWeight = 0;

    for (const match of matches.slice(0, 5)) { // Top 5 matches
      for (const outcome of match.outcomes) {
        const weight = match.similarity * outcome.probability;
        totalWeight += weight;
        totalMagnitude += outcome.magnitude * weight;

        if (outcome.direction === "up") upWeight += weight;
        else if (outcome.direction === "down") downWeight += weight;
        else neutralWeight += weight;
      }
    }

    if (totalWeight === 0) return null;

    // Determine direction
    let direction: "up" | "down" | "neutral" = "neutral";
    let maxWeight = neutralWeight;

    if (upWeight > maxWeight) {
      direction = "up";
      maxWeight = upWeight;
    }
    if (downWeight > maxWeight) {
      direction = "down";
      maxWeight = downWeight;
    }

    const confidence = maxWeight / totalWeight;
    const expectedMagnitude = totalMagnitude / totalWeight;

    return {
      direction,
      confidence,
      expectedMagnitude,
      timeframe: "1-5 days",
    };
  }

  /**
   * Compare current scenario to specific historical
   */
  compareScenario(historicalId: string): {
    similarity: number;
    differences: string[];
    similarities: string[];
  } | null {
    if (!this.currentScenario) return null;

    const historical = this.scenarioLibrary.scenarios.find(s => s.id === historicalId);
    if (!historical) return null;

    const similarities: string[] = [];
    const differences: string[] = [];

    if (this.currentScenario.trend === historical.trend) {
      similarities.push(`Both in ${historical.trend} trend`);
    } else {
      differences.push(`Trend differs: current ${this.currentScenario.trend} vs historical ${historical.trend}`);
    }

    if (this.currentScenario.volumeProfile === historical.volumeProfile) {
      similarities.push(`Similar volume profile: ${historical.volumeProfile}`);
    } else {
      differences.push(`Volume differs: current ${this.currentScenario.volumeProfile} vs historical ${historical.volumeProfile}`);
    }

    if (Math.abs(this.currentScenario.volatility - historical.volatility) < 0.01) {
      similarities.push("Similar volatility levels");
    } else {
      differences.push(`Volatility differs: ${(this.currentScenario.volatility * 100).toFixed(1)}% vs ${(historical.volatility * 100).toFixed(1)}%`);
    }

    const similarity = this.calculateSimilarity(this.currentScenario, historical);

    return { similarity, differences, similarities };
  }

  /**
   * Get scenario statistics
   */
  getStatistics(): {
    totalScenarios: number;
    outcomesTracked: number;
    avgSimilarity: number;
    topMatches: ScenarioMatch[];
  } {
    const matches = this.currentScenario ? this.findMatches(0.5) : [];
    const avgSimilarity = matches.length > 0
      ? matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
      : 0;

    return {
      totalScenarios: this.scenarioLibrary.scenarios.length,
      outcomesTracked: this.scenarioLibrary.outcomes.size,
      avgSimilarity,
      topMatches: matches.slice(0, 3),
    };
  }

  /**
   * Clear library
   */
  clear(): void {
    this.scenarioLibrary.scenarios = [];
    this.scenarioLibrary.outcomes.clear();
    this.currentScenario = null;
  }

  /**
   * Export library
   */
  exportLibrary(): ScenarioLibrary {
    return {
      scenarios: [...this.scenarioLibrary.scenarios],
      outcomes: new Map(this.scenarioLibrary.outcomes),
    };
  }

  /**
   * Import library
   */
  importLibrary(library: ScenarioLibrary): void {
    this.scenarioLibrary = library;
  }

  private calculateSimilarity(s1: MarketScenario, s2: MarketScenario): number {
    let score = 0;
    let weights = 0;

    // Trend match (weight: 0.3)
    if (s1.trend === s2.trend) {
      score += 0.3;
    }
    weights += 0.3;

    // Volume profile match (weight: 0.2)
    if (s1.volumeProfile === s2.volumeProfile) {
      score += 0.2;
    }
    weights += 0.2;

    // Market phase match (weight: 0.2)
    if (s1.marketPhase === s2.marketPhase) {
      score += 0.2;
    }
    weights += 0.2;

    // Volatility similarity (weight: 0.3)
    const volDiff = Math.abs(s1.volatility - s2.volatility);
    const volSimilarity = Math.max(0, 1 - volDiff / 0.05);
    score += volSimilarity * 0.3;
    weights += 0.3;

    return weights > 0 ? score / weights : 0;
  }

  private aggregateOutcomes(
    outcomes: { direction: string; magnitude: number; timeToOutcome: number }[]
  ): { direction: "up" | "down" | "neutral"; magnitude: number; probability: number }[] {
    const counts: Record<string, { count: number; totalMagnitude: number }> = {
      up: { count: 0, totalMagnitude: 0 },
      down: { count: 0, totalMagnitude: 0 },
      neutral: { count: 0, totalMagnitude: 0 },
    };

    for (const outcome of outcomes) {
      const dir = outcome.direction.toLowerCase();
      if (counts[dir]) {
        counts[dir].count++;
        counts[dir].totalMagnitude += outcome.magnitude;
      }
    }

    const total = outcomes.length;
    const aggregated: { direction: "up" | "down" | "neutral"; magnitude: number; probability: number }[] = [];

    for (const [direction, data] of Object.entries(counts)) {
      if (data.count > 0) {
        aggregated.push({
          direction: direction as "up" | "down" | "neutral",
          magnitude: data.totalMagnitude / data.count,
          probability: data.count / total,
        });
      }
    }

    return aggregated.sort((a, b) => b.probability - a.probability);
  }
}
