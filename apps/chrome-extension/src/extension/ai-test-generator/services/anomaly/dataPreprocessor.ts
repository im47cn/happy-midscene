/**
 * input: Raw metric data arrays
 * output: Cleaned and normalized data for baseline calculation
 * pos: Data preparation layer before baseline building
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface PreprocessConfig {
  outlierRemoval: boolean;
  outlierThreshold: number; // Z-score threshold for outlier detection
  fillMissing: boolean;
  fillMethod: 'linear' | 'previous' | 'mean';
  normalize: boolean;
  normalizeMethod: 'zscore' | 'minmax';
  removeZeros: boolean;
}

export interface PreprocessResult {
  data: DataPoint[];
  removedOutliers: number;
  filledMissing: number;
  stats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PREPROCESS_CONFIG: PreprocessConfig = {
  outlierRemoval: true,
  outlierThreshold: 3, // 3 standard deviations
  fillMissing: true,
  fillMethod: 'linear',
  normalize: false,
  normalizeMethod: 'zscore',
  removeZeros: false,
};

// ============================================================================
// Statistical Utilities
// ============================================================================

/**
 * Calculate basic statistics for a data array
 */
export function calculateStats(values: number[]): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  q1: number;
  q3: number;
} {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, q1: 0, q3: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;

  // Mean
  const mean = values.reduce((sum, v) => sum + v, 0) / n;

  // Standard deviation
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Min/Max
  const min = sorted[0];
  const max = sorted[n - 1];

  // Median
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Quartiles
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  return { mean, stdDev, min, max, median, q1, q3 };
}

