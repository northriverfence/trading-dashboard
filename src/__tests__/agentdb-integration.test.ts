import { test, expect } from "bun:test";
import { HybridLearningSystem } from "../learning/hybrid-learning-system.js";
import { TradeValidator } from "../validation/trade-validator.js";
import { DynamicRiskAdjuster } from "../risk/dynamic-risk-adjuster.js";
import { IntelligentStrategySelector } from "../strategies/intelligent-selector.js";
import { BacktestMemory } from "../backtest/backtest-memory.js";

test("AgentDB integration - full workflow", async () => {
    // Initialize all components
    const learning = new HybridLearningSystem("./test-data");
    const validator = new TradeValidator();
    const riskAdjuster = new DynamicRiskAdjuster();
    const strategySelector = new IntelligentStrategySelector();
    const backtestMemory = new BacktestMemory();

    // 1. Record a trade
    const trade = learning.recordTrade({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
        entryTime: new Date().toISOString(),
        status: "open",
        outcome: "open",
        marketCondition: "bullish",
        strategy: "breakout",
        reasoning: "Test trade",
        mistakes: [],
        lessons: [],
    });

    expect(trade.id).toBeDefined();

    // 2. Validate a similar trade
    const validation = await validator.validateTrade({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 151,
        stopLoss: 148,
        takeProfit: 157,
        shares: 10,
        strategy: "breakout",
        marketCondition: "bullish",
        reasoning: "Similar setup",
    });

    expect(validation.approved).toBeBoolean();
    expect(validation.recommendation).toBeOneOf(["proceed", "caution", "avoid"]);

    // 3. Get risk adjustment
    const riskAdjustment = await riskAdjuster.adjustRisk({
        symbol: "AAPL",
        side: "buy",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        shares: 10,
    });

    expect(riskAdjustment.positionSizeMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(riskAdjustment.positionSizeMultiplier).toBeLessThanOrEqual(2.0);

    // 4. Get strategy recommendation
    const strategy = await strategySelector.selectStrategy({
        condition: "bullish",
        indicators: { rsi: 55, trend: "up", volatility: 0.15 },
    });

    expect(strategy.strategy).toBeString();
    expect(strategy.confidence).toBeNumber();

    // 5. Store backtest scenario
    await backtestMemory.storeScenario({
        id: `test_backtest_${Date.now()}`,
        symbol: "AAPL",
        strategy: "breakout",
        marketCondition: "bullish",
        entryPrice: 150,
        stopLoss: 147,
        takeProfit: 156,
        timeOfDay: 10,
        dayOfWeek: 1,
        simulatedOutcome: "win",
        simulatedPnl: 50,
        timestamp: Date.now(),
    });

    console.log("All AgentDB integrations working together!");
});
