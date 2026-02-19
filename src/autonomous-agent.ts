/**
 * Autonomous Trading Agent
 *
 * Self-healing, self-learning, adaptive trading system that:
 * - Runs automatically during market hours
 * - Recovers from errors gracefully
 * - Learns from every trade via AgentDB
 * - Adapts strategies based on market conditions
 * - Performs research during after-hours
 */

import { TradingAgentDB, type TradeMemory } from "./agentdb-integration.js";
import { TradeLearningSystem } from "./learning-system.js";
import { RiskOrchestrator } from "./risk/orchestrator.js";
import { loadRiskConfig } from "./risk/config.js";
import type { TradeRequest, Portfolio } from "./risk/types.js";

interface MarketHours {
  isOpen: boolean;
  nextOpen: Date;
  nextClose: Date;
  timeToOpen: number;
  timeToClose: number;
}

interface AgentState {
  isRunning: boolean;
  lastTradeTime: number;
  lastErrorTime: number;
  consecutiveErrors: number;
  totalTradesToday: number;
  dailyPnl: number;
  currentStrategy: string;
  marketCondition: string;
  lastResearchTime: number;
}

interface TradeOpportunity {
  symbol: string;
  price: number;
  confidence: number;
  reasoning: string;
}

export class AutonomousTradingAgent {
  private state: AgentState;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private researchInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;
  private tradingDB: TradingAgentDB;
  private tradeJournal: TradeLearningSystem;
  private riskOrchestrator: RiskOrchestrator;

  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly ERROR_COOLDOWN_MS = 60000;
  private readonly CHECK_INTERVAL_MS = 30000;
  private readonly RESEARCH_INTERVAL_MS = 3600000;
  private readonly MARKET_OPEN_HOUR = 9;
  private readonly MARKET_OPEN_MINUTE = 30;
  private readonly MARKET_CLOSE_HOUR = 16;
  private readonly MARKET_CLOSE_MINUTE = 0;

  constructor() {
    this.tradingDB = new TradingAgentDB();
    this.tradeJournal = new TradeLearningSystem();
    this.riskOrchestrator = new RiskOrchestrator(loadRiskConfig());
    this.state = this.loadState();
  }

  private loadState(): AgentState {
    try {
      return {
        isRunning: false,
        lastTradeTime: 0,
        lastErrorTime: 0,
        consecutiveErrors: 0,
        totalTradesToday: 0,
        dailyPnl: 0,
        currentStrategy: "breakout",
        marketCondition: "neutral",
        lastResearchTime: 0,
      };
    } catch {
      return this.getDefaultState();
    }
  }

  private getDefaultState(): AgentState {
    return {
      isRunning: false,
      lastTradeTime: 0,
      lastErrorTime: 0,
      consecutiveErrors: 0,
      totalTradesToday: 0,
      dailyPnl: 0,
      currentStrategy: "breakout",
      marketCondition: "neutral",
      lastResearchTime: 0,
    };
  }

  private saveState(): void {
    // Persistence would go here
  }

  async initialize(): Promise<boolean> {
    console.log("Initializing Autonomous Trading Agent...");

    try {
      await this.tradingDB.initialize();
      await this.adaptStrategy();

      console.log("Autonomous agent initialized successfully");
      console.log(`Current Strategy: ${this.state.currentStrategy}`);
      console.log(`Market Condition: ${this.state.marketCondition}`);

      return true;
    } catch (error) {
      console.error("Initialization failed:", error);
      return false;
    }
  }

  getMarketHours(): MarketHours {
    const now = new Date();
    const currentDay = now.getDay();

    const isWeekday = currentDay >= 1 && currentDay <= 5;

    const openTime = new Date(now);
    openTime.setHours(this.MARKET_OPEN_HOUR, this.MARKET_OPEN_MINUTE, 0, 0);

    const closeTime = new Date(now);
    closeTime.setHours(this.MARKET_CLOSE_HOUR, this.MARKET_CLOSE_MINUTE, 0, 0);

    const isOpen = isWeekday && now >= openTime && now <= closeTime;

    let nextOpen = new Date(openTime);
    let nextClose = new Date(closeTime);

    if (now > closeTime || !isWeekday) {
      nextOpen.setDate(nextOpen.getDate() + 1);
      while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
        nextOpen.setDate(nextOpen.getDate() + 1);
      }
      nextClose = new Date(nextOpen);
      nextClose.setHours(this.MARKET_CLOSE_HOUR, this.MARKET_CLOSE_MINUTE, 0, 0);
    }

