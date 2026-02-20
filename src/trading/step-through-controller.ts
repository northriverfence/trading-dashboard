import { SimulationEngine } from "./simulation-engine.js";
import type { Bar } from "../adapters/types.js";

type SimulationState = "idle" | "running" | "paused" | "stopped" | "completed";

export type SpeedMultiplier = 1 | 2 | 5 | 10;

interface SimulationTickEvent {
  bar: Bar;
  barIndex: number;
  totalBars: number;
  progress: number;
}

interface SimulationStateChangeEvent {
  state: SimulationState;
  previousState: SimulationState;
}

export interface SimulationControllerEvents {
  tick: SimulationTickEvent;
  stateChange: SimulationStateChangeEvent;
  complete: void;
}

type EventHandler<T> = (event: T) => void;

interface StepThroughConfig {
  symbol: string;
  startDate?: Date;
  endDate?: Date;
  strategy: (context: {
    symbol: string;
    currentBar: Bar;
    currentBarIndex: number;
    totalBars: number;
    portfolio: {
      cash: number;
      equity: number;
      positions: { symbol: string; qty: number }[];
    };
    buy: (qty: number) => void;
    sell: (qty: number) => void;
  }) => void;
}

export class StepThroughController {
  private engine: SimulationEngine;
  private config: StepThroughConfig;
  private state: SimulationState = "idle";
  private currentBarIndex = 0;
  private speed: SpeedMultiplier = 1;
  private bars: Bar[] = [];
  private listeners: {
    [K in keyof SimulationControllerEvents]?: EventHandler<SimulationControllerEvents[K]>[];
  } = {};
  private playInterval: ReturnType<typeof setInterval> | null = null;

  constructor(engine: SimulationEngine, config: StepThroughConfig) {
    this.engine = engine;
    this.config = config;
    this.loadBars();
  }

  private loadBars(): void {
    let bars = this.engine.getBars(this.config.symbol);

    // Filter by date range if specified
    if (this.config.startDate || this.config.endDate) {
      const startTime = this.config.startDate?.getTime() ?? 0;
      const endTime = this.config.endDate?.getTime() ?? Infinity;
      bars = bars.filter(
        (bar) => bar.timestamp.getTime() >= startTime && bar.timestamp.getTime() <= endTime
      );
    }

    this.bars = bars;
  }

  getState(): SimulationState {
    return this.state;
  }

  getCurrentBarIndex(): number {
    return this.currentBarIndex;
  }

  getTotalBars(): number {
    return this.bars.length;
  }

  getSpeed(): SpeedMultiplier {
    return this.speed;
  }

  isPlaying(): boolean {
    return this.state === "running";
  }

  getCurrentBar(): Bar | undefined {
    return this.bars[this.currentBarIndex];
  }

  getProgress(): number {
    if (this.bars.length === 0) return 0;
    if (this.state === "completed") return 100;
    return Math.round((this.currentBarIndex / this.bars.length) * 100);
  }

  setSpeed(speed: SpeedMultiplier): void {
    const validSpeeds: SpeedMultiplier[] = [1, 2, 5, 10];
    if (!validSpeeds.includes(speed)) {
      throw new Error(`Invalid speed: ${speed}. Must be one of: ${validSpeeds.join(", ")}`);
    }
    this.speed = speed;

    // If running, restart with new speed
    if (this.state === "running" && this.playInterval) {
      this.stopPlayInterval();
      this.startPlayInterval();
    }
  }

  play(): void {
    const previousState = this.state;

    if (this.state === "stopped" || this.state === "completed") {
      this.reset();
    }

    this.state = "running";
    this.emit("stateChange", { state: this.state, previousState });

    this.startPlayInterval();
  }

  private startPlayInterval(): void {
    if (this.playInterval) {
      clearInterval(this.playInterval);
    }

    const baseDelay = 1000; // 1 second at 1x speed
    const delay = baseDelay / this.speed;

    this.playInterval = setInterval(() => {
      if (this.currentBarIndex >= this.bars.length - 1) {
        this.complete();
        return;
      }

      this.executeTick();
      this.currentBarIndex++;
    }, delay);
  }

