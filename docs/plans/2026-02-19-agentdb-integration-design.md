# AgentDB Integration Design

**Date:** 2026-02-19
**Topic:** Comprehensive AgentDB Integration for Stock Trading Agent
**Status:** Approved for Implementation

---

## Executive Summary

This design integrates AgentDB's vector-based memory system across five critical areas of the stock trading agent:

1. **Trade Signal Validation** - Historical validation before execution
2. **Learning System Enhancement** - Hybrid file + AgentDB architecture
3. **Dynamic Risk Adjustment** - Position sizing based on historical patterns
4. **Strategy Selection Intelligence** - Auto-select best strategy for market conditions
5. **Backtest Result Memory** - Compare live trades against simulations

**Architecture Pattern:** Hybrid - AgentDB for fast queries, JSON files for audit trail.

---

## 1. Architecture Overview

### 1.1 Design Philosophy

- **AgentDB** = Fast, intelligent query layer for active decision-making (in-memory, vector search)
- **JSON Files** = Long-term audit trail and data durability (filesystem, human-readable)
- **Sync Manager** = Bidirectional synchronization ensuring consistency

### 1.2 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Trading System                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Trade Signal │◄──►│   AgentDB    │◄──►│   Strategy   │      │
│  │  Validation  │    │   Memory     │    │  Selection   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         ▲                   ▲                   ▲              │
│         └───────────────────┼───────────────────┘              │
│                             │                                  │
│                    ┌────────┴────────┐                         │
│                    │   Sync Manager  │                         │
│                    │  (Bidirectional)│                         │
│                    └────────┬────────┘                         │
│                             │                                  │
│         ┌───────────────────┼───────────────────┐              │
│         ▼                   ▼                   ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Learning   │    │    Risk      │    │  Backtest    │      │
│  │   System     │    │  Adjustment  │    │   Memory     │      │
│  │ (JSON+Agent) │    │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Flow

1. **Trade Execution Flow:**
    - Signal generated → Validate via AgentDB (similar trades) → Risk adjustment → Execute → Store in both systems

2. **Learning Flow:**
    - Trade closes → Analyze pattern → Update AgentDB vectors → Sync to JSON files

3. **Research Flow:**
    - Hourly research cycle → Query AgentDB for patterns → Update strategy selection

---

## 2. Component Specifications

### 2.1 Component A: Trade Signal Validation

**File:** `src/validation/trade-validator.ts`

**Purpose:** Before executing any trade, validate against historical similar setups using AgentDB's vector similarity search.

**Interface:**

```typescript
interface ValidationResult {
    approved: boolean;
    confidence: number;
    similarTrades: TradeMemory[];
    historicalWinRate: number;
    recommendation: "proceed" | "caution" | "avoid";
    reasoning: string;
}

class TradeValidator {
    async validateTrade(signal: TradeSignal): Promise<ValidationResult>;
    private calculateWinRate(trades: TradeMemory[]): number;
}
```

**Decision Logic:**

| Win Rate | Recommendation | Action                    |
| -------- | -------------- | ------------------------- |
| > 60%    | proceed        | Execute normally          |
| 40-60%   | caution        | Execute with reduced size |
| < 40%    | avoid          | Skip trade                |

**Integration Point:**

- Called from `AutonomousTradingAgent.shouldExecuteTrade()`
- Adds validation step before `executeTrade()`

**AgentDB Usage:**

- Uses `tradingDB.findSimilarTrades()` with embedding matching
- Searches top 10 similar historical trades
- Threshold: 0.7 similarity score

---

### 2.2 Component B: Learning System Enhancement

**File:** `src/learning/hybrid-learning-system.ts`

**Purpose:** Create a hybrid learning system that uses AgentDB for intelligent queries while maintaining JSON files for durability.

**Current State:** File-based `TradeLearningSystem` with simple pattern matching
**New State:** Hybrid architecture with bidirectional sync

**Interface:**

```typescript
class HybridLearningSystem {
    // Fast, intelligent queries via AgentDB
    async findSimilarTrades(trade: TradeRecord, k: number): Promise<TradeRecord[]>;
    async getSmartRecommendations(): Promise<string[]>;
    async getPatternAnalysis(pattern: string): Promise<PatternStats>;

    // Durable storage via JSON (existing functionality preserved)
    saveTrade(trade: TradeRecord): void;
    closeTrade(tradeId: string, exitPrice: number): TradeRecord | null;

    // Sync management
    private syncToAgentDB(trade: TradeRecord): Promise<void>;
    private syncFromAgentDB(): Promise<void>;
}
```

