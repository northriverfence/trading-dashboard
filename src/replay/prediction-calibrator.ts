/**
 * PredictionCalibrator
 * Calibrates prediction confidence based on historical performance
 */

export interface CalibrationData {
  predictedProbability: number;
  actualOutcome: boolean;
  timestamp: Date;
  confidence: number;
}

export interface CalibrationResult {
  isWellCalibrated: boolean;
  calibrationError: number; // Lower is better
  reliabilityDiagram: { bin: number; expected: number; observed: number; count: number }[];
  adjustments: Map<number, number>; // Maps predicted -> calibrated probability
}

export class PredictionCalibrator {
  private calibrationData: CalibrationData[] = [];
  private bins = 10; // 10% probability bins

  /**
   * Add calibration data point
   */
  addDataPoint(data: CalibrationData): void {
    this.calibrationData.push(data);
  }

  /**
   * Add multiple data points
   */
  addDataPoints(data: CalibrationData[]): void {
    this.calibrationData.push(...data);
  }

  /**
   * Calibrate a prediction
   */
  calibrate(
    predictedProbability: number,
    confidence: number,
  ): {
    calibratedProbability: number;
    adjustedConfidence: number;
    reliability: number;
  } {
    const calibration = this.calculateCalibration();
    const bin = Math.floor(predictedProbability * this.bins);

    // Find adjustment for this bin
    const adjustment = calibration.adjustments.get(bin) || 0;
    const calibratedProbability = Math.max(0, Math.min(1, predictedProbability + adjustment));

    // Adjust confidence based on calibration quality
    const reliability = 1 - calibration.calibrationError;
    const adjustedConfidence = confidence * reliability;

    return {
      calibratedProbability,
      adjustedConfidence,
      reliability,
    };
  }

  /**
   * Calculate overall calibration
   */
  calculateCalibration(): CalibrationResult {
    if (this.calibrationData.length === 0) {
      return {
        isWellCalibrated: false,
        calibrationError: 1,
        reliabilityDiagram: [],
        adjustments: new Map(),
      };
    }

    const reliabilityDiagram: { bin: number; expected: number; observed: number; count: number }[] = [];
    const adjustments = new Map<number, number>();

    // Group by bins
    const bins: CalibrationData[][] = Array.from({ length: this.bins }, () => []);

    for (const data of this.calibrationData) {
      const binIndex = Math.min(Math.floor(data.predictedProbability * this.bins), this.bins - 1);
      bins[binIndex].push(data);
    }

    let totalError = 0;
    let totalCount = 0;

    for (let i = 0; i < this.bins; i++) {
      const binData = bins[i];
      const count = binData.length;
      const expected = (i + 0.5) / this.bins; // Midpoint of bin

      let observed = 0;
      if (count > 0) {
        observed = binData.filter((d) => d.actualOutcome).length / count;
      }

      reliabilityDiagram.push({
        bin: i,
        expected,
        observed,
        count,
      });

      if (count > 0) {
        totalError += Math.abs(expected - observed) * count;
        totalCount += count;
        adjustments.set(i, observed - expected);
      }
    }

    const calibrationError = totalCount > 0 ? totalError / totalCount : 1;
    const isWellCalibrated = calibrationError < 0.1;

    return {
      isWellCalibrated,
      calibrationError,
      reliabilityDiagram,
      adjustments,
    };
  }

  /**
   * Get calibration by confidence level
   */
  getCalibrationByConfidence(): {
    high: number; // >= 0.8
    medium: number; // 0.5-0.8
    low: number; // < 0.5
  } {
    const high = this.calibrationData.filter((d) => d.confidence >= 0.8);
    const medium = this.calibrationData.filter((d) => d.confidence >= 0.5 && d.confidence < 0.8);
    const low = this.calibrationData.filter((d) => d.confidence < 0.5);

    return {
      high: high.length > 0 ? high.filter((d) => d.actualOutcome).length / high.length : 0,
      medium: medium.length > 0 ? medium.filter((d) => d.actualOutcome).length / medium.length : 0,
      low: low.length > 0 ? low.filter((d) => d.actualOutcome).length / low.length : 0,
    };
  }

  /**
   * Detect overconfidence
   */
  detectOverconfidence(): {
    isOverconfident: boolean;
    overconfidenceRate: number;
    recommendation: string;
  } {
    const highConfidence = this.calibrationData.filter((d) => d.confidence >= 0.8);
    if (highConfidence.length === 0) {
      return {
        isOverconfident: false,
        overconfidenceRate: 0,
        recommendation: "Insufficient high-confidence predictions",
      };
    }

    const accurate = highConfidence.filter((d) => d.actualOutcome).length;
    const accuracy = accurate / highConfidence.length;
    const overconfidenceRate = 0.8 - accuracy; // Expected 80% at 0.8 confidence

    return {
      isOverconfident: overconfidenceRate > 0.15,
      overconfidenceRate,
      recommendation:
        overconfidenceRate > 0.15 ? "Reduce confidence in high-confidence predictions" : "Calibration looks good",
    };
  }

  /**
   * Get calibration statistics
   */
  getStatistics(): {
    totalDataPoints: number;
    accuracy: number;
    avgPredictedProbability: number;
    brierScore: number;
  } {
    if (this.calibrationData.length === 0) {
      return {
        totalDataPoints: 0,
        accuracy: 0,
        avgPredictedProbability: 0,
        brierScore: 0,
      };
    }

    const correct = this.calibrationData.filter((d) => d.actualOutcome).length;
    const accuracy = correct / this.calibrationData.length;
    const avgPredictedProbability =
      this.calibrationData.reduce((sum, d) => sum + d.predictedProbability, 0) / this.calibrationData.length;

    // Brier score (lower is better)
    const brierScore =
      this.calibrationData.reduce((sum, d) => {
        const outcome = d.actualOutcome ? 1 : 0;
        return sum + Math.pow(d.predictedProbability - outcome, 2);
      }, 0) / this.calibrationData.length;

    return {
      totalDataPoints: this.calibrationData.length,
      accuracy,
      avgPredictedProbability,
      brierScore,
    };
  }

  /**
   * Clear old data
   */
  clearOld(beforeDate: Date): void {
    this.calibrationData = this.calibrationData.filter((d) => d.timestamp >= beforeDate);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.calibrationData = [];
  }

  /**
   * Export calibration data
   */
  exportData(): CalibrationData[] {
    return [...this.calibrationData];
  }

  /**
   * Import calibration data
   */
  importData(data: CalibrationData[]): void {
    this.calibrationData = data;
  }
}
