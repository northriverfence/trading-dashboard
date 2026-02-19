/**
 * Execution Simulator
 * Simulates order fills with slippage and commission
 */

import type { OrderRequest, Bar, Quote } from "../adapters/types.js";
import type { ExecutionSimulator as IExecutionSimulator, Fill, FillModel } from "./types.js";

export class ExecutionSimulator implements IExecutionSimulator {
  private commission: number;
  private slippage: number;

  constructor(commission: number = 0.001, slippage: number = 0.001) {
    this.commission = commission;
    this.slippage = slippage;
  }

  simulateFill(order: OrderRequest, bar: Bar, fillModel: FillModel): Fill | null {
    const timestamp = new Date(bar.timestamp);

    switch (fillModel) {
      case "immediate":
        return this.fillImmediate(order, bar, timestamp);
      case "next_bar":
        return this.fillNextBar(order, bar, timestamp);
      case "market":
        return this.fillMarket(order, bar, timestamp);
      case "limit":
        return this.fillLimit(order, bar, timestamp);
      default:
        return this.fillImmediate(order, bar, timestamp);
    }
  }

  private fillImmediate(order: OrderRequest, bar: Bar, timestamp: Date): Fill | null {
    // Fill at current bar's close price
    const fillPrice = this.applySlippage(bar.close, order.side, bar.volume);
    const commission = this.calculateCommission(fillPrice * order.qty);

    return {
      orderId: this.generateOrderId(),
      symbol: order.symbol,
      side: order.side,
      qty: order.qty,
      price: fillPrice,
      timestamp,
      commission,
      slippage: Math.abs(fillPrice - bar.close),
    };
  }

  private fillNextBar(order: OrderRequest, bar: Bar, timestamp: Date): Fill | null {
    // For next_bar model, we would need the next bar's data
    // For now, fill at current bar's close
    return this.fillImmediate(order, bar, timestamp);
  }

  private fillMarket(order: OrderRequest, bar: Bar, timestamp: Date): Fill | null {
    // Market order fills at open + small slippage
    const fillPrice = this.applySlippage(bar.open, order.side, bar.volume);
    const commission = this.calculateCommission(fillPrice * order.qty);

    return {
      orderId: this.generateOrderId(),
      symbol: order.symbol,
      side: order.side,
      qty: order.qty,
      price: fillPrice,
      timestamp,
      commission,
      slippage: Math.abs(fillPrice - bar.open),
    };
  }

  private fillLimit(order: OrderRequest, bar: Bar, timestamp: Date): Fill | null {
    if (!order.limitPrice) {
      // No limit price specified, treat as market order
      return this.fillMarket(order, bar, timestamp);
    }

    const limitPrice = order.limitPrice;

    // Check if limit order would fill
    if (order.side === "buy") {
      // Buy limit order fills if low <= limit price
      if (bar.low <= limitPrice) {
        // Fill at the better of limit price or open
        const fillPrice = Math.min(limitPrice, bar.open);
        const finalPrice = this.applySlippage(fillPrice, "buy", bar.volume);
        const commission = this.calculateCommission(finalPrice * order.qty);

        return {
          orderId: this.generateOrderId(),
          symbol: order.symbol,
          side: "buy",
          qty: order.qty,
          price: finalPrice,
          timestamp,
          commission,
          slippage: Math.abs(finalPrice - fillPrice),
        };
      }
    } else {
      // Sell limit order fills if high >= limit price
      if (bar.high >= limitPrice) {
        // Fill at the better of limit price or open
        const fillPrice = Math.max(limitPrice, bar.open);
        const finalPrice = this.applySlippage(fillPrice, "sell", bar.volume);
        const commission = this.calculateCommission(finalPrice * order.qty);

        return {
          orderId: this.generateOrderId(),
          symbol: order.symbol,
          side: "sell",
          qty: order.qty,
          price: finalPrice,
          timestamp,
          commission,
          slippage: Math.abs(finalPrice - fillPrice),
        };
      }
    }

    // Limit order didn't fill
    return null;
  }

  simulateQuoteFill(order: OrderRequest, quote: Quote, fillModel: FillModel): Fill | null {
    if (fillModel === "limit" && order.limitPrice) {
      // Check limit order against quote
      if (order.side === "buy") {
        if (quote.ask <= order.limitPrice) {
          const fillPrice = this.applySlippage(quote.ask, "buy", quote.askSize);
          const commission = this.calculateCommission(fillPrice * order.qty);

          return {
            orderId: this.generateOrderId(),
            symbol: order.symbol,
            side: "buy",
            qty: Math.min(order.qty, quote.askSize),
            price: fillPrice,
            timestamp: new Date(quote.timestamp),
            commission,
            slippage: Math.abs(fillPrice - quote.ask),
          };
        }
      } else {
        if (quote.bid >= order.limitPrice) {
          const fillPrice = this.applySlippage(quote.bid, "sell", quote.bidSize);
          const commission = this.calculateCommission(fillPrice * order.qty);

          return {
            orderId: this.generateOrderId(),
            symbol: order.symbol,
            side: "sell",
            qty: Math.min(order.qty, quote.bidSize),
            price: fillPrice,
            timestamp: new Date(quote.timestamp),
            commission,
            slippage: Math.abs(fillPrice - quote.bid),
          };
        }
      }
      return null;
    }

    // Market/immediate fill at quote
    const fillPrice = order.side === "buy" ? quote.ask : quote.bid;
    const fillSize = order.side === "buy" ? quote.askSize : quote.bidSize;
    const finalPrice = this.applySlippage(fillPrice, order.side, fillSize);
    const commission = this.calculateCommission(finalPrice * order.qty);

    return {
      orderId: this.generateOrderId(),
      symbol: order.symbol,
      side: order.side,
      qty: Math.min(order.qty, fillSize),
      price: finalPrice,
      timestamp: new Date(quote.timestamp),
      commission,
      slippage: Math.abs(finalPrice - fillPrice),
    };
  }

  calculateSlippage(price: number, side: "buy" | "sell", volume: number): number {
    // Slippage increases with order size relative to volume
    // Base slippage + variable slippage based on volume
    const volumeFactor = volume > 0 ? Math.min(1, 10000 / volume) : 1;
    const slippagePercent = this.slippage * (1 + volumeFactor);

    if (side === "buy") {
      return price * (1 + slippagePercent);
    } else {
      return price * (1 - slippagePercent);
    }
  }

  private applySlippage(price: number, side: "buy" | "sell", volume: number): number {
    return this.calculateSlippage(price, side, volume);
  }

  calculateCommission(notional: number): number {
    return notional * this.commission;
  }

  private generateOrderId(): string {
    return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
