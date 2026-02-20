import type { Position, Trade } from "./types.js";

export class PositionManager {
  private positions: Map<string, Position> = new Map();

  processTrade(trade: Trade): void {
    const existingPosition = this.positions.get(trade.symbol);

    if (trade.side === "buy") {
      this.handleBuyTrade(trade, existingPosition);
    } else {
      this.handleSellTrade(trade, existingPosition);
    }
  }

  private handleBuyTrade(trade: Trade, existingPosition?: Position): void {
    if (!existingPosition) {
      this.positions.set(trade.symbol, {
        symbol: trade.symbol,
        side: "long",
        qty: trade.qty,
        avgEntryPrice: trade.price,
        currentPrice: trade.price,
        unrealizedPnl: 0,
        realizedPnl: 0,
        openedAt: trade.timestamp,
      });
    } else {
      const totalCost = existingPosition.qty * existingPosition.avgEntryPrice + trade.qty * trade.price;
      const newQty = existingPosition.qty + trade.qty;

      existingPosition.qty = newQty;
      existingPosition.avgEntryPrice = totalCost / newQty;
      existingPosition.unrealizedPnl = (existingPosition.currentPrice - existingPosition.avgEntryPrice) * newQty;
    }
  }

  private handleSellTrade(trade: Trade, existingPosition?: Position): void {
    if (!existingPosition) return;

    const sellQty = Math.min(trade.qty, existingPosition.qty);
    const realizedPnl = (trade.price - existingPosition.avgEntryPrice) * sellQty;
    existingPosition.realizedPnl += realizedPnl;
    existingPosition.qty -= sellQty;

    if (existingPosition.qty <= 0) {
      this.positions.delete(trade.symbol);
    } else {
      existingPosition.unrealizedPnl =
        (existingPosition.currentPrice - existingPosition.avgEntryPrice) * existingPosition.qty;
    }
  }

  updatePrice(symbol: string, price: number): void {
    const position = this.positions.get(symbol);
    if (!position) return;

    position.currentPrice = price;
    position.unrealizedPnl = (price - position.avgEntryPrice) * position.qty;
  }

  getPosition(symbol: string): Position | null {
    return this.positions.get(symbol) ?? null;
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getTotalUnrealizedPnl(): number {
    return this.getAllPositions().reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  }

  getTotalRealizedPnl(): number {
    return this.getAllPositions().reduce((sum, pos) => sum + pos.realizedPnl, 0);
  }

  clear(): void {
    this.positions.clear();
  }
}