**Sync Strategy:**

1. **Write Path:** Every trade saved to JSON → Immediately indexed in AgentDB
2. **Read Path:** Query AgentDB first (fast) → Fall back to JSON if needed
3. **Rebuild:** Can reconstruct AgentDB from JSON files on startup

**Data Consistency:**

- JSON is source of truth for long-term storage
- AgentDB is query layer (can be rebuilt from JSON)
- Sync Manager ensures eventual consistency

---

### 2.3 Component C: Dynamic Risk Adjustment

**File:** `src/risk/dynamic-risk-adjuster.ts`

**Purpose:** Adjust position sizing and stop-loss levels based on historical performance of similar trades.

**Interface:**

```typescript
interface RiskAdjustment {
    positionSizeMultiplier: number; // Range: 0.5 to 2.0
    stopLossMultiplier: number; // Range: 0.8 to 1.5
    confidence: number; // Range: 0 to 1
    reasoning: string;
}

class DynamicRiskAdjuster {
    async adjustRisk(request: TradeRequest): Promise<RiskAdjustment>;
    private calculateHistoricalMetrics(trades: TradeMemory[]): Metrics;
}
```

**Adjustment Rules:**

| Historical Avg PnL | Win Rate | Position Size | Stop Loss | Reasoning                |
| ------------------ | -------- | ------------- | --------- | ------------------------ |
| > $50              | > 60%    | 1.2x          | 1.0x      | High confidence setup    |
| > $20              | 40-60%   | 1.0x          | 1.0x      | Neutral setup            |
| < -$20             | < 40%    | 0.5x          | 0.8x      | Poor setup - reduce risk |
| Any                | < 30%    | 0.0x          | N/A       | Block trade              |

**Integration Point:**

- Called from `RiskOrchestrator.validateTrade()`
- Modifies position size before final approval
- Updates stop-loss levels based on historical volatility

**AgentDB Usage:**

- Queries 20 similar trades for statistical significance
- Calculates win rate, average PnL, drawdown
- Uses embedding-based similarity for pattern matching

---

### 2.4 Component D: Strategy Selection Intelligence

**File:** `src/strategies/intelligent-selector.ts`

**Purpose:** Automatically select the best-performing strategy for current market conditions using AgentDB pattern analysis.

**Interface:**

```typescript
interface StrategyRecommendation {
    strategy: string;
    confidence: number;
    expectedWinRate: number;
    reasoning: string;
}

interface MarketCondition {
    condition: "bullish" | "bearish" | "neutral" | "volatile";
    indicators: { rsi: number; trend: string; volatility: number };
}

class IntelligentStrategySelector {
    async selectStrategy(marketCondition: MarketCondition): Promise<StrategyRecommendation>;
    async getStrategyPerformance(strategy: string): Promise<PerformanceStats>;
    private rankStrategies(patterns: TradingPattern[]): RankedStrategy[];
}
```

**Selection Algorithm:**

1. Query AgentDB for all winning patterns (confidence > 0.3, win rate > 50%)
2. Filter patterns matching current market condition
3. Sort by success rate × occurrence count
4. Return top strategy with confidence score

**Fallback Strategy:**

- If no patterns match current conditions → Default to "breakout"
- If confidence < 0.3 → Reduce position sizes across all strategies

**Integration Point:**

- Called from `AutonomousTradingAgent.adaptStrategy()`
- Runs hourly during market hours
- Updates `state.currentStrategy`

**AgentDB Usage:**

- Uses `tradingDB.getWinningPatterns()`
- Filters by market condition metadata
- Tracks pattern performance over time

---

### 2.5 Component E: Backtest Result Memory

**File:** `src/backtest/backtest-memory.ts`

**Purpose:** Store backtest scenarios in AgentDB to compare live opportunities against historical simulations.

**Interface:**

```typescript
interface BacktestScenario {
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

class BacktestMemory {
    async storeScenario(scenario: BacktestScenario): Promise<void>;
    async findSimilarScenarios(trade: TradeSignal, k: number): Promise<BacktestScenario[]>;
    async getScenarioStats(symbol: string): Promise<ScenarioStats>;
    private generateScenarioEmbedding(scenario: BacktestScenario): number[];
}
```

**Use Cases:**

1. **Pre-trade Validation:** Compare live signal against similar backtest scenarios
2. **Strategy Confidence:** Calculate expected performance based on backtest matches
3. **Scenario Learning:** Update live trade outcomes back to scenario database

**Integration Points:**

- **Store:** Called from backtest engine after each scenario execution
- **Query:** Called from `TradeValidator` during pre-trade validation
- **Update:** Called when live trades close to improve scenario accuracy

