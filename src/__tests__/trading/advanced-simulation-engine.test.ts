import { test, expect, beforeEach, describe } from "bun:test";
import { AdvancedSimulationEngine, type SimulationMode } from "../../trading/advanced-simulation-engine.js";
import { SimulationEngine } from "../../trading/simulation-engine.js";
import type { Bar } from "../../adapters/types.js";

// Mock WebSocketFeeds for testing
class MockWebSocketFeeds {
  messages: { channel: string; type: string; payload: unknown }[] = [];

  broadcast(channel: string, payload: unknown, type = "metric"): void {
    this.messages.push({ channel, type, payload });
  }

  clear(): void {
    this.messages = [];
  }
}

let mockWebSocket: MockWebSocketFeeds;
let engine: SimulationEngine;
let advancedEngine: AdvancedSimulationEngine;

const sampleBars: Bar[] = [
  { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 152, volume: 1000000 },
  { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 152, high: 157, low: 151, close: 156, volume: 1200000 },
  { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 156, high: 158, low: 154, close: 155, volume: 900000 },
  { symbol: "AAPL", timestamp: new Date("2024-01-04"), open: 155, high: 160, low: 153, close: 158, volume: 1100000 },
  { symbol: "AAPL", timestamp: new Date("2024-01-05"), open: 158, high: 162, low: 156, close: 161, volume: 1300000 },
];

beforeEach(() => {
  mockWebSocket = new MockWebSocketFeeds();
  engine = new SimulationEngine({ initialCash: 100000 });
  engine.loadBars("AAPL", sampleBars);
  advancedEngine = new AdvancedSimulationEngine({
    engine,
    symbol: "AAPL",
    initialCash: 100000,
    websocketFeeds: mockWebSocket as unknown as import("../../dashboard/websocket-feeds.js").WebSocketFeeds,
  });
});

describe("AdvancedSimulationEngine - Fast Mode", () => {
  test("fast mode uses bar-by-bar execution with existing SimulationEngine", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "fast",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    expect(results.trades).toHaveLength(2);
    expect(results.finalEquity).toBeGreaterThan(0);
    expect(results.metrics).toBeDefined();
    expect(results.metrics.totalTrades).toBe(2);
  });

  test("fast mode returns equity curve and trade history", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "fast",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 2) ctx.sell(5);
        if (ctx.currentBarIndex === 4) ctx.sell(5);
      },
    });

    expect(results.equityCurve).toBeDefined();
    expect(results.equityCurve.length).toBeGreaterThan(0);
    expect(results.trades.length).toBeGreaterThan(0);
    expect(results.trades[0].price).toBe(152); // Close price of first bar
  });
});

describe("AdvancedSimulationEngine - Step Mode", () => {
  test("step mode uses StepThroughController", async () => {
    await advancedEngine.initializeStepMode({
      strategy: () => {},
    });

    const controller = advancedEngine.getStepController();
    expect(controller).toBeDefined();
    expect(controller.getState()).toBe("idle");
  });

  test("step mode allows play/pause/step controls", async () => {
    await advancedEngine.initializeStepMode({
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
      },
    });

    const controller = advancedEngine.getStepController();

    // Initially idle
    expect(controller.getState()).toBe("idle");
    expect(controller.getCurrentBarIndex()).toBe(0);

    // Play should change state
    controller.play();
    expect(controller.isPlaying()).toBe(true);

    // Pause
    controller.pause();
    expect(controller.isPlaying()).toBe(false);
    expect(controller.getState()).toBe("paused");

    // Step forward
    const prevIndex = controller.getCurrentBarIndex();
    await controller.step();
    expect(controller.getCurrentBarIndex()).toBe(prevIndex + 1);
  });

  test("step mode broadcasts tick events via WebSocket", async () => {
    await advancedEngine.initializeStepMode({
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
      },
    });

    const controller = advancedEngine.getStepController();

    // Listen for tick events
    let tickReceived = false;
    controller.on("tick", () => {
      tickReceived = true;
    });

    // Clear any messages before stepping
    mockWebSocket.clear();

    // Step should trigger tick event and WebSocket broadcast
    await controller.step();

    expect(tickReceived).toBe(true);

    // Check WebSocket broadcast
    const simMessages = mockWebSocket.messages.filter((m) => m.channel === "simulation");
    expect(simMessages.length).toBeGreaterThan(0);
  });
});