    return {
      isOpen,
      nextOpen,
      nextClose,
      timeToOpen: nextOpen.getTime() - now.getTime(),
      timeToClose: nextClose.getTime() - now.getTime(),
    };
  }

  start(): void {
    if (this.state.isRunning) {
      console.log("Agent is already running");
      return;
    }

    console.log("Starting autonomous trading agent...");
    this.state.isRunning = true;
    this.isShuttingDown = false;

    this.checkInterval = setInterval(() => {
      this.tradingLoop().catch((error) => {
        this.handleError("Trading loop", error);
      });
    }, this.CHECK_INTERVAL_MS);

    this.researchInterval = setInterval(() => {
      this.researchLoop().catch((error) => {
        this.handleError("Research loop", error);
      });
    }, this.RESEARCH_INTERVAL_MS);

    this.tradingLoop().catch((error) => this.handleError("Initial trading loop", error));
    this.researchLoop().catch((error) => this.handleError("Initial research loop", error));

    console.log("Agent is now running autonomously");
    console.log("Press Ctrl+C to stop");
  }

  stop(): void {
    console.log("Stopping autonomous trading agent...");
    this.isShuttingDown = true;
    this.state.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.researchInterval) {
      clearInterval(this.researchInterval);
      this.researchInterval = null;
    }

    this.saveState();
    console.log("Agent stopped");
  }

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
        const similarTrade = await this.tradingDB.findSimilarTrades({
          id: `query_${Date.now()}`,
          symbol: opp.symbol,
          side: "buy",
          entryPrice: opp.price,
          stopLoss: opp.price * 0.98,
          takeProfit: opp.price * 1.04,
          shares: 0,
          strategy: this.state.currentStrategy,
          marketCondition: this.state.marketCondition as "bullish" | "bearish" | "neutral",
          reasoning: opp.reasoning,
          mistakes: [],
          lessons: [],
          timestamp: Date.now(),
        });

        if (similarTrade.length > 0) {
          const winRate = similarTrade.filter((t: TradeMemory) => t.outcome === "win").length / similarTrade.length;
          console.log(`${opp.symbol}: Historical win rate ${(winRate * 100).toFixed(0)}%`);
        }
      }

      if (opportunities[0] && this.shouldExecuteTrade(opportunities[0])) {
        await this.executeTrade(opportunities[0]);
      }

      if (this.state.consecutiveErrors > 0) {
        this.state.consecutiveErrors = 0;
        console.log("Error streak cleared");
      }
    } catch (error) {
      this.handleError("Trading loop execution", error);
    }
  }

  private async scanForOpportunities(): Promise<TradeOpportunity[]> {
    // Placeholder - would integrate with actual market scanning
    return [];
  }

  private async researchLoop(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      console.log("Starting research phase...");

      const patterns = await this.tradingDB.getWinningPatterns(0.3, 0.5);
      console.log(`Found ${patterns.length} high-confidence winning patterns`);

      patterns.slice(0, 3).forEach((p) => {
        console.log(`  ${p.pattern}: ${(p.successRate * 100).toFixed(0)}% (${p.occurrenceCount} trades)`);
      });

      const losingPatterns = await this.tradingDB.getLosingPatterns(0.3);
      if (losingPatterns.length > 0) {
        console.log(`Found ${losingPatterns.length} patterns to avoid`);
        losingPatterns.forEach((p) => {
          console.log(`  ${p.pattern}: ${(p.successRate * 100).toFixed(0)}%`);
        });
      }

      const recommendations = await this.tradingDB.getRecommendations();
      console.log("Trading Recommendations:");
      recommendations.forEach((r: string) => console.log(`  ${r}`));

      const stats = this.tradingDB.getStats();
      console.log("Database Statistics:");
      console.log(`  Total Trades: ${stats.totalTrades}`);
      console.log(`  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
      console.log(`  Total P&L: $${stats.totalPnl.toFixed(2)}`);

      this.state.lastResearchTime = Date.now();
      this.saveState();

      console.log("Research phase complete");
    } catch (error) {
      this.handleError("Research loop", error);
    }
  }

  private async adaptStrategy(): Promise<void> {
    try {
      const winningPatterns = await this.tradingDB.getWinningPatterns(0.3, 0.5);

      if (winningPatterns.length > 0) {
        const bestPattern = winningPatterns[0];
        if (!bestPattern) return;

        const [strategy, condition] = bestPattern.pattern.split("_");

        if (strategy && strategy !== this.state.currentStrategy) {
          console.log(`Adapting strategy: ${this.state.currentStrategy} → ${strategy}`);
          this.state.currentStrategy = strategy;
        }

        if (condition && condition !== this.state.marketCondition) {
          console.log(`Market condition updated: ${this.state.marketCondition} → ${condition}`);
          this.state.marketCondition = condition;
        }
      }
    } catch (error) {
      console.error("Strategy adaptation failed:", error);
    }
  }

  private shouldExecuteTrade(opportunity: TradeOpportunity): boolean {
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

    return true;
  }

  private async executeTrade(opportunity: TradeOpportunity): Promise<void> {
    try {
      console.log(`Validating trade: ${opportunity.symbol}`);

      // Build trade request for risk validation
      const request: TradeRequest = {
        symbol: opportunity.symbol,
        side: "buy",
        entryPrice: opportunity.price,
        stopLoss: opportunity.price * 0.98,
        takeProfit: opportunity.price * 1.04,
        confidence: opportunity.confidence,
        strategy: this.state.currentStrategy,
      };

      // Get portfolio state (simplified - would come from actual account)
      const portfolio: Portfolio = {
        cash: 1000,
        positions: [],
        totalValue: 1000,
        dailyPnl: this.state.dailyPnl,
        totalPnl: 0,
      };

      // Validate with risk orchestrator
      const validation = await this.riskOrchestrator.validateTrade(request, portfolio);

      if (!validation.approved) {
        console.log(`Trade rejected by risk manager: ${validation.reason}`);
        return;
      }

      console.log(`Executing trade: ${validation.shares} shares of ${request.symbol}`);
      console.log(`Stop level: ${validation.stopLevel?.stopPrice}`);

      const trade: TradeMemory = {
        id: `trade_${Date.now()}`,
        symbol: opportunity.symbol,
        side: "buy",
        entryPrice: opportunity.price,
        stopLoss: validation.stopLevel?.stopPrice ?? opportunity.price * 0.98,
        takeProfit: opportunity.price * 1.04,
        shares: validation.shares,
        strategy: this.state.currentStrategy,
        marketCondition: this.state.marketCondition as "bullish" | "bearish" | "neutral",
        reasoning: opportunity.reasoning,
        mistakes: [],
        lessons: [],
        timestamp: Date.now(),
      };

      await this.tradingDB.storeTrade(trade);

      this.tradeJournal.recordTrade({
        symbol: opportunity.symbol,
        side: "buy",
        entryPrice: trade.entryPrice,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        shares: trade.shares,
        entryTime: new Date().toISOString(),
        status: "open",
        outcome: "open",
        marketCondition: this.state.marketCondition as "bullish" | "bearish" | "neutral",
        strategy: this.state.currentStrategy,
        reasoning: opportunity.reasoning,
        mistakes: [],
        lessons: [],
      });

      this.state.totalTradesToday++;
      this.state.lastTradeTime = Date.now();
      this.saveState();

      console.log(`Trade executed: ${trade.id}`);
    } catch (error) {
      this.handleError("Trade execution", error);
    }
  }

  private handleError(context: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error in ${context}:`, errorMessage);

    this.state.consecutiveErrors++;
    this.state.lastErrorTime = Date.now();
    this.saveState();

    if (this.state.consecutiveErrors >= this.MAX_CONSECUTIVE_ERRORS) {
      console.log(`Too many errors (${this.state.consecutiveErrors}), entering cooldown`);
    }
  }

  getStatus(): { state: AgentState; marketHours: MarketHours } {
    return {
      state: { ...this.state },
      marketHours: this.getMarketHours(),
    };
  }
}

export const autonomousAgent = new AutonomousTradingAgent();

if (import.meta.main) {
  const agent = new AutonomousTradingAgent();

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down gracefully...");
    agent.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, shutting down gracefully...");
    agent.stop();
    process.exit(0);
  });

  agent.initialize().then((success) => {
    if (success) {
      agent.start();
    } else {
      console.error("Failed to initialize agent");
      process.exit(1);
    }
  });
}
