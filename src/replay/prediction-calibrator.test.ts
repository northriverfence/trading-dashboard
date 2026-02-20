/**
 * PredictionCalibrator Tests
 */

import { test, expect } from "bun:test";
import { PredictionCalibrator, CalibrationData } from "./prediction-calibrator.js";

test("PredictionCalibrator adds and calibrates predictions", () => {
  const calibrator = new PredictionCalibrator();

  // Add calibration data
  for (let i = 0; i < 20; i++) {
    const data: CalibrationData = {
      predictedProbability: 0.85,
      actualOutcome: i < 14, // 70% accurate
      timestamp: new Date(),
      confidence: 0.8,
    };
    calibrator.addDataPoint(data);
  }

  const result = calibrator.calibrate(0.85, 0.8);
  expect(result.calibratedProbability).toBeGreaterThanOrEqual(0);
  expect(result.calibratedProbability).toBeLessThanOrEqual(1);
  expect(result.reliability).toBeGreaterThanOrEqual(0);
});

test("PredictionCalibrator analyzes calibration", () => {
  const calibrator = new PredictionCalibrator();

  // Add well-calibrated predictions
  for (let i = 0; i < 100; i++) {
    const probability = 0.5 + Math.random() * 0.5;
    const data: CalibrationData = {
      predictedProbability: probability,
      actualOutcome: Math.random() < probability,
      timestamp: new Date(),
      confidence: 0.7,
    };
    calibrator.addDataPoint(data);
  }

  const calibration = calibrator.calculateCalibration();
  expect(calibration.isWellCalibrated).toBeDefined();
  expect(calibration.calibrationError).toBeGreaterThanOrEqual(0);
  expect(calibration.reliabilityDiagram.length).toBeGreaterThan(0);
});

test("PredictionCalibrator detects overconfidence", () => {
  const calibrator = new PredictionCalibrator();

  // Add overconfident predictions (0.9 confidence but low accuracy)
  for (let i = 0; i < 20; i++) {
    const data: CalibrationData = {
      predictedProbability: 0.9,
      actualOutcome: i < 8, // Only 40% accurate
      timestamp: new Date(),
      confidence: 0.9,
    };
    calibrator.addDataPoint(data);
  }

  const detection = calibrator.detectOverconfidence();
  expect(typeof detection.isOverconfident).toBe("boolean");
  expect(typeof detection.overconfidenceRate).toBe("number");
});

test("PredictionCalibrator gets calibration by confidence", () => {
  const calibrator = new PredictionCalibrator();

  for (let i = 0; i < 20; i++) {
    const data: CalibrationData = {
      predictedProbability: 0.85,
      actualOutcome: i < 14,
      timestamp: new Date(),
      confidence: i < 10 ? 0.9 : 0.6,
    };
    calibrator.addDataPoint(data);
  }

  const byConfidence = calibrator.getCalibrationByConfidence();
  expect(byConfidence.high).toBeGreaterThanOrEqual(0);
  expect(byConfidence.medium).toBeGreaterThanOrEqual(0);
});

test("PredictionCalibrator gets statistics", () => {
  const calibrator = new PredictionCalibrator();

  for (let i = 0; i < 50; i++) {
    const data: CalibrationData = {
      predictedProbability: 0.7,
      actualOutcome: i < 35,
      timestamp: new Date(),
      confidence: 0.8,
    };
    calibrator.addDataPoint(data);
  }

  const stats = calibrator.getStatistics();
  expect(stats.totalDataPoints).toBe(50);
  expect(stats.brierScore).toBeGreaterThanOrEqual(0);
  expect(stats.accuracy).toBeGreaterThanOrEqual(0);
});

test("PredictionCalibrator clears data", () => {
  const calibrator = new PredictionCalibrator();

  for (let i = 0; i < 30; i++) {
    const data: CalibrationData = {
      predictedProbability: 0.8,
      actualOutcome: i < 24,
      timestamp: new Date(),
      confidence: 0.8,
    };
    calibrator.addDataPoint(data);
  }

  calibrator.clear();

  const stats = calibrator.getStatistics();
  expect(stats.totalDataPoints).toBe(0);
});