describe("AdvancedSimulationEngine - Advanced Mode", () => {
  test("advanced mode uses OrderBookSimulator for fills", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    // OrderBookSimulator should create more realistic fills
    expect(results.trades).toHaveLength(2);
    expect(results.orderBookData).toBeDefined();
  });

  test("advanced mode applies slippage based on volume", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(100); // Large order
        if (ctx.currentBarIndex === 2) ctx.buy(10); // Small order
        if (ctx.currentBarIndex === 4) ctx.sell(110);
      },
    });

    // All trades should have slippage data
    for (const trade of results.trades) {
      expect(trade.slippage).toBeDefined();
    }

    // Larger orders should have more slippage
    const largeOrderSlippage = results.trades[0].slippage || 0;
    const smallOrderSlippage = results.trades[1].slippage || 0;
    expect(largeOrderSlippage).toBeGreaterThanOrEqual(smallOrderSlippage);
  });

  test("advanced mode includes order book depth data", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
      },
    });

    expect(results.orderBookData).toBeDefined();
    expect(results.orderBookData.depthHistory).toBeDefined();
    expect(results.orderBookData.depthHistory.length).toBeGreaterThan(0);
  });

  test("advanced mode calculates market impact", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(50);
        if (ctx.currentBarIndex === 2) ctx.sell(50);
      },
    });

    expect(results.metrics.marketImpact).toBeDefined();
    expect(results.metrics.avgSlippage).toBeDefined();
  });
});

describe("AdvancedSimulationEngine - All Modes", () => {
  test("all modes return consistent result structure", async () => {
    const fastResults = await advancedEngine.runSimulation({
      mode: "fast",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    const advancedResults = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    // Both should have required fields
    expect(fastResults.trades).toBeDefined();
    expect(fastResults.finalEquity).toBeDefined();
    expect(fastResults.metrics).toBeDefined();
    expect(fastResults.equityCurve).toBeDefined();

    expect(advancedResults.trades).toBeDefined();
    expect(advancedResults.finalEquity).toBeDefined();
    expect(advancedResults.metrics).toBeDefined();
    expect(advancedResults.equityCurve).toBeDefined();
  });

  test("WebSocket events fire correctly for all modes", async () => {
    const modes: SimulationMode[] = ["fast", "advanced"];

    for (const mode of modes) {
      mockWebSocket.clear();

      await advancedEngine.runSimulation({
        mode,
        strategy: (ctx) => {
          if (ctx.currentBarIndex === 0) ctx.buy(10);
        },
      });

      // Should have broadcast simulation_tick messages
      const tickMessages = mockWebSocket.messages.filter((m) => m.channel === "simulation" && m.type === "metric");
      expect(tickMessages.length).toBeGreaterThan(0);
    }
  });

  test("simulation_tick messages include bar and portfolio data", async () => {
    await advancedEngine.runSimulation({
      mode: "fast",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
      },
    });

    const tickMessages = mockWebSocket.messages.filter((m) => m.channel === "simulation");

    expect(tickMessages.length).toBeGreaterThan(0);

    for (const msg of tickMessages) {
      const payload = msg.payload as { bar?: unknown; portfolio?: unknown };
      expect(payload.bar).toBeDefined();
      expect(payload.portfolio).toBeDefined();
    }
  });
});

describe("AdvancedSimulationEngine - Configuration", () => {
  test("can configure slippage model parameters", () => {
    const customEngine = new AdvancedSimulationEngine({
      engine,
      symbol: "AAPL",
      initialCash: 100000,
      slippageConfig: {
        baseSlippage: 0.002,
        impactFactor: 0.02,
      },
    });

    expect(customEngine).toBeDefined();
  });

  test("can configure order book depth", async () => {
    const customEngine = new AdvancedSimulationEngine({
      engine,
      symbol: "AAPL",
      initialCash: 100000,
      orderBookDepth: 10,
    });

    const results = await customEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
      },
    });

    expect(results.orderBookData).toBeDefined();
  });

  test("validates mode parameter", async () => {
    await expect(
      advancedEngine.runSimulation({
        mode: "invalid" as SimulationMode,
        strategy: () => {},
      }),
    ).rejects.toThrow();
  });
});

describe("AdvancedSimulationEngine - Results Accuracy", () => {
  test("equity curve tracks portfolio value over time", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "fast",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    // Equity curve should have entry for each bar
    expect(results.equityCurve.length).toBe(5);

    // First entry should be initial cash
    expect(results.equityCurve[0]).toBe(100000);

    // Last entry should match final equity
    expect(results.equityCurve[results.equityCurve.length - 1]).toBe(results.finalEquity);
  });

  test("trades include execution details", async () => {
    const results = await advancedEngine.runSimulation({
      mode: "advanced",
      strategy: (ctx) => {
        if (ctx.currentBarIndex === 0) ctx.buy(10);
        if (ctx.currentBarIndex === 4) ctx.sell(10);
      },
    });

    expect(results.trades.length).toBe(2);

    for (const trade of results.trades) {
      expect(trade.id).toBeDefined();
      expect(trade.symbol).toBe("AAPL");
      expect(trade.side).toBeDefined();
      expect(trade.qty).toBe(10);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.timestamp).toBeInstanceOf(Date);
    }
  });
});
