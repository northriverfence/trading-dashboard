import type { Order, Position } from "./types.js";
import type { AlpacaConfig } from "./alpaca-provider.js";

export interface AccountInfo {
  cash: number;
  equity: number;
  buyingPower: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  error?: string;
}

export class AlpacaBroker {
  private config: AlpacaConfig;
  private baseUrl: string;

  constructor(config: AlpacaConfig) {
    this.config = config;
    this.baseUrl = config.paper ? "https://paper-api.alpaca.markets" : "https://api.alpaca.markets";
  }

  async submitOrder(order: Order): Promise<OrderResult> {
    // Simulated execution - in real impl, would call Alpaca API
    const filledPrice = 150 + Math.random() * 50;

    return {
      success: true,
      orderId: order.id,
      filledPrice,
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // Simulated - would call Alpaca API
    return true;
  }

  async getAccount(): Promise<AccountInfo> {
    // Simulated - would call Alpaca API
    return {
      cash: 100000,
      equity: 100000,
      buyingPower: 200000,
    };
  }

  async getPositions(): Promise<Position[]> {
    // Simulated - would call Alpaca API
    return [];
  }
}
