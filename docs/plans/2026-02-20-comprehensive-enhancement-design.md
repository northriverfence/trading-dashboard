# Comprehensive Stock Trading Agent Enhancement Design

**Date:** 2026-02-20
**Topic:** 8-System Enhancement Package for AgentDB-Integrated Trading Agent
**Status:** Approved for Implementation

---

## Executive Summary

This design implements 8 major enhancement systems for the stock trading agent, organized in dependency order:

1. **Real-Time Sync Optimization** - Foundation layer for reliable data flow
2. **Multi-Model Embeddings** - Strategy-specific vector representations
3. **Automated Pattern Discovery** - Clustering-based pattern detection
4. **Confidence-Weighted Logging** - Intelligent memory management
5. **Intelligent Circuit Breakers** - AgentDB-aware safety systems
6. **Pre-Market Research Automation** - Overnight intelligence gathering
7. **Smart Trade Replay System** - Backtest-live comparison
8. **Performance Monitoring Dashboard** - Real-time visualization

**Total Scope:** ~50 implementation tasks across 26 new modules

---

## Phase 1: Foundation Layer

### 1.1 Real-Time Sync Optimization System

**Purpose:** Reliable, high-performance synchronization between JSON files and AgentDB

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    SyncOptimizer                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  SyncQueue   │→ │ BatchEngine  │→ │ RetryManager │      │
│  │  (in-memory) │  │ (aggregator) │  │ (exponential)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                 ↓                 ↓               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ConflictDetect│  │ RateLimiter  │  │ DeadLetterQ  │      │
│  │ (3-way merge)│  │ (token bucket)│  │ (failures)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| SyncOptimizer | `src/sync/sync-optimizer.ts` | Main orchestrator |
| BatchEngine | `src/sync/batch-engine.ts` | 500ms window aggregation |
| RetryManager | `src/sync/retry-manager.ts` | Exponential backoff (100ms→1.6s, 5 retries) |
| ConflictDetector | `src/sync/conflict-detector.ts` | 3-way merge with timestamp priority |
| RateLimiter | `src/sync/rate-limiter.ts` | Token bucket (10 burst, 5 sustained ops/sec) |
| DeadLetterQueue | `src/sync/dead-letter-queue.ts` | Failed sync persistence |

**Key Interfaces:**
```typescript
interface SyncJob {
  id: string;
  trade: TradeRecord;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
  retryCount: number;
}

interface BatchConfig {
  maxSize: number;        // 10 items
  maxWaitMs: number;      // 500ms
  flushOnError: boolean;  // true
}

class SyncOptimizer {
  queueTrade(trade: TradeRecord, priority?: SyncPriority): Promise<SyncJobId>;
  flushBatch(): Promise<BatchSyncResult>;
  reconcileDivergence(): Promise<ReconciliationReport>;
  getSyncHealth(): SyncHealthMetrics;
  pauseSync(): void;
  resumeSync(): void;
}
```

**Success Metrics:**
- Sync latency < 100ms (p95)
- Zero data loss (all trades synced or in DLQ)
- < 0.1% conflict rate

---

## Phase 2: Intelligence Layer

### 2.1 Multi-Model Embedding System

**Purpose:** Strategy-specific embedding models for better pattern matching

**Registry Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                 EmbeddingRegistry                           │
├─────────────────────────────────────────────────────────────┤
│  Strategy         │  Model           │  Dimensions         │
├─────────────────────────────────────────────────────────────┤
│  breakout         │  PriceActionV1   │  384 (volatility)   │
│  mean_reversion   │  StatisticalV1   │  256 (z-score)      │
│  trend_following  │  MomentumV1      │  512 (ma-cross)     │
│  options_flow     │  UnusualV1       │  128 (volume)       │
│  earnings_play    │  EventV1         │  320 (time-series)  │
│  generic          │  MiniLM-Fallback │  384 (default)      │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| EmbeddingRegistry | `src/ml/embedding-registry.ts` | Model selection & routing |
| PriceActionEmbedder | `src/ml/models/price-action-embedder.ts` | Breakout patterns (volatility features) |
| StatisticalEmbedder | `src/ml/models/statistical-embedder.ts` | Mean reversion (z-score, deviation) |
| MomentumEmbedder | `src/ml/models/momentum-embedder.ts` | Trend following (MA cross, RSI) |
| EmbeddingCache | `src/ml/embedding-cache.ts` | LRU cache (1000 items) |

