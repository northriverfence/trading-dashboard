import { OrderManager } from "./order-manager.js";
import { PortfolioTracker } from "./portfolio-tracker.js";
import type { Order, Quote, Trade } from "./types.js";

interface TradingEngineConfig {
  initialCash: number;
}

export class TradingEngine {
  private orderManager: OrderManager;
  private portfolioTracker: PortfolioTracker;
  private config: TradingEngineConfig;
  private quoteOverrides: Map<string, Quote> = new Map();

  constructor(config: TradingEngineConfig) {
    this.config = config;
    this.orderManager = new OrderManager();
    this.portfolioTracker = new PortfolioTracker(config.initialCash);
  }

  async submitOrder(orderInput: Omit<Order, "id" | "status" | "createdAt">): Promise<Order> {
    const order: Order = {
      ...orderInput,
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      createdAt: new Date(),
    };

    const validation = this.validateOrder(order);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (order.type === "market") {
      const quote = await this.getQuote(order.symbol);
      const fillPrice = order.side === "buy" ? quote.ask : quote.bid;

      order.status = "filled";
      order.filledQty = order.qty;
      order.avgPrice = fillPrice;
      order.updatedAt = new Date();

      const trade: Trade = {
        id: `tr_${Date.now()}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        price: fillPrice,
        timestamp: new Date(),
      };

      this.portfolioTracker.processTrade(trade);
    }

    this.orderManager.addOrder(order);
    return order;
  }

  private validateOrder(order: Order): { valid: boolean; error?: string } {
    const portfolio = this.portfolioTracker.getPortfolio();

    if (order.side === "buy") {
      const estimatedCost = order.qty * (order.limitPrice || 100);
      if (estimatedCost > portfolio.cash) {
        return { valid: false, error: "insufficient funds" };
      }
    }

    return { valid: true };
  }

  async cancelOrder(id: string): Promise<boolean> {
    return this.orderManager.cancelOrder(id);
  }

  getOrder(id: string): Order | null {
    return this.orderManager.getOrder(id);
  }

  getAllOrders(): Order[] {
    return this.orderManager.getAllOrders();
  }

  getOpenOrders(): Order[] {
    return this.orderManager.getOpenOrders();
  }

  getPortfolio() {
    return this.portfolioTracker.getPortfolio();
  }

  async getQuote(symbol: string): Promise<Quote> {
    // Check for quote override first (used in backtesting)
    const override = this.quoteOverrides.get(symbol);
    if (override) {
      return override;
    }

    const basePrice = 150 + Math.random() * 50;
    const spread = 0.02;

    return {
      symbol,
      bid: basePrice - spread,
      ask: basePrice + spread,
      lastPrice: basePrice,
      volume: Math.floor(Math.random() * 1000000),
      timestamp: new Date(),
    };
  }

  updateMarketPrices(prices: Record<string, number>): void {
    this.portfolioTracker.updatePrices(prices);
  }

  setQuoteOverride(symbol: string, quote: Quote): void {
    this.quoteOverrides.set(symbol, quote);
  }

  clearQuoteOverrides(): void {
    this.quoteOverrides.clear();
  }
}
