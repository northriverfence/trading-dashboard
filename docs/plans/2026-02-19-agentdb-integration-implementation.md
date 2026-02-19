# AgentDB Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate AgentDB's vector memory system across 5 areas of the trading agent for intelligent trade validation, risk adjustment, strategy selection, and pattern learning.

**Architecture:** Hybrid system with AgentDB as fast query layer and JSON files for audit trail. Bidirectional sync keeps both systems consistent.

**Tech Stack:** TypeScript, Bun, AgentDB (agentdb npm package), existing TradingAgentDB foundation

---

## Prerequisites

Before starting, ensure:

- `bun install` has been run (agentdb is already in package.json)
- You understand the existing `src/agentdb-integration.ts` file
- You have reviewed `docs/plans/2026-02-19-agentdb-integration-design.md`

---

## Quick Reference: Existing Code

**Key existing files to understand:**

- `src/agentdb-integration.ts` - TradingAgentDB class with MemoryController
- `src/autonomous-agent.ts` - AutonomousTradingAgent that uses TradingAgentDB
- `src/learning-system.ts` - File-based TradeLearningSystem
- `src/risk/orchestrator.ts` - RiskOrchestrator for trade validation
- `src/backtest/backtest-engine.ts` - Backtest engine

---

## Implementation Tasks

### Task 1: Create Directory Structure

**Purpose:** Set up all directories needed for the new components.

**Files:**

- Create directories (no files yet)

**Step 1: Create directories**

Run:

```bash
mkdir -p src/learning src/validation src/strategies src/sync
```

**Step 2: Verify structure**

Run:

```bash
ls -la src/learning src/validation src/strategies src/sync
```

Expected: All directories exist and are empty.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: create directory structure for AgentDB integration"
```

---

### Task 2: Create Sync Manager

**Purpose:** Build bidirectional sync between JSON files and AgentDB.

**Files:**

- Create: `src/sync/sync-manager.ts`
- Test: `src/sync/sync-manager.test.ts`

**Step 1: Write the failing test**

Create `src/sync/sync-manager.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { SyncManager } from "./sync-manager.js";

