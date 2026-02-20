import { PositionManager } from "./position-manager.js";
import type { Portfolio, Trade } from "./types.js";

export class PortfolioTracker {
  private positionManager: PositionManager;
  private initialCash: number;
  private cash: number;
  private startingEquity: number;

  constructor(initialCash: number) {
    this.initialCash = initialCash;
    this.cash = initialCash;
    this.startingEquity = initialCash;
    this.positionManager = new PositionManager();
  }

  processTrade(trade: Trade): void {
    const tradeValue = trade.price * trade.qty;

    if (trade.side === "buy") {
      this.cash -= tradeValue;
    } else {
      this.cash += tradeValue;
    }

    this.positionManager.processTrade(trade);
  }

  updatePrices(prices: Record<string, number>): void {
    for (const [symbol, price] of Object.entries(prices)) {
      this.positionManager.updatePrice(symbol, price);
    }
  }

  getPortfolio(): Portfolio {
    const positions = this.positionManager.getAllPositions();
    const positionsValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.qty, 0);

    const totalPnl = this.positionManager.getTotalRealizedPnl();
    const currentEquity = this.cash + positionsValue;
    const dailyPnl = currentEquity - this.startingEquity;

    return {
      cash: this.cash,
      equity: currentEquity,
      buyingPower: this.cash,
      positions,
      dailyPnl,
      totalPnl,
    };
  }

  reset(): void {
    this.cash = this.initialCash;
    this.startingEquity = this.initialCash;
    this.positionManager.clear();
  }
}
