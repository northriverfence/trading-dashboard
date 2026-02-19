# Risk Management Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a modular Risk Management Layer with four independent modules (Position Sizing, Portfolio Controls, Circuit Breakers, Stop Management) that coordinate through a RiskOrchestrator to protect trading capital.

**Architecture:** Modular architecture with 16 independent components (4 per module) coordinated by a central RiskOrchestrator. Each component is independently configurable and testable. PostgreSQL persistence for audit trails and circuit breaker events.

**Tech Stack:** TypeScript, Bun runtime, PostgreSQL, Kubernetes, AgentDB

---

## Project Structure

```
src/
├── risk/
│   ├── types.ts                          # Core interfaces
│   ├── orchestrator.ts                   # RiskOrchestrator
│   ├── config.ts                         # Configuration management
│   ├── database.ts                       # PostgreSQL persistence
│   ├── sizing/
│   │   ├── base-sizer.ts                 # Abstract base class
│   │   ├── fixed-fractional-sizer.ts
│   │   ├── kelly-criterion-sizer.ts
│   │   ├── volatility-adjusted-sizer.ts
│   │   └── atr-sizer.ts
│   ├── portfolio/
│   │   ├── base-analyzer.ts              # Abstract base class
│   │   ├── correlation-analyzer.ts
│   │   ├── sector-exposure-limiter.ts
│   │   ├── portfolio-heat-monitor.ts
│   │   └── concentration-risk-checker.ts
│   ├── breakers/
│   │   ├── base-breaker.ts               # Abstract base class
│   │   ├── daily-loss-limiter.ts
│   │   ├── consecutive-loss-halt.ts
│   │   ├── drawdown-reducer.ts
│   │   └── volatility-breaker.ts
│   └── stops/
│       ├── base-stop.ts                  # Abstract base class
│       ├── trailing-stop-engine.ts
│       ├── volatility-based-stop.ts
│       ├── time-based-exit.ts
│       └── atr-stop.ts
├── __tests__/
│   └── risk/
│       ├── sizing/
│       │   ├── fixed-fractional-sizer.test.ts
│       │   ├── kelly-criterion-sizer.test.ts
│       │   ├── volatility-adjusted-sizer.test.ts
│       │   └── atr-sizer.test.ts
│       ├── portfolio/
│       │   ├── correlation-analyzer.test.ts
│       │   ├── sector-exposure-limiter.test.ts
│       │   ├── portfolio-heat-monitor.test.ts
│       │   └── concentration-risk-checker.test.ts
│       ├── breakers/
│       │   ├── daily-loss-limiter.test.ts
│       │   ├── consecutive-loss-halt.test.ts
│       │   ├── drawdown-reducer.test.ts
│       │   └── volatility-breaker.test.ts
│       ├── stops/
│       │   ├── trailing-stop-engine.test.ts
│       │   ├── volatility-based-stop.test.ts
│       │   ├── time-based-exit.test.ts
│       │   └── atr-stop.test.ts
│       └── orchestrator.test.ts
└── config/
    └── risk-config.yaml

database/
└── migrations/
    ├── 001_create_risk_tables.sql
    └── 002_create_risk_indexes.sql

k8s/
├── risk-management-deployment.yaml
├── risk-management-service.yaml
└── risk-management-configmap.yaml
```

---

## Phase 1: Foundation (Interfaces and Types)

### Task 1.1: Create Core Risk Types Interface

**File**: `src/risk/types.ts`
**Time**: 3 minutes
**Command**: `bun test src/__tests__/risk/types.test.ts`

**Step 1: Write the interface definitions**

