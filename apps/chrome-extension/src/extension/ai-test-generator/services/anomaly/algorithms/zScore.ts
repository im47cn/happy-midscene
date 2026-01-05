/**
 * input: Data values, baseline statistics
 * output: Z-score based anomaly detection results
 * pos: Statistical anomaly detection using standard deviations
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { AnomalyPoint, BaselineInfo } from '../../../types/anomaly';

// ============================================================================
// Z-Score Detection
// ============================================================================

export interface ZScoreDetectionOptions {
  threshold?: number; // Number of standard deviations (default: 3)
  minAbsoluteDeviation?: number; // Minimum absolute deviation to flag
}

export interface ZScoreResult {
  isAnomaly: boolean;
  zScore: number;
  deviation: number;
  percentageDeviation: number;
}

/**
 * Calculate Z-score for a single value
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Detect if a single value is anomalous using Z-score
 */
export function detectZScoreAnomaly(
  value: number,
  baseline: BaselineInfo,
  options: ZScoreDetectionOptions = {}
): ZScoreResult {
  const { threshold = 3, minAbsoluteDeviation = 0 } = options;

  const zScore = calculateZScore(value, baseline.mean, baseline.stdDev);
  const deviation = value - baseline.mean;
  const percentageDeviation = baseline.mean !== 0 ? (deviation / baseline.mean) * 100 : 0;

  const isAnomaly =
    Math.abs(zScore) > threshold && Math.abs(deviation) >= minAbsoluteDeviation;

  return {
    isAnomaly,
    zScore,
    deviation,
    percentageDeviation,
  };
}

/**
 * Detect anomalies in a series of values using Z-score
 */
export function detectZScoreAnomalies(
  values: number[],
  baseline: BaselineInfo,
  options: ZScoreDetectionOptions = {}
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];

  for (let i = 0; i < values.length; i++) {
    const result = detectZScoreAnomaly(values[i], baseline, options);
    if (result.isAnomaly) {
      anomalies.push({
        index: i,
        value: values[i],
        deviation: result.zScore,
      });
    }
  }

  return anomalies;
}

/**
 * Modified Z-score using Median Absolute Deviation (MAD)
 * More robust to outliers in the baseline
 */
export function calculateModifiedZScore(value: number, median: number, mad: number): number {
  if (mad === 0) return 0;
  // 0.6745 is the standard deviation / MAD ratio for normal distribution
  return 0.6745 * (value - median) / mad;
}

/**
 * Calculate Median Absolute Deviation
 */
export function calculateMAD(values: number[]): { median: number; mad: number } {
  if (values.length === 0) return { median: 0, mad: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const absoluteDeviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad =
    n % 2 === 0
      ? (absoluteDeviations[n / 2 - 1] + absoluteDeviations[n / 2]) / 2
      : absoluteDeviations[Math.floor(n / 2)];

  return { median, mad };
}

/**
 * Detect anomaly using modified Z-score (more robust)
 */
export function detectModifiedZScoreAnomaly(
  value: number,
  values: number[],
  threshold: number = 3.5
): ZScoreResult {
  const { median, mad } = calculateMAD(values);
  const modifiedZScore = calculateModifiedZScore(value, median, mad);
  const deviation = value - median;
  const percentageDeviation = median !== 0 ? (deviation / median) * 100 : 0;

  return {
    isAnomaly: Math.abs(modifiedZScore) > threshold,
    zScore: modifiedZScore,
    deviation,
    percentageDeviation,
  };
}
