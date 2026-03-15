import { describe, it, expect, beforeEach } from "bun:test";
import { OrderBookSimulator } from "../../trading/order-book-simulator.js";

describe("OrderBookSimulator", () => {
  let orderBook: OrderBookSimulator;

  beforeEach(() => {
    orderBook = new OrderBookSimulator("AAPL");
  });

  describe("Initialization", () => {
    it("should initialize with empty order book", () => {
      expect(orderBook.getBids()).toHaveLength(0);
      expect(orderBook.getAsks()).toHaveLength(0);
      expect(orderBook.getBestBid()).toBeNull();
      expect(orderBook.getBestAsk()).toBeNull();
      expect(orderBook.getSpread()).toBeNull();
      expect(orderBook.getTotalVolume()).toBe(0);

      const quote = orderBook.getQuote();
      expect(quote.bid).toBeNull();
      expect(quote.ask).toBeNull();
      expect(quote.bidSize).toBe(0);
      expect(quote.askSize).toBe(0);
    });

    it("should store the symbol correctly", () => {
      const quote = orderBook.getQuote();
      expect(quote.symbol).toBe("AAPL");
    });
  });

  describe("Limit Order Book Management", () => {
    it("should add bid limit orders and maintain sorted order (highest first)", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("buy", 102, 5, Date.now() + 1);
      orderBook.addLimitOrder("buy", 101, 8, Date.now() + 2);

      const bids = orderBook.getBids();
      expect(bids.length).toBe(3);
      expect(bids[0].price).toBe(102); // Highest bid first
      expect(bids[1].price).toBe(101);
      expect(bids[2].price).toBe(100);
    });

    it("should add ask limit orders and maintain sorted order (lowest first)", () => {
      orderBook.addLimitOrder("sell", 105, 10, Date.now());
      orderBook.addLimitOrder("sell", 103, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 104, 8, Date.now() + 2);

      const asks = orderBook.getAsks();
      expect(asks.length).toBe(3);
      expect(asks[0].price).toBe(103); // Lowest ask first
      expect(asks[1].price).toBe(104);
      expect(asks[2].price).toBe(105);
    });

    it("should aggregate multiple orders at the same price level", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("buy", 100, 5, Date.now() + 1);
      orderBook.addLimitOrder("buy", 100, 3, Date.now() + 2);

      const bids = orderBook.getBids();
      expect(bids.length).toBe(1);
      expect(bids[0].price).toBe(100);
      expect(bids[0].size).toBe(18); // 10 + 5 + 3
      expect(bids[0].orderCount).toBe(3);
    });

    it("should track order book depth at each price level", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("buy", 100, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 101, 8, Date.now() + 2);

      const depth = orderBook.getDepth();
      expect(depth.bids.length).toBe(1);
      expect(depth.bids[0]).toEqual({ price: 100, size: 15, orderCount: 2 });
      expect(depth.asks.length).toBe(1);
      expect(depth.asks[0]).toEqual({ price: 101, size: 8, orderCount: 1 });
    });
  });

  describe("Order Matching", () => {
    it("should match market buy order against best ask", () => {
      // Setup: Add asks
      orderBook.addLimitOrder("sell", 101, 10, Date.now());
      orderBook.addLimitOrder("sell", 102, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 103, 8, Date.now() + 2);

      const result = orderBook.executeMarketOrder("buy", 7);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(7);
      expect(result.avgPrice).toBe(101); // Best ask price
      expect(result.trades.length).toBe(1);
      expect(result.trades[0].price).toBe(101);
      expect(result.trades[0].qty).toBe(7);
    });

    it("should match market sell order against best bid", () => {
      // Setup: Add bids
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("buy", 99, 5, Date.now() + 1);
      orderBook.addLimitOrder("buy", 98, 8, Date.now() + 2);

      const result = orderBook.executeMarketOrder("sell", 6);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(6);
      expect(result.avgPrice).toBe(100); // Best bid price
      expect(result.trades.length).toBe(1);
      expect(result.trades[0].price).toBe(100);
      expect(result.trades[0].qty).toBe(6);
    });

    it("should partially fill market buy when size exceeds available at best ask", () => {
      orderBook.addLimitOrder("sell", 101, 5, Date.now());
      orderBook.addLimitOrder("sell", 102, 10, Date.now() + 1);

      const result = orderBook.executeMarketOrder("buy", 12);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(12);
      expect(result.avgPrice).toBe((101 * 5 + 102 * 7) / 12);
      expect(result.trades.length).toBe(2);
      expect(result.trades[0]).toEqual({ price: 101, qty: 5 });
      expect(result.trades[1]).toEqual({ price: 102, qty: 7 });
    });

    it("should partially fill market sell when size exceeds available at best bid", () => {
      orderBook.addLimitOrder("buy", 100, 5, Date.now());
      orderBook.addLimitOrder("buy", 99, 10, Date.now() + 1);

      const result = orderBook.executeMarketOrder("sell", 12);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(12);
      expect(result.avgPrice).toBe((100 * 5 + 99 * 7) / 12);
      expect(result.trades.length).toBe(2);
      expect(result.trades[0]).toEqual({ price: 100, qty: 5 });
      expect(result.trades[1]).toEqual({ price: 99, qty: 7 });
    });

    it("should use FIFO priority for orders at same price level", () => {
      const ts1 = Date.now();
      const ts2 = ts1 + 100;
      const ts3 = ts1 + 200;

      orderBook.addLimitOrder("sell", 101, 5, ts1);
      orderBook.addLimitOrder("sell", 101, 5, ts2);
      orderBook.addLimitOrder("sell", 101, 5, ts3);

      const result = orderBook.executeMarketOrder("buy", 12);

      expect(result.filledQty).toBe(12);
      expect(result.trades.length).toBe(3);
      // First order should be fully filled (5)
      expect(result.trades[0].qty).toBe(5);
      // Second order should be fully filled (5)
      expect(result.trades[1].qty).toBe(5);
      // Third order should be partially filled (2)
      expect(result.trades[2].qty).toBe(2);
    });

    it("should handle market buy with insufficient liquidity", () => {
      orderBook.addLimitOrder("sell", 101, 5, Date.now());

      const result = orderBook.executeMarketOrder("buy", 10);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(5); // Only 5 available
      expect(result.remainingQty).toBe(5);
      expect(result.trades.length).toBe(1);
    });

    it("should handle market sell with insufficient liquidity", () => {
      orderBook.addLimitOrder("buy", 100, 3, Date.now());

      const result = orderBook.executeMarketOrder("sell", 8);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(3); // Only 3 available
      expect(result.remainingQty).toBe(5);
      expect(result.trades.length).toBe(1);
    });

    it("should return unfilled result when no opposing orders exist", () => {
      const result = orderBook.executeMarketOrder("buy", 10);

      expect(result.filled).toBe(false);
      expect(result.filledQty).toBe(0);
      expect(result.remainingQty).toBe(10);
      expect(result.trades.length).toBe(0);
    });
  });

  describe("Spread and Mid Price Calculation", () => {
    it("should calculate spread correctly", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 10, Date.now() + 1);

      const spread = orderBook.getSpread();
      expect(spread).toBe(1); // 101 - 100
    });

    it("should calculate mid price correctly", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 104, 10, Date.now() + 1);

      const quote = orderBook.getQuote();
      expect(quote.bid).toBe(100);
      expect(quote.ask).toBe(104);
      // Mid price = (100 + 104) / 2 = 102
      const midPrice = (quote.bid! + quote.ask!) / 2;
      expect(midPrice).toBe(102);
    });

    it("should handle mid price when only one side has orders", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());

      const quote = orderBook.getQuote();
      expect(quote.bid).toBe(100);
      expect(quote.ask).toBeNull();
    });

    it("should return null spread when no bids or asks exist", () => {
      expect(orderBook.getSpread()).toBeNull();

      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      expect(orderBook.getSpread()).toBeNull();

      orderBook = new OrderBookSimulator("AAPL");
      orderBook.addLimitOrder("sell", 101, 10, Date.now());
      expect(orderBook.getSpread()).toBeNull();
    });

    it("should update spread after order matching", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 102, 5, Date.now() + 2);

      expect(orderBook.getSpread()).toBe(1); // 101 - 100

      orderBook.executeMarketOrder("buy", 5); // Consume all at 101

      expect(orderBook.getSpread()).toBe(2); // 102 - 100
    });

    it("should calculate mid price correctly", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 102, 5, Date.now() + 1);

      const quote = orderBook.getQuote();
      expect(quote.bid).toBe(100);
      expect(quote.ask).toBe(102);
      // Mid price = (100 + 102) / 2 = 101
      expect((quote.bid! + quote.ask!) / 2).toBe(101);
    });

    it("should return null bid/ask when only one side exists", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());

      expect(orderBook.getSpread()).toBeNull();

      const quote = orderBook.getQuote();
      expect(quote.bid).toBe(100);
      expect(quote.ask).toBeNull();
    });
  });

  describe("Quote", () => {
    it("should return quote with current bid/ask/last price", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);

      const quote = orderBook.getQuote();
      expect(quote.bid).toBe(100);
      expect(quote.ask).toBe(101);
      expect(quote.lastPrice).toBeNull(); // No trades yet
    });

    it("should update last price after trade", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);

      orderBook.executeMarketOrder("buy", 3);

      const quote = orderBook.getQuote();
      expect(quote.lastPrice).toBe(101);
      expect(quote.lastSize).toBe(3);
    });

    it("should include symbol and timestamp in quote", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);

      const quote = orderBook.getQuote();
      expect(quote.symbol).toBe("AAPL");
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it("should return null bid/ask when no orders exist", () => {
      const quote = orderBook.getQuote();
      expect(quote.bid).toBeNull();
      expect(quote.ask).toBeNull();
      expect(quote.lastPrice).toBeNull();
    });

    it("should calculate bid/ask sizes from aggregated orders", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("buy", 100, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 101, 8, Date.now() + 2);

      const quote = orderBook.getQuote();
      expect(quote.bidSize).toBe(15);
      expect(quote.askSize).toBe(8);
    });
  });

  describe("Limit Order Partial Fill", () => {
    it("should allow limit buy to cross spread and fill as market order", () => {
      orderBook.addLimitOrder("sell", 100, 10, Date.now());

      // Limit buy at 101 crosses the spread
      const result = orderBook.executeLimitOrder("buy", 101, 5, Date.now() + 1);

      expect(result.filled).toBe(true);
      expect(result.filledQty).toBe(5);
      expect(result.avgPrice).toBe(100); // Fills at resting ask price
    });

    it("should not fill limit buy if price below best ask", () => {
      orderBook.addLimitOrder("sell", 101, 10, Date.now());

      // Limit buy at 100 does not cross
      const result = orderBook.executeLimitOrder("buy", 100, 5, Date.now() + 1);

      expect(result.filled).toBe(false);
      expect(result.filledQty).toBe(0);
      // Order should be added to book
      expect(orderBook.getBids().length).toBe(1);
      expect(orderBook.getBids()[0].price).toBe(100);
    });

    it("should not fill limit sell if price above best bid", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());

      // Limit sell at 101 does not cross
      const result = orderBook.executeLimitOrder("sell", 101, 5, Date.now() + 1);

      expect(result.filled).toBe(false);
      expect(result.filledQty).toBe(0);
      // Order should be added to book
      expect(orderBook.getAsks().length).toBe(1);
      expect(orderBook.getAsks()[0].price).toBe(101);
    });
  });

  describe("Order Book State", () => {
    it("should clear order book", () => {
      orderBook.addLimitOrder("buy", 100, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);
      orderBook.executeMarketOrder("buy", 2); // Create a trade

      orderBook.clear();

      expect(orderBook.getBids().length).toBe(0);
      expect(orderBook.getAsks().length).toBe(0);
      expect(orderBook.getQuote().bid).toBeNull();
      expect(orderBook.getQuote().ask).toBeNull();
    });

    it("should return best bid and best ask", () => {
      orderBook.addLimitOrder("buy", 98, 10, Date.now());
      orderBook.addLimitOrder("buy", 100, 5, Date.now() + 1);
      orderBook.addLimitOrder("buy", 99, 8, Date.now() + 2);

      orderBook.addLimitOrder("sell", 102, 10, Date.now());
      orderBook.addLimitOrder("sell", 101, 5, Date.now() + 1);
      orderBook.addLimitOrder("sell", 103, 8, Date.now() + 2);

      expect(orderBook.getBestBid()).toEqual({ price: 100, size: 5, orderCount: 1 });
      expect(orderBook.getBestAsk()).toEqual({ price: 101, size: 5, orderCount: 1 });
    });

    it("should track total volume traded", () => {
      orderBook.addLimitOrder("buy", 100, 20, Date.now());
      orderBook.addLimitOrder("sell", 101, 20, Date.now() + 1);

      orderBook.executeMarketOrder("buy", 5);
      orderBook.executeMarketOrder("sell", 7);

      expect(orderBook.getTotalVolume()).toBe(12);
    });
  });
});
