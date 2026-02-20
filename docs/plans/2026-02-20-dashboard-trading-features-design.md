# Dashboard Trading Features Design

> **Date:** 2026-02-20
> **Goal:** Add paper trading, live trading, and simulation capabilities to the trading dashboard

---

## Requirements Summary

Based on user input:

1. **Market Data Sources:** Alpaca Markets (primary) + Yahoo Finance (backup)
2. **Simulation Levels:** All tiers - Simple summary, step-through visualization, AND advanced market simulation
3. **Trading Modes:** Both paper and live trading from the start

---

## Architecture Overview

### Three Trading Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                    Trading Dashboard                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   PAPER      │  │    LIVE      │  │ SIMULATION   │         │
│  │  TRADING     │  │   TRADING    │  │   / BACKTEST │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│              ┌────────────┴────────────┐                     │
│              │    TradingEngine          │                     │
│              │  - Order validation       │                     │
│              │  - Position tracking      │                     │
│              │  - P&L calculation        │                     │
│              │  - Risk checks            │                     │
│              └────────────┬────────────┘                     │
│                           │                                    │
│         ┌─────────────────┼─────────────────┐                │
│         │                 │                 │                  │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐            │
│    │  Alpaca │      │  Yahoo  │      │Simulation│            │
│    │ Markets │      │Finance  │      │ Engine   │            │
│    │  (Live) │      │ (Backup)│      │(Backtest)│            │
│    └─────────┘      └─────────┘      └─────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. TradingEngine (Core)

Central order management system that handles all trading modes uniformly.

**Responsibilities:**
- Order validation and sanitization
- Position tracking (open/closed)
- P&L calculation (realized/unrealized)
- Risk checks before execution
- Trade logging to AgentDB

**Key Classes:**
- `TradingEngine` - Main coordinator
- `OrderManager` - Order lifecycle management
- `PositionManager` - Track open positions
- `PortfolioTracker` - Calculate equity, cash, P&L

### 2. Market Data Providers

**AlpacaProvider** (Primary for Live/Paper)
- REST API for market data
- WebSocket for real-time quotes
- Paper trading endpoint support
- Rate limits: 200 req/min free tier

**YahooProvider** (Backup)
- Free delayed data (15 min)
- No rate limits
- Fallback when Alpaca unavailable

**DataProvider Interface:**
```typescript
interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getBars(symbol: string, timeframe: string): Promise<Bar[]>;
  subscribeToQuotes(symbols: string[], callback: (quote: Quote) => void): void;
}
```

### 3. SimulationEngine

Three-tier simulation system:

#### Tier 1: Simple Backtest
- Run strategy on historical bars
- Calculate total return, Sharpe ratio, max drawdown
- Generate trade list with entry/exit prices
- **Fast execution** - seconds for years of data

#### Tier 2: Step-Through Visualization
- Pause/play/step controls
- Visual chart with trade markers
- See portfolio value change bar-by-bar
- **Interactive** - user controls speed

#### Tier 3: Advanced Market Simulation
- Order book simulation with limit/market orders
- Slippage modeling (volume-based)
- Latency simulation (network delay)
- Market impact modeling (large orders affect price)
- **Realistic** - matches live trading behavior

### 4. BrokerAdapter

Abstract interface for broker integrations:

```typescript
interface BrokerAdapter {
  // Account
  getAccount(): Promise<Account>;

  // Orders
  submitOrder(order: Order): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<void>;
  getOrder(orderId: string): Promise<Order>;

  // Positions
  getPositions(): Promise<Position[]>;

  // Market Data
  subscribeToQuotes(symbols: string[]): void;
  onQuote(callback: (quote: Quote) => void): void;
}
```

**Implementations:**
- `AlpacaBroker` - Paper and live trading
- `SimulationBroker` - Backtest/simulation mode

---

## API Endpoints

### Trading Endpoints

```typescript
// POST /api/orders - Submit new order
{
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit" | "stop" | "stop_limit";
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: "day" | "gtc" | "ioc" | "fop";
}

// GET /api/orders - List orders
// GET /api/orders/:id - Get specific order
// DELETE /api/orders/:id - Cancel order

// GET /api/positions - Current positions
// GET /api/account - Account details (equity, cash, buying power)

// GET /api/portfolio/history - Equity curve over time
// GET /api/trades - Trade history
```

### Simulation Endpoints

```typescript
// POST /api/simulations - Start new simulation
{
  strategy: string;
  symbols: string[];
  startDate: string;
  endDate: string;
  initialCash: number;
  mode: "fast" | "step" | "advanced";
  parameters?: Record<string, unknown>;
}

// GET /api/simulations/:id - Get simulation status/results
// POST /api/simulations/:id/control - Control simulation (play/pause/step/stop)
// GET /api/simulations/:id/trades - Simulation trade log
```

### Market Data Endpoints

```typescript
// GET /api/market/quotes/:symbol - Current quote
// GET /api/market/bars/:symbol?timeframe=1D&start=2024-01-01
// GET /api/market/clock - Market hours status
```

---

## WebSocket Messages

### Server → Client

