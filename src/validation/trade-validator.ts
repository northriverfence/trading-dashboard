import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export interface TradeSignal {
    symbol: string;
    side: "buy" | "sell";
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    shares: number;
    strategy: string;
    marketCondition: string;
    reasoning: string;
}

export interface ValidationResult {
    approved: boolean;
    confidence: number;
    similarTrades: TradeMemory[];
    historicalWinRate: number;
    recommendation: "proceed" | "caution" | "avoid";
    reasoning: string;
}

export class TradeValidator {
    async validateTrade(signal: TradeSignal): Promise<ValidationResult> {
        const queryTrade: TradeMemory = {
            id: `query_${Date.now()}`,
            symbol: signal.symbol,
            side: signal.side,
            entryPrice: signal.entryPrice,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            shares: signal.shares,
            strategy: signal.strategy,
            marketCondition: signal.marketCondition as "bullish" | "bearish" | "neutral",
            reasoning: signal.reasoning,
            mistakes: [],
            lessons: [],
            timestamp: Date.now(),
        };

        const similarTrades = await tradingDB.findSimilarTrades(queryTrade, 10);

        if (similarTrades.length === 0) {
            return {
                approved: true,
                confidence: 0,
                similarTrades: [],
                historicalWinRate: 0,
                recommendation: "caution",
                reasoning: "No similar trades found. Proceed with caution.",
            };
        }

        const historicalWinRate = this.calculateWinRate(similarTrades);

        let recommendation: "proceed" | "caution" | "avoid";
        let approved: boolean;
        let reasoning: string;

        if (historicalWinRate > 0.6) {
            recommendation = "proceed";
            approved = true;
            reasoning = `✅ High historical win rate (${(historicalWinRate * 100).toFixed(0)}%)`;
        } else if (historicalWinRate < 0.4) {
            recommendation = "avoid";
            approved = false;
            reasoning = `⚠️ Low historical win rate (${(historicalWinRate * 100).toFixed(0)}%). Consider skipping.`;
        } else {
            recommendation = "caution";
            approved = true;
            reasoning = `⚖️ Mixed results (${(historicalWinRate * 100).toFixed(0)}% win rate).`;
        }

        return {
            approved,
            confidence: Math.min(1, similarTrades.length / 10),
            similarTrades,
            historicalWinRate,
            recommendation,
            reasoning,
        };
    }

    private calculateWinRate(trades: TradeMemory[]): number {
        const closedTrades = trades.filter(t => t.outcome);
        if (closedTrades.length === 0) return 0;
        const wins = closedTrades.filter(t => t.outcome === "win").length;
        return wins / closedTrades.length;
    }
}