```typescript
/**
 * Risk Management Types
 * Core interfaces for the Risk Management Layer
 */

export interface Position {
    symbol: string;
    qty: number;
    entryPrice: number;
    currentPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    entryTime: Date;
    sector?: string;
    unrealizedPnl: number;
}

export interface Portfolio {
    cash: number;
    positions: Position[];
    totalValue: number;
    dailyPnl: number;
    totalPnl: number;
}

export interface TradeRequest {
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence: number;
    strategy: string;
}

export interface SizingResult {
    shares: number;
    positionValue: number;
    riskAmount: number;
    riskPercent: number;
    rejected: boolean;
    rejectionReason?: string;
}

export interface PortfolioCheckResult {
    allowed: boolean;
    reason?: string;
    adjustedSize?: number;
    riskContribution: number;
}

export interface CircuitBreakerResult {
    halted: boolean;
    haltReason?: string;
    resumeTime?: Date;
    cooldownMinutes?: number;
    reductionFactor?: number;
}

export interface StopLevel {
    stopPrice: number;
    stopType: "fixed" | "trailing" | "atr" | "volatility" | "time";
    activationPrice?: number;
    expiresAt?: Date;
}

export interface RiskCheck {
    id: string;
    timestamp: Date;
    type: "sizing" | "portfolio" | "circuit_breaker" | "stop";
    symbol?: string;
    passed: boolean;
    details: Record<string, unknown>;
}

export interface RiskConfig {
    sizingType: "fixed_fractional" | "kelly" | "volatility_adjusted" | "atr";
    maxPositionPct: number;
    kellyFraction: number;
    riskPerTrade: number;
    maxSectorExposure: number;
    maxPortfolioHeat: number;
    maxCorrelation: number;
    dailyLossLimit: number;
    consecutiveLosses: number;
    drawdownThresholds: number[];
    volatilityThreshold: number;
    stopType: "trailing" | "atr" | "volatility" | "time";
    atrMultiplier: number;
    trailingActivation: number;
    timeLimit: number;
}
```

**Step 2: Commit**

```bash
git add src/risk/types.ts
git commit -m "feat: add core risk management types and interfaces"
```

---

### Task 1.2: Create Risk Configuration Management

**File**: `src/risk/config.ts`
**Time**: 2 minutes
**Command**: `bun test src/__tests__/risk/config.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "bun:test";
import { loadRiskConfig, validateRiskConfig, defaultRiskConfig } from "../risk/config.js";

describe("Risk Config", () => {
    it("should load default config", () => {
        const config = loadRiskConfig();
        expect(config.dailyLossLimit).toBe(10);
        expect(config.maxPositionPct).toBe(0.1);
    });

    it("should apply config overrides", () => {
        const config = loadRiskConfig({ dailyLossLimit: 20 });
        expect(config.dailyLossLimit).toBe(20);
        expect(config.maxPositionPct).toBe(0.1); // Unchanged
    });

    it("should validate invalid configs", () => {
        const errors = validateRiskConfig({ ...defaultRiskConfig, maxPositionPct: 1.5 });
        expect(errors.length).toBeGreaterThan(0);
    });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/__tests__/risk/config.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
/**
 * Risk Configuration Management
 */

import type { RiskConfig } from "./types.js";

export const defaultRiskConfig: RiskConfig = {
    sizingType: "fixed_fractional",
    maxPositionPct: 0.1,
    kellyFraction: 0.5,
    riskPerTrade: 0.02,
    maxSectorExposure: 0.3,
    maxPortfolioHeat: 0.5,
    maxCorrelation: 0.7,
    dailyLossLimit: 10,
    consecutiveLosses: 3,
    drawdownThresholds: [5, 10, 15],
    volatilityThreshold: 2.0,
    stopType: "trailing",
    atrMultiplier: 2.0,
    trailingActivation: 1.02,
    timeLimit: 3600,
};

export function loadRiskConfig(overrides?: Partial<RiskConfig>): RiskConfig {
    return {
        ...defaultRiskConfig,
        ...overrides,
    };
}

export function validateRiskConfig(config: RiskConfig): string[] {
    const errors: string[] = [];

    if (config.maxPositionPct <= 0 || config.maxPositionPct > 1) {
        errors.push("maxPositionPct must be between 0 and 1");
    }
    if (config.riskPerTrade <= 0 || config.riskPerTrade > 0.1) {
        errors.push("riskPerTrade should be between 0 and 0.1 (10%)");
    }
    if (config.maxSectorExposure <= 0 || config.maxSectorExposure > 1) {
        errors.push("maxSectorExposure must be between 0 and 1");
    }

    return errors;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/__tests__/risk/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/risk/config.ts src/__tests__/risk/config.test.ts
git commit -m "feat: add risk configuration management with validation"
```

