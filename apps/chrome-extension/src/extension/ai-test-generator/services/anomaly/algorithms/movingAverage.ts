/**
 * input: Time series data
 * output: Moving average based anomaly detection results
 * pos: Trend-aware anomaly detection using moving averages
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { AnomalyPoint } from '../../../types/anomaly';
import type { DataPoint } from '../dataPreprocessor';

// ============================================================================
// Moving Average Detection
// ============================================================================

export interface MovingAverageOptions {
  windowSize?: number; // Window size for moving average
  threshold?: number; // Number of standard deviations for anomaly
  useExponential?: boolean; // Use exponential moving average
  alpha?: number; // Smoothing factor for EMA (0-1)
}

export interface MovingAverageResult {
  isAnomaly: boolean;
  currentValue: number;
  movingAverage: number;
  deviation: number;
  percentageDeviation: number;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) {
    return values.map(() => values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length;
    result.push(avg);
  }

  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(values: number[], alpha: number = 0.2): number[] {
  if (values.length === 0) return [];

  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Calculate Moving Standard Deviation
 */
export function calculateMovingStdDev(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return values.map(() => Math.sqrt(variance));
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance = window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length;
    result.push(Math.sqrt(variance));
  }

  return result;
}

/**
 * Detect anomaly using moving average comparison
 */
export function detectMovingAverageAnomaly(
  value: number,
  historicalValues: number[],
  options: MovingAverageOptions = {}
): MovingAverageResult {
  const { windowSize = 10, threshold = 2, useExponential = false, alpha = 0.2 } = options;

  if (historicalValues.length === 0) {
    return {
      isAnomaly: false,
      currentValue: value,
      movingAverage: value,
      deviation: 0,
      percentageDeviation: 0,
    };
  }

  // Calculate moving average
  const ma = useExponential
    ? calculateEMA([...historicalValues, value], alpha)
    : calculateSMA([...historicalValues, value], windowSize);

  const movingAverage = ma[ma.length - 2] || value; // Use previous MA as baseline
  const movingStdDevs = calculateMovingStdDev(historicalValues, windowSize);
  const stdDev = movingStdDevs[movingStdDevs.length - 1] || 0;

  const deviation = value - movingAverage;
  const percentageDeviation = movingAverage !== 0 ? (deviation / movingAverage) * 100 : 0;
  const zScore = stdDev !== 0 ? deviation / stdDev : 0;

  return {
    isAnomaly: Math.abs(zScore) > threshold,
    currentValue: value,
    movingAverage,
    deviation,
    percentageDeviation,
  };
}

/**
 * Detect anomalies in a data series using moving average
 */
export function detectMovingAverageAnomalies(
  data: DataPoint[],
  options: MovingAverageOptions = {}
): AnomalyPoint[] {
  const { windowSize = 10, threshold = 2, useExponential = false, alpha = 0.2 } = options;

  if (data.length < windowSize) {
    return [];
  }

  const values = data.map((d) => d.value);
  const anomalies: AnomalyPoint[] = [];

  // Calculate moving average and std dev
  const ma = useExponential ? calculateEMA(values, alpha) : calculateSMA(values, windowSize);
  const stdDevs = calculateMovingStdDev(values, windowSize);

  // Check each point after warm-up period
  for (let i = windowSize; i < values.length; i++) {
    const deviation = values[i] - ma[i - 1];
    const stdDev = stdDevs[i - 1];
    const zScore = stdDev !== 0 ? deviation / stdDev : 0;

    if (Math.abs(zScore) > threshold) {
      anomalies.push({
        index: i,
        value: values[i],
        deviation: zScore,
        timestamp: data[i].timestamp,
      });
    }
  }

  return anomalies;
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  values: number[],
  windowSize: number = 20,
  multiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(values, windowSize);
  const stdDevs = calculateMovingStdDev(values, windowSize);

  const upper = middle.map((m, i) => m + multiplier * stdDevs[i]);
  const lower = middle.map((m, i) => m - multiplier * stdDevs[i]);

  return { upper, middle, lower };
}

/**
 * Detect anomalies using Bollinger Bands
 */
export function detectBollingerBandAnomalies(
  data: DataPoint[],
  windowSize: number = 20,
  multiplier: number = 2
): AnomalyPoint[] {
  const values = data.map((d) => d.value);
  const bands = calculateBollingerBands(values, windowSize, multiplier);
  const anomalies: AnomalyPoint[] = [];

  for (let i = windowSize; i < values.length; i++) {
    if (values[i] > bands.upper[i] || values[i] < bands.lower[i]) {
      const deviation =
        values[i] > bands.upper[i]
          ? (values[i] - bands.upper[i]) / (bands.upper[i] - bands.middle[i])
          : (values[i] - bands.lower[i]) / (bands.middle[i] - bands.lower[i]);

      anomalies.push({
        index: i,
        value: values[i],
        deviation,
        timestamp: data[i].timestamp,
      });
    }
  }

  return anomalies;
}
