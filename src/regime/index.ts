/**
 * Market Regime Detection Module
 * Identifies market conditions for dynamic strategy selection
 */

export { MarketRegimeDetector } from "./regime-detector.js";

export type {
  MarketRegime,
  RegimeConfig,
  RegimeState,
  RegimeTransition,
} from "./regime-detector.js";
