// src/trading/trading-mode-manager.ts

/**
 * Trading Mode Manager
 *
 * Manages switching between simulation, paper, and live trading modes
 * with safety checks to prevent accidental live trading.
 */

export type TradingMode = "simulation" | "paper" | "live";

export interface ModeChangeEvent {
  previousMode: TradingMode;
  newMode: TradingMode;
  timestamp: Date;
  reason?: string;
}

export interface ModeChangeRequest {
  requestedMode: TradingMode;
  currentMode: TradingMode;
  approved: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  warningMessage?: string;
}

export interface ModeHistoryEntry {
  mode: TradingMode;
  timestamp: Date;
  reason?: string;
}

export interface SafetyStatus {
  currentMode: TradingMode;
  canSwitchToLive: boolean;
  requiresConfirmationForLive: boolean;
  recommendedNextStep: TradingMode | null;
  warningLevel: "none" | "low" | "medium" | "high";
}

export interface TradingModeManagerEvents {
  modeChange: ModeChangeEvent;
  modeChangeRequest: ModeChangeRequest;
}

type EventHandler<T> = (event: T) => void;

interface TradingModeManagerConfig {
  useSavedPreference?: boolean;
  initialMode?: TradingMode;
}

interface ModeTransition {
  from: TradingMode;
  to: TradingMode;
  requiresConfirmation: boolean;
  warningMessage?: string;
}

// Valid mode transitions with safety requirements
const VALID_TRANSITIONS: ModeTransition[] = [
  { from: "simulation", to: "paper", requiresConfirmation: false },
  {
    from: "paper",
    to: "live",
    requiresConfirmation: true,
    warningMessage: "WARNING: You are about to enter LIVE TRADING mode. Real money will be used.",
  },
  { from: "paper", to: "simulation", requiresConfirmation: false },
  { from: "live", to: "paper", requiresConfirmation: false },
];

// Storage key for persistence
const MODE_PREFERENCE_KEY = "trading_mode_preference";

// In-memory fallback for environments without localStorage (e.g., Bun tests)
// Using a module-level variable to persist across static method calls
const memoryStorage = new Map<string, string>();

export class TradingModeManager {
  private currentMode: TradingMode;
  private modeHistory: ModeHistoryEntry[];
  private listeners: {
    [K in keyof TradingModeManagerEvents]?: EventHandler<TradingModeManagerEvents[K]>[];
  } = {};

  constructor(config: TradingModeManagerConfig = {}) {
    // Initialize mode based on config
    if (config.useSavedPreference) {
      const savedMode = TradingModeManager.loadModePreference();
      this.currentMode = savedMode;
    } else if (config.initialMode) {
      this.currentMode = config.initialMode;
    } else {
      this.currentMode = "simulation";
    }

    // Initialize history
    this.modeHistory = [
      {
        mode: this.currentMode,
        timestamp: new Date(),
        reason: "Initial mode",
      },
    ];
  }

  /**
   * Get the current trading mode
   */
  getCurrentMode(): TradingMode {
    return this.currentMode;
  }

  /**
   * Get the mode history
   */
  getModeHistory(): ModeHistoryEntry[] {
    return [...this.modeHistory];
  }

  /**
   * Get the color associated with the current mode
   */
  getModeColor(): "green" | "yellow" | "red" {
    switch (this.currentMode) {
      case "simulation":
        return "green";
      case "paper":
        return "yellow";
      case "live":
        return "red";
      default:
        return "green";
    }
  }

  /**
   * Get the display name for the current mode
   */
  getModeDisplayName(): string {
    switch (this.currentMode) {
      case "simulation":
        return "Simulation";
      case "paper":
        return "Paper Trading";
      case "live":
        return "Live Trading";
      default:
        return "Unknown";
    }
  }