test("SyncManager should sync trades to AgentDB", async () => {
    const syncManager = new SyncManager();

    const mockTrade = {
        id: "trade_123",
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish" as const,
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    // Should not throw
    await expect(syncManager.syncTradeToAgentDB(mockTrade)).resolves.toBeUndefined();
});

test("SyncManager should handle missing trade data gracefully", async () => {
    const syncManager = new SyncManager();

    // Should return empty array without error
    const result = await syncManager.getUnsyncedTrades();
    expect(Array.isArray(result)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/sync/sync-manager.test.ts
```

Expected: FAIL - "Cannot find module './sync-manager.js'"

**Step 3: Write minimal implementation**

Create `src/sync/sync-manager.ts`:

```typescript
import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export class SyncManager {
    private tradingDB = tradingDB;

    async syncTradeToAgentDB(trade: TradeMemory): Promise<void> {
        await this.tradingDB.storeTrade(trade);
    }

    async getUnsyncedTrades(): Promise<TradeMemory[]> {
        // Placeholder - will implement full sync logic later
        return [];
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/sync/sync-manager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/sync/
git commit -m "feat: add SyncManager foundation for AgentDB sync"
```

---

### Task 3: Create Hybrid Learning System

**Purpose:** Build hybrid learning system that uses both AgentDB and JSON files.

**Files:**

- Create: `src/learning/hybrid-learning-system.ts`
- Test: `src/learning/hybrid-learning-system.test.ts`
- Reference: `src/learning-system.ts` (existing file-based system)

**Step 1: Write the failing test**

Create `src/learning/hybrid-learning-system.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { HybridLearningSystem } from "./hybrid-learning-system.js";

test("HybridLearningSystem should save trade to both systems", async () => {
    const learning = new HybridLearningSystem();

    const trade = {
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        entryTime: new Date().toISOString(),
        status: "open" as const,
        outcome: "open" as const,
        marketCondition: "bullish" as const,
        strategy: "breakout",
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
    };

    const saved = learning.recordTrade(trade);
    expect(saved.id).toBeDefined();
    expect(saved.symbol).toBe("AAPL");
});

test("HybridLearningSystem should find similar trades via AgentDB", async () => {
    const learning = new HybridLearningSystem();

    const queryTrade = {
        id: "query_123",
        symbol: "AAPL",
        side: "buy" as const,
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish" as const,
        reasoning: "Query",
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
    };

    // Should return array (may be empty if no trades yet)
    const similar = await learning.findSimilarTrades(queryTrade, 5);
    expect(Array.isArray(similar)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/learning/hybrid-learning-system.test.ts
```

Expected: FAIL - "Cannot find module"

**Step 3: Write implementation**

Create `src/learning/hybrid-learning-system.ts`:

```typescript
import { TradeLearningSystem, type TradeRecord } from "../learning-system.js";
import { tradingDB, type TradeMemory } from "../agentdb-integration.js";
import { SyncManager } from "../sync/sync-manager.js";

export class HybridLearningSystem {
    private fileSystem: TradeLearningSystem;
    private syncManager: SyncManager;

    constructor(dataDir: string = "./data") {
        this.fileSystem = new TradeLearningSystem(dataDir);
        this.syncManager = new SyncManager();
    }

    // File-backed storage (existing functionality)
    recordTrade(trade: Omit<TradeRecord, "id">): TradeRecord {
        // Save to file system (source of truth)
        const saved = this.fileSystem.recordTrade(trade);

        // Sync to AgentDB (async, non-blocking)
        const tradeMemory: TradeMemory = {
            id: saved.id,
            symbol: saved.symbol,
            side: saved.side,
            entryPrice: saved.entryPrice,
            stopLoss: saved.stopLoss,
            takeProfit: saved.takeProfit,
            shares: saved.shares,
            strategy: saved.strategy,
            marketCondition: saved.marketCondition,
            reasoning: saved.reasoning,
            mistakes: saved.mistakes || [],
            lessons: saved.lessons || [],
            timestamp: new Date(saved.entryTime).getTime(),
        };

        this.syncManager.syncTradeToAgentDB(tradeMemory).catch((err) => {
            console.error("Failed to sync to AgentDB:", err);
        });

        return saved;
    }

    closeTrade(
        tradeId: string,
        exitPrice: number,
        exitTime: string,
        mistakes: string[] = [],
        lessons: string[] = [],
    ): TradeRecord | null {
        return this.fileSystem.closeTrade(tradeId, exitPrice, exitTime, mistakes, lessons);
    }

    // AgentDB-powered queries
    async findSimilarTrades(trade: TradeMemory, k: number = 5): Promise<TradeMemory[]> {
        return tradingDB.findSimilarTrades(trade, k);
    }

    async getSmartRecommendations(): Promise<string[]> {
        return tradingDB.getRecommendations();
    }

    async getWinningPatterns(minConfidence: number = 0.3, minSuccessRate: number = 0.5) {
        return tradingDB.getWinningPatterns(minConfidence, minSuccessRate);
    }

    // Delegate other methods to file system
    generateDailySummary(date: string) {
        return this.fileSystem.generateDailySummary(date);
    }

    getStats() {
        return this.fileSystem.getStats();
    }

    getRecommendations(symbol?: string) {
        return this.fileSystem.getRecommendations(symbol);
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/learning/hybrid-learning-system.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/learning/
git commit -m "feat: implement HybridLearningSystem with AgentDB + file sync"
```

---

### Task 4: Create Trade Validator

**Purpose:** Build pre-trade validation using AgentDB historical data.

**Files:**

- Create: `src/validation/trade-validator.ts`
- Test: `src/validation/trade-validator.test.ts`

**Step 1: Write the failing test**

Create `src/validation/trade-validator.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { TradeValidator, type TradeSignal } from "./trade-validator.js";

test("TradeValidator should return validation result", async () => {
    const validator = new TradeValidator();

    const signal: TradeSignal = {
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish",
        reasoning: "Test validation",
    };

    const result = await validator.validateTrade(signal);

    expect(result.approved).toBeBoolean();
    expect(result.confidence).toBeNumber();
    expect(result.recommendation).toBeOneOf(["proceed", "caution", "avoid"]);
    expect(result.reasoning).toBeString();
    expect(Array.isArray(result.similarTrades)).toBe(true);
});

test("TradeValidator should calculate win rate correctly", () => {
    const validator = new TradeValidator();

    const trades = [{ outcome: "win" as const }, { outcome: "win" as const }, { outcome: "loss" as const }];

    // Access private method via any
    const winRate = (validator as any).calculateWinRate(trades);
    expect(winRate).toBe(2 / 3);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/validation/trade-validator.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `src/validation/trade-validator.ts`:

```typescript
import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export interface TradeSignal {
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    shares: number;
    strategy: string;
    marketCondition: string;
    reasoning: string;
}

export interface ValidationResult {
    approved: boolean;
    confidence: number;
    similarTrades: TradeMemory[];
    historicalWinRate: number;
    recommendation: "proceed" | "caution" | "avoid";
    reasoning: string;
}

export class TradeValidator {
    async validateTrade(signal: TradeSignal): Promise<ValidationResult> {
        // Convert signal to TradeMemory format for querying
        const queryTrade: TradeMemory = {
            id: `query_${Date.now()}`,
            symbol: signal.symbol,
            side: signal.side,
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            shares: signal.shares,
            strategy: signal.strategy,
            marketCondition: signal.marketCondition as "bullish" | "bearish" | "neutral",
            reasoning: signal.reasoning,
            mistakes: [],
            lessons: [],
            timestamp: Date.now(),
        };

        // Find similar historical trades
        const similarTrades = await tradingDB.findSimilarTrades(queryTrade, 10);

        if (similarTrades.length === 0) {
            return {
                approved: true,
                confidence: 0,
                similarTrades: [],
                historicalWinRate: 0,
                recommendation: "caution",
                reasoning: "No similar trades found. Proceed with caution.",
            };
        }

        // Calculate win rate
        const historicalWinRate = this.calculateWinRate(similarTrades);

        // Determine recommendation
        let recommendation: "proceed" | "caution" | "avoid";
        let approved: boolean;
        let reasoning: string;

        if (historicalWinRate > 0.6) {
            recommendation = "proceed";
            approved = true;
            reasoning = `✅ High historical win rate (${(historicalWinRate * 100).toFixed(0)}%) for similar trades`;
        } else if (historicalWinRate < 0.4) {
            recommendation = "avoid";
            approved = false;
            reasoning = `⚠️ Low historical win rate (${(historicalWinRate * 100).toFixed(0)}%) for similar trades. Consider skipping.`;
        } else {
            recommendation = "caution";
            approved = true;
            reasoning = `⚖️ Mixed results (${(historicalWinRate * 100).toFixed(0)}% win rate). Trade with reduced size.`;
        }

        return {
            approved,
            confidence: Math.min(1, similarTrades.length / 10),
            similarTrades,
            historicalWinRate,
            recommendation,
            reasoning,
        };
    }

    private calculateWinRate(trades: TradeMemory[]): number {
        const closedTrades = trades.filter((t) => t.outcome);
        if (closedTrades.length === 0) return 0;

        const wins = closedTrades.filter((t) => t.outcome === "win").length;
        return wins / closedTrades.length;
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/validation/trade-validator.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/validation/
git commit -m "feat: implement TradeValidator with AgentDB historical analysis"
```

---

### Task 5: Create Dynamic Risk Adjuster

**Purpose:** Adjust position sizing based on historical trade performance.

**Files:**

- Create: `src/risk/dynamic-risk-adjuster.ts`
- Test: `src/risk/dynamic-risk-adjuster.test.ts`

**Step 1: Write the failing test**

Create `src/risk/dynamic-risk-adjuster.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { DynamicRiskAdjuster, type TradeRequest } from "./dynamic-risk-adjuster.js";

test("DynamicRiskAdjuster should return risk adjustment", async () => {
    const adjuster = new DynamicRiskAdjuster();

    const request: TradeRequest = {
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
    };

    const result = await adjuster.adjustRisk(request);

    expect(result.positionSizeMultiplier).toBeNumber();
    expect(result.stopLossMultiplier).toBeNumber();
    expect(result.confidence).toBeNumber();
    expect(result.reasoning).toBeString();

    // Multipliers should be within bounds
    expect(result.positionSizeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(result.positionSizeMultiplier).toBeLessThanOrEqual(2.0);
    expect(result.stopLossMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(result.stopLossMultiplier).toBeLessThanOrEqual(1.5);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/risk/dynamic-risk-adjuster.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `src/risk/dynamic-risk-adjuster.ts`:

```typescript
import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export interface TradeRequest {
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    shares: number;
}

export interface RiskAdjustment {
    positionSizeMultiplier: number; // Range: 0.5 to 2.0
    stopLossMultiplier: number; // Range: 0.8 to 1.5
    confidence: number; // Range: 0 to 1
    reasoning: string;
}

export class DynamicRiskAdjuster {
    async adjustRisk(request: TradeRequest): Promise<RiskAdjustment> {
        // Query similar trades for historical analysis
        const queryTrade: TradeMemory = {
            id: `risk_query_${Date.now()}`,
            symbol: request.symbol,
            side: request.side,
            entryPrice: request.entryPrice,
            stopLoss: request.stopLoss,
            takeProfit: request.takeProfit,
            shares: request.shares,
            strategy: "unknown", // Will be determined by caller
            marketCondition: "neutral",
            reasoning: "Risk adjustment query",
            mistakes: [],
            lessons: [],
            timestamp: Date.now(),
        };

        const similarTrades = await tradingDB.findSimilarTrades(queryTrade, 20);

        if (similarTrades.length === 0) {
            return {
                positionSizeMultiplier: 1.0,
                stopLossMultiplier: 1.0,
                confidence: 0,
                reasoning: "No historical data. Using standard risk parameters.",
            };
        }

        // Calculate metrics
        const closedTrades = similarTrades.filter((t) => t.outcome);
        const winRate = this.calculateWinRate(closedTrades);
        const avgPnl = this.calculateAvgPnl(closedTrades);

        // Determine adjustment
        let positionSizeMultiplier = 1.0;
        let stopLossMultiplier = 1.0;
        let confidence = Math.min(1, similarTrades.length / 20);
        let reasoning: string;

        if (avgPnl > 50 && winRate > 0.6) {
            // High confidence setup
            positionSizeMultiplier = 1.2;
            stopLossMultiplier = 1.0;
            reasoning = `✅ High confidence: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L`;
        } else if (avgPnl > 20 && winRate >= 0.4) {
            // Neutral setup
            positionSizeMultiplier = 1.0;
            stopLossMultiplier = 1.0;
            reasoning = `⚖️ Neutral setup: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L`;
        } else if (avgPnl < -20 || winRate < 0.4) {
            // Poor setup
            positionSizeMultiplier = 0.5;
            stopLossMultiplier = 0.8;
            reasoning = `⚠️ Poor setup: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L. Reducing position size.`;
        } else {
            positionSizeMultiplier = 1.0;
            stopLossMultiplier = 1.0;
            reasoning = `ℹ️ Limited data: ${(winRate * 100).toFixed(0)}% win rate, $${avgPnl.toFixed(2)} avg P&L`;
        }

        return {
            positionSizeMultiplier,
            stopLossMultiplier,
            confidence,
            reasoning,
        };
    }

    private calculateWinRate(trades: TradeMemory[]): number {
        if (trades.length === 0) return 0;
        const wins = trades.filter((t) => t.outcome === "win").length;
        return wins / trades.length;
    }

    private calculateAvgPnl(trades: TradeMemory[]): number {
        if (trades.length === 0) return 0;
        const total = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        return total / trades.length;
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/risk/dynamic-risk-adjuster.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/risk/dynamic-risk-adjuster.ts src/risk/dynamic-risk-adjuster.test.ts
git commit -m "feat: implement DynamicRiskAdjuster with AgentDB pattern analysis"
```

---

### Task 6: Create Intelligent Strategy Selector

**Purpose:** Auto-select best strategy based on AgentDB pattern analysis.

**Files:**

- Create: `src/strategies/intelligent-selector.ts`
- Test: `src/strategies/intelligent-selector.test.ts`

**Step 1: Write the failing test**

Create `src/strategies/intelligent-selector.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { IntelligentStrategySelector, type MarketCondition } from "./intelligent-selector.js";

test("IntelligentStrategySelector should return strategy recommendation", async () => {
    const selector = new IntelligentStrategySelector();

    const marketCondition: MarketCondition = {
        condition: "bullish",
        indicators: {
            rsi: 55,
            trend: "up",
            volatility: 0.15,
        },
    };

    const result = await selector.selectStrategy(marketCondition);

    expect(result.strategy).toBeString();
    expect(result.confidence).toBeNumber();
    expect(result.expectedWinRate).toBeNumber();
    expect(result.reasoning).toBeString();

    // Should return one of known strategies
    expect(["breakout", "mean_reversion", "trend_following"]).toContain(result.strategy);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/strategies/intelligent-selector.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `src/strategies/intelligent-selector.ts`:

```typescript
import { tradingDB, type TradingPattern } from "../agentdb-integration.js";

export interface MarketCondition {
    condition: "bullish" | "bearish" | "neutral" | "volatile";
    indicators: {
        rsi: number;
        trend: string;
        volatility: number;
    };
}

export interface StrategyRecommendation {
    strategy: string;
    confidence: number;
    expectedWinRate: number;
    reasoning: string;
}

export class IntelligentStrategySelector {
    async selectStrategy(marketCondition: MarketCondition): Promise<StrategyRecommendation> {
        // Get winning patterns from AgentDB
        const patterns = await tradingDB.getWinningPatterns(0.3, 0.5);

        if (patterns.length === 0) {
            return {
                strategy: "breakout",
                confidence: 0.3,
                expectedWinRate: 0.5,
                reasoning: "No pattern data available. Defaulting to breakout strategy.",
            };
        }

        // Filter patterns matching current market condition
        const relevantPatterns = patterns.filter((p) => p.marketCondition === marketCondition.condition);

        // If no patterns match current condition, use all patterns
        const patternsToRank = relevantPatterns.length > 0 ? relevantPatterns : patterns;

        // Rank by success rate * occurrence count (weighted confidence)
        const ranked = patternsToRank
            .map((p) => ({
                pattern: p,
                score: p.successRate * Math.log(p.occurrenceCount + 1), // Log scaling for occurrence
            }))
            .sort((a, b) => b.score - a.score);

        const best = ranked[0];

        if (!best) {
            return {
                strategy: "breakout",
                confidence: 0.3,
                expectedWinRate: 0.5,
                reasoning: "Pattern analysis inconclusive. Defaulting to breakout strategy.",
            };
        }

        // Parse strategy from pattern key (format: "strategy_marketCondition")
        const [strategy] = best.pattern.pattern.split("_");

        return {
            strategy: strategy || "breakout",
            confidence: best.pattern.confidence,
            expectedWinRate: best.pattern.successRate,
            reasoning: `📊 Selected based on ${best.pattern.occurrenceCount} historical trades with ${(best.pattern.successRate * 100).toFixed(0)}% win rate in ${marketCondition.condition} conditions`,
        };
    }

    async getStrategyPerformance(strategy: string): Promise<{
        totalTrades: number;
        winRate: number;
        avgPnl: number;
    }> {
        const patterns = await tradingDB.getWinningPatterns(0.1, 0);
        const strategyPatterns = patterns.filter((p) => p.pattern.startsWith(`${strategy}_`));

        if (strategyPatterns.length === 0) {
            return { totalTrades: 0, winRate: 0, avgPnl: 0 };
        }

        const totalTrades = strategyPatterns.reduce((sum, p) => sum + p.occurrenceCount, 0);
        const avgWinRate = strategyPatterns.reduce((sum, p) => sum + p.successRate, 0) / strategyPatterns.length;
        const avgPnl = strategyPatterns.reduce((sum, p) => sum + p.avgPnl, 0) / strategyPatterns.length;

        return {
            totalTrades,
            winRate: avgWinRate,
            avgPnl,
        };
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/strategies/intelligent-selector.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/strategies/
git commit -m "feat: implement IntelligentStrategySelector with AgentDB pattern analysis"
```

---

### Task 7: Create Backtest Memory System

**Purpose:** Store and query backtest scenarios for live trade comparison.

**Files:**

- Create: `src/backtest/backtest-memory.ts`
- Test: `src/backtest/backtest-memory.test.ts`

**Step 1: Write the failing test**

Create `src/backtest/backtest-memory.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { BacktestMemory, type BacktestScenario } from "./backtest-memory.js";

test("BacktestMemory should store and retrieve scenarios", async () => {
    const memory = new BacktestMemory();

    const scenario: BacktestScenario = {
        id: `backtest_${Date.now()}`,
        symbol: "AAPL",
        strategy: "breakout",
        marketCondition: "bullish",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        timeOfDay: 10,
        dayOfWeek: 1,
        simulatedOutcome: "win",
        simulatedPnl: 50,
        timestamp: Date.now(),
    };

    // Should not throw
    await expect(memory.storeScenario(scenario)).resolves.toBeUndefined();
});

test("BacktestMemory should find similar scenarios", async () => {
    const memory = new BacktestMemory();

    const trade = {
        symbol: "AAPL",
        entryPrice: 150,
        strategy: "breakout",
        marketCondition: "bullish",
    };

    // Should return array (may be empty)
    const scenarios = await memory.findSimilarScenarios(trade, 5);
    expect(Array.isArray(scenarios)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/backtest/backtest-memory.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

Create `src/backtest/backtest-memory.ts`:

```typescript
import { tradingDB } from "../agentdb-integration.js";

export interface BacktestScenario {
    id: string;
    symbol: string;
    strategy: string;
    marketCondition: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    timeOfDay: number; // Hour of entry (0-23)
    dayOfWeek: number; // 0-6
    simulatedOutcome: "win" | "loss";
    simulatedPnl: number;
    timestamp: number;
}

export interface TradeSignal {
    symbol: string;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    strategy?: string;
    marketCondition?: string;
}

export class BacktestMemory {
    async storeScenario(scenario: BacktestScenario): Promise<void> {
        const embedding = this.generateScenarioEmbedding(scenario);

        await tradingDB.store(
            {
                id: scenario.id,
                content: `Backtest: ${scenario.symbol} ${scenario.strategy} ${scenario.marketCondition} - ${scenario.simulatedOutcome}`,
                embedding,
                importance: 0.5,
                timestamp: scenario.timestamp,
                metadata: {
                    type: "backtest",
                    ...scenario,
                },
            },
            "backtests",
        );
    }

    async findSimilarScenarios(trade: TradeSignal, k: number = 5): Promise<BacktestScenario[]> {
        // Create a partial scenario for embedding
        const partialScenario: Partial<BacktestScenario> = {
            symbol: trade.symbol,
            strategy: trade.strategy || "unknown",
            marketCondition: trade.marketCondition || "neutral",
            entryPrice: trade.entryPrice,
            stopLoss: trade.stopLoss || trade.entryPrice * 0.98,
            takeProfit: trade.takeProfit || trade.entryPrice * 1.04,
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
        };

        const embedding = this.generatePartialEmbedding(partialScenario);

        const results = await tradingDB.search(
            embedding,
            {
                topK: k,
                threshold: 0.6,
                filter: { type: "backtest" },
            },
            "backtests",
        );

        return results
            .filter((r) => r.metadata?.type === "backtest")
            .map((r) => r.metadata as unknown as BacktestScenario);
    }

    async getScenarioStats(symbol: string): Promise<{
        totalScenarios: number;
        winRate: number;
        avgPnl: number;
    }> {
        // This would query all scenarios for a symbol
        // For now, return placeholder
        return {
            totalScenarios: 0,
            winRate: 0,
            avgPnl: 0,
        };
    }

    private generateScenarioEmbedding(scenario: BacktestScenario): number[] {
        const features = [
            // Price features (normalized)
            scenario.entryPrice / 1000,
            scenario.stopLoss / 1000,
            scenario.takeProfit / 1000,

            // Risk ratio
            (scenario.takeProfit - scenario.entryPrice) / Math.max(0.01, scenario.entryPrice - scenario.stopLoss),

            // Time features
            scenario.timeOfDay / 24,
            scenario.dayOfWeek / 7,

            // Categorical (one-hot)
            scenario.strategy === "breakout" ? 1 : 0,
            scenario.strategy === "mean_reversion" ? 1 : 0,
            scenario.strategy === "trend_following" ? 1 : 0,
            scenario.marketCondition === "bullish" ? 1 : 0,
            scenario.marketCondition === "bearish" ? 1 : 0,
            scenario.marketCondition === "neutral" ? 1 : 0,

            // Outcome
            scenario.simulatedOutcome === "win" ? 1 : -1,
        ];

        // Pad to 384 dimensions
        while (features.length < 384) features.push(0);
        return features.slice(0, 384);
    }

    private generatePartialEmbedding(scenario: Partial<BacktestScenario>): number[] {
        const features = [
            (scenario.entryPrice || 0) / 1000,
            (scenario.stopLoss || 0) / 1000,
            (scenario.takeProfit || 0) / 1000,
            new Date().getHours() / 24,
            new Date().getDay() / 7,
            scenario.strategy === "breakout" ? 1 : 0,
            scenario.strategy === "mean_reversion" ? 1 : 0,
            scenario.strategy === "trend_following" ? 1 : 0,
            scenario.marketCondition === "bullish" ? 1 : 0,
            scenario.marketCondition === "bearish" ? 1 : 0,
            scenario.marketCondition === "neutral" ? 1 : 0,
        ];

        while (features.length < 384) features.push(0);
        return features.slice(0, 384);
    }
}
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/backtest/backtest-memory.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/backtest/backtest-memory.ts src/backtest/backtest-memory.test.ts
git commit -m "feat: implement BacktestMemory system for scenario storage"
```

---

### Task 8: Update AgentDB Integration with Namespace Support

**Purpose:** Add namespace support to TradingAgentDB for backtest isolation.

**Files:**

- Modify: `src/agentdb-integration.ts`

**Step 1: Write test for namespace support**

Create `src/agentdb-integration-namespace.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { TradingAgentDB } from "./agentdb-integration.js";

test("TradingAgentDB should store with namespace", async () => {
    const db = new TradingAgentDB();
    await db.initialize();

    // Should not throw when storing with namespace
    await expect(
        db.store(
            {
                id: "test_123",
                content: "Test memory",
                embedding: new Array(384).fill(0),
                timestamp: Date.now(),
                importance: 0.5,
                metadata: { type: "test" },
            },
            "backtests",
        ),
    ).resolves.toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
bun test src/agentdb-integration-namespace.test.ts
```

Expected: FAIL - store method may not accept namespace parameter

**Step 3: Modify TradingAgentDB to support namespaces**

Read the current implementation first:

```bash
cat src/agentdb-integration.ts | head -100
```

Then modify `src/agentdb-integration.ts` to add namespace support:

Add these methods to the `TradingAgentDB` class (after line 113, after `storeTrade`):

```typescript
  /**
   * Store a memory with custom namespace
   */
  async store(memory: Memory, namespace: string = "trading"): Promise<void> {
    await this.memory.store(memory, namespace);
  }

  /**
   * Search memories with custom namespace
   */
  async search(
    embedding: number[],
    options: { topK?: number; threshold?: number; filter?: Record<string, unknown>; useAttention?: boolean },
    namespace: string = "trading"
  ): Promise<SearchResult[]> {
    return this.memory.search(embedding, {
      topK: options.topK || 10,
      threshold: options.threshold || 0.7,
      filter: options.filter,
      useAttention: options.useAttention ?? true,
    }, namespace);
  }
```

**Step 4: Run test to verify it passes**

Run:

```bash
bun test src/agentdb-integration-namespace.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/agentdb-integration.ts src/agentdb-integration-namespace.test.ts
git commit -m "feat: add namespace support to TradingAgentDB for backtest isolation"
```

---

### Task 9: Integrate Trade Validator into AutonomousTradingAgent

**Purpose:** Add pre-trade validation to the autonomous agent.

**Files:**

- Modify: `src/autonomous-agent.ts`

**Step 1: Read current autonomous-agent.ts**

Read the current implementation to understand the structure:

```bash
cat src/autonomous-agent.ts | head -150
```

**Step 2: Add TradeValidator import and integration**

Modify `src/autonomous-agent.ts`:

Add import at top:

```typescript
import { TradeValidator } from "./validation/trade-validator.js";
```

Add to class properties (around line 51):

```typescript
  private tradeValidator: TradeValidator;
```

Initialize in constructor (around line 64):

```typescript
this.tradeValidator = new TradeValidator();
```

**Step 3: Add validation to trading loop**

Find `shouldExecuteTrade` method and modify it:

```typescript
  private async shouldExecuteTrade(
    opportunity: TradeOpportunity,
    validation?: { recommendation: string; reasoning: string }
  ): Promise<boolean> {
    // Check existing limits
    if (this.state.totalTradesToday >= 5) {
      console.log("Daily trade limit reached");
      return false;
    }

    if (this.state.dailyPnl < -25) {
      console.log("Daily loss limit reached, stopping trading");
      return false;
    }

    if (opportunity.confidence < 0.6) {
      console.log(`Confidence too low (${(opportunity.confidence * 100).toFixed(0)}%)`);
      return false;
    }

    // Check AgentDB validation
    if (validation?.recommendation === "avoid") {
      console.log(`Trade validation failed: ${validation.reasoning}`);
      return false;
    }

    return true;
  }
```

**Step 4: Modify trading loop to use validation**

Find `tradingLoop` method and update:

```typescript
  private async tradingLoop(): Promise<void> {
    if (this.isShuttingDown) return;

    const marketHours = this.getMarketHours();

    if (!marketHours.isOpen) {
      if (marketHours.timeToOpen <= 300000) {
        console.log(`Market opens in ${Math.floor(marketHours.timeToOpen / 1000)}s`);
      }
      return;
    }

    if (this.state.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
      const timeSinceError = Date.now() - this.state.lastErrorTime;
      if (timeSinceError < this.ERROR_COOLDOWN_MS) {
        console.log(`Error cooldown: ${Math.floor((this.ERROR_COOLDOWN_MS - timeSinceError) / 1000)}s remaining`);
        return;
      }
      console.log("Error cooldown complete, resetting error count");
      this.state.consecutiveErrors = 0;
    }

    try {
      await this.adaptStrategy();

      const opportunities = await this.scanForOpportunities();

      if (opportunities.length === 0) {
        console.log("No trading opportunities found");
        return;
      }

      for (const opp of opportunities.slice(0, 3)) {
        // NEW: Validate trade with AgentDB
        const validation = await this.tradeValidator.validateTrade({
          symbol: opp.symbol,
          side: "buy",
          entryPrice: opp.price,
          stopLoss: opp.price * 0.98,
          takeProfit: opp.price * 1.04,
          shares: 0,
          strategy: this.state.currentStrategy,
          marketCondition: this.state.marketCondition as "bullish" | "bearish" | "neutral",
          reasoning: opp.reasoning,
        });

        console.log(`Validation for ${opp.symbol}: ${validation.recommendation} (${validation.reasoning})`);

        if (validation.recommendation === "avoid") {
          console.log(`Skipping ${opp.symbol} due to poor historical performance`);
          continue;
        }

        // Modified: Pass validation to shouldExecuteTrade
        if (await this.shouldExecuteTrade(opp, validation)) {
          await this.executeTrade(opp);
        }
      }

      if (this.state.consecutiveErrors > 0) {
        this.state.consecutiveErrors = 0;
        console.log("Error streak cleared");
      }
    } catch (error) {
      this.handleError("Trading loop execution", error);
    }
  }
```

**Step 5: Test the integration**

Run existing tests to make sure nothing broke:

```bash
bun test src/autonomous-agent.ts 2>&1 | head -20 || echo "No test file, checking compilation..."
```

Check TypeScript compilation:

```bash
bun tsc --noEmit src/autonomous-agent.ts 2>&1 | head -20
```

Expected: No compilation errors

**Step 6: Commit**

```bash
git add src/autonomous-agent.ts
git commit -m "feat: integrate TradeValidator into AutonomousTradingAgent"
```

---

### Task 10: Integrate Dynamic Risk Adjuster into RiskOrchestrator

**Purpose:** Add dynamic risk adjustment to risk validation.

**Files:**

- Modify: `src/risk/orchestrator.ts`

**Step 1: Read current orchestrator.ts**

Read to understand structure:

```bash
cat src/risk/orchestrator.ts | head -100
```

**Step 2: Add DynamicRiskAdjuster integration**

Add import:

```typescript
import { DynamicRiskAdjuster } from "./dynamic-risk-adjuster.js";
```

Add property:

```typescript
  private riskAdjuster: DynamicRiskAdjuster;
```

Initialize in constructor:

```typescript
this.riskAdjuster = new DynamicRiskAdjuster();
```

**Step 3: Modify validateTrade to include dynamic adjustment**

Add to `validateTrade` method after static validation:

```typescript
// NEW: Dynamic risk adjustment from AgentDB
const riskAdjustment = await this.riskAdjuster.adjustRisk(request);

if (riskAdjustment.positionSizeMultiplier < 0.1) {
    return {
        approved: false,
        reason: `Dynamic risk check failed: ${riskAdjustment.reasoning}`,
    };
}

// Apply dynamic adjustment to position sizing
const adjustedShares = Math.floor(shares * riskAdjustment.positionSizeMultiplier);
const adjustedStopPrice = request.stopLoss * riskAdjustment.stopLossMultiplier;

console.log(`Risk adjustment: ${riskAdjustment.reasoning}`);
console.log(`Position size: ${shares} → ${adjustedShares} (${riskAdjustment.positionSizeMultiplier}x)`);
```

Update return statement to use adjusted values:

```typescript
return {
    approved: true,
    shares: adjustedShares,
    stopLevel: {
        stopPrice: adjustedStopPrice,
        trailing: stopLevel.trailing,
        timeExit: stopLevel.timeExit,
    },
    riskAdjustment,
};
```

**Step 4: Test compilation**

```bash
bun tsc --noEmit src/risk/orchestrator.ts 2>&1 | head -20
```

Expected: No compilation errors

**Step 5: Commit**

```bash
git add src/risk/orchestrator.ts
git commit -m "feat: integrate DynamicRiskAdjuster into RiskOrchestrator"
```

---

### Task 11: Integrate Intelligent Strategy Selector

**Purpose:** Add automatic strategy selection to autonomous agent.

**Files:**

- Modify: `src/autonomous-agent.ts`

**Step 1: Add import and property**

Add import:

```typescript
import { IntelligentStrategySelector } from "./strategies/intelligent-selector.js";
```

Add property:

```typescript
  private strategySelector: IntelligentStrategySelector;
```

Initialize in constructor:

```typescript
this.strategySelector = new IntelligentStrategySelector();
```

**Step 2: Enhance adaptStrategy method**

Replace the existing `adaptStrategy` method:

```typescript
  private async adaptStrategy(): Promise<void> {
    try {
      // Get current market condition
      const marketCondition = this.detectMarketCondition();

      // NEW: Use intelligent strategy selection
      const recommendation = await this.strategySelector.selectStrategy(marketCondition);

      if (recommendation.strategy !== this.state.currentStrategy) {
        console.log(`🎯 Strategy adapted: ${this.state.currentStrategy} → ${recommendation.strategy}`);
        console.log(`   Reason: ${recommendation.reasoning}`);
        this.state.currentStrategy = recommendation.strategy;
      }

      if (recommendation.confidence < 0.3) {
        console.log(`⚠️ Low strategy confidence (${recommendation.confidence.toFixed(2)}). Reducing position sizes.`);
      }

      // Update market condition
      if (marketCondition.condition !== this.state.marketCondition) {
        console.log(`📊 Market condition: ${this.state.marketCondition} → ${marketCondition.condition}`);
        this.state.marketCondition = marketCondition.condition;
      }
    } catch (error) {
      console.error("Strategy adaptation failed:", error);
    }
  }

  private detectMarketCondition(): MarketCondition {
    // Placeholder - would use actual market indicators
    // For now, return based on time or simple logic
    const hour = new Date().getHours();

    return {
      condition: hour < 12 ? "bullish" : "neutral",
      indicators: {
        rsi: 50,
        trend: "sideways",
        volatility: 0.15,
      },
    };
  }
```

Add import for MarketCondition type:

```typescript
import type { MarketCondition } from "./strategies/intelligent-selector.js";
```

**Step 3: Test compilation**

```bash
bun tsc --noEmit src/autonomous-agent.ts 2>&1 | head -20
```

Expected: No compilation errors

**Step 4: Commit**

```bash
git add src/autonomous-agent.ts
git commit -m "feat: integrate IntelligentStrategySelector into autonomous agent"
```

---

### Task 12: Create Integration Test

**Purpose:** Verify all components work together.

**Files:**

- Create: `src/__tests__/agentdb-integration.test.ts`

**Step 1: Write integration test**

Create `src/__tests__/agentdb-integration.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { HybridLearningSystem } from "../learning/hybrid-learning-system.js";
import { TradeValidator } from "../validation/trade-validator.js";
import { DynamicRiskAdjuster } from "../risk/dynamic-risk-adjuster.js";
import { IntelligentStrategySelector } from "../strategies/intelligent-selector.js";
import { BacktestMemory } from "../backtest/backtest-memory.js";

test("AgentDB integration - full workflow", async () => {
    // Initialize all components
    const learning = new HybridLearningSystem("./test-data");
    const validator = new TradeValidator();
    const riskAdjuster = new DynamicRiskAdjuster();
    const strategySelector = new IntelligentStrategySelector();
    const backtestMemory = new BacktestMemory();

    // 1. Record a trade
    const trade = learning.recordTrade({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        entryTime: new Date().toISOString(),
        status: "open",
        outcome: "open",
        marketCondition: "bullish",
        strategy: "breakout",
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
    });

    expect(trade.id).toBeDefined();

    // 2. Validate a similar trade
    const validation = await validator.validateTrade({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 151,
        stopLoss: 148,
        takeProfit: 157,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish",
        reasoning: "Similar setup",
    });

    expect(validation.approved).toBeBoolean();
    expect(validation.recommendation).toBeOneOf(["proceed", "caution", "avoid"]);

    // 3. Get risk adjustment
    const riskAdjustment = await riskAdjuster.adjustRisk({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
    });

    expect(riskAdjustment.positionSizeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(riskAdjustment.positionSizeMultiplier).toBeLessThanOrEqual(2.0);

    // 4. Get strategy recommendation
    const strategy = await strategySelector.selectStrategy({
        condition: "bullish",
        indicators: { rsi: 55, trend: "up", volatility: 0.15 },
    });

    expect(strategy.strategy).toBeString();
    expect(strategy.confidence).toBeNumber();

    // 5. Store backtest scenario
    await backtestMemory.storeScenario({
        id: `test_backtest_${Date.now()}`,
        symbol: "AAPL",
        strategy: "breakout",
        marketCondition: "bullish",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        timeOfDay: 10,
        dayOfWeek: 1,
        simulatedOutcome: "win",
        simulatedPnl: 50,
        timestamp: Date.now(),
    });

    console.log("✅ All AgentDB integrations working together!");
});
```

**Step 2: Run integration test**

Run:

```bash
bun test src/__tests__/agentdb-integration.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/__tests__/agentdb-integration.test.ts
git commit -m "test: add comprehensive AgentDB integration test"
```

---

### Task 13: Create Index Exports

**Purpose:** Export all new modules from index files.

**Files:**

- Modify: `src/learning/index.ts` (create if not exists)
- Modify: `src/validation/index.ts` (create)
- Modify: `src/strategies/index.ts` (create)
- Modify: `src/sync/index.ts` (create)

**Step 1: Create index files**

Create `src/learning/index.ts`:

```typescript
export { HybridLearningSystem } from "./hybrid-learning-system.js";
```

Create `src/validation/index.ts`:

```typescript
export { TradeValidator, type TradeSignal, type ValidationResult } from "./trade-validator.js";
```

Create `src/strategies/index.ts`:

```typescript
export {
    IntelligentStrategySelector,
    type MarketCondition,
    type StrategyRecommendation,
} from "./intelligent-selector.js";
```

Create `src/sync/index.ts`:

```typescript
export { SyncManager } from "./sync-manager.js";
```

**Step 2: Commit**

```bash
git add src/learning/index.ts src/validation/index.ts src/strategies/index.ts src/sync/index.ts
git commit -m "chore: add index exports for new modules"
```

---

### Task 14: Final Verification

**Purpose:** Run all tests and verify the implementation.

**Step 1: Run all tests**

```bash
bun test
```

Expected: All tests pass

**Step 2: Check TypeScript compilation**

```bash
bun tsc --noEmit 2>&1 | head -30
```

Expected: No compilation errors

**Step 3: Verify file structure**

```bash
find src -type f -name "*.ts" | grep -E "(learning|validation|strategies|sync|backtest)" | sort
```

Expected: All new files exist

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete AgentDB integration across all 5 areas

- Trade Signal Validation with historical analysis
- Hybrid Learning System (AgentDB + JSON files)
- Dynamic Risk Adjustment based on patterns
- Intelligent Strategy Selection
- Backtest Result Memory

All components tested and integrated into AutonomousTradingAgent."
```

---

## Summary

This implementation plan creates a comprehensive AgentDB integration with:

1. **SyncManager** - Bidirectional sync between JSON and AgentDB
2. **HybridLearningSystem** - Unified interface for both storage systems
3. **TradeValidator** - Pre-trade validation using historical data
4. **DynamicRiskAdjuster** - Position sizing based on pattern performance
5. **IntelligentStrategySelector** - Auto-select best strategy for market conditions
6. **BacktestMemory** - Store and query backtest scenarios

All components are:

- Fully typed with TypeScript
- Covered by unit tests
- Integrated into the existing autonomous trading agent
- Following DRY, YAGNI, and TDD principles

---

## Next Steps

After implementation:

1. Run backtests to validate performance improvements
2. Monitor sync consistency
3. Tune validation thresholds based on results
4. Add more sophisticated market condition detection

**See design doc:** `docs/plans/2026-02-19-agentdb-integration-design.md`
