import { tradingDB, type TradeMemory } from "../agentdb-integration.js";

export class SyncManager {
  private tradingDB = tradingDB;

  async syncTradeToAgentDB(trade: TradeMemory): Promise<void> {
    await this.tradingDB.storeTrade(trade);
  }

  async getUnsyncedTrades(): Promise<TradeMemory[]> {
    // Placeholder - will implement full sync logic later
    return [];
  }
}
