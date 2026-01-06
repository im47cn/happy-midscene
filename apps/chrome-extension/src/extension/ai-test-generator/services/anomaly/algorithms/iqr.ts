/**
 * input: Data values
 * output: IQR-based anomaly detection results
 * pos: Robust anomaly detection using interquartile range
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { AnomalyPoint } from '../../../types/anomaly';

// ============================================================================
// IQR Detection
// ============================================================================

export interface IQRDetectionOptions {
  multiplier?: number; // IQR multiplier (default: 1.5 for outliers, 3 for extreme)
}

export interface IQRStats {
  q1: number;
  q2: number; // median
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
}

export interface IQRResult {
  isAnomaly: boolean;
  isLow: boolean;
  isHigh: boolean;
  deviation: number;
  stats: IQRStats;
}

/**
 * Calculate IQR statistics from values
 */
export function calculateIQRStats(
  values: number[],
  multiplier = 1.5,
): IQRStats {
  if (values.length === 0) {
    return { q1: 0, q2: 0, q3: 0, iqr: 0, lowerBound: 0, upperBound: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Calculate quartiles
  const q1Index = Math.floor(n * 0.25);
  const q2Index = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sorted[q1Index];
  const q2 =
    n % 2 === 0 ? (sorted[q2Index - 1] + sorted[q2Index]) / 2 : sorted[q2Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  // Calculate bounds
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return { q1, q2, q3, iqr, lowerBound, upperBound };
}

/**
 * Detect if a single value is anomalous using IQR
 */
export function detectIQRAnomaly(
  value: number,
  values: number[],
  options: IQRDetectionOptions = {},
): IQRResult {
  const { multiplier = 1.5 } = options;
  const stats = calculateIQRStats(values, multiplier);

  const isLow = value < stats.lowerBound;
  const isHigh = value > stats.upperBound;
  const isAnomaly = isLow || isHigh;

  let deviation = 0;
  if (isLow) {
    deviation = (value - stats.lowerBound) / stats.iqr;
  } else if (isHigh) {
    deviation = (value - stats.upperBound) / stats.iqr;
  }

  return {
    isAnomaly,
    isLow,
    isHigh,
    deviation,
    stats,
  };
}

/**
 * Detect anomalies in a series of values using IQR
 */
export function detectIQRAnomalies(
  values: number[],
  options: IQRDetectionOptions = {},
): AnomalyPoint[] {
  const { multiplier = 1.5 } = options;
  const stats = calculateIQRStats(values, multiplier);
  const anomalies: AnomalyPoint[] = [];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value < stats.lowerBound || value > stats.upperBound) {
      const deviation =
        value < stats.lowerBound
          ? (value - stats.lowerBound) / stats.iqr
          : (value - stats.upperBound) / stats.iqr;
      anomalies.push({
        index: i,
        value,
        deviation,
      });
    }
  }

  return anomalies;
}

/**
 * Get percentage of values that would be flagged as anomalies
 */
export function getAnomalyPercentage(
  values: number[],
  multiplier = 1.5,
): number {
  const anomalies = detectIQRAnomalies(values, { multiplier });
  return values.length > 0 ? (anomalies.length / values.length) * 100 : 0;
}