---

### Task 1.3: Create Database Schema

**File**: `database/migrations/001_create_risk_tables.sql`
**Time**: 3 minutes
**Command**: `psql -U trading_agent -d trading_db -f database/migrations/001_create_risk_tables.sql`

**Step 1: Write the migration**

```sql
-- Risk Configuration Table
CREATE TABLE IF NOT EXISTS risk_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Checks Audit Log
CREATE TABLE IF NOT EXISTS risk_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(20),
    passed BOOLEAN NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Circuit Breaker Events
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    breaker_type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    resume_time TIMESTAMP,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    metadata JSONB
);

-- Portfolio Snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_value DECIMAL(15, 2),
    cash_balance DECIMAL(15, 2),
    daily_pnl DECIMAL(15, 2),
    total_pnl DECIMAL(15, 2),
    positions JSONB,
    risk_metrics JSONB
);

-- Stop Orders Tracking
CREATE TABLE IF NOT EXISTS stop_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    stop_type VARCHAR(50) NOT NULL,
    stop_price DECIMAL(12, 4) NOT NULL,
    activation_price DECIMAL(12, 4),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_at TIMESTAMP,
    metadata JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_risk_checks_timestamp ON risk_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_checks_symbol ON risk_checks(symbol);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_triggered ON circuit_breaker_events(triggered_at);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_stop_orders_symbol ON stop_orders(symbol);
```

**Step 2: Commit**

```bash
git add database/migrations/001_create_risk_tables.sql
git commit -m "feat: add PostgreSQL schema for risk management persistence"
```

---

### Task 1.4: Create Risk Database Client

**File**: `src/risk/database.ts`
**Time**: 3 minutes
**Command**: `bun test src/__tests__/risk/database.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { RiskDatabase } from "../../risk/database.js";
import type { RiskConfig } from "../../risk/types.js";

describe("RiskDatabase", () => {
    const db = new RiskDatabase({
        host: "localhost",
        port: 5432,
        database: "trading_db",
        user: "trading_agent",
        password: "password",
    });

    it("should connect to database", async () => {
        await db.connect();
        expect(db.isConnected).toBe(true);
    });
});
```

**Step 2: Write implementation**

```typescript
/**
 * Risk Database Client
 * PostgreSQL persistence for risk management
 */

import { Pool, type PoolConfig } from "pg";
import type { RiskConfig, RiskCheck, CircuitBreakerResult } from "./types.js";

export interface DatabaseConfig extends PoolConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

export class RiskDatabase {
    private pool: Pool;
    isConnected: boolean = false;

    constructor(config: DatabaseConfig) {
        this.pool = new Pool(config);
    }

    async connect(): Promise<void> {
        if (this.isConnected) return;
        await this.pool.query("SELECT 1");
        this.isConnected = true;
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
        this.isConnected = false;
    }

    async saveRiskConfig(name: string, config: RiskConfig): Promise<void> {
        await this.pool.query(
            `INSERT INTO risk_configs (name, config, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (name) DO UPDATE
       SET config = $2, updated_at = CURRENT_TIMESTAMP`,
            [name, JSON.stringify(config)],
        );
    }

    async getRiskConfig(name: string): Promise<RiskConfig | null> {
        const result = await this.pool.query("SELECT config FROM risk_configs WHERE name = $1", [name]);
        return result.rows[0]?.config ?? null;
    }

    async logRiskCheck(check: RiskCheck): Promise<void> {
        await this.pool.query(
            `INSERT INTO risk_checks (id, timestamp, check_type, symbol, passed, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [check.id, check.timestamp, check.type, check.symbol, check.passed, JSON.stringify(check.details)],
        );
    }

    async recordCircuitBreakerEvent(type: string, reason: string, result: CircuitBreakerResult): Promise<void> {
        await this.pool.query(
            `INSERT INTO circuit_breaker_events
       (breaker_type, reason, resume_time, metadata)
       VALUES ($1, $2, $3, $4)`,
            [type, reason, result.resumeTime ?? null, JSON.stringify(result)],
        );
    }

    async isCircuitBreakerActive(): Promise<boolean> {
        const result = await this.pool.query(
            `SELECT COUNT(*) as count
       FROM circuit_breaker_events
       WHERE is_resolved = false
       AND (resume_time IS NULL OR resume_time > CURRENT_TIMESTAMP)`,
        );
        return parseInt(result.rows[0].count) > 0;
    }
}
```

**Step 3: Commit**

```bash
git add src/risk/database.ts src/__tests__/risk/database.test.ts
git commit -m "feat: add RiskDatabase client for PostgreSQL persistence"
```

---

## Phase 2: Position Sizing Module (Tasks 2.1-2.5)

### Task 2.1: Create Base Sizer Abstract Class

**File**: `src/risk/sizing/base-sizer.ts`

```typescript
import type { TradeRequest, SizingResult, Portfolio, RiskConfig } from "../types.js";