  /**
   * Request a mode change with safety checks
   */
  async requestModeChange(
    targetMode: TradingMode,
    options: { confirmed?: boolean; reason?: string } = {},
  ): Promise<ModeChangeRequest> {
    const { confirmed = false, reason } = options;

    // Validate the target mode
    if (!this.isValidMode(targetMode)) {
      const request: ModeChangeRequest = {
        requestedMode: targetMode,
        currentMode: this.currentMode,
        approved: false,
        reason: `Invalid mode: ${targetMode}. Valid modes are: simulation, paper, live`,
      };
      this.emit("modeChangeRequest", request);
      return request;
    }

    // Check if already in the requested mode
    if (targetMode === this.currentMode) {
      const request: ModeChangeRequest = {
        requestedMode: targetMode,
        currentMode: this.currentMode,
        approved: false,
        reason: `Already in ${targetMode} mode`,
      };
      this.emit("modeChangeRequest", request);
      return request;
    }

    // Find the transition rule
    const transition = VALID_TRANSITIONS.find((t) => t.from === this.currentMode && t.to === targetMode);

    if (!transition) {
      const request: ModeChangeRequest = {
        requestedMode: targetMode,
        currentMode: this.currentMode,
        approved: false,
        reason: `Cannot transition directly from ${this.currentMode} to ${targetMode}`,
      };
      this.emit("modeChangeRequest", request);
      return request;
    }

    // Check if confirmation is required
    if (transition.requiresConfirmation && !confirmed) {
      const request: ModeChangeRequest = {
        requestedMode: targetMode,
        currentMode: this.currentMode,
        approved: false,
        requiresConfirmation: true,
        warningMessage: transition.warningMessage,
        reason: "Confirmation required for live trading mode",
      };
      this.emit("modeChangeRequest", request);
      return request;
    }

    // Perform the mode change
    const previousMode = this.currentMode;
    this.currentMode = targetMode;

    // Add to history
    this.modeHistory.push({
      mode: targetMode,
      timestamp: new Date(),
      reason: reason || `Switched from ${previousMode}`,
    });

    // Emit events
    const modeChangeEvent: ModeChangeEvent = {
      previousMode,
      newMode: targetMode,
      timestamp: new Date(),
      reason,
    };

    const requestResult: ModeChangeRequest = {
      requestedMode: targetMode,
      currentMode: previousMode,
      approved: true,
      requiresConfirmation: false,
    };

    this.emit("modeChange", modeChangeEvent);
    this.emit("modeChangeRequest", requestResult);

    return requestResult;
  }

  /**
   * Get safety status information
   */
  getSafetyStatus(): SafetyStatus {
    const canSwitchToLive = this.currentMode === "paper";
    const requiresConfirmationForLive = true;

    let recommendedNextStep: TradingMode | null = null;
    if (this.currentMode === "simulation") {
      recommendedNextStep = "paper";
    } else if (this.currentMode === "paper") {
      recommendedNextStep = "live";
    }

    let warningLevel: "none" | "low" | "medium" | "high" = "none";
    if (this.currentMode === "simulation") {
      warningLevel = "none";
    } else if (this.currentMode === "paper") {
      warningLevel = "low";
    } else if (this.currentMode === "live") {
      warningLevel = "high";
    }

    return {
      currentMode: this.currentMode,
      canSwitchToLive,
      requiresConfirmationForLive,
      recommendedNextStep,
      warningLevel,
    };
  }

  /**
   * Get allowed transitions from current mode
   */
  getAllowedTransitions(): TradingMode[] {
    return VALID_TRANSITIONS.filter((t) => t.from === this.currentMode).map((t) => t.to);
  }

  /**
   * Save mode preference to storage (static)
   */
  static saveModePreference(mode: TradingMode): TradingMode {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MODE_PREFERENCE_KEY, mode);
    }
    // Always save to memory storage as fallback (for Bun test environment)
    memoryStorage.set(MODE_PREFERENCE_KEY, mode);
    return mode;
  }

  /**
   * Save mode preference to storage (instance method delegates to static)
   */
  saveModePreference(mode: TradingMode): TradingMode {
    return TradingModeManager.saveModePreference(mode);
  }

  /**
   * Load mode preference from storage
   */
  static loadModePreference(): TradingMode {
    let saved: string | null = null;
    if (typeof localStorage !== "undefined") {
      saved = localStorage.getItem(MODE_PREFERENCE_KEY);
    } else {
      // Fallback to memory storage for environments without localStorage
      saved = memoryStorage.get(MODE_PREFERENCE_KEY) ?? null;
    }
    if (saved === "simulation" || saved === "paper" || saved === "live") {
      return saved;
    }
    return "simulation";
  }

  /**
   * Clear saved mode preference
   */
  static clearModePreference(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(MODE_PREFERENCE_KEY);
    } else {
      // Fallback to memory storage for environments without localStorage
      memoryStorage.delete(MODE_PREFERENCE_KEY);
    }
  }

  /**
   * Register an event listener
   */
  on<K extends keyof TradingModeManagerEvents>(event: K, handler: EventHandler<TradingModeManagerEvents[K]>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  /**
   * Remove an event listener
   */
  removeListener<K extends keyof TradingModeManagerEvents>(
    event: K,
    handler: EventHandler<TradingModeManagerEvents[K]>,
  ): void {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter((h) => h !== handler) as EventHandler<TradingModeManagerEvents[K]>[];
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit<K extends keyof TradingModeManagerEvents>(event: K, data: TradingModeManagerEvents[K]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  /**
   * Validate if a string is a valid trading mode
   */
  private isValidMode(mode: string): mode is TradingMode {
    return mode === "simulation" || mode === "paper" || mode === "live";
  }
}
