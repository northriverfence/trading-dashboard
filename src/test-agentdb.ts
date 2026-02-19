/**
 * AgentDB Integration Test
 *
 * Tests all TradingAgentDB functionality:
 * - Store trades with embeddings
 * - Find similar trades
 * - Analyze trade risk
 * - Pattern recognition
 * - Recommendations
 * - Statistics
 */

import { TradingAgentDB, type TradeMemory } from "./agentdb-integration.js";

// Test configuration
const TEST_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];
const TEST_STRATEGIES = ["breakout", "mean_reversion", "trend_following"] as const;
const TEST_CONDITIONS = ["bullish", "bearish", "neutral"] as const;

/**
 * Generate a sample trade for testing
 */
function generateTrade(
  symbol: string,
  side: "buy" | "sell",
  outcome?: "win" | "loss" | "breakeven",
  overrides: Partial<TradeMemory> = {},
): TradeMemory {
  const entryPrice = 100 + Math.random() * 200;
  const stopLoss = entryPrice * 0.98;
  const takeProfit = entryPrice * (side === "buy" ? 1.04 : 0.96);
  const shares = Math.floor(5 + Math.random() * 20);

  let exitPrice: number | undefined;
  let pnl: number | undefined;

  if (outcome) {
    if (outcome === "win") {
      exitPrice = takeProfit;
      pnl = (takeProfit - entryPrice) * shares * (side === "buy" ? 1 : -1);
    } else if (outcome === "loss") {
      exitPrice = stopLoss;
      pnl = (stopLoss - entryPrice) * shares * (side === "buy" ? 1 : -1);
    } else {
      exitPrice = entryPrice;
      pnl = 0;
    }
  }

  const strategyIdx = Math.floor(Math.random() * TEST_STRATEGIES.length);
  const conditionIdx = Math.floor(Math.random() * TEST_CONDITIONS.length);

  return {
    id: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    symbol,
    side,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    shares,
    pnl,
    outcome,
    strategy: overrides.strategy || TEST_STRATEGIES[strategyIdx] || "breakout",
    marketCondition: overrides.marketCondition || TEST_CONDITIONS[conditionIdx] || "neutral",
    reasoning: `Test trade for ${symbol} using ${overrides.strategy || "breakout"} strategy`,
    mistakes: outcome === "loss" ? ["Entered too late", "Ignored volume signal"] : [],
    lessons: outcome === "win" ? ["Good entry timing", "Patience paid off"] : [],
    timestamp: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

async function runTests() {
  console.log("Starting AgentDB Integration Tests\n");

  const db = new TradingAgentDB();

  // Test 1: Initialize
  console.log("Test 1: Initialize TradingAgentDB");
  try {
    await db.initialize();
    console.log("Initialization successful\n");
  } catch (error) {
    console.error("Initialization failed:", error);
    return;
  }

  // Test 2: Store trades
  console.log("Test 2: Store trades with embeddings");
  const trades: TradeMemory[] = [];

  for (let i = 0; i < 10; i++) {
    const symbol = TEST_SYMBOLS[i % TEST_SYMBOLS.length]!;
    const strategy: "breakout" | "mean_reversion" | "trend_following" = TEST_STRATEGIES[i % TEST_STRATEGIES.length]!;
    const condition: "bullish" | "bearish" | "neutral" = i % 2 === 0 ? "bullish" : "neutral";

    const trade = generateTrade(symbol, "buy", "win", {
      strategy,
      marketCondition: condition,
      reasoning: `Strong ${strategy} setup in ${condition} market`,
    });
    trades.push(trade);
    await db.storeTrade(trade);
  }

  for (let i = 0; i < 5; i++) {
    const symbol = TEST_SYMBOLS[i % TEST_SYMBOLS.length]!;
    const trade = generateTrade(symbol, "buy", "loss", {
      strategy: "mean_reversion",
      marketCondition: "bearish",
      reasoning: "Counter-trend trade that failed",
      mistakes: ["Fought the trend", "No confirmation"],
    });
    trades.push(trade);
    await db.storeTrade(trade);
  }

  for (let i = 0; i < 3; i++) {
    const symbol = TEST_SYMBOLS[i]!;
    const trade = generateTrade(symbol, "sell", "breakeven");
    trades.push(trade);
    await db.storeTrade(trade);
  }

  console.log(`Stored ${trades.length} trades\n`);

  // Test 3: Find similar trades
  console.log("Test 3: Find similar trades");
  const queryTrade = generateTrade("AAPL", "buy", undefined, {
    strategy: "breakout",
    marketCondition: "bullish",
  });

  try {
    const similarTrades = await db.findSimilarTrades(queryTrade, 5);
    console.log(`Found ${similarTrades.length} similar trades`);
    similarTrades.slice(0, 3).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.symbol} ${t.strategy} (${t.outcome || "open"})`);
    });
    console.log();
  } catch (error) {
    console.error("Similar trades search failed:", error);
  }

  // Test 4: Analyze trade risk
  console.log("Test 4: Analyze trade risk");
  const riskTrade = generateTrade("MSFT", "buy", undefined, {
    strategy: "breakout",
    marketCondition: "bullish",
  });

  try {
    const riskAnalysis = await db.analyzeTradeRisk(riskTrade);
    console.log(`Risk Analysis:`);
    console.log(`  Risk Level: ${riskAnalysis.risk}`);
    console.log(`  Confidence: ${(riskAnalysis.confidence * 100).toFixed(0)}%`);
    console.log(`  Similar Trades: ${riskAnalysis.similarTrades.length}`);
    console.log(`  Avg Outcome: $${riskAnalysis.avgOutcome.toFixed(2)}`);
    console.log(`  Recommendation: ${riskAnalysis.recommendation}`);
    console.log();
  } catch (error) {
    console.error("Risk analysis failed:", error);
  }

  // Test 5: Get winning patterns
  console.log("Test 5: Get winning patterns");
  try {
    const winningPatterns = await db.getWinningPatterns(0.1, 0.5);
    console.log(`Found ${winningPatterns.length} winning patterns`);
    winningPatterns.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.pattern}: ${(p.successRate * 100).toFixed(0)}% win rate`);
    });
    console.log();
  } catch (error) {
    console.error("Winning patterns failed:", error);
  }

  // Test 6: Get losing patterns
  console.log("Test 6: Get losing patterns");
  try {
    const losingPatterns = await db.getLosingPatterns(0.1);
    console.log(`Found ${losingPatterns.length} losing patterns`);
    losingPatterns.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.pattern}: ${(p.successRate * 100).toFixed(0)}% win rate`);
    });
    console.log();
  } catch (error) {
    console.error("Losing patterns failed:", error);
  }

  // Test 7: Get recommendations
  console.log("Test 7: Get recommendations");
  try {
    const recommendations = await db.getRecommendations();
    console.log(`Generated ${recommendations.length} recommendation lines`);
    recommendations.forEach((rec) => {
      console.log(`  ${rec}`);
    });
    console.log();
  } catch (error) {
    console.error("Recommendations failed:", error);
  }

  // Test 8: Get statistics
  console.log("Test 8: Get database statistics");
  try {
    const stats = db.getStats();
    console.log(`Statistics:`);
    console.log(`  Total Trades: ${stats.totalTrades}`);
    console.log(`  Total Patterns: ${stats.totalPatterns}`);
    console.log(`  Memory Count: ${stats.memoryCount}`);
    console.log(`  Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
    console.log(`  Total P&L: $${stats.totalPnl.toFixed(2)}`);
    console.log();
  } catch (error) {
    console.error("Statistics failed:", error);
  }

  // Test 9: Pattern update verification
  console.log("Test 9: Verify pattern updates");
  try {
    const updateTrade = generateTrade("AAPL", "buy", "win", {
      strategy: "breakout",
      marketCondition: "bullish",
    });
    await db.storeTrade(updateTrade);

    const patterns = await db.getWinningPatterns(0.1, 0.5);
    const breakoutBullish = patterns.find((p) => p.pattern === "breakout_bullish");

    if (breakoutBullish) {
      console.log(`Pattern updated successfully:`);
      console.log(`  Pattern: ${breakoutBullish.pattern}`);
      console.log(`  Occurrences: ${breakoutBullish.occurrenceCount}`);
      console.log(`  Success Rate: ${(breakoutBullish.successRate * 100).toFixed(0)}%`);
      console.log(`  Avg P&L: $${breakoutBullish.avgPnl.toFixed(2)}`);
    } else {
      console.log("Pattern not found (may need more trades)");
    }
    console.log();
  } catch (error) {
    console.error("Pattern update failed:", error);
  }

  console.log("All tests completed!");
}

runTests().catch(console.error);