export abstract class BaseSizer {
    protected config: RiskConfig;

    constructor(config: RiskConfig) {
        this.config = config;
    }

    abstract calculateSize(request: TradeRequest, portfolio: Portfolio): SizingResult;

    protected createResult(
        shares: number,
        positionValue: number,
        riskAmount: number,
        rejected: boolean = false,
        rejectionReason?: string,
    ): SizingResult {
        return {
            shares,
            positionValue,
            riskAmount,
            riskPercent: this.config.riskPerTrade,
            rejected,
            rejectionReason,
        };
    }
}
```

### Task 2.2-2.5: Implement Sizers (FixedFractional, Kelly, VolatilityAdjusted, ATR)

See detailed implementations in the plan output above.

---

## Phase 3: Portfolio Controls Module (Tasks 3.1-3.5)

Implement CorrelationAnalyzer, SectorExposureLimiter, PortfolioHeatMonitor, ConcentrationRiskChecker.

---

## Phase 4: Circuit Breakers Module (Tasks 4.1-4.5)

Implement DailyLossLimiter, ConsecutiveLossHalt, DrawdownReducer, VolatilityBreaker.

---

## Phase 5: Stop Management Module (Tasks 5.1-5.5)

Implement TrailingStopEngine, VolatilityBasedStop, TimeBasedExit, ATRStop.

---

## Phase 6: Risk Orchestrator (Task 6.1)

**File**: `src/risk/orchestrator.ts`

Coordinates all modules and provides unified `validateTrade()` interface.

---

## Phase 7: Integration (Task 7.1)

**File**: `src/autonomous-agent.ts` (modifications)

Integrate RiskOrchestrator into trade execution flow.

---

## Phase 8: Tests (Tasks 8.1-8.3)

Create comprehensive unit tests for all modules.

---

## Phase 9: Deployment (Tasks 9.1-9.2)

**Files**:

- `config/risk-config.yaml` - Risk configuration
- `k8s/risk-management-deployment.yaml` - Kubernetes manifests

---

## Testing Commands Summary

```bash
# Run all tests
bun test

# Run specific module
bun test src/__tests__/risk/sizing/
bun test src/__tests__/risk/breakers/

# Run with coverage
bun test --coverage
```

---

## Implementation Order Summary

1. **Foundation** (Tasks 1.1-1.4): Types, config, database
2. **Position Sizing** (Tasks 2.1-2.5): 4 sizer implementations
3. **Portfolio Controls** (Tasks 3.1-3.5): 4 analyzers
4. **Circuit Breakers** (Tasks 4.1-4.5): 4 breakers
5. **Stop Management** (Tasks 5.1-5.5): 4 stop managers
6. **Orchestrator** (Task 6.1): Main coordinator
7. **Integration** (Task 7.1): Agent integration
8. **Tests** (Tasks 8.1-8.3): Unit and integration tests
9. **Deployment** (Tasks 9.1-9.2): Config and K8s manifests

Each task is bite-sized (2-5 minutes) following TDD principles with failing tests first.