```typescript
// Order update
{
  type: "order_update",
  data: {
    id: string;
    status: "pending" | "filled" | "partially_filled" | "canceled" | "rejected";
    filledQty: number;
    avgPrice: number;
    timestamp: string;
  }
}

// Quote update
{
  type: "quote",
  data: {
    symbol: string;
    bid: number;
    ask: number;
    lastPrice: number;
    volume: number;
    timestamp: string;
  }
}

// Trade execution
{
  type: "trade_execution",
  data: {
    orderId: string;
    symbol: string;
    side: string;
    qty: number;
    price: number;
    pnl: number;
    timestamp: string;
  }
}

// Simulation progress (for step-through mode)
{
  type: "simulation_tick",
  data: {
    simulationId: string;
    timestamp: string;
    bar: OHLCV;
    portfolioValue: number;
    positions: Position[];
    signals: Signal[];
  }
}
```

### Client → Server

```typescript
// Submit order
{
  type: "submit_order",
  payload: {
    symbol: string;
    side: "buy" | "sell";
    qty: number;
    type: "market" | "limit";
    limitPrice?: number;
  }
}

// Control simulation
{
  type: "simulation_control",
  payload: {
    simulationId: string;
    action: "play" | "pause" | "step" | "stop";
    speed?: number; // For play mode (1x, 2x, 5x, 10x)
  }
}

// Subscribe to quotes
{
  type: "subscribe_quotes",
  payload: {
    symbols: string[];
  }
}
```

---

## UI Components

### Trading Panel

New card on dashboard with:
- **Order Entry Form** - Symbol, qty, order type, price inputs
- **Order Book Preview** - Bid/ask spread visualization
- **Quick Trade Buttons** - Market buy/sell shortcuts
- **Pending Orders List** - Cancel/modify open orders

### Positions Panel (Enhanced)

- Real-time P&L with live quotes
- Unrealized/realized breakdown
- Position sizing vs portfolio %
- Quick close buttons

### Market Data Panel

- Watchlist with live quotes
- Mini charts (sparklines)
- Market hours indicator
- Price alerts configuration

### Simulation Panel

**Control Bar:**
- Strategy selector dropdown
- Date range picker
- Mode selector (Fast/Step/Advanced)
- Start/Stop/Reset buttons
- Speed control slider (for step mode)

**Results View:**
- Summary metrics (total return, Sharpe, max drawdown)
- Equity curve chart
- Trade list with P&L
- Monthly returns heatmap

**Step-Through View:**
- Main price chart with trade markers
- Portfolio value over time
- Trade log with timestamps
- Step/Play/Pause controls

**Advanced Simulation View:**
- Order book visualization
- Slippage analysis
- Latency metrics
- Market impact graph

### Mode Switcher

Header toggle between:
- **Simulation** - Practice with historical data
- **Paper** - Trade with virtual money (real market)
- **Live** - Trade with real money

Visual indicator shows current mode with color coding:
- Green: Simulation
- Yellow: Paper
- Red: Live (caution)

---

## Data Flow

### Order Execution Flow

```
User clicks "Buy" → OrderEntry validates → Risk checks →
BrokerAdapter.submitOrder() → MarketDataProvider confirms fill →
PositionManager updates → WebSocket broadcasts → Dashboard updates
```

### Simulation Flow

```
User starts simulation → SimulationEngine loads data →
Strategy generates signals → Simulated execution →
Portfolio updates → WebSocket tick sent →
UI updates chart/positions → Repeat for each bar
```

---

## Security Considerations

1. **API Keys** - Stored encrypted, never exposed to frontend
2. **Order Confirmation** - Extra confirmation for live trades
3. **Daily Limits** - Max loss/day, max orders/day circuit breakers
4. **Read-Only Mode** - Can view without trading permissions
5. **Audit Logging** - All orders logged with user/session info

---

## Configuration

```typescript
interface TradingConfig {
  mode: "simulation" | "paper" | "live";

  // Alpaca credentials (for paper/live)
  alpaca: {
    apiKey: string;
    apiSecret: string;
    paper: boolean; // true for paper, false for live
  };

  // Simulation settings
  simulation: {
    defaultCash: number;
    commissionPerTrade: number;
    slippageModel: "none" | "fixed" | "volume_based";
    latencyMs: number;
  };

  // Risk limits
  risk: {
    maxPositionSizePercent: number;
    maxDailyLoss: number;
    maxOrdersPerDay: number;
  };
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- TradingEngine with OrderManager, PositionManager
- AlpacaProvider for market data
- Basic order REST API
- Simple order entry UI

### Phase 2: Paper Trading (Week 2)
- AlpacaBroker integration
- Paper trading mode
- Real-time quote WebSocket
- Enhanced positions panel

### Phase 3: Simple Simulation (Week 3)
- SimulationEngine Tier 1
- Fast backtest mode
- Results summary view
- Strategy parameter inputs

### Phase 4: Advanced Simulation (Week 4)
- Tier 2 & 3 simulation
- Step-through visualization
- Order book simulation
- Market impact modeling

### Phase 5: Live Trading (Week 5)
- Live mode switch
- Order confirmation flow
- Enhanced risk checks
- Audit logging

---

## Success Criteria

1. **Paper Trading:** Can place orders via dashboard, see them execute on Alpaca paper account
2. **Simulation:** Can run backtest, see equity curve, step through trades
3. **Live Trading:** Can switch to live mode with confirmation, execute real trades
4. **Real-time Updates:** Quotes and positions update within 1 second
5. **Risk Controls:** Orders rejected if they violate configured limits

---

## Dependencies

- `@alpacahq/alpaca-trade-api` - Alpaca integration
- `yahoo-finance2` - Yahoo Finance data
- `lightweight-charts` - Charts for simulation visualization

---

**Approved by:** _____________
**Date:** _____________
