// src/pattern-discovery/miner.ts
import type { TradeMemory } from "../agentdb-integration.js";
import type { DiscoveredPattern } from "./types.js";

export interface MinerConfig {
    minSupport: number;    // Minimum fraction of trades that must have the pattern
    minConfidence: number; // Minimum win rate for pattern to be valid
}

export class PatternMiner {
    private config: MinerConfig;

    constructor(config: MinerConfig) {
        this.config = config;
    }

    minePatterns(trades: TradeMemory[], clusterId: number): DiscoveredPattern[] {
        if (trades.length === 0) {
            return [];
        }

        const patterns: DiscoveredPattern[] = [];
        const n = trades.length;

        // Calculate win rate for this cluster
        const winningTrades = trades.filter((t) => this.isWinningTrade(t));
        const winRate = winningTrades.length / n;

        // Extract common features
        const features = this.extractCommonFeatures(trades);

        // Check if this cluster meets support threshold
        if (n >= this.config.minSupport * n) {
            // Create pattern if win rate meets confidence threshold
            if (winRate >= this.config.minConfidence) {
                const avgPnl = this.calculateAvgPnl(trades);

                patterns.push({
                    id: `pattern_cluster_${clusterId}_${Date.now()}`,
                    clusterId,
                    features,
                    trades,
                    winRate,
                    avgPnl,
                    confidence: winRate * this.calculateSupportScore(n),
                    discoveredAt: Date.now(),
                    status: winRate >= 0.6 ? "validated" : "discovered",
                });
            }
        }

        return patterns;
    }

    private isWinningTrade(trade: TradeMemory): boolean {
        // Simple heuristic: trade is winning if no mistakes recorded
        // In real implementation, compare exit price to entry
        return trade.mistakes.length === 0;
    }

    private extractCommonFeatures(trades: TradeMemory[]): Record<string, number> {
        // Count strategy occurrences
        const strategyCounts: Record<string, number> = {};
        const conditionCounts: Record<string, number> = {};

        for (const trade of trades) {
            strategyCounts[trade.strategy] = (strategyCounts[trade.strategy] || 0) + 1;
            conditionCounts[trade.marketCondition] = (conditionCounts[trade.marketCondition] || 0) + 1;
        }

        const n = trades.length;
        const features: Record<string, number> = {};

        // Add strategies that appear in >50% of trades
        for (const [strategy, count] of Object.entries(strategyCounts)) {
            if (count / n > 0.5) {
                features[`strategy_${strategy}`] = count / n;
            }
        }

        // Add market conditions that appear in >50% of trades
        for (const [condition, count] of Object.entries(conditionCounts)) {
            if (count / n > 0.5) {
                features[`condition_${condition}`] = count / n;
            }
        }

        return features;
    }

    private calculateAvgPnl(trades: TradeMemory[]): number {
        // Simplified - in real implementation would calculate actual P&L
        return trades.length > 0 ? 100 * (trades.filter((t) => this.isWinningTrade(t)).length / trades.length) : 0;
    }

    private calculateSupportScore(tradeCount: number): number {
        // Higher score for patterns with more supporting trades
        return Math.min(tradeCount / 10, 1);
    }
}
