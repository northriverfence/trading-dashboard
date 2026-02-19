# Stock Trading Agent

A TypeScript-based stock trading agent built with the Claude Agent SDK that implements a **"\$5/day + Reinvest Only Profits"** strategy.

## Important Risk Warning

**Trading involves substantial risk of loss. Past performance does not guarantee future results.**

- This agent requires **manual user approval** for all trades
- Start with **paper trading** before risking real money
- Never invest more than you can afford to lose
- This is not financial advice

## Strategy Overview

### "\$5/day + Reinvest Only Profits"

1. **Daily Investment**: Add \$5 to your trading account daily
2. **Profit-Only Trading**: Once profitable, only trade with realized gains
3. **Principal Protection**: The original \$5+ invested is NEVER at risk
4. **Compounding**: Reinvest 100% of profits for exponential growth

### Risk Management

- Maximum \$100 per position
- 2% stop-loss on every trade
- Minimum 1:2 risk:reward ratio
- Maximum 3 concurrent positions
- Daily loss limit of \$10
- User approval required for all trades

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Get Alpaca API Keys

1. Sign up at [Alpaca Markets](https://alpaca.markets/)
2. Generate API keys (paper trading recommended)
3. Copy `.env.example` to `.env`
4. Add your API keys to `.env`

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run in Paper Trading Mode (Recommended First)

```bash
bun run src/index.ts
```

## Usage

```typescript
// Create a trading agent
const agent = new StockTradingAgent({
  alpacaApiKey: "your_key",
  alpacaSecretKey: "your_secret",
  paperTrading: true, // Start with paper!
  dailyInvestment: 5,
  // ... other config
});

// Analyze a stock
const analysis = await agent.analyzeStock("AAPL");

// Propose a trade (requires user approval)
const trade = await agent.proposeTrade({
  symbol: "AAPL",
  side: "buy",
  entryPrice: 150.0,
  stopLoss: 147.0,
  takeProfit: 156.0,
  reasoning: "Bullish trend with good support level",
});

// Execute approved trade
if (trade.approved) {
  await agent.executeApprovedTrade();
}

// Add daily $5
agent.addDailyInvestment();

// Check performance
console.log(agent.getPerformanceMetrics());
```

## Project Structure

```
├── src/
│   ├── trading-agent.ts    # Main trading agent class
│   ├── index.ts            # Entry point
│   └── types/
│       └── alpaca.d.ts     # Alpaca API type definitions
├── .env.example            # Environment variables template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Safety Features

1. **Paper Trading Mode**: Test everything with fake money first
2. **User Approval**: No autonomous trades - you approve every order
3. **Position Limits**: Max \$100 per position prevents large losses
4. **Stop Losses**: Automatic stop-loss orders on every trade
5. **Daily Loss Limits**: Trading stops if daily loss exceeds \$10
6. **Principal Protection**: Original capital is never at risk

## Disclaimer

This software is for educational purposes only. Not financial advice. Trading stocks involves risk. Consult a financial advisor before making investment decisions.
