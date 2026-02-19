/**
 * Predictive Analytics Module
 */

export interface PricePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PredictionResult {
  signal: "buy" | "sell" | "hold";
  confidence: number;
  targetPrice: number;
  stopLoss: number;
  reasoning: string[];
  indicators: {
    rsi: number;
    macd: number;
    macdSignal: number;
    upperBand: number;
    lowerBand: number;
    sma20: number;
    sma50: number;
    trend: "up" | "down" | "sideways";
    volatility: number;
  };
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const sum = prices.slice(-period).reduce((a, b) => a + (b ?? 0), 0);
  return sum / period;
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const current = prices[i] ?? 0;
    const prev = prices[i - 1] ?? 0;
    changes.push(current - prev);
  }

  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calculateMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - (ema26[i] ?? 0));
  const signalLine = calculateEMA(macdLine, 9);

  const macd = macdLine[macdLine.length - 1] ?? 0;
  const signal = signalLine[signalLine.length - 1] ?? 0;

  return { macd, signal, histogram: macd - signal };
}

function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0] ?? 0];

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i] ?? 0;
    ema.push(price * k + (ema[i - 1] ?? 0) * (1 - k));
  }
  return ema;
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
): {
  upper: number;
  middle: number;
  lower: number;
} {
  const sma = calculateSMA(prices, period);
  const squaredDiffs = prices.slice(-period).map((p) => Math.pow((p ?? 0) - sma, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

  return {
    upper: sma + 2 * stdDev,
    middle: sma,
    lower: sma - 2 * stdDev,
  };
}

export function generatePrediction(prices: PricePoint[]): PredictionResult {
  const closes = prices.map((p) => p.close);
  const currentPrice = closes[closes.length - 1] ?? 0;

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bands = calculateBollingerBands(closes);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);

  let trend: "up" | "down" | "sideways" = "sideways";
  if (sma20 > sma50 * 1.02) trend = "up";
  else if (sma20 < sma50 * 0.98) trend = "down";

  const volatility = calculateVolatility(closes);

  let signal: "buy" | "sell" | "hold" = "hold";
  const reasoning: string[] = [];
  let confidence = 0.5;

  if (rsi < 30) {
    reasoning.push("RSI oversold");
    confidence += 0.1;
  } else if (rsi > 70) {
    reasoning.push("RSI overbought");
    confidence -= 0.1;
  }

  if (macd.histogram > 0) {
    reasoning.push("MACD bullish");
    confidence += 0.1;
  } else {
    reasoning.push("MACD bearish");
    confidence -= 0.1;
  }

  if (trend === "up") confidence += 0.1;
  else if (trend === "down") confidence -= 0.1;

  if (currentPrice < bands.lower) {
    reasoning.push("Below lower band");
    confidence += 0.1;
  } else if (currentPrice > bands.upper) {
    reasoning.push("Above upper band");
    confidence -= 0.1;
  }

  if (confidence > 0.6) signal = "buy";
  else if (confidence < 0.4) signal = "sell";

  const targetPrice = signal === "buy" ? currentPrice * 1.04 : signal === "sell" ? currentPrice * 0.96 : currentPrice;
  const stopLoss =
    signal === "buy" ? currentPrice * 0.98 : signal === "sell" ? currentPrice * 1.02 : currentPrice * 0.95;

  return {
    signal,
    confidence: Math.min(0.95, Math.max(0.05, confidence)),
    targetPrice,
    stopLoss,
    reasoning,
    indicators: {
      rsi,
      macd: macd.macd,
      macdSignal: macd.signal,
      upperBand: bands.upper,
      lowerBand: bands.lower,
      sma20,
      sma50,
      trend,
      volatility,
    },
  };
}

function calculateVolatility(prices: number[]): number {
  const returns = prices.slice(1).map((c, i) => {
    const prev = prices[i] ?? 1;
    return prev > 0 ? (c - prev) / prev : 0;
  });
  const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length || 1);
  return Math.sqrt(variance);
}
