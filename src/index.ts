/**
 * Stock Trading Agent - Main Entry Point
 *
 * This agent implements a "$5/day + Reinvest Only Profits" strategy:
 * - Start with $5 daily investment
 * - Once profitable, only trade with realized gains
 * - Never risk original principal
 * - Compounding growth through disciplined risk management
 */

import { StockTradingAgent, type TradingConfig } from "./trading-agent";

// Load configuration from environment or use defaults
function loadConfig(): TradingConfig {
  const paperTrading = process.env.PAPER_TRADING !== "false"; // Default to paper trading

  return {
    // Alpaca API credentials (set these in .env file)
    alpacaApiKey: process.env.ALPACA_API_KEY || "",
    alpacaSecretKey: process.env.ALPACA_SECRET_KEY || "",
    paperTrading: paperTrading,

    // Daily Funding Strategy
    dailyInvestment: 5, // $5 per day
    canUseRealizedProfits: true,
    neverRiskPrincipal: true,

    // Risk Management Settings
    maxPositionSize: 100, // Max $100 per position (limits risk)
    maxDailyLoss: 10, // Stop trading if daily loss exceeds $10
    maxPortfolioRisk: 5, // Max 5% of portfolio at risk
    maxOpenPositions: 3, // Max 3 concurrent positions

    // Trading Strategy
    initialCapital: paperTrading ? 1000 : 5, // Start with $1000 paper, $5 real
    realizedProfits: 0, // No profits yet
    totalPrincipalInvested: 5, // Track total $5 deposits
    profitTarget: 10, // Daily profit target $10
    minRiskRewardRatio: 2, // Minimum 1:2 risk:reward ratio
  };
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("📈 STOCK TRADING AGENT");
  console.log("=".repeat(70));
  console.log("Strategy: $5/day + Reinvest Only Profits");
  console.log("Goal: Sustainable daily growth through disciplined trading");
  console.log("=".repeat(70) + "\n");

  // Check for API credentials
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) {
    console.error("❌ ERROR: Missing Alpaca API credentials!");
    console.error("");
    console.error("Please set the following environment variables:");
    console.error("  export ALPACA_API_KEY=your_api_key");
    console.error("  export ALPACA_SECRET_KEY=your_secret_key");
    console.error("");
    console.error("Or create a .env file with these values.");
    console.error("");
    console.error("Get your API keys from: https://alpaca.markets/");
    console.error("");
    process.exit(1);
  }

  const config = loadConfig();

  console.log(`📊 Configuration:`);
  console.log(`  Mode: ${config.paperTrading ? "PAPER TRADING" : "🔴 LIVE TRADING"}`);
  console.log(`  Daily Investment: $${config.dailyInvestment}`);
  console.log(`  Initial Capital: $${config.initialCapital}`);
  console.log(`  Max Position Size: $${config.maxPositionSize}`);
  console.log(`  Max Daily Loss: $${config.maxDailyLoss}`);
  console.log(`  Min Risk:Reward: 1:${config.minRiskRewardRatio}`);
  console.log("");

  // Create the trading agent
  const agent = new StockTradingAgent(config);

  try {
    // Check market status
    console.log("🏦 Connecting to Alpaca...");
    const marketStatus = await agent.getMarketStatus();
    console.log(`  Market Open: ${marketStatus.isOpen ? "✅" : "❌"}`);
    console.log(`  Next Open: ${marketStatus.nextOpen}`);
    console.log("");

    // Get account info
    const accountInfo = await agent.getAccountInfo();
    console.log(`💰 Account Status:`);
    console.log(`  Buying Power: $${accountInfo.buyingPower.toFixed(2)}`);
    console.log(`  Cash: $${accountInfo.cash.toFixed(2)}`);
    console.log(`  Portfolio Value: $${accountInfo.portfolioValue.toFixed(2)}`);
    console.log(`  Day Trades: ${accountInfo.dayTradeCount}`);
    console.log("");

    // Demo: Analyze a stock
    console.log("🔍 Demo Stock Analysis:");
    const symbol = "AAPL";
    const analysis = await agent.analyzeStock(symbol);
    console.log("");

    // Show performance metrics
    console.log("📊 Performance Metrics:");
    console.log(agent.getPerformanceMetrics());
    console.log("");

    // Interactive trading session
    console.log("=".repeat(70));
    console.log("🤖 TRADING AGENT READY");
    console.log("=".repeat(70));
    console.log("Commands available:");
    console.log("  - analyze <SYMBOL>   : Analyze a stock");
    console.log("  - trade <SYMBOL>     : Propose a trade");
    console.log("  - positions          : Show open positions");
    console.log("  - metrics            : Show performance metrics");
    console.log("  - add5               : Add daily $5 investment");
    console.log("  - exit               : Shutdown agent");
    console.log("=".repeat(70));
    console.log("");

    // Handle user input for demo
    if (process.argv.includes("--demo")) {
      console.log("Running demo mode...");

      // Propose a sample trade (would require user approval in real scenario)
      console.log("\n📝 Sample Trade Proposal:");
      const tradeResult = await agent.proposeTrade({
        symbol: "AAPL",
        side: "buy",
        entryPrice: analysis.currentPrice,
        stopLoss: analysis.currentPrice * 0.98, // 2% stop loss
        takeProfit: analysis.currentPrice * 1.04, // 4% take profit (2:1 R:R)
        reasoning: `Bullish trend detected. Price above SMA20 ($${analysis.sma20.toFixed(
          2,
        )}) and SMA50 ($${analysis.sma50.toFixed(
          2,
        )}). Good risk:reward ratio with support at $${analysis.support.toFixed(2)}.`,
      });

      if (tradeResult.approved) {
        console.log("✅ Trade approved and executed!");
      } else {
        console.log("❌ Trade rejected or awaiting approval");
      }
    }

    // Graceful shutdown
    await agent.shutdown();
    console.log("\n✅ Trading agent shut down successfully");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the agent
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