**Embedding Model Interface:**
```typescript
interface EmbeddingModel {
  readonly name: string;
  readonly dimensions: number;
  readonly strategy: string;

  generate(trade: TradeMemory): number[];
  generateBatch(trades: TradeMemory[]): number[][];
  compare(a: number[], b: number[]): number;  // Cosine similarity
  getFeatureImportance(): FeatureImportance[];
}

class EmbeddingRegistry {
  registerModel(model: EmbeddingModel): void;
  getModel(strategy: string): EmbeddingModel;
  routeAndEmbed(trade: TradeMemory): number[];
  getDefaultModel(): EmbeddingModel;
  listModels(): EmbeddingModel[];
}
```

**Feature Vectors by Strategy:**

**PriceAction (Breakout):**
- Price volatility (ATR/price)
- Volume surge ratio
- Consolidation period
- Breakout strength
- Support/resistance distance

**Statistical (Mean Reversion):**
- Z-score from mean
- Bollinger Band position
- RSI deviation
- Standard deviation
- Mean reversion velocity

**Momentum (Trend Following):**
- Moving average alignment
- RSI trend slope
- MACD histogram
- ADX strength
- Price momentum

---

## Phase 3: Discovery Layer

### 3.1 Automated Pattern Discovery System

**Purpose:** Discover winning patterns using clustering algorithms

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                 PatternDiscoveryEngine                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ TradeCluster │→ │ PatternMiner │→ │ QualityGate  │      │
│  │  (HDBSCAN)   │  │ (association)│  │ (validation) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                 ↓                 ↓               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ NoiseFilter  │  │ EmergingFlag │  │ DeprecateOld │      │
│  │ (outliers)   │  │ (early win)  │  │ (decay old)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| DiscoveryEngine | `src/pattern-discovery/engine.ts` | Main orchestrator |
| HDBSCANClusterer | `src/pattern-discovery/clusterer.ts` | Density-based clustering |
| PatternMiner | `src/pattern-discovery/miner.ts` | Association rule mining |
| QualityGate | `src/pattern-discovery/quality-gate.ts` | Win rate validation |
| EmergingDetector | `src/pattern-discovery/emerging-detector.ts` | Early pattern flags |
| Deprecator | `src/pattern-discovery/deprecator.ts` | Old pattern cleanup |

**Pattern Lifecycle:**
```
Discovered → Validated (10+ trades, >50% win) → Active → Deprecated (<30% over 20 trades)
     ↓
Emerging (5+ trades, 100% win, fast-track)
```

**Key Interfaces:**
```typescript
interface DiscoveredPattern {
  id: string;
  clusterId: number;
  features: PatternFeatures;
  trades: TradeMemory[];
  winRate: number;
  avgPnl: number;
  confidence: number;
  discoveredAt: number;
  status: 'discovered' | 'validated' | 'active' | 'deprecated';
}

interface EmergingPattern {
  id: string;
  pattern: DiscoveredPattern;
  tradesCount: number;
  winRate: number;  // Typically 100% for emerging
  fastTrackEligible: boolean;
}

class PatternDiscoveryEngine {
  discoverPatterns(options?: DiscoveryOptions): Promise<DiscoveredPattern[]>;
  flagEmergingPatterns(): Promise<EmergingPattern[]>;
  validatePattern(patternId: string): Promise<boolean>;
  deprecateStalePatterns(minTrades?: number, minWinRate?: number): Promise<string[]>;
  getClusterVisualization(): ClusterGraph;
  analyzeCluster(clusterId: number): ClusterAnalysis;
}
```

**HDBSCAN Parameters:**
- minClusterSize: 5 trades
- minSamples: 3
- metric: 'euclidean' (embeddings)
- clusterSelectionMethod: 'eom' (excess of mass)

---

## Phase 4: Memory Layer

### 4.1 Confidence-Weighted Logging System