**AgentDB Usage:**

- Separate namespace: "backtests"
- Custom embeddings including time and day features
- Filter queries by symbol, strategy, or market condition

---

## 3. Data Model

### 3.1 AgentDB Memory Types

```typescript
// Trade Memory (existing, enhanced)
interface TradeMemory {
    id: string;
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    exitPrice?: number;
    stopLoss: number;
    takeProfit: number;
    shares: number;
    pnl?: number;
    outcome?: "win" | "loss" | "breakeven";
    strategy: string;
    marketCondition: string;
    timeOfDay: number; // NEW
    dayOfWeek: number; // NEW
    volatility: number; // NEW
    reasoning: string;
    mistakes: string[];
    lessons: string[];
    timestamp: number;
}

// Pattern Memory (existing)
interface TradingPattern {
    id: string;
    pattern: string;
    strategy: string;
    marketCondition: string;
    successRate: number;
    avgPnl: number;
    occurrenceCount: number;
    confidence: number;
    lastSeen: number;
}

// Backtest Memory (NEW)
interface BacktestMemory {
    id: string;
    type: "backtest";
    symbol: string;
    strategy: string;
    marketCondition: string;
    features: number[]; // Embedding vector
    simulatedOutcome: "win" | "loss";
    simulatedPnl: number;
    timestamp: number;
}
```

### 3.2 Embedding Strategies

**Trade Embedding (384 dimensions):**

```typescript
function generateTradeEmbedding(trade: TradeMemory): number[] {
    const features = [
        // Price features (normalized)
        trade.entryPrice / 1000,
        trade.stopLoss / 1000,
        trade.takeProfit / 1000,

        // Risk metrics
        (trade.takeProfit - trade.entryPrice) / Math.max(0.01, trade.entryPrice - trade.stopLoss),

        // Position features
        trade.shares / 100,

        // Time features (NEW)
        trade.timeOfDay / 24,
        trade.dayOfWeek / 7,

        // Market features (NEW)
        trade.volatility,

        // Categorical (one-hot encoded)
        trade.strategy === "breakout" ? 1 : 0,
        trade.strategy === "mean_reversion" ? 1 : 0,
        trade.strategy === "trend_following" ? 1 : 0,
        trade.marketCondition === "bullish" ? 1 : 0,
        trade.marketCondition === "bearish" ? 1 : 0,
        trade.marketCondition === "neutral" ? 1 : 0,

        // Outcome (for completed trades)
        trade.outcome === "win" ? 1 : trade.outcome === "loss" ? -1 : 0,
    ];

    // Pad to 384 dimensions
    while (features.length < 384) features.push(0);
    return features.slice(0, 384);
}
```

---

## 4. Integration Points

### 4.1 Existing Code Modifications

#### 4.1.1 AutonomousTradingAgent

**Current:**

```typescript
private async tradingLoop(): Promise<void> {
  const opportunities = await this.scanForOpportunities();
  if (opportunities[0] && this.shouldExecuteTrade(opportunities[0])) {
    await this.executeTrade(opportunities[0]);
  }
}
```

**Enhanced:**

```typescript
private async tradingLoop(): Promise<void> {
  const opportunities = await this.scanForOpportunities();

  for (const opp of opportunities.slice(0, 3)) {
    // NEW: Validate with AgentDB
    const validation = await this.tradeValidator.validateTrade(opp);

    if (validation.recommendation === "avoid") {
      console.log(`Skipping ${opp.symbol}: ${validation.reasoning}`);
      continue;
    }

    // NEW: Adjust risk based on historical patterns
    const riskAdjustment = await this.riskAdjuster.adjustRisk(opp);

    if (this.shouldExecuteTrade(opp, validation, riskAdjustment)) {
      await this.executeTrade(opp, riskAdjustment);
    }
  }
}
```

#### 4.1.2 RiskOrchestrator

**Current:** Validates trades against static risk rules

**Enhanced:** Adds dynamic risk adjustment layer

```typescript
async validateTrade(request: TradeRequest, portfolio: Portfolio): Promise<ValidationResult> {
  // Existing static validation
  const staticValidation = this.runStaticChecks(request, portfolio);
  if (!staticValidation.passed) return { approved: false, ... };

  // NEW: Dynamic adjustment from AgentDB
  const dynamicAdjustment = await this.riskAdjuster.adjustRisk(request);

  return {
    approved: true,
    shares: Math.floor(request.shares * dynamicAdjustment.positionSizeMultiplier),
    stopLevel: {
      stopPrice: request.stopLoss * dynamicAdjustment.stopLossMultiplier,
      ...
    },
    dynamicConfidence: dynamicAdjustment.confidence,
  };
}
```

