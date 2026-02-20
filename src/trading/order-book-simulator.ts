// OrderBookSimulator - Advanced Market Simulation for Tier 3
// Simulates a real order book with bid/ask levels, order matching, and price-time priority

export interface PriceLevel {
  price: number;
  size: number;
  orderCount: number;
}

export interface InternalOrder {
  id: string;
  side: "buy" | "sell";
  price: number;
  qty: number;
  timestamp: number;
}

export interface TradeExecution {
  price: number;
  qty: number;
}

export interface OrderResult {
  filled: boolean;
  filledQty: number;
  remainingQty: number;
  avgPrice: number | null;
  trades: TradeExecution[];
}

export interface OrderBookQuote {
  symbol: string;
  bid: number | null;
  ask: number | null;
  bidSize: number;
  askSize: number;
  lastPrice: number | null;
  lastSize: number | null;
  timestamp: Date;
}

export interface OrderBookDepth {
  bids: PriceLevel[];
  asks: PriceLevel[];
}

export class OrderBookSimulator {
  private symbol: string;
  private bids: Map<number, InternalOrder[]> = new Map(); // price -> orders
  private asks: Map<number, InternalOrder[]> = new Map(); // price -> orders
  private lastPrice: number | null = null;
  private lastSize: number | null = null;
  private totalVolume: number = 0;
  private orderIdCounter: number = 0;

  constructor(symbol: string) {
    this.symbol = symbol;
  }

  /**
   * Add a limit order to the book
   * @param side - "buy" or "sell"
   * @param price - Limit price
   * @param qty - Order quantity
   * @param timestamp - Order timestamp (for FIFO priority)
   * @returns Order ID
   */
  addLimitOrder(side: "buy" | "sell", price: number, qty: number, timestamp: number): string {
    const orderId = this.generateOrderId();
    const order: InternalOrder = {
      id: orderId,
      side,
      price,
      qty,
      timestamp,
    };

    const book = side === "buy" ? this.bids : this.asks;
    if (!book.has(price)) {
      book.set(price, []);
    }
    book.get(price)!.push(order);

    return orderId;
  }

  /**
   * Execute a market order (immediate execution at best available price)
   * @param side - "buy" or "sell"
   * @param qty - Order quantity
   * @returns Order execution result
   */
  executeMarketOrder(side: "buy" | "sell", qty: number): OrderResult {
    const result: OrderResult = {
      filled: false,
      filledQty: 0,
      remainingQty: qty,
      avgPrice: null,
      trades: [],
    };

    if (qty <= 0) {
      return result;
    }

    // Buy: match against asks (lowest price first)
    // Sell: match against bids (highest price first)
    const opposingBook = side === "buy" ? this.asks : this.bids;

    // Get sorted prices
    const sortedPrices = this.getSortedPrices(opposingBook, side === "buy");

    let totalValue = 0;

    for (const price of sortedPrices) {
      if (result.remainingQty <= 0) break;

      const ordersAtPrice = opposingBook.get(price);
      if (!ordersAtPrice || ordersAtPrice.length === 0) continue;

      // Match against orders at this price level (FIFO)
      while (result.remainingQty > 0 && ordersAtPrice.length > 0) {
        const restingOrder = ordersAtPrice[0];
        const fillQty = Math.min(result.remainingQty, restingOrder.qty);

        // Execute trade
        result.trades.push({ price, qty: fillQty });
        totalValue += price * fillQty;
        result.filledQty += fillQty;
        result.remainingQty -= fillQty;
        this.totalVolume += fillQty;

        // Update resting order
        restingOrder.qty -= fillQty;
        if (restingOrder.qty <= 0) {
          ordersAtPrice.shift(); // Remove filled order
        }
      }

      // Clean up empty price levels
      if (ordersAtPrice.length === 0) {
        opposingBook.delete(price);
      }
    }

    // Update result
    if (result.filledQty > 0) {
      result.filled = true;
      result.avgPrice = totalValue / result.filledQty;
      this.lastPrice = result.trades[result.trades.length - 1].price;
      this.lastSize = result.filledQty;
    }

    return result;
  }

  /**
   * Execute a limit order (crosses spread if possible, otherwise adds to book)
   * @param side - "buy" or "sell"
   * @param price - Limit price
   * @param qty - Order quantity
   * @param timestamp - Order timestamp
   * @returns Order execution result
   */
  executeLimitOrder(side: "buy" | "sell", price: number, qty: number, timestamp: number): OrderResult {
    // Check if order crosses the spread
    const canExecute = this.canCrossSpread(side, price);

    if (!canExecute) {
      // Add to book without execution
      this.addLimitOrder(side, price, qty, timestamp);
      return {
        filled: false,
        filledQty: 0,
        remainingQty: qty,
        avgPrice: null,
        trades: [],
      };
    }

    // Execute as market order up to available liquidity at acceptable prices
    return this.executeLimitOrderWithCrossing(side, price, qty);
  }

  /**
   * Get all bid price levels (sorted highest to lowest)
   */
  getBids(): PriceLevel[] {
    const sortedPrices = Array.from(this.bids.keys()).sort((a, b) => b - a);
    return sortedPrices.map((price) => this.getPriceLevel(this.bids, price)).filter((level) => level.size > 0);
  }