**Purpose:** Intelligent memory management with importance scoring

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                 AdaptiveMemoryManager                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Importance Formula:                                        │
│  I = (win_rate * 0.4) + (pnl_factor * 0.3) +               │
│      (recency * 0.2) + (uniqueness * 0.1)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Compressor  │→ │    Pruner    │→ │   Archiver   │      │
│  │ (deduplicate)│  │ (LRU + score)│  │ (cold store) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Memory Tiers:                                              │
│  Hot: 1000 items (AgentDB) - Fast queries                  │
│  Warm: 10000 items (SQLite) - Recent history               │
│  Cold: Archive files - Long-term storage                   │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| AdaptiveManager | `src/memory/adaptive-manager.ts` | Orchestrator |
| ImportanceScorer | `src/memory/importance-scorer.ts` | Score calculation |
| Compressor | `src/memory/compressor.ts` | Deduplication (0.95 similarity) |
| Pruner | `src/memory/pruner.ts` | LRU + score eviction |
| TieredStorage | `src/memory/tiered-storage.ts` | Hot/Warm/Cold management |
| Archiver | `src/memory/archiver.ts` | Cold storage (S3/local) |

**Importance Scoring:**
```typescript
interface ImportanceWeights {
  winRate: 0.4;
  pnlFactor: 0.3;      // Normalized P&L / max P&L
  recency: 0.2;        // 1 / (days since trade + 1)
  uniqueness: 0.1;     // 1 - max(similarity to other trades)
}

const DEFAULT_IMPORTANCE = {
  win: 0.9,
  loss: 0.3,
  breakeven: 0.5,
};

class AdaptiveMemoryManager {
  calculateImportance(trade: TradeMemory): number;
  compressSimilar(similarityThreshold?: number): Promise<CompressionReport>;
  pruneToTarget(targetSize: number): Promise<PruneReport>;
  promoteToHot(memoryIds: string[]): Promise<void>;
  demoteToWarm(memoryIds: string[]): Promise<void>;
  archiveToCold(memoryIds: string[]): Promise<ArchiveStats>;
  getStorageTiers(): StorageTierStats;
}
```

**Storage Tier Limits:**
- Hot (AgentDB): 1000 items, < 50ms query
- Warm (SQLite): 10000 items, < 200ms query
- Cold (Archive): Unlimited, batch access only

---

## Phase 5: Safety Layer

### 5.1 Intelligent Circuit Breaker System

**Purpose:** AgentDB-aware circuit breakers with dynamic thresholds

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                IntelligentCircuitBreaker                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pre-Market Checks:                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DayOfWeek    │→ │ Volatility   │→ │ Earnings     │      │
│  │ PatternCheck │  │ RegimeCheck  │  │ HistoryCheck │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Dynamic Thresholds:                                        │
│  - Daily loss limit adjusts based on pattern confidence    │
│  - Position sizing auto-reduces when patterns weak         │
│  - Trading halts when AgentDB shows < 30% win rate         │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| IntelligentBreaker | `src/breakers/intelligent-breaker.ts` | Main orchestrator |
| DayPatternChecker | `src/breakers/day-pattern-checker.ts` | Day-of-week analysis |
| RegimeDetector | `src/breakers/regime-detector.ts` | Volatility regime |
| EarningsGuard | `src/breakers/earnings-guard.ts` | Earnings calendar |
| DynamicThresholds | `src/breakers/dynamic-thresholds.ts` | Adaptive limits |

**Dynamic Threshold Formulas:**
```typescript
interface DynamicLimits {
  dailyLossLimit: number;      // Base * confidenceFactor
  maxPositionSize: number;     // Base * patternStrength
  maxTradesPerDay: number;     // Base * winRateFactor
}

class IntelligentCircuitBreaker {
  preMarketCheck(): Promise<PreMarketDecision>;
  checkDayOfWeek(day?: number): Promise<DayPatternStats>;
  checkVolatilityRegime(currentVIX: number): Promise<RegimeAnalysis>;
  checkEarningsCalendar(symbols: string[]): Promise<EarningsAlert[]>;
  calculateDynamicLimits(): DynamicLimits;
  shouldHaltTrading(): Promise<boolean>;
}

interface PreMarketDecision {
  canTrade: boolean;
  confidence: number;
  recommendedStrategy?: string;
  warnings: string[];
}
```

