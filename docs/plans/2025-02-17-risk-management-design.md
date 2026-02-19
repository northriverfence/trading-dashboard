# Risk Management Layer Design

## Overview

A modular Risk Management Layer for the autonomous trading agent that prioritizes capital protection through four independent, configurable modules.

## Architecture

```
Trading Agent
    └── Risk Management Orchestrator
        ├── Position Sizing Module
        ├── Portfolio Controls Module
        ├── Circuit Breakers Module
        └── Stop Management Module
```

## Modules

### 1. Position Sizing Module (`src/risk/sizing/`)

**Purpose**: Determine appropriate position size for each trade.

**Implementations**:

- **FixedFractionalSizer** (Default): Risk fixed percentage per trade
- **KellyCriterionSizer**: Optimal sizing based on historical win rate
- **VolatilityAdjustedSizer**: Reduce size in volatile markets
- **ATRSizer**: Size based on Average True Range

**Configuration**:

```typescript
{
  type: "fixed_fractional", // or "kelly", "volatility_adjusted", "atr"
  maxPositionPct: 0.10,     // Max 10% per position
  kellyFraction: 0.5,       // Half-Kelly for safety
  riskPerTrade: 0.02,       // Risk 2% per trade
}
```

### 2. Portfolio Controls Module (`src/risk/portfolio/`)

**Purpose**: Monitor and limit portfolio-level risk exposure.

**Implementations**:

- **CorrelationAnalyzer**: Check position correlations
- **SectorExposureLimiter**: Max exposure per sector
- **PortfolioHeatMonitor**: Total portfolio risk
- **ConcentrationRiskChecker**: Prevent over-concentration

**Configuration**:

```typescript
{
  maxSectorExposure: 0.30,  // Max 30% per sector
  maxPortfolioHeat: 0.50,   // Max 50% total at risk
  maxCorrelation: 0.70,     // Reject if correlation > 0.7
}
```

### 3. Circuit Breakers Module (`src/risk/breakers/`)

**Purpose**: Halt or modify trading when risk conditions are met.

**Implementations**:

- **DailyLossLimiter**: Stop after daily loss (default: $10)
- **ConsecutiveLossHalt**: Cooldown after N consecutive losses
- **DrawdownReducer**: Progressive size reduction during drawdowns
- **VolatilityBreaker**: Pause when market volatility spikes

**Configuration**:

```typescript
{
  dailyLossLimit: 10,           // $10 daily loss limit
  consecutiveLosses: 3,         // Stop after 3 losses
  drawdownThresholds: [5, 10, 15], // Reduce at 5%, 10%, 15%
  volatilityThreshold: 2.0,     // ATR multiplier
}
```

**Drawdown Reduction Schedule**:

- 5% drawdown: Reduce position size by 25%
- 10% drawdown: Reduce position size by 50%
- 15% drawdown: Reduce position size by 75%
- 20% drawdown: Stop trading, enter research mode

### 4. Stop Management Module (`src/risk/stops/`)

**Purpose**: Calculate and manage stop-loss levels.

**Implementations**:

- **TrailingStopEngine**: Dynamic stop following price
- **VolatilityBasedStop**: Wider stops in volatile conditions
- **TimeBasedExit**: Exit if not profitable within timeframe
- **ATRStop**: Stop distance based on ATR

**Configuration**:

```typescript
{
  type: "trailing",           // or "atr", "volatility", "time"
  atrMultiplier: 2.0,
  trailingActivation: 1.02,   // Start trailing at +2%
  timeLimit: 3600,            // 1 hour max hold time
}
```

## Integration Flow

1. **Pre-Trade Validation**:
    - Sizing module calculates position size
    - Portfolio module checks correlations/exposure
    - Breakers module validates no halt condition

2. **Trade Execution**:
    - Stop module calculates exit levels
    - Trade executed with stop orders attached

3. **Post-Trade Monitoring**:
    - Continuous portfolio heat monitoring
    - Circuit breaker condition checking
    - Trailing stop adjustment

## Database Schema

**PostgreSQL tables**:

- `risk_configs` - Risk configuration persistence
- `risk_checks` - Audit log of risk validations
- `circuit_breaker_events` - Circuit breaker trigger log
- `portfolio_snapshots` - Portfolio state for backtesting

## Testing Strategy

1. **Unit Tests**: Each module independently tested
2. **Integration Tests**: Orchestrator coordination
3. **Backtests**: Historical risk scenario validation
4. **Paper Trading**: Live validation before real deployment

## Success Criteria

- Position sizing limits single-trade risk
- Portfolio controls prevent over-concentration
- Circuit breakers protect against runaway losses
- Stop management locks in profits and limits losses
- All modules configurable without code changes
- Zero false positives on circuit breakers in backtesting
