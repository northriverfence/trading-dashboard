import { TradeLearningSystem, type TradeRecord } from "../learning-system.js";
import { tradingDB, type TradeMemory } from "../agentdb-integration.js";
import { SyncManager } from "../sync/sync-manager.js";

export class HybridLearningSystem {
    private fileSystem: TradeLearningSystem;
    private syncManager: SyncManager;

    constructor(dataDir: string = "./data") {
        this.fileSystem = new TradeLearningSystem(dataDir);
        this.syncManager = new SyncManager();
    }

    // File-backed storage (existing functionality)
    recordTrade(trade: Omit<TradeRecord, "id">): TradeRecord {
        // Save to file system (source of truth)
        const saved = this.fileSystem.recordTrade(trade);

        // Sync to AgentDB (async, non-blocking)
        const tradeMemory: TradeMemory = {
            id: saved.id,
            symbol: saved.symbol,
            side: saved.side,
            entryPrice: saved.entryPrice,
            stopLoss: saved.stopLoss,
            takeProfit: saved.takeProfit,
            shares: saved.shares,
            strategy: saved.strategy,
            marketCondition: saved.marketCondition,
            reasoning: saved.reasoning,
            mistakes: saved.mistakes || [],
            lessons: saved.lessons || [],
            timestamp: new Date(saved.entryTime).getTime(),
        };

        this.syncManager.syncTradeToAgentDB(tradeMemory).catch((err) => {
            console.error("Failed to sync to AgentDB:", err);
        });

        return saved;
    }

    closeTrade(
        tradeId: string,
        exitPrice: number,
        exitTime: string,
        mistakes: string[] = [],
        lessons: string[] = [],
    ): TradeRecord | null {
        return this.fileSystem.closeTrade(tradeId, exitPrice, exitTime, mistakes, lessons);
    }

    // AgentDB-powered queries
    async findSimilarTrades(trade: TradeMemory, k: number = 5): Promise<TradeMemory[]> {
        return tradingDB.findSimilarTrades(trade, k);
    }

    async getSmartRecommendations(): Promise<string[]> {
        return tradingDB.getRecommendations();
    }

    async getWinningPatterns(minConfidence: number = 0.3, minSuccessRate: number = 0.5) {
        return tradingDB.getWinningPatterns(minConfidence, minSuccessRate);
    }

    // Delegate other methods to file system
    generateDailySummary(date: string) {
        return this.fileSystem.generateDailySummary(date);
    }

    getStats() {
        return this.fileSystem.getStats();
    }

    getRecommendations(symbol?: string) {
        return this.fileSystem.getRecommendations(symbol);
    }
}
