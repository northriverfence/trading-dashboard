/**
 * Strategies Module
 * Exports example trading strategies
 */

export {
  MovingAverageCrossoverStrategy,
  createMACrossoverStrategy,
  type MovingAverageConfig,
} from "./moving-average-crossover.js";

export { RSIStrategy, type RSIConfig } from "./rsi-strategy.js";
export { BollingerBandsStrategy, type BollingerConfig } from "./bollinger-bands-strategy.js";
export { MovingAverageCrossoverStrategy as MACrossoverStrategy } from "./ma-crossover.js";
