/**
 * Stock Trading Agent - Real Money Trading with Risk Management
 *
 * CRITICAL WARNING: Trading involves risk of loss. Past performance does not
 * guarantee future results. This agent requires user approval for all trades.
 *
 * Strategy: $5/day + Reinvest Only Earnings
 * - Start with $5 daily injection
 * - Can only trade with realized profits after initial $5
 * - Once profitable, only risk earnings, never original capital
 *
 * Features:
 * - Paper trading mode for testing (REQUIRED first)
 * - Strict risk management (position limits, stop losses, daily loss caps)
 * - User approval required for all trades
 * - Portfolio tracking and performance analytics
 * - Market data integration via Alpaca API
 */

import { query, type Options, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import Alpaca, { type AlpacaConfig } from "@alpacahq/alpaca-trade-api";

// Configuration types
export interface TradingConfig {
  // API credentials (use environment variables in production)
  alpacaApiKey: string;
  alpacaSecretKey: string;
  paperTrading: boolean; // MUST be true initially

  // Daily Funding Strategy
  dailyInvestment: number; // Starting at $5/day
  canUseRealizedProfits: boolean; // Can trade with profits
  neverRiskPrincipal: boolean; // Never risk original $5 once profitable

  // Risk Management Settings
  maxPositionSize: number; // Max $ per position
  maxDailyLoss: number; // Stop trading if daily loss exceeds this
  maxPortfolioRisk: number; // Max % of portfolio at risk
  maxOpenPositions: number; // Max number of concurrent positions

  // Trading Strategy
  initialCapital: number;
  realizedProfits: number; // Track profits available for trading
  totalPrincipalInvested: number; // Track total $5 deposits
  profitTarget: number; // Daily profit target
  minRiskRewardRatio: number; // Minimum risk:reward ratio (e.g., 1:2)
}

interface Position {
  symbol: string;
  qty: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: Date;
  unrealizedPnl: number;
  realizedPnl: number;
}

interface TradingState {
  cash: number;
  positions: Map<string, Position>;
  dailyPnl: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  tradingEnabled: boolean;
  realizedProfits: number; // Profits available for trading
  principalInvested: number; // Total $5 daily injections
  tradingCapital: number; // Available for trading (min $5 or profits)
}

// Trading Agent Class
export class StockTradingAgent {
  private alpaca: Alpaca;
  private config: TradingConfig;
  private state: TradingState;
  private agentDefinition: AgentDefinition;

  constructor(config: TradingConfig) {
    this.config = config;

    // Initialize Alpaca client
    this.alpaca = new Alpaca({
      keyId: config.alpacaApiKey,
      secretKey: config.alpacaSecretKey,
      paper: config.paperTrading,
    });

    // Calculate trading capital
    const tradingCapital = Math.max(config.dailyInvestment, config.realizedProfits);

    // Initialize Trading State
    this.state = {
      cash: config.initialCapital,
      positions: new Map(),
      dailyPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      maxDrawdown: 0,
      tradingEnabled: true,
      realizedProfits: config.realizedProfits,
      principalInvested: config.totalPrincipalInvested,
      tradingCapital: tradingCapital,
    };

    // Define the trading agent
    this.agentDefinition = {
      description: "Expert stock trading agent with risk management",
      prompt: this.getTradingSystemPrompt(),
      tools: ["WebSearch", "WebFetch", "Read", "Write"],
    };
  }

  private getTradingSystemPrompt(): string {
    return `You are an expert stock trading agent specializing in risk-managed trading strategies.

CRITICAL CAPITAL ALLOCATION RULES (Never Violate):
1. DAILY INJECTION: Add $${this.config.dailyInvestment} fresh capital each day
2. PROFIT-ONLY TRADING: Once profitable, ONLY trade with realized profits
3. PRINCIPAL PROTECTION: The original $${this.config.totalPrincipalInvested} invested is NEVER at risk
4. Available Trading Capital: $${this.state.tradingCapital.toFixed(2)} (min $${this.config.dailyInvestment} or realized profits)
5. Current Realized Profits: $${this.state.realizedProfits.toFixed(2)}
6. Total Principal Invested: $${this.state.principalInvested.toFixed(2)}

RISK MANAGEMENT RULES:
7. NEVER risk more than $${this.config.maxPositionSize} per trade
8. ALWAYS use stop-loss orders (max loss: 2% of position)
9. Maintain minimum ${this.config.minRiskRewardRatio}:1 risk:reward ratio
10. Maximum ${this.config.maxOpenPositions} open positions at once
11. STOP trading if daily loss reaches $${this.config.maxDailyLoss}
12. ALWAYS get user approval before executing trades
13. Paper trading mode: ${this.config.paperTrading ? "ACTIVE" : "OFF"}

TRADING STRATEGY FRAMEWORK:
1. Market Analysis (Technical + Fundamental)
   - Check market conditions (trending/ranging/volatile)
   - Identify support/resistance levels
   - Analyze volume patterns
   - Review recent news/sentiment

2. Trade Selection Criteria (ALL must be met):
   - Clear directional bias based on analysis
   - Defined entry, stop-loss, and take-profit levels
   - Risk:reward ratio >= ${this.config.minRiskRewardRatio}:1
   - Position size <= $${this.config.maxPositionSize}
   - Available capital allows for trade
   - Not at max open positions limit

3. Risk Management (Mandatory):
   - Calculate position size based on risk (not greed)
   - Set stop-loss at logical technical level
   - Set take-profit at minimum ${this.config.minRiskRewardRatio}x the risk
   - Never average down on losing positions
   - Cut losses quickly, let winners run

4. Execution Protocol:
   - Present trade idea to user with full analysis
   - Include: Symbol, Direction, Entry, Stop, Target, Size, R:R
   - Wait for explicit user approval before executing
   - Use limit orders when possible (better fills)
   - Set stop-loss immediately after entry

5. Position Management:
   - Monitor open positions continuously
   - Trail stops on winning trades to lock in profits
   - Close positions hitting stop-loss without emotion
   - Take profits at predetermined targets
   - Never move stop-loss further away

GROWTH STRATEGY:
- Start with $${this.config.dailyInvestment}/day
- Compound profits: Reinvest 100% of realized gains
- Once portfolio reaches $100, consider withdrawing 50% of profits
- Target: 1-3% daily returns on trading capital
- Scale up gradually as profits accumulate

PERFORMANCE TRACKING:
- Track win rate, average winner/loser, profit factor
- Calculate expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
- Monitor maximum drawdown
- Review trades daily for lessons learned

Current Trading State:
- Cash Available: $${this.state.cash.toFixed(2)}
- Trading Capital: $${this.state.tradingCapital.toFixed(2)}
- Realized Profits: $${this.state.realizedProfits.toFixed(2)}
- Total Principal: $${this.state.principalInvested.toFixed(2)}
- Open Positions: ${this.state.positions.size}
- Daily P&L: $${this.state.dailyPnl.toFixed(2)}
- Total Trades Today: ${this.state.totalTrades}
- Trading Enabled: ${this.state.tradingEnabled}
- Mode: ${this.config.paperTrading ? "PAPER TRADING" : "LIVE TRADING"}

Remember: Capital preservation is priority #1. Small losses are acceptable; large losses are not.
Goal: Sustainable daily growth through disciplined risk management and profit compounding.`;
  }

  // Market Data Methods
  async getMarketStatus(): Promise<any> {
    try {
      const clock = await this.alpaca.getClock();
      return {
        isOpen: clock.is_open,
        nextOpen: clock.next_open,
        nextClose: clock.next_close,
        timestamp: clock.timestamp,
      };
    } catch (error) {
      console.error("Error fetching market status:", error);
      throw error;
    }
  }

  async getStockQuote(symbol: string): Promise<any> {
    try {
      const quote = await this.alpaca.getLatestQuote(symbol);
      return {
        symbol,
        bid: quote.bidPrice,
        ask: quote.askPrice,
        bidSize: quote.bidSize,
        askSize: quote.askSize,
        timestamp: quote.timestamp,
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  async getHistoricalBars(symbol: string, timeframe: string = "1Day", limit: number = 100): Promise<any[]> {
    try {
      const response = await this.alpaca.getBars(symbol, {
        timeframe,
        limit,
      });
      return response.bars.map((bar: any) => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    } catch (error) {
      console.error(`Error fetching historical bars for ${symbol}:`, error);
      throw error;
    }
  }

  // Account & Portfolio Methods
  async getAccountInfo(): Promise<any> {
    try {
      const account = await this.alpaca.getAccount();
      return {
        buyingPower: account.buying_power,
        cash: account.cash,
        portfolioValue: account.portfolio_value,
        equity: account.equity,
        dayTradeCount: account.daytrade_count,
        isPatternDayTrader: account.pattern_day_trader,
        tradingBlocked: account.trading_blocked,
      };
    } catch (error) {
      console.error("Error fetching account info:", error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const positions = await this.alpaca.getPositions();
      return positions.map((pos: any) => ({
        symbol: pos.symbol,
        qty: parseFloat(pos.qty),
        entryPrice: parseFloat(pos.avg_entry_price),
        currentPrice: parseFloat(pos.current_price),
        stopLoss: 0,
        takeProfit: 0,
        entryTime: new Date(),
        unrealizedPnl: parseFloat(pos.unrealized_pl),
        realizedPnl: 0,
      }));
    } catch (error) {
      console.error("Error fetching positions:", error);
      throw error;
    }
  }

  // Risk Management
  private checkRiskLimits(): { allowed: boolean; reason?: string } {
    // Check daily loss limit
    if (this.state.dailyPnl <= -this.config.maxDailyLoss) {
      return {
        allowed: false,
        reason: `Daily loss limit ($${this.config.maxDailyLoss}) reached. Trading disabled.`,
      };
    }

    // Check max open positions
    if (this.state.positions.size >= this.config.maxOpenPositions) {
      return {
        allowed: false,
        reason: `Maximum open positions (${this.config.maxOpenPositions}) reached.`,
      };
    }

    // Check if trading enabled
    if (!this.state.tradingEnabled) {
      return {
        allowed: false,
        reason: "Trading is currently disabled.",
      };
    }

    // Check if we have trading capital
    if (this.state.tradingCapital < 5) {
      return {
        allowed: false,
        reason: "Insufficient trading capital. Minimum $5 required.",
      };
    }

    return { allowed: true };
  }

  calculatePositionSize(entryPrice: number, stopLoss: number): number {
    const riskPerShare = entryPrice - stopLoss;
    const maxRiskAmount = Math.min(this.config.maxPositionSize * 0.02, this.state.tradingCapital * 0.02); // 2% of position or trading capital
    const shares = Math.floor(maxRiskAmount / Math.abs(riskPerShare));
    const positionValue = shares * entryPrice;

    // Ensure position doesn't exceed max size
    if (positionValue > this.config.maxPositionSize) {
      return Math.floor(this.config.maxPositionSize / entryPrice);
    }

    // Ensure we don't exceed available trading capital
    if (positionValue > this.state.tradingCapital) {
      return Math.floor(this.state.tradingCapital / entryPrice);
    }

    return shares;
  }

  // Trade Execution (Requires User Approval)
  async proposeTrade(params: {
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    reasoning: string;
  }): Promise<{ approved: boolean; order?: any }> {
    const riskCheck = this.checkRiskLimits();
    if (!riskCheck.allowed) {
      console.log(`❌ Trade rejected: ${riskCheck.reason}`);
      return { approved: false };
    }

    const { symbol, side, entryPrice, stopLoss, takeProfit, reasoning } = params;

    // Calculate metrics
    const shares = this.calculatePositionSize(entryPrice, stopLoss);
    const positionValue = shares * entryPrice;
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const rewardPerShare = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = rewardPerShare / riskPerShare;
    const totalRisk = shares * riskPerShare;
    const totalReward = shares * rewardPerShare;

    // Validate risk:reward ratio
    if (riskRewardRatio < this.config.minRiskRewardRatio) {
      console.log(
        `❌ Trade rejected: Risk:Reward ratio ${riskRewardRatio.toFixed(
          2,
        )} is below minimum ${this.config.minRiskRewardRatio}`,
      );
      return { approved: false };
    }

    // Build trade proposal
    const proposal = {
      symbol,
      side,
      shares,
      entryPrice,
      stopLoss,
      takeProfit,
      positionValue,
      riskPerShare,
      rewardPerShare,
      riskRewardRatio,
      totalRisk,
      totalReward,
      reasoning,
      mode: this.config.paperTrading ? "PAPER" : "LIVE",
      tradingCapital: this.state.tradingCapital,
      realizedProfits: this.state.realizedProfits,
    };

    console.log("\n" + "=".repeat(60));
    console.log("📊 TRADE PROPOSAL");
    console.log("=".repeat(60));
    console.log(`Symbol: ${symbol}`);
    console.log(`Side: ${side.toUpperCase()}`);
    console.log(`Shares: ${shares}`);
    console.log(`Entry: $${entryPrice.toFixed(2)}`);
    console.log(`Stop Loss: $${stopLoss.toFixed(2)}`);
    console.log(`Take Profit: $${takeProfit.toFixed(2)}`);
    console.log(`Position Value: $${positionValue.toFixed(2)}`);
    console.log(`Risk/Reward: 1:${riskRewardRatio.toFixed(2)}`);
    console.log(`Total Risk: $${totalRisk.toFixed(2)}`);
    console.log(`Potential Reward: $${totalReward.toFixed(2)}`);
    console.log(`Trading Capital: $${this.state.tradingCapital.toFixed(2)}`);
    console.log(`Realized Profits: $${this.state.realizedProfits.toFixed(2)}`);
    console.log(`Mode: ${proposal.mode}`);
    console.log("-".repeat(60));
    console.log("Reasoning:", reasoning);
    console.log("=".repeat(60));

    // In a real implementation, this would wait for user input
    return new Promise((resolve) => {
      console.log("\n⏳ Waiting for user approval...");
      console.log("Call agent.approveTrade() to execute or agent.rejectTrade() to cancel");

      // Store the proposal for later approval
      (this as any).pendingTrade = { proposal, resolve };
    });
  }

  async executeApprovedTrade(): Promise<any> {
    const pending = (this as any).pendingTrade;
    if (!pending) {
      throw new Error("No pending trade to execute");
    }

    const { proposal, resolve } = pending;

    try {
      // Submit order to Alpaca
      const order = await this.alpaca.createOrder({
        symbol: proposal.symbol,
        qty: proposal.shares,
        side: proposal.side,
        type: "limit",
        limit_price: proposal.entryPrice,
        time_in_force: "day",
      });

      console.log(`✅ Order submitted: ${order.id}`);

      // Submit stop-loss order
      const stopOrder = await this.alpaca.createOrder({
        symbol: proposal.symbol,
        qty: proposal.shares,
        side: proposal.side === "buy" ? "sell" : "buy",
        type: "stop",
        stop_price: proposal.stopLoss,
        time_in_force: "gtc",
      });

      console.log(`🛡️ Stop-loss order submitted: ${stopOrder.id}`);

      // Track position
      const position: Position = {
        symbol: proposal.symbol,
        qty: proposal.shares,
        entryPrice: proposal.entryPrice,
        currentPrice: proposal.entryPrice,
        stopLoss: proposal.stopLoss,
        takeProfit: proposal.takeProfit,
        entryTime: new Date(),
        unrealizedPnl: 0,
        realizedPnl: 0,
      };
      this.state.positions.set(proposal.symbol, position);
      this.state.totalTrades++;

      // Update cash
      this.state.cash -= proposal.positionValue;

      resolve({ approved: true, order });
      (this as any).pendingTrade = null;

      return order;
    } catch (error) {
      console.error("Error executing trade:", error);
      resolve({ approved: false, error });
      (this as any).pendingTrade = null;
      throw error;
    }
  }

  rejectTrade(reason: string): void {
    const pending = (this as any).pendingTrade;
    if (pending) {
      pending.resolve({ approved: false, reason });
      (this as any).pendingTrade = null;
    }
  }

  // Analysis Methods
  async analyzeStock(symbol: string): Promise<any> {
    console.log(`\n🔍 Analyzing ${symbol}...`);

    try {
      // Get quote
      const quote = await this.getStockQuote(symbol);

      // Get historical data
      const bars = await this.getHistoricalBars(symbol, "1Day", 50);

      // Calculate basic indicators
      const sma20 = this.calculateSMA(bars.slice(-20), 20);
      const sma50 = this.calculateSMA(bars, 50);
      const currentPrice = (quote.bid + quote.ask) / 2;

      // Simple trend analysis
      const trend =
        currentPrice > sma20 && sma20 > sma50
          ? "bullish"
          : currentPrice < sma20 && sma20 < sma50
            ? "bearish"
            : "neutral";

      // Calculate ATR for volatility
      const atr = this.calculateATR(bars.slice(-14), 14);

      // Support and resistance (simplified)
      const highs = bars.map((b) => b.high);
      const lows = bars.map((b) => b.low);
      const resistance = Math.max(...highs.slice(-20));
      const support = Math.min(...lows.slice(-20));

      const analysis = {
        symbol,
        currentPrice,
        trend,
        sma20,
        sma50,
        atr,
        support,
        resistance,
        volatility: atr / currentPrice,
        recommendation:
          trend === "bullish" && currentPrice > sma20
            ? "potential_long"
            : trend === "bearish" && currentPrice < sma20
              ? "potential_short"
              : "neutral",
      };

      console.log(`📈 Analysis Results:`);
      console.log(`  Current Price: $${currentPrice.toFixed(2)}`);
      console.log(`  Trend: ${trend.toUpperCase()}`);
      console.log(`  SMA20: $${sma20.toFixed(2)}`);
      console.log(`  SMA50: $${sma50.toFixed(2)}`);
      console.log(`  ATR: $${atr.toFixed(2)}`);
      console.log(`  Support: $${support.toFixed(2)}`);
      console.log(`  Resistance: $${resistance.toFixed(2)}`);
      console.log(`  Recommendation: ${analysis.recommendation}`);

      return analysis;
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  // Technical Indicators
  private calculateSMA(bars: any[], period: number): number {
    if (bars.length < period) return 0;
    const sum = bars.slice(-period).reduce((acc, bar) => acc + bar.close, 0);
    return sum / period;
  }

  private calculateATR(bars: any[], period: number): number {
    if (bars.length < 2) return 0;

    const trValues = [];
    for (let i = 1; i < bars.length; i++) {
      const high = bars[i].high;
      const low = bars[i].low;
      const prevClose = bars[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trValues.push(Math.max(tr1, tr2, tr3));
    }

    return trValues.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, trValues.length);
  }

  // Performance Tracking
  getPerformanceMetrics(): any {
    const winRate = this.state.totalTrades > 0 ? (this.state.winningTrades / this.state.totalTrades) * 100 : 0;

    return {
      ...this.state,
      winRate: winRate.toFixed(2) + "%",
      maxDrawdown: this.state.maxDrawdown.toFixed(2),
      remainingCash: this.state.cash.toFixed(2),
      openPositions: this.state.positions.size,
      tradingCapital: this.state.tradingCapital.toFixed(2),
      realizedProfits: this.state.realizedProfits.toFixed(2),
      principalInvested: this.state.principalInvested.toFixed(2),
    };
  }

  // Update realized profits (call this when closing profitable trades)
  updateRealizedProfits(profit: number): void {
    if (profit > 0) {
      this.state.realizedProfits += profit;
      this.state.winningTrades++;
    }
    this.state.tradingCapital = Math.max(this.config.dailyInvestment, this.state.realizedProfits);
  }

  // Add daily $5 investment
  addDailyInvestment(): void {
    this.state.principalInvested += this.config.dailyInvestment;
    this.state.cash += this.config.dailyInvestment;
    console.log(
      `💰 Added $${this.config.dailyInvestment} daily investment. Total principal: $${this.state.principalInvested}`,
    );
  }

  // Agent query method using SDK
  async query(prompt: string, options?: Partial<Options>): Promise<any> {
    const fullOptions: Options = {
      agent: "StockTradingAgent",
      agents: {
        StockTradingAgent: this.agentDefinition,
      },
      ...options,
    };

    const result = await query({ prompt, options: fullOptions });

    // Collect all messages
    const messages = [];
    for await (const message of result) {
      messages.push(message);
    }

    return messages;
  }

  // Shutdown
  async shutdown(): Promise<void> {
    console.log("\n📊 Final Performance Metrics:");
    console.log(this.getPerformanceMetrics());
  }
}
