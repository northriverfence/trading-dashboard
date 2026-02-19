/**
 * Trading Agent Demo
 *
 * This demonstrates the key features of the stock trading agent
 * without requiring actual API credentials (uses mock data for demo).
 */

import { StockTradingAgent } from "./trading-agent";

// Demo configuration (no real API calls)
const demoConfig = {
  alpacaApiKey: "demo_key",
  alpacaSecretKey: "demo_secret",
  paperTrading: true,

  // Daily Funding Strategy
  dailyInvestment: 5,
  canUseRealizedProfits: true,
  neverRiskPrincipal: true,

  // Risk Management
  maxPositionSize: 100,
  maxDailyLoss: 10,
  maxPortfolioRisk: 5,
  maxOpenPositions: 3,

  // Strategy Settings
  initialCapital: 5,
  realizedProfits: 0,
  totalPrincipalInvested: 5,
  profitTarget: 10,
  minRiskRewardRatio: 2,
};

console.log("\n" + "=".repeat(70));
console.log("📈 STOCK TRADING AGENT DEMO");
console.log("=".repeat(70));
console.log("Strategy: $5/day + Reinvest Only Profits");
console.log("=".repeat(70) + "\n");

// Create agent
const agent = new StockTradingAgent(demoConfig);

console.log("✅ Trading agent created successfully!\n");

// Show initial state
console.log("📊 Initial State:");
console.log(agent.getPerformanceMetrics());
console.log("");

// Simulate adding daily $5
console.log("💰 Adding daily $5 investment...");
agent.addDailyInvestment();
console.log("");

// Simulate a winning trade
console.log("📈 Simulating a profitable trade...");
agent.updateRealizedProfits(2.5); // Made $2.50 profit
console.log(`   Realized Profits: $${agent.getPerformanceMetrics().realizedProfits}`);
console.log("");

// Show updated state
console.log("📊 Updated Performance Metrics:");
console.log(agent.getPerformanceMetrics());
console.log("");

// Simulate multiple days of compounding
console.log("📊 Compounding Growth Simulation:");
let profits = 2.5;
for (let day = 2; day <= 30; day++) {
  // Add daily $5
  agent.addDailyInvestment();

  // Simulate daily return of 2-5% on profits
  const dailyReturn = 0.02 + Math.random() * 0.03;
  const dailyProfit = profits * dailyReturn;
  profits += dailyProfit;
  agent.updateRealizedProfits(dailyProfit);

  if (day % 7 === 0) {
    const metrics = agent.getPerformanceMetrics();
    console.log(
      `  Day ${day}: Principal: $${metrics.principalInvested}, Profits: $${metrics.realizedProfits}, Total: $${parseFloat(metrics.principalInvested) + parseFloat(metrics.realizedProfits)}`,
    );
  }
}

console.log("");
console.log("=".repeat(70));
console.log("📈 Final Performance Metrics:");
console.log("=".repeat(70));
console.log(agent.getPerformanceMetrics());
console.log("=".repeat(70));
console.log("\n✅ Demo complete!");
console.log("");
console.log("Next steps:");
console.log("1. Get Alpaca API keys from https://alpaca.markets/");
console.log("2. Create a .env file with your credentials");
console.log("3. Run: bun run src/index.ts");
console.log("4. Start trading (paper mode recommended first)!");
console.log("");
