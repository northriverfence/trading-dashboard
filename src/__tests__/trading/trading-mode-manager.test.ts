// src/__tests__/trading/trading-mode-manager.test.ts

import { test, expect, beforeEach, describe } from "bun:test";
import {
  TradingModeManager,
  type TradingMode,
  type ModeChangeEvent,
  type ModeChangeRequest,
  type TradingModeManagerEvents,
} from "../../trading/trading-mode-manager.js";

describe("TradingModeManager", () => {
  let manager: TradingModeManager;

  beforeEach(() => {
    manager = new TradingModeManager();
  });

  describe("Initialization", () => {
    test("initializes in simulation mode by default", () => {
      expect(manager.getCurrentMode()).toBe("simulation");
    });

    test("initializes with correct visual indicator for simulation", () => {
      expect(manager.getModeColor()).toBe("green");
    });

    test("mode history starts with simulation mode", () => {
      const history = manager.getModeHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.mode).toBe("simulation");
      expect(history[0]?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Mode Switching - Valid Transitions", () => {
    test("can switch from simulation to paper mode", async () => {
      const result = await manager.requestModeChange("paper");
      expect(result.approved).toBe(true);
      expect(manager.getCurrentMode()).toBe("paper");
    });

    test("can switch from paper to live mode with confirmation", async () => {
      // First go to paper
      await manager.requestModeChange("paper");
      expect(manager.getCurrentMode()).toBe("paper");

      // Then to live with confirmation
      const result = await manager.requestModeChange("live", { confirmed: true });
      expect(result.approved).toBe(true);
      expect(manager.getCurrentMode()).toBe("live");
    });

    test("can switch from live back to paper mode", async () => {
      await manager.requestModeChange("paper");
      await manager.requestModeChange("live", { confirmed: true });
      expect(manager.getCurrentMode()).toBe("live");

      const result = await manager.requestModeChange("paper");
      expect(result.approved).toBe(true);
      expect(manager.getCurrentMode()).toBe("paper");
    });

    test("can switch from paper back to simulation mode", async () => {
      await manager.requestModeChange("paper");
      expect(manager.getCurrentMode()).toBe("paper");

      const result = await manager.requestModeChange("simulation");
      expect(result.approved).toBe(true);
      expect(manager.getCurrentMode()).toBe("simulation");
    });
  });

  describe("Mode Switching - Invalid Transitions", () => {
    test("cannot switch directly from simulation to live mode", async () => {
      const result = await manager.requestModeChange("live");
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("Cannot transition directly from simulation to live");
      expect(manager.getCurrentMode()).toBe("simulation");
    });

    test("cannot switch to live mode without confirmation", async () => {
      await manager.requestModeChange("paper");

      const result = await manager.requestModeChange("live");
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("Confirmation required");
      expect(manager.getCurrentMode()).toBe("paper");
    });

    test("cannot switch to the same mode", async () => {
      const result = await manager.requestModeChange("simulation");
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("Already in simulation mode");
    });

    test("rejects invalid mode values", async () => {
      // @ts-expect-error Testing invalid mode
      const result = await manager.requestModeChange("invalid_mode");
      expect(result.approved).toBe(false);
      expect(result.reason).toContain("Invalid mode");
    });
  });

  describe("Mode History", () => {
    test("tracks mode change history", async () => {
      await manager.requestModeChange("paper");
      await manager.requestModeChange("live", { confirmed: true });

      const history = manager.getModeHistory();
      expect(history).toHaveLength(3);
      expect(history[0]?.mode).toBe("simulation");
      expect(history[1]?.mode).toBe("paper");
      expect(history[2]?.mode).toBe("live");
    });

    test("history entries include timestamps", async () => {
      const beforeChange = new Date();
      await manager.requestModeChange("paper");
      const afterChange = new Date();

      const history = manager.getModeHistory();
      const entry = history[history.length - 1];
      expect(entry?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeChange.getTime());
      expect(entry?.timestamp.getTime()).toBeLessThanOrEqual(afterChange.getTime());
    });

    test("history entries include reason for change", async () => {
      await manager.requestModeChange("paper");

      const history = manager.getModeHistory();
      const entry = history[history.length - 1];
      expect(entry?.reason).toBeDefined();
    });
  });

  describe("Events", () => {
    test("emits modeChange event on successful transition", async () => {
      const events: ModeChangeEvent[] = [];
      manager.on("modeChange", (event) => {
        events.push(event);
      });

      await manager.requestModeChange("paper");

      expect(events).toHaveLength(1);
      expect(events[0]?.previousMode).toBe("simulation");
      expect(events[0]?.newMode).toBe("paper");
      expect(events[0]?.timestamp).toBeInstanceOf(Date);
    });

    test("emits modeChangeRequest event on any request", async () => {
      const requests: ModeChangeRequest[] = [];
      manager.on("modeChangeRequest", (request) => {
        requests.push(request);
      });

      await manager.requestModeChange("paper");

      expect(requests).toHaveLength(1);
      expect(requests[0]?.requestedMode).toBe("paper");
      expect(requests[0]?.currentMode).toBe("simulation");
      expect(requests[0]?.approved).toBe(true);
    });

    test("does not emit modeChange on rejected transition", async () => {
      const events: ModeChangeEvent[] = [];
      manager.on("modeChange", (event) => {
        events.push(event);
      });

      // Try to go directly to live (should fail)
      await manager.requestModeChange("live");

      expect(events).toHaveLength(0);
    });

    test("removeListener removes event handler", async () => {
      const events: ModeChangeEvent[] = [];
      const handler = (event: ModeChangeEvent) => {
        events.push(event);
      };

      manager.on("modeChange", handler);
      await manager.requestModeChange("paper");
      expect(events).toHaveLength(1);

      manager.removeListener("modeChange", handler);
      await manager.requestModeChange("simulation");
      expect(events).toHaveLength(1); // Still 1, no new event
    });
  });

  describe("Visual Indicators", () => {
    test("returns green color for simulation mode", () => {
      expect(manager.getModeColor()).toBe("green");
    });

    test("returns yellow color for paper mode", async () => {
      await manager.requestModeChange("paper");
      expect(manager.getModeColor()).toBe("yellow");
    });

    test("returns red color for live mode", async () => {
      await manager.requestModeChange("paper");
      await manager.requestModeChange("live", { confirmed: true });
      expect(manager.getModeColor()).toBe("red");
    });

    test("returns mode display name", () => {
      expect(manager.getModeDisplayName()).toBe("Simulation");
    });

    test("returns correct display name for each mode", async () => {
      expect(manager.getModeDisplayName()).toBe("Simulation");

      await manager.requestModeChange("paper");
      expect(manager.getModeDisplayName()).toBe("Paper Trading");

      await manager.requestModeChange("live", { confirmed: true });
      expect(manager.getModeDisplayName()).toBe("Live Trading");
    });
  });

  describe("Persistence", () => {
    test("can save and load mode preference", () => {
      manager.saveModePreference("paper");
      const loaded = TradingModeManager.loadModePreference();
      expect(loaded).toBe("paper");
    });

    test("saveModePreference returns current mode after saving", () => {
      const result = manager.saveModePreference("paper");
      expect(result).toBe("paper");
    });

    test("loadModePreference returns simulation by default", () => {
      // Clear any saved preference first
      TradingModeManager.clearModePreference();
      const loaded = TradingModeManager.loadModePreference();
      expect(loaded).toBe("simulation");
    });

    test("clearModePreference removes saved preference", () => {
      manager.saveModePreference("paper");
      expect(TradingModeManager.loadModePreference()).toBe("paper");

      TradingModeManager.clearModePreference();
      expect(TradingModeManager.loadModePreference()).toBe("simulation");
    });

    test("can initialize with saved preference", async () => {
      TradingModeManager.clearModePreference();
      TradingModeManager.saveModePreference("paper");

      const newManager = new TradingModeManager({ useSavedPreference: true });
      expect(newManager.getCurrentMode()).toBe("paper");
    });
  });

  describe("Safety Features", () => {
    test("requires confirmation for live mode activation", async () => {
      await manager.requestModeChange("paper");

      // Without confirmation
      const resultWithout = await manager.requestModeChange("live");
      expect(resultWithout.approved).toBe(false);
      expect(resultWithout.requiresConfirmation).toBe(true);

      // With confirmation
      const resultWith = await manager.requestModeChange("live", { confirmed: true });
      expect(resultWith.approved).toBe(true);
      expect(resultWith.requiresConfirmation).toBe(false);
    });

    test("provides warning message for live mode", async () => {
      await manager.requestModeChange("paper");

      const result = await manager.requestModeChange("live");
      expect(result.warningMessage).toBeDefined();
      expect(result.warningMessage).toContain("LIVE TRADING");
    });

    test("getSafetyStatus returns current safety information", () => {
      const status = manager.getSafetyStatus();
      expect(status.currentMode).toBe("simulation");
      expect(status.canSwitchToLive).toBe(false);
      expect(status.requiresConfirmationForLive).toBe(true);
      expect(status.recommendedNextStep).toBe("paper");
    });

    test("getSafetyStatus updates based on current mode", async () => {
      await manager.requestModeChange("paper");

      const status = manager.getSafetyStatus();
      expect(status.currentMode).toBe("paper");
      expect(status.canSwitchToLive).toBe(true);
      expect(status.requiresConfirmationForLive).toBe(true);
      expect(status.recommendedNextStep).toBe("live");
    });

    test("getAllowedTransitions returns valid next modes", () => {
      const transitions = manager.getAllowedTransitions();
      expect(transitions).toContain("paper");
      expect(transitions).not.toContain("live");
      expect(transitions).not.toContain("simulation");
    });

    test("getAllowedTransitions updates after mode change", async () => {
      await manager.requestModeChange("paper");

      const transitions = manager.getAllowedTransitions();
      expect(transitions).toContain("simulation");
      expect(transitions).toContain("live");
      expect(transitions).not.toContain("paper");
    });
  });

  describe("Edge Cases", () => {
    test("handles rapid mode switches correctly", async () => {
      await manager.requestModeChange("paper");
      await manager.requestModeChange("simulation");
      await manager.requestModeChange("paper");

      expect(manager.getCurrentMode()).toBe("paper");
      expect(manager.getModeHistory()).toHaveLength(4); // initial + 3 changes
    });

    test("maintains history after many mode changes", async () => {
      await manager.requestModeChange("paper");
      await manager.requestModeChange("simulation");
      await manager.requestModeChange("paper");
      await manager.requestModeChange("simulation");
      await manager.requestModeChange("paper");

      const history = manager.getModeHistory();
      expect(history.length).toBeGreaterThanOrEqual(5);
    });

    test("event data is immutable", async () => {
      const events: ModeChangeEvent[] = [];
      manager.on("modeChange", (event) => {
        events.push(event);
      });

      await manager.requestModeChange("paper");

      expect(events).toHaveLength(1);
      expect(events[0]?.previousMode).toBe("simulation");
      expect(events[0]?.newMode).toBe("paper");
    });
  });
});