**Circuit Breaker Rules:**
- Halt if day-of-week win rate < 40% over last 20 similar days
- Halt if VIX > 30 and historical win rate < 30% in high-vol
- Reduce position size 50% if earnings within 24hrs
- Daily loss limit = $100 * patternConfidence (range: $50-$150)

---

## Phase 6: Automation Layer

### 6.1 Pre-Market Research Automation

**Purpose:** Overnight intelligence gathering and correlation

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                 PreMarketIntelligence                       │
├─────────────────────────────────────────────────────────────┤
│  Data Sources:                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ NewsAPI      │  │ EarningsCal  │  │ FuturesData  │      │
│  │ (sentiment)  │  │ (estimates)  │  │ (premarket)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                 ↓                 ↓               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Sentiment    │→ │ Correlation  │→ │ Strategy     │      │
│  │ Analyzer     │  │ Engine       │  │ Adjuster     │      │
│  │ (NLP)        │  │ (AgentDB)    │  │ (confidence) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| PreMarketIntel | `src/research/pre-market-intel.ts` | Orchestrator |
| NewsFetcher | `src/research/news-fetcher.ts` | News API (AlphaVantage, NewsAPI) |
| SentimentAnalyzer | `src/research/sentiment-analyzer.ts` | NLP sentiment scoring |
| EarningsCalendar | `src/research/earnings-calendar.ts` | Earnings data (Finnhub) |
| FuturesMonitor | `src/research/futures-monitor.ts` | Pre-market futures |
| CorrelationEngine | `src/research/correlation-engine.ts` | AgentDB pattern correlation |
| StrategyAdjuster | `src/research/strategy-adjuster.ts` | Confidence tuning |

**Key Interfaces:**
```typescript
interface OvernightIntel {
  headlines: Headline[];
  sentiment: SentimentScore;
  earningsToday: Earning[];
  futuresGap: number;
  marketOpenConfidence: number;
}

interface SentimentScore {
  bullish: number;   // 0-1
  bearish: number;   // 0-1
  neutral: number;   // 0-1
  overall: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

interface StrategyAdjustments {
  [strategy: string]: {
    confidenceMultiplier: number;  // 0.5 - 1.5
    reason: string;
  };
}

class PreMarketIntelligence {
  gatherOvernightData(): Promise<OvernightIntel>;
  fetchHeadlines(sources?: string[]): Promise<Headline[]>;
  analyzeSentiment(headlines: string[]): SentimentScore;
  fetchEarnings(date?: string): Promise<Earning[]>;
  fetchFuturesGap(): Promise<number>;
  correlateWithPatterns(): Promise<CorrelationReport>;
  adjustStrategyConfidence(): StrategyAdjustments;
  generateMorningBriefing(): MorningBriefing;
}
```

**Sentiment Analysis Pipeline:**
1. Fetch overnight headlines (4 AM - 9:30 AM ET)
2. Filter finance-related (SPY, QQQ, key stocks)
3. NLP sentiment classification
4. Aggregate by topic (Fed, earnings, geopolitical)
5. Compare to historical sentiment → pattern correlation

**Strategy Confidence Adjustments:**
- Sentiment bullish + breakout strategy → 1.2x confidence
- Sentiment bearish + trend following → 0.8x confidence
- High volatility expected → reduce all confidences by 0.2

---

## Phase 7: Learning Layer

### 7.1 Smart Trade Replay System

**Purpose:** Replay historical setups, compare live vs backtest outcomes

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                   TradeReplayEngine                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Scenario     │→ │ Outcome      │→ │ Prediction   │      │
│  │ Matcher      │  │ Tracker      │  │ Calibrator   │      │
│  │ (find similar│  │ (actual P&L) │  │ (adjust)     │      │
│  │ backtests)   │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Discrepancy Analysis:                                      │
│  - Predicted win rate vs actual                            │
│  - Simulated entry vs actual fill                          │
│  - Backtest slippage vs live slippage                      │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| ReplayEngine | `src/replay/replay-engine.ts` | Orchestrator |
| ScenarioMatcher | `src/replay/scenario-matcher.ts` | Find similar backtests |
| OutcomeTracker | `src/replay/outcome-tracker.ts` | Track actual outcomes |
| PredictionCalibrator | `src/replay/prediction-calibrator.ts` | Adjust predictions |
| SlippageAnalyzer | `src/replay/slippage-analyzer.ts` | Execution comparison |
| DiscrepancyReporter | `src/replay/discrepancy-reporter.ts` | Bias reporting |