/**
 * Calculate Z-score for a value
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// ============================================================================
// Data Preprocessor Class
// ============================================================================

class DataPreprocessor {
  /**
   * Preprocess data with all configured steps
   */
  preprocess(data: DataPoint[], config: Partial<PreprocessConfig> = {}): PreprocessResult {
    const fullConfig = { ...DEFAULT_PREPROCESS_CONFIG, ...config };
    let processedData = [...data];
    let removedOutliers = 0;
    let filledMissing = 0;

    // Sort by timestamp
    processedData.sort((a, b) => a.timestamp - b.timestamp);

    // Remove zeros if configured
    if (fullConfig.removeZeros) {
      const beforeCount = processedData.length;
      processedData = processedData.filter((d) => d.value !== 0);
      removedOutliers += beforeCount - processedData.length;
    }

    // Remove outliers
    if (fullConfig.outlierRemoval) {
      const result = this.removeOutliers(processedData, fullConfig.outlierThreshold);
      processedData = result.data;
      removedOutliers += result.removed;
    }

    // Fill missing values (detect gaps in timeline)
    if (fullConfig.fillMissing && processedData.length >= 2) {
      const result = this.fillMissingValues(processedData, fullConfig.fillMethod);
      processedData = result.data;
      filledMissing = result.filled;
    }

    // Normalize
    if (fullConfig.normalize) {
      processedData = this.normalizeData(processedData, fullConfig.normalizeMethod);
    }

    // Calculate final stats
    const values = processedData.map((d) => d.value);
    const stats = calculateStats(values);

    return {
      data: processedData,
      removedOutliers,
      filledMissing,
      stats: {
        mean: stats.mean,
        stdDev: stats.stdDev,
        min: stats.min,
        max: stats.max,
      },
    };
  }

  /**
   * Remove outliers using Z-score method
   */
  removeOutliers(
    data: DataPoint[],
    threshold: number = 3
  ): { data: DataPoint[]; removed: number } {
    if (data.length < 3) {
      return { data, removed: 0 };
    }

    const values = data.map((d) => d.value);
    const stats = calculateStats(values);

    const filtered = data.filter((d) => {
      const zScore = Math.abs(calculateZScore(d.value, stats.mean, stats.stdDev));
      return zScore <= threshold;
    });

    return {
      data: filtered,
      removed: data.length - filtered.length,
    };
  }

  /**
   * Remove outliers using IQR method
   */
  removeOutliersIQR(
    data: DataPoint[],
    multiplier: number = 1.5
  ): { data: DataPoint[]; removed: number } {
    if (data.length < 4) {
      return { data, removed: 0 };
    }

    const values = data.map((d) => d.value);
    const stats = calculateStats(values);
    const iqr = stats.q3 - stats.q1;
    const lowerBound = stats.q1 - multiplier * iqr;
    const upperBound = stats.q3 + multiplier * iqr;

    const filtered = data.filter((d) => d.value >= lowerBound && d.value <= upperBound);

    return {
      data: filtered,
      removed: data.length - filtered.length,
    };
  }

  /**
   * Fill missing values in time series
   */
  fillMissingValues(
    data: DataPoint[],
    method: 'linear' | 'previous' | 'mean'
  ): { data: DataPoint[]; filled: number } {
    if (data.length < 2) {
      return { data, filled: 0 };
    }

    // Detect typical interval
    const intervals: number[] = [];
    for (let i = 1; i < data.length; i++) {
      intervals.push(data[i].timestamp - data[i - 1].timestamp);
    }
    intervals.sort((a, b) => a - b);
    const typicalInterval = intervals[Math.floor(intervals.length / 2)]; // Median interval

    // If interval is too small or inconsistent, skip
    if (typicalInterval <= 0 || intervals[intervals.length - 1] / typicalInterval > 100) {
      return { data, filled: 0 };
    }

    const result: DataPoint[] = [];
    let filled = 0;
    const values = data.map((d) => d.value);
    const meanValue = values.reduce((sum, v) => sum + v, 0) / values.length;

    for (let i = 0; i < data.length; i++) {
      result.push(data[i]);

      if (i < data.length - 1) {
        const gap = data[i + 1].timestamp - data[i].timestamp;
        const expectedPoints = Math.round(gap / typicalInterval) - 1;

        // Fill gaps larger than 1.5x typical interval
        if (expectedPoints > 0 && gap > typicalInterval * 1.5) {
          for (let j = 1; j <= expectedPoints; j++) {
            const timestamp = data[i].timestamp + (gap * j) / (expectedPoints + 1);
            let value: number;

            switch (method) {
              case 'linear':
                value = data[i].value + ((data[i + 1].value - data[i].value) * j) / (expectedPoints + 1);
                break;
              case 'previous':
                value = data[i].value;
                break;
              case 'mean':
                value = meanValue;
                break;
            }

            result.push({ timestamp, value });
            filled++;
          }
        }
      }
    }

    return { data: result, filled };
  }

  /**
   * Normalize data
   */
  normalizeData(data: DataPoint[], method: 'zscore' | 'minmax'): DataPoint[] {
    if (data.length === 0) return data;

    const values = data.map((d) => d.value);
    const stats = calculateStats(values);

    return data.map((d) => {
      let normalizedValue: number;

      switch (method) {
        case 'zscore':
          normalizedValue = stats.stdDev === 0 ? 0 : (d.value - stats.mean) / stats.stdDev;
          break;
        case 'minmax':
          const range = stats.max - stats.min;
          normalizedValue = range === 0 ? 0 : (d.value - stats.min) / range;
          break;
      }

      return { timestamp: d.timestamp, value: normalizedValue };
    });
  }

  /**
   * Denormalize data back to original scale
   */
  denormalize(
    normalizedValue: number,
    originalStats: { mean: number; stdDev: number; min: number; max: number },
    method: 'zscore' | 'minmax'
  ): number {
    switch (method) {
      case 'zscore':
        return normalizedValue * originalStats.stdDev + originalStats.mean;
      case 'minmax':
        return normalizedValue * (originalStats.max - originalStats.min) + originalStats.min;
    }
  }

  /**
   * Smooth data using simple moving average
   */
  smoothData(data: DataPoint[], windowSize: number = 3): DataPoint[] {
    if (data.length < windowSize) return data;

    const result: DataPoint[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length, i + halfWindow + 1);
      const windowData = data.slice(start, end);
      const avgValue = windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;

      result.push({ timestamp: data[i].timestamp, value: avgValue });
    }

    return result;
  }

  /**
   * Detect if data has significant trend
   */
  detectTrend(data: DataPoint[]): { hasTrend: boolean; slope: number; direction: 'up' | 'down' | 'flat' } {
    if (data.length < 3) {
      return { hasTrend: false, slope: 0, direction: 'flat' };
    }

    // Simple linear regression
    const n = data.length;
    const xValues = data.map((_, i) => i);
    const yValues = data.map((d) => d.value);

    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += Math.pow(xValues[i] - xMean, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;

    // Calculate R-squared to determine significance
    const predictions = xValues.map((x) => yMean + slope * (x - xMean));
    const ssRes = yValues.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
    const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    const hasTrend = rSquared > 0.3 && Math.abs(slope) > 0.01;
    const direction = Math.abs(slope) < 0.01 ? 'flat' : slope > 0 ? 'up' : 'down';

    return { hasTrend, slope, direction };
  }

  /**
   * Detrend data (remove linear trend)
   */
  detrend(data: DataPoint[]): DataPoint[] {
    const { slope } = this.detectTrend(data);
    const n = data.length;
    const xMean = (n - 1) / 2;
    const yValues = data.map((d) => d.value);
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / n;

    return data.map((d, i) => ({
      timestamp: d.timestamp,
      value: d.value - slope * (i - xMean),
    }));
  }

  /**
   * Aggregate data points into fixed intervals
   */
  aggregate(
    data: DataPoint[],
    intervalMs: number,
    method: 'mean' | 'sum' | 'max' | 'min' | 'last' = 'mean'
  ): DataPoint[] {
    if (data.length === 0) return [];

    const buckets: Map<number, number[]> = new Map();

    // Group data into buckets
    for (const point of data) {
      const bucketKey = Math.floor(point.timestamp / intervalMs) * intervalMs;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(point.value);
    }

    // Aggregate each bucket
    const result: DataPoint[] = [];
    for (const [timestamp, values] of buckets) {
      let aggregatedValue: number;

      switch (method) {
        case 'mean':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0) / values.length;
          break;
        case 'sum':
          aggregatedValue = values.reduce((sum, v) => sum + v, 0);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'last':
          aggregatedValue = values[values.length - 1];
          break;
      }

      result.push({ timestamp, value: aggregatedValue });
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }
}

// Export singleton instance
export const dataPreprocessor = new DataPreprocessor();
