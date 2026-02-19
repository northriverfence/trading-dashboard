import { RiskOrchestrator } from "./src/risk/orchestrator.js";
import { loadRiskConfig } from "./src/risk/config.js";
import type { TradeRequest, Portfolio } from "./src/risk/types.js";

const config = loadRiskConfig();
const orchestrator = new RiskOrchestrator(config);

const request: TradeRequest = {
  symbol: "AAPL",
  side: "buy",
  entryPrice: 10,
  stopLoss: 9.8,
  takeProfit: 10.4,
  confidence: 0.7,
  strategy: "breakout",
};

const portfolio: Portfolio = {
  cash: 10000,
  positions: [],
  totalValue: 10000,
  dailyPnl: 0,
  totalPnl: 0,
};

const result = await orchestrator.validateTrade(request, portfolio);
console.log("Result:", JSON.stringify(result, null, 2));