  private stopPlayInterval(): void {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  pause(): void {
    if (this.state !== "running") return;

    const previousState = this.state;
    this.stopPlayInterval();
    this.state = "paused";
    this.emit("stateChange", { state: this.state, previousState });
  }

  async step(): Promise<void> {
    // If completed, we stay at the end (no-op, not error)
    if (this.state === "completed") {
      return;
    }

    // If running, auto-pause first then step
    if (this.state === "running") {
      this.pause();
    }

    // Only allowed in paused or idle
    if (this.state !== "paused" && this.state !== "idle") {
      throw new Error(`Cannot step from state: ${this.state}. Must be paused or idle.`);
    }

    if (this.currentBarIndex >= this.bars.length - 1) {
      this.complete();
      return;
    }

    this.currentBarIndex++;
    this.executeTick();

    if (this.currentBarIndex >= this.bars.length - 1) {
      this.complete();
    }
  }

  stepBackward(): void {
    // If running, auto-pause first
    if (this.state === "running") {
      this.pause();
    }

    if (this.state !== "paused" && this.state !== "idle") {
      throw new Error(`Cannot step backward from state: ${this.state}. Must be paused or idle.`);
    }

    if (this.currentBarIndex > 0) {
      this.currentBarIndex--;
      // Emit tick event for the new current bar
      const bar = this.bars[this.currentBarIndex];
      if (bar) {
        this.emit("tick", {
          bar,
          barIndex: this.currentBarIndex,
          totalBars: this.bars.length,
          progress: this.getProgress(),
        });
      }
    }
  }

  canStepForward(): boolean {
    return this.currentBarIndex < this.bars.length - 1;
  }

  canStepBackward(): boolean {
    return this.currentBarIndex > 0;
  }

  jumpTo(index: number): void {
    if (this.state !== "paused" && this.state !== "idle") {
      throw new Error(`Cannot jump from state: ${this.state}. Must be paused or idle.`);
    }

    if (index < 0 || index >= this.bars.length) {
      throw new Error(`Invalid bar index: ${index}. Must be between 0 and ${this.bars.length - 1}`);
    }

    this.currentBarIndex = index;

    // Emit tick event for the jumped-to bar
    const bar = this.bars[this.currentBarIndex];
    if (bar) {
      this.emit("tick", {
        bar,
        barIndex: this.currentBarIndex,
        totalBars: this.bars.length,
        progress: this.getProgress(),
      });
    }
  }

  stop(): void {
    const previousState = this.state;
    this.stopPlayInterval();
    this.currentBarIndex = 0;
    this.state = "stopped";
    this.emit("stateChange", { state: this.state, previousState });
  }

  reset(): void {
    this.stopPlayInterval();
    this.currentBarIndex = 0;
    this.speed = 1;
    this.state = "idle";
  }

  private complete(): void {
    const previousState = this.state;
    this.stopPlayInterval();
    this.state = "completed";
    this.emit("stateChange", { state: this.state, previousState });
    this.emit("complete", undefined);
  }

  private executeTick(): void {
    const bar = this.bars[this.currentBarIndex];
    if (!bar) return;

    // Execute the strategy for this bar
    const portfolio = this.engine.getPortfolio();
    const context = {
      symbol: this.config.symbol,
      currentBar: bar,
      currentBarIndex: this.currentBarIndex,
      totalBars: this.bars.length,
      portfolio: {
        cash: portfolio.cash,
        equity: portfolio.equity,
        positions: portfolio.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
      },
      buy: (qty: number) => {
        // Execute buy through engine
        this.executeBuy(bar, qty);
      },
      sell: (qty: number) => {
        // Execute sell through engine
        this.executeSell(bar, qty);
      },
    };

    this.config.strategy(context);

    // Emit tick event
    this.emit("tick", {
      bar,
      barIndex: this.currentBarIndex,
      totalBars: this.bars.length,
      progress: this.getProgress(),
    });
  }

  private executeBuy(bar: Bar, qty: number): void {
    // Access the engine's protected method via type assertion
    // This is similar to how SimulationEngine does it
    const engine = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: unknown) => void };
    };

    const trade = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `step_order`,
      symbol: this.config.symbol,
      side: "buy" as const,
      qty,
      price: bar.close,
      timestamp: bar.timestamp,
    };

    engine.portfolioTracker.processTrade(trade);
  }

  private executeSell(bar: Bar, qty: number): void {
    const engine = this.engine as unknown as {
      portfolioTracker: { processTrade: (trade: unknown) => void };
    };

    const trade = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      orderId: `step_order`,
      symbol: this.config.symbol,
      side: "sell" as const,
      qty,
      price: bar.close,
      timestamp: bar.timestamp,
    };

    engine.portfolioTracker.processTrade(trade);
  }

  on<K extends keyof SimulationControllerEvents>(
    event: K,
    handler: EventHandler<SimulationControllerEvents[K]>
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  removeListener<K extends keyof SimulationControllerEvents>(
    event: K,
    handler: EventHandler<SimulationControllerEvents[K]>
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter((h) => h !== handler) as EventHandler<
        SimulationControllerEvents[K]
      >[];
    }
  }

  private emit<K extends keyof SimulationControllerEvents>(
    event: K,
    data: SimulationControllerEvents[K]
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