**Key Interfaces:**
```typescript
interface MatchedScenario {
  backtestId: string;
  similarity: number;
  backtestOutcome: 'win' | 'loss';
  backtestPnl: number;
  features: ScenarioFeatures;
}

interface Prediction {
  expectedWinRate: number;
  expectedPnl: number;
  confidence: number;
  basedOn: number;  // Number of scenarios
}

interface LiveOutcome {
  tradeId: string;
  actualOutcome: 'win' | 'loss';
  actualPnl: number;
  entrySlippage: number;
  exitSlippage: number;
}

interface CalibrationReport {
  predictionAccuracy: number;
  biasDirection: 'optimistic' | 'pessimistic' | 'neutral';
  recommendedAdjustment: number;
}

class TradeReplayEngine {
  findSimilarScenarios(trade: TradeSignal, k?: number): Promise<MatchedScenario[]>;
  predictOutcome(scenarios: MatchedScenario[]): Prediction;
  recordActualOutcome(tradeId: string, outcome: LiveOutcome): void;
  calibratePredictions(): Promise<CalibrationReport>;
  analyzeSlippage(): SlippageReport;
  getDiscrepancyReport(): DiscrepancyReport;
  suggestBacktestImprovements(): string[];
}
```

**Scenario Matching Criteria:**
- Symbol match (optional)
- Strategy match (required)
- Market condition match (weighted)
- Time of day similarity (±1 hour)
- Price action similarity (correlation > 0.8)

**Prediction Calibration:**
- Track prediction vs actual over rolling 20 trades
- If accuracy < 60%, adjust predictions by bias factor
- Report bias (optimistic/pessimistic) to dashboard

---

## Phase 8: Visibility Layer

### 8.1 Performance Monitoring Dashboard

**Purpose:** Real-time visualization and monitoring

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                 MonitoringDashboard                         │
│                    (Web UI + API)                           │
├─────────────────────────────────────────────────────────────┤
│  Panels:                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Win Rate by  │  │ AgentDB      │  │ Live Trade   │      │
│  │ Strategy     │  │ Health       │  │ Stream       │      │
│  │ (time chart) │  │ (metrics)    │  │ (websocket)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Validation   │  │ Risk Adj.    │  │ Pattern      │      │
│  │ Approval Rate│  │ Impact       │  │ Discovery    │      │
│  │ (gauge)      │  │ (bar chart)  │  │ (alerts)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Real-time WebSocket feeds from agent events                │
└─────────────────────────────────────────────────────────────┘
```

**Components:**

| Component | File | Responsibility |
|-----------|------|----------------|
| DashboardServer | `src/dashboard/server.ts` | Bun.serve() with WebSocket |
| MetricsAPI | `src/dashboard/api/metrics.ts` | REST endpoints |
| WebSocketFeeds | `src/dashboard/websocket/feeds.ts` | Real-time updates |
| UI (HTML) | `src/dashboard/ui/index.html` | Frontend entry |
| ChartComponents | `src/dashboard/ui/components/charts.ts` | Visualization |
| PanelManager | `src/dashboard/ui/components/panels.ts` | Dashboard panels |
| EventAggregator | `src/dashboard/aggregator.ts` | Metrics aggregation |

**API Endpoints:**
```typescript
// REST API
GET /api/metrics/win-rate?strategy=
GET /api/metrics/agentdb-health
GET /api/metrics/validation-stats
GET /api/metrics/risk-adjustment-impact
GET /api/patterns/active
GET /api/patterns/emerging
GET /api/trades/recent?limit=

