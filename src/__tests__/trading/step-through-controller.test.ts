import { test, expect, beforeEach, describe } from "bun:test";
import { StepThroughController, type SimulationControllerEvents, type SpeedMultiplier } from "../../trading/step-through-controller.js";
import { SimulationEngine } from "../../trading/simulation-engine.js";
import type { Bar } from "../../adapters/types.js";

describe("StepThroughController", () => {
  let engine: SimulationEngine;
  let controller: StepThroughController;
  let bars: Bar[];

  beforeEach(() => {
    engine = new SimulationEngine({ initialCash: 100000 });
    bars = [
      { symbol: "AAPL", timestamp: new Date("2024-01-01"), open: 150, high: 155, low: 149, close: 152, volume: 1000000 },
      { symbol: "AAPL", timestamp: new Date("2024-01-02"), open: 152, high: 157, low: 151, close: 156, volume: 1200000 },
      { symbol: "AAPL", timestamp: new Date("2024-01-03"), open: 156, high: 158, low: 154, close: 155, volume: 900000 },
      { symbol: "AAPL", timestamp: new Date("2024-01-04"), open: 155, high: 160, low: 154, close: 158, volume: 1100000 },
      { symbol: "AAPL", timestamp: new Date("2024-01-05"), open: 158, high: 162, low: 157, close: 161, volume: 1300000 },
    ];
    engine.loadBars("AAPL", bars);
    controller = new StepThroughController(engine, {
      symbol: "AAPL",
      strategy: (ctx) => {
        // Simple strategy for testing
        if (ctx.currentBarIndex === 0) {
          ctx.buy(10);
        }
      },
    });
  });

  test("Controller initializes in idle state", () => {
    expect(controller.getState()).toBe("idle");
    expect(controller.getCurrentBarIndex()).toBe(0);
    expect(controller.getTotalBars()).toBe(5);
    expect(controller.getSpeed()).toBe(1);
    expect(controller.isPlaying()).toBe(false);
  });

  test("play() starts simulation and changes state to running", () => {
    controller.play();
    expect(controller.getState()).toBe("running");
    expect(controller.isPlaying()).toBe(true);
  });

  test("pause() pauses simulation at current state", () => {
    controller.play();
    expect(controller.getState()).toBe("running");

    controller.pause();
    expect(controller.getState()).toBe("paused");
    expect(controller.isPlaying()).toBe(false);
  });

  test("stop() resets simulation to beginning", () => {
    controller.play();
    controller.pause();

    controller.stop();
    expect(controller.getState()).toBe("stopped");
    expect(controller.getCurrentBarIndex()).toBe(0);
    expect(controller.isPlaying()).toBe(false);
  });

  test("step() advances one bar when paused", async () => {
    controller.play();
    controller.pause();
    const indexBefore = controller.getCurrentBarIndex();

    await controller.step();
    expect(controller.getCurrentBarIndex()).toBe(indexBefore + 1);
    expect(controller.getState()).toBe("paused");
  });

  test("step() does not advance past last bar", async () => {
    controller.play();
    controller.pause();

    // Step through all bars
    for (let i = 0; i < bars.length; i++) {
      await controller.step();
    }

    // Try to step past the end
    await controller.step();
    expect(controller.getCurrentBarIndex()).toBe(bars.length - 1);
  });

  test("stepBackward() moves back one bar when paused", async () => {
    controller.play();
    await controller.step();
    await controller.step();
    controller.pause();

    const indexBefore = controller.getCurrentBarIndex();
    expect(indexBefore).toBe(2);

    controller.stepBackward();
    expect(controller.getCurrentBarIndex()).toBe(1);
    expect(controller.getState()).toBe("paused");
  });

  test("stepBackward() does not go below index 0", () => {
    controller.play();
    controller.pause();

    controller.stepBackward();
    expect(controller.getCurrentBarIndex()).toBe(0);
  });

  test("setSpeed() changes playback speed", () => {
    expect(controller.getSpeed()).toBe(1);

    controller.setSpeed(2);
    expect(controller.getSpeed()).toBe(2);

    controller.setSpeed(5);
    expect(controller.getSpeed()).toBe(5);

    controller.setSpeed(10);
    expect(controller.getSpeed()).toBe(10);
  });

  test("setSpeed() throws on invalid speed", () => {
    expect(() => controller.setSpeed(3 as SpeedMultiplier)).toThrow();
    expect(() => controller.setSpeed(0 as SpeedMultiplier)).toThrow();
    expect(() => controller.setSpeed(100 as SpeedMultiplier)).toThrow();
  });

  test("getCurrentBar() returns current bar data", () => {
    const bar = controller.getCurrentBar();
    expect(bar).toBeDefined();
    expect(bar?.symbol).toBe("AAPL");
    expect(bar?.close).toBe(152);
  });

  test("state event fires on state change", () => {
    const stateChanges: string[] = [];
    controller.on("stateChange", (event) => {
      stateChanges.push(event.state);
    });

    controller.play();
    controller.pause();
    controller.stop();

    expect(stateChanges).toEqual(["running", "paused", "stopped"]);
  });

  test("tick event fires when stepping", async () => {
    const tickEvents: { index: number; bar: Bar }[] = [];
    controller.on("tick", (event) => {
      tickEvents.push({ index: event.barIndex, bar: event.bar });
    });

    controller.play();
    await controller.step();

    expect(tickEvents).toHaveLength(1);
    expect(tickEvents[0]?.index).toBe(1);
  });

  test("completion event fires when simulation completes", async () => {
    let completed = false;
    controller.on("complete", () => {
      completed = true;
    });

    controller.play();
    controller.pause();

    // Step through all bars
    for (let i = 0; i < bars.length; i++) {
      await controller.step();
    }

    expect(completed).toBe(true);
    expect(controller.getState()).toBe("completed");
  });

  test("play() resumes from paused state", () => {
    controller.play();
    controller.pause();
    const indexBefore = controller.getCurrentBarIndex();

    controller.play();
    expect(controller.getState()).toBe("running");
    // Should continue from where it was paused
    expect(controller.getCurrentBarIndex()).toBe(indexBefore);
  });

  test("play() from idle starts from beginning", () => {
    controller.play();
    expect(controller.getCurrentBarIndex()).toBe(0);
  });

  test("play() from stopped resets and starts", async () => {
    controller.play();
    await controller.step();
    await controller.step();
    controller.stop();

    controller.play();
    expect(controller.getCurrentBarIndex()).toBe(0);
    expect(controller.getState()).toBe("running");
  });

  test("canStepForward() returns correct values", () => {
    controller.play();
    controller.pause();

    expect(controller.canStepForward()).toBe(true);

    // Step to last bar
    for (let i = 0; i < bars.length - 1; i++) {
      controller.step();
    }

    expect(controller.canStepForward()).toBe(false);
  });

  test("canStepBackward() returns correct values", () => {
    controller.play();
    controller.pause();

    expect(controller.canStepBackward()).toBe(false);

    controller.step();
    expect(controller.canStepBackward()).toBe(true);
  });

  test("removeListener() removes event listener", () => {
    const stateChanges: string[] = [];
    const handler = (event: { state: string }) => {
      stateChanges.push(event.state);
    };

    controller.on("stateChange", handler);
    controller.play();
    expect(stateChanges).toEqual(["running"]);

    controller.removeListener("stateChange", handler);
    controller.pause();
    expect(stateChanges).toEqual(["running"]); // Should not have changed
  });

  test("getProgress() returns percentage complete", async () => {
    expect(controller.getProgress()).toBe(0);

    controller.play();
    await controller.step();
    expect(controller.getProgress()).toBe(20); // 1 of 5 bars = 20%

    await controller.step();
    expect(controller.getProgress()).toBe(40); // 2 of 5 bars = 40%
  });

  test("getProgress() returns 100 when completed", async () => {
    controller.play();
    controller.pause();

    for (let i = 0; i < bars.length; i++) {
      await controller.step();
    }

    expect(controller.getProgress()).toBe(100);
  });

  test("reset() returns controller to initial state", async () => {
    controller.play();
    await controller.step();
    await controller.step();
    controller.pause();

    controller.reset();
    expect(controller.getState()).toBe("idle");
    expect(controller.getCurrentBarIndex()).toBe(0);
    expect(controller.getSpeed()).toBe(1);
  });

  test("step() throws when stopped", () => {
    controller.play();
    controller.stop();
    expect(() => controller.step()).toThrow();
  });

  test("stepBackward() throws when stopped", () => {
    controller.play();
    controller.stop();
    expect(() => controller.stepBackward()).toThrow();

    controller.stop();
    expect(() => controller.stepBackward()).toThrow();
  });

  test("jumpTo() jumps to specific bar index", () => {
    controller.play();
    controller.pause();

    controller.jumpTo(3);
    expect(controller.getCurrentBarIndex()).toBe(3);
  });

  test("jumpTo() throws on invalid index", () => {
    controller.play();
    controller.pause();

    expect(() => controller.jumpTo(-1)).toThrow();
    expect(() => controller.jumpTo(bars.length)).toThrow();
  });

  test("jumpTo() throws when not paused or idle", () => {
    controller.play();
    expect(() => controller.jumpTo(2)).toThrow();
  });

  test("events include correct bar context", async () => {
    const tickEvents: Array<{ index: number; total: number; progress: number }> = [];
    controller.on("tick", (event) => {
      tickEvents.push({
        index: event.barIndex,
        total: event.totalBars,
        progress: event.progress,
      });
    });

    controller.play();
    await controller.step();
    await controller.step();

    expect(tickEvents).toHaveLength(2);
    expect(tickEvents[0]).toEqual({ index: 1, total: 5, progress: 20 });
    expect(tickEvents[1]).toEqual({ index: 2, total: 5, progress: 40 });
  });
});