#### 4.1.3 Learning System Migration

**Current:** File-based only

**Enhanced:** Hybrid with AgentDB

```typescript
// In constructor
constructor() {
  this.fileSystem = new FileLearningSystem();  // Existing
  this.agentDB = new TradingAgentDB();          // NEW
  this.syncManager = new SyncManager(this.fileSystem, this.agentDB);

  // Sync on startup
  this.syncManager.syncAll();
}

// In recordTrade
recordTrade(trade: TradeRecord): TradeRecord {
  // Save to file (existing)
  const saved = this.fileSystem.recordTrade(trade);

  // Index in AgentDB (NEW)
  this.agentDB.storeTrade(saved).catch(err =>
    console.error("AgentDB sync failed:", err)
  );

  return saved;
}
```

---

## 5. Implementation Sequence

### Phase 1: Foundation (Week 1)

1. Create `HybridLearningSystem` with sync layer
2. Implement bidirectional JSON ↔ AgentDB sync
3. Add data migration utility for existing trades

### Phase 2: Core Components (Week 2)

1. Build `TradeValidator` with AgentDB queries
2. Integrate validation into `AutonomousTradingAgent`
3. Add validation results to trade logs

### Phase 3: Risk Intelligence (Week 3)

1. Implement `DynamicRiskAdjuster`
2. Integrate with `RiskOrchestrator`
3. Test position sizing adjustments

### Phase 4: Strategy Intelligence (Week 4)

1. Build `IntelligentStrategySelector`
2. Integrate with `adaptStrategy()` method
3. Add strategy performance tracking

### Phase 5: Backtest Memory (Week 5)

1. Create `BacktestMemory` system
2. Integrate with backtest engine
3. Link backtest results to live validation

### Phase 6: Testing & Optimization (Week 6)

1. Run comprehensive backtests
2. Validate sync consistency
3. Performance optimization

---

## 6. Testing Strategy

### 6.1 Unit Tests

Each component needs:

- AgentDB query accuracy tests
- Sync consistency tests
- Fallback behavior when AgentDB unavailable

### 6.2 Integration Tests

- End-to-end trade flow with validation
- Risk adjustment accuracy
- Strategy selection performance

### 6.3 Backtest Validation

- Compare AgentDB-enhanced vs baseline performance
- Measure improvement in win rate, risk-adjusted returns
- Validate pattern recognition accuracy

---

## 7. Success Metrics

| Metric                       | Baseline | Target | Measurement           |
| ---------------------------- | -------- | ------ | --------------------- |
| Win Rate                     | Current  | +10%   | Backtest comparison   |
| Avg Risk:Reward              | Current  | +0.2R  | Trade analysis        |
| Pattern Recognition Accuracy | N/A      | >70%   | Manual validation     |
| Query Latency                | N/A      | <50ms  | Performance tests     |
| Sync Consistency             | 100%     | 100%   | Data integrity checks |

---

## 8. Risk Mitigation

| Risk               | Mitigation                                              |
| ------------------ | ------------------------------------------------------- |
| AgentDB failure    | Fallback to file-based system                           |
| Data inconsistency | Daily sync validation + rebuild capability              |
| Overfitting        | Minimum sample size (10 trades) before pattern adoption |
| Query latency      | Local caching for frequent queries                      |
| Memory bloat       | Automatic pruning of old memories (configurable)        |

---

## 9. Future Enhancements

1. **Multi-Model Embeddings:** Use different embedding models for different pattern types
2. **Temporal Analysis:** Add time-series pattern detection (seasonality, day-of-week effects)
3. **Cross-Symbol Learning:** Find patterns that work across similar stocks
4. **Market Regime Detection:** Automatically detect and adapt to market regime changes

---

## Appendix: File Structure

```
src/
├── agentdb-integration.ts          # Existing (enhance)
├── learning/
│   ├── hybrid-learning-system.ts   # NEW
│   └── sync-manager.ts             # NEW
├── validation/
│   └── trade-validator.ts          # NEW
├── risk/
│   ├── dynamic-risk-adjuster.ts    # NEW
│   └── orchestrator.ts             # Modify
├── strategies/
│   └── intelligent-selector.ts     # NEW
└── backtest/
    ├── backtest-memory.ts          # NEW
    └── integration.ts              # Modify
```

---

## Sign-off

- **Design Approved:** 2026-02-19
- **Next Step:** Create implementation plan via writing-plans skill