// WebSocket Events
events: 'trade', 'validation', 'pattern', 'alert', 'heartbeat'
```

**Dashboard Panels:**

**Panel 1: Strategy Performance (Time Series Chart)**
- Win rate by strategy over time
- P&L by strategy
- Sharpe ratio
- Max drawdown

**Panel 2: AgentDB Health (Metrics Grid)**
- Memory count (hot/warm/cold)
- Sync lag (ms)
- Query latency (p50, p95, p99)
- Cache hit rate
- Pattern count by status

**Panel 3: Live Trade Stream (Scrolling Table)**
- Recent trades with validation results
- Color-coded (green=proceed, yellow=caution, red=avoid)
- Risk adjustment applied
- Real-time updates

**Panel 4: Validation Metrics (Gauges)**
- Approval rate
- Recommendation distribution
- Average confidence
- Validation latency

**Panel 5: Risk Adjustment Impact (Bar Chart)**
- Position size changes (up/down)
- Stop loss adjustments
- Rejection reasons

**Panel 6: Pattern Discovery (Alert Feed)**
- New patterns discovered
- Emerging pattern alerts
- Deprecated patterns
- Pattern performance changes

**Key Interfaces:**
```typescript
interface DashboardConfig {
  port: number;           // 3000
  refreshInterval: number; // 5000ms
  wsHeartbeat: number;     // 30000ms
}

class MonitoringDashboard {
  startServer(config: DashboardConfig): void;
  broadcastTrade(trade: TradeRecord): void;
  broadcastValidation(validation: ValidationResult): void;
  broadcastPatternAlert(alert: PatternAlert): void;
  getMetrics(): DashboardMetrics;
  getHealthStatus(): HealthStatus;
}
```

**WebSocket Message Format:**
```typescript
interface TradeEvent {
  type: 'trade';
  timestamp: number;
  data: {
    symbol: string;
    side: string;
    entryPrice: number;
    validation: ValidationResult;
    riskAdjustment: RiskAdjustment;
  };
}

interface ValidationEvent {
  type: 'validation';
  timestamp: number;
  data: {
    totalValidations: number;
    approvalRate: number;
    avgConfidence: number;
  };
}
```

---

## Cross-Cutting Concerns

### Configuration Management

**File:** `src/config/enhancement-config.ts`

```typescript
interface EnhancementConfig {
  sync: SyncConfig;
  embeddings: EmbeddingConfig;
  patternDiscovery: PatternDiscoveryConfig;
  memory: MemoryConfig;
  circuitBreakers: CircuitBreakerConfig;
  preMarket: PreMarketConfig;
  replay: ReplayConfig;
  dashboard: DashboardConfig;
}

export const DEFAULT_ENHANCEMENT_CONFIG: EnhancementConfig = {
  sync: {
    batchSize: 10,
    maxWaitMs: 500,
    maxRetries: 5,
    baseRetryDelayMs: 100,
    rateLimitOpsPerSec: 5,
  },
  embeddings: {
    cacheSize: 1000,
    defaultDimensions: 384,
    models: ['price-action', 'statistical', 'momentum'],
  },
  patternDiscovery: {
    minClusterSize: 5,
    minSamples: 3,
    validationWinRate: 0.5,
    validationMinTrades: 10,
    deprecationWinRate: 0.3,
    deprecationLookback: 20,
  },
  memory: {
    hotTierSize: 1000,
    warmTierSize: 10000,
    importanceWeights: {
      winRate: 0.4,
      pnlFactor: 0.3,
      recency: 0.2,
      uniqueness: 0.1,
    },
    compressionThreshold: 0.95,
  },
  circuitBreakers: {
    enableDayOfWeekCheck: true,
    enableVolatilityCheck: true,
    enableEarningsCheck: true,
    minDayWinRate: 0.4,
    minVolatilityWinRate: 0.3,
    baseDailyLossLimit: 100,
  },
  preMarket: {
    newsSources: ['bloomberg', 'reuters', 'cnbc'],
    sentimentUpdateInterval: 300000, // 5 min
    earningsLookahead: 24, // hours
  },
  replay: {
    similarScenariosCount: 10,
    calibrationWindow: 20,
    slippageThreshold: 0.01,
  },
  dashboard: {
    port: 3000,
    refreshInterval: 5000,
    wsHeartbeat: 30000,
    enableWebSocket: true,
  },
};
```

### Event Bus Integration

All systems publish events to a central event bus for loose coupling:

```typescript
// Event types
type AgentEvent =
  | { type: 'trade.recorded'; trade: TradeRecord }
  | { type: 'trade.validated'; validation: ValidationResult }
  | { type: 'trade.executed'; outcome: TradeOutcome }
  | { type: 'pattern.discovered'; pattern: DiscoveredPattern }
  | { type: 'pattern.deprecated'; patternId: string }
  | { type: 'sync.completed'; stats: SyncStats }
  | { type: 'sync.failed'; error: Error; job: SyncJob }
  | { type: 'memory.pruned'; count: number }
  | { type: 'circuit.breaker.triggered'; reason: string }
  | { type: 'premarket.intel'; intel: OvernightIntel }
  | { type: 'replay.prediction'; prediction: Prediction };

