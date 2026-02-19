/**
 * Alpaca Exchange Adapter
 * Implements ExchangeAdapter for Alpaca Markets API
 */

import Alpaca from "@alpacahq/alpaca-trade-api";
import { BaseAdapter } from "../base-adapter.js";
import type {
  Quote,
  Bar,
  Trade,
  Account,
  Position,
  Order,
  OrderRequest,
  MarketStatus,
  AlpacaConfig,
} from "../types.js";

export class AlpacaAdapter extends BaseAdapter {
  private client: Alpaca;
  private config: AlpacaConfig;
  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();

  constructor(config: AlpacaConfig) {
    super();
    this.config = config;
    this.client = new Alpaca({
      keyId: config.apiKey,
      secretKey: config.secretKey,
      paper: config.paper,
    });
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      // Test connection by fetching account info
      await this.client.getAccount();
      this.connected = true;
      console.log(`✅ Connected to Alpaca (${this.config.paper ? "paper" : "live"})`);
    } catch (error) {
      console.error("Failed to connect to Alpaca:", error);
      throw error;
    }
  }

  disconnect(): void {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedSymbols.clear();
    console.log("Disconnected from Alpaca");
  }

  async getQuote(symbol: string): Promise<Quote> {
    try {
      const quote = await this.client.getLatestQuote(symbol);
      return {
        symbol,
        bid: quote.bidPrice,
        ask: quote.askPrice,
        bidSize: quote.bidSize,
        askSize: quote.askSize,
        lastPrice: (quote.bidPrice + quote.askPrice) / 2,
        lastSize: 0,
        timestamp: new Date(quote.timestamp),
        exchange: "NASDAQ",
      };
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      throw error;
    }
  }

  async getHistoricalBars(symbol: string, timeframe: string = "1Day", limit: number = 100): Promise<Bar[]> {
    try {
      const response = await this.client.getBars(symbol, {
        timeframe,
        limit,
      });

      return response.bars.map((bar: { t: string; o: number; h: number; l: number; c: number; v: number }) => ({
        symbol,
        timestamp: new Date(bar.t),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));
    } catch (error) {
      console.error(`Error fetching historical bars for ${symbol}:`, error);
      throw error;
    }
  }

  async getMarketStatus(): Promise<MarketStatus> {
    try {
      const clock = await this.client.getClock();
      return {
        isOpen: clock.is_open,
        nextOpen: new Date(clock.next_open),
        nextClose: new Date(clock.next_close),
        timestamp: new Date(clock.timestamp),
      };
    } catch (error) {
      console.error("Error fetching market status:", error);
      throw error;
    }
  }

  async subscribe(symbols: string[], channels?: string[]): Promise<void> {
    // Alpaca WebSocket subscription would go here
    // For now, just track subscriptions
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol));
    console.log(`Subscribed to: ${symbols.join(", ")}`);
  }

  unsubscribe(symbols: string[]): void {
    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol));
    console.log(`Unsubscribed from: ${symbols.join(", ")}`);
  }

  async getAccount(): Promise<Account> {
    try {
      const account = await this.client.getAccount();
      return {
        id: account.id,
        buyingPower: parseFloat(String(account.buying_power)),
        cash: parseFloat(String(account.cash)),
        portfolioValue: parseFloat(String(account.portfolio_value)),
        equity: parseFloat(String(account.equity)),
        dayTradeCount: account.daytrade_count,
        isPatternDayTrader: account.pattern_day_trader,
        tradingBlocked: account.trading_blocked,
      };
    } catch (error) {
      console.error("Error fetching account info:", error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const positions = await this.client.getPositions();
      return positions.map((pos) => ({
        symbol: pos.symbol,
        qty: parseFloat(pos.qty),
        entryPrice: parseFloat(pos.avg_entry_price),
        currentPrice: parseFloat(pos.current_price),
        marketValue: parseFloat(pos.qty) * parseFloat(pos.current_price),
        unrealizedPnl: parseFloat(pos.unrealized_pl),
        realizedPnl: 0,
      }));
    } catch (error) {
      // No positions returns error
      return [];
    }
  }

  async submitOrder(request: OrderRequest): Promise<Order> {
    try {
      const orderData = {
        symbol: request.symbol,
        qty: request.qty,
        side: request.side,
        type: request.type as "market" | "limit" | "stop" | "stop_limit" | "trailing_stop",
        time_in_force: request.timeInForce as "day" | "gtc" | "opg" | "cls" | "ioc" | "fok",
        limit_price: request.limitPrice,
        stop_price: request.stopPrice,
      };

      const order = await this.client.createOrder(orderData);

      return {
        id: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        qty: parseFloat(order.qty),
        filledQty: parseFloat(order.filled_qty || "0"),
        type: order.type as Order["type"],
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        timeInForce: order.time_in_force as Order["timeInForce"],
        status: this.mapOrderStatus(order.status),
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at || order.created_at),
        filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : undefined,
      };
    } catch (error) {
      console.error("Error submitting order:", error);
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      await this.client.cancelOrder(orderId);
    } catch (error) {
      console.error(`Error canceling order ${orderId}:`, error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    try {
      const order = await this.client.getOrder(orderId);
      return {
        id: order.id,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side,
        qty: parseFloat(order.qty),
        filledQty: parseFloat(order.filled_qty || "0"),
        type: order.type as Order["type"],
        limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
        stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
        timeInForce: order.time_in_force as Order["timeInForce"],
        status: this.mapOrderStatus(order.status),
        createdAt: new Date(order.created_at),
        updatedAt: new Date(order.updated_at || order.created_at),
        filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : undefined,
      };
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  }

  private mapOrderStatus(status: string): Order["status"] {
    const statusMap: Record<string, Order["status"]> = {
      new: "pending",
      partially_filled: "partially_filled",
      filled: "filled",
      done_for_day: "filled",
      canceled: "canceled",
      expired: "expired",
      replaced: "open",
      pending_cancel: "open",
      pending_replace: "open",
      accepted: "open",
      pending_new: "pending",
      accepted_for_bidding: "pending",
      stopped: "open",
      rejected: "rejected",
      suspended: "open",
      calculated: "open",
    };
    return statusMap[status] || "pending";
  }
}