  /**
   * Get all ask price levels (sorted lowest to highest)
   */
  getAsks(): PriceLevel[] {
    const sortedPrices = Array.from(this.asks.keys()).sort((a, b) => a - b);
    return sortedPrices.map((price) => this.getPriceLevel(this.asks, price)).filter((level) => level.size > 0);
  }

  /**
   * Get order book depth (all price levels)
   */
  getDepth(): OrderBookDepth {
    return {
      bids: this.getBids(),
      asks: this.getAsks(),
    };
  }

  /**
   * Get best bid (highest buy price)
   */
  getBestBid(): PriceLevel | null {
    const bids = this.getBids();
    return bids.length > 0 ? bids[0] : null;
  }

  /**
   * Get best ask (lowest sell price)
   */
  getBestAsk(): PriceLevel | null {
    const asks = this.getAsks();
    return asks.length > 0 ? asks[0] : null;
  }

  /**
   * Calculate bid-ask spread
   */
  getSpread(): number | null {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();

    if (bestBid === null || bestAsk === null) {
      return null;
    }

    return bestAsk.price - bestBid.price;
  }

  /**
   * Get current quote (bid/ask/last price)
   */
  getQuote(): OrderBookQuote {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();

    return {
      symbol: this.symbol,
      bid: bestBid?.price ?? null,
      ask: bestAsk?.price ?? null,
      bidSize: bestBid?.size ?? 0,
      askSize: bestAsk?.size ?? 0,
      lastPrice: this.lastPrice,
      lastSize: this.lastSize,
      timestamp: new Date(),
    };
  }

  /**
   * Get total volume traded
   */
  getTotalVolume(): number {
    return this.totalVolume;
  }

  /**
   * Clear all orders and reset state
   */
  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.lastPrice = null;
    this.lastSize = null;
    this.totalVolume = 0;
    this.orderIdCounter = 0;
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(): string {
    return `${this.symbol}_${Date.now()}_${++this.orderIdCounter}`;
  }

  /**
   * Get sorted prices from a price level map
   */
  private getSortedPrices(book: Map<number, InternalOrder[]>, ascending: boolean): number[] {
    const prices = Array.from(book.keys());
    return ascending ? prices.sort((a, b) => a - b) : prices.sort((a, b) => b - a);
  }

  /**
   * Get aggregated price level info
   */
  private getPriceLevel(book: Map<number, InternalOrder[]>, price: number): PriceLevel {
    const orders = book.get(price) || [];
    const size = orders.reduce((sum, order) => sum + order.qty, 0);
    return {
      price,
      size,
      orderCount: orders.length,
    };
  }

  /**
   * Check if a limit order can cross the spread
   */
  private canCrossSpread(side: "buy" | "sell", price: number): boolean {
    if (side === "buy") {
      const bestAsk = this.getBestAsk();
      return bestAsk !== null && price >= bestAsk.price;
    } else {
      const bestBid = this.getBestBid();
      return bestBid !== null && price <= bestBid.price;
    }
  }

  /**
   * Execute limit order that crosses the spread
   */
  private executeLimitOrderWithCrossing(side: "buy" | "sell", price: number, qty: number): OrderResult {
    const result: OrderResult = {
      filled: false,
      filledQty: 0,
      remainingQty: qty,
      avgPrice: null,
      trades: [],
    };

    const opposingBook = side === "buy" ? this.asks : this.bids;
    const sortedPrices = this.getSortedPrices(opposingBook, side === "buy");

    let totalValue = 0;

    for (const restingPrice of sortedPrices) {
      if (result.remainingQty <= 0) break;

      // For buy orders: only match if resting ask <= limit price
      // For sell orders: only match if resting bid >= limit price
      if (side === "buy" && restingPrice > price) break;
      if (side === "sell" && restingPrice < price) break;

      const ordersAtPrice = opposingBook.get(restingPrice);
      if (!ordersAtPrice || ordersAtPrice.length === 0) continue;

      // Match against orders at this price level (FIFO)
      while (result.remainingQty > 0 && ordersAtPrice.length > 0) {
        const restingOrder = ordersAtPrice[0];
        const fillQty = Math.min(result.remainingQty, restingOrder.qty);

        // Execute trade
        result.trades.push({ price: restingPrice, qty: fillQty });
        totalValue += restingPrice * fillQty;
        result.filledQty += fillQty;
        result.remainingQty -= fillQty;
        this.totalVolume += fillQty;

        // Update resting order
        restingOrder.qty -= fillQty;
        if (restingOrder.qty <= 0) {
          ordersAtPrice.shift(); // Remove filled order
        }
      }

      // Clean up empty price levels
      if (ordersAtPrice.length === 0) {
        opposingBook.delete(restingPrice);
      }
    }

    // Update result
    if (result.filledQty > 0) {
      result.filled = true;
      result.avgPrice = totalValue / result.filledQty;
      this.lastPrice = result.trades[result.trades.length - 1].price;
      this.lastSize = result.filledQty;
    }

    // Add remaining quantity to book as limit order
    if (result.remainingQty > 0) {
      this.addLimitOrder(side, price, result.remainingQty, Date.now());
    }

    return result;
  }
}