class AgentEventBus {
  publish(event: AgentEvent): void;
  subscribe<T extends AgentEvent['type']>(type: T, handler: Handler): Unsubscribe;
}
```

---

## Success Metrics

### System-Level KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync latency (p95) | < 100ms | SyncOptimizer telemetry |
| Query latency (p95) | < 50ms | AgentDB metrics |
| Pattern discovery rate | 1-2/week | PatternDiscoveryEngine |
| Memory compression ratio | > 20% | AdaptiveMemoryManager |
| Prediction accuracy | > 70% | TradeReplayEngine |
| Dashboard load time | < 2s | Browser timing |
| WebSocket latency | < 100ms | Ping/pong |

### Trading Performance KPIs

| Metric | Target | Source |
|--------|--------|--------|
| Win rate improvement | +10% vs baseline | Trade analysis |
| Risk-adjusted return | +0.2R | Position sizing |
| Validation accuracy | > 80% | Confusion matrix |
| Pattern win rate | > 60% | Pattern statistics |
| Slippage vs backtest | < 1% | Replay analysis |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Task 1.1: SyncOptimizer core
- Task 1.2: BatchEngine
- Task 1.3: RetryManager
- Task 1.4: ConflictDetector
- Task 1.5: RateLimiter
- Task 1.6: DeadLetterQueue

### Phase 2: Intelligence (Week 2)
- Task 2.1: EmbeddingRegistry
- Task 2.2: PriceActionEmbedder
- Task 2.3: StatisticalEmbedder
- Task 2.4: MomentumEmbedder
- Task 2.5: EmbeddingCache
- Task 2.6: Model router integration
- Task 2.7: Fallback chain
- Task 2.8: Feature importance analysis

### Phase 3: Discovery (Week 3)
- Task 3.1: DiscoveryEngine
- Task 3.2: HDBSCANClusterer
- Task 3.3: PatternMiner
- Task 3.4: QualityGate
- Task 3.5: EmergingDetector
- Task 3.6: Deprecator
- Task 3.7: Cluster visualization

### Phase 4: Memory (Week 4)
- Task 4.1: AdaptiveManager
- Task 4.2: ImportanceScorer
- Task 4.3: Compressor
- Task 4.4: Pruner
- Task 4.5: TieredStorage

### Phase 5: Safety (Week 5)
- Task 5.1: IntelligentBreaker
- Task 5.2: DayPatternChecker
- Task 5.3: RegimeDetector
- Task 5.4: EarningsGuard
- Task 5.5: DynamicThresholds

### Phase 6: Automation (Week 6)
- Task 6.1: PreMarketIntel
- Task 6.2: NewsFetcher
- Task 6.3: SentimentAnalyzer
- Task 6.4: EarningsCalendar
- Task 6.5: FuturesMonitor
- Task 6.6: CorrelationEngine

### Phase 7: Learning (Week 7)
- Task 7.1: ReplayEngine
- Task 7.2: ScenarioMatcher
- Task 7.3: OutcomeTracker
- Task 7.4: PredictionCalibrator
- Task 7.5: SlippageAnalyzer

### Phase 8: Visibility (Week 8)
- Task 8.1: DashboardServer
- Task 8.2: MetricsAPI
- Task 8.3: WebSocketFeeds
- Task 8.4: UI components (charts)
- Task 8.5: PanelManager
- Task 8.6: EventAggregator
- Task 8.7: Frontend HTML
- Task 8.8: Real-time feeds

**Total: ~50 implementation tasks over 8 weeks**

---

## Sign-off

- **Design Approved:** 2026-02-20
- **Implementation Approach:** Dependency-ordered phases
- **Next Step:** Create detailed implementation plan via writing-plans skill
