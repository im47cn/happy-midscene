/**
 * input: Metric data, baseline configuration
 * output: Statistical baselines for anomaly detection
 * pos: Core baseline building service for dynamic thresholds
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  BaselineConfig,
  BaselineInfo,
  BaselineMethod,
  SeasonalityConfig,
} from '../../types/anomaly';
import { DEFAULT_BASELINE_CONFIG } from '../../types/anomaly';
import { anomalyStorage } from './storage';
import {
  type DataPoint,
  dataPreprocessor,
  calculateStats,
} from './dataPreprocessor';
import { seasonalityAnalyzer } from './seasonalityAnalyzer';

// ============================================================================
// Types
// ============================================================================

export interface BuildBaselineOptions {
  data: DataPoint[];
  config?: Partial<BaselineConfig>;
  autoDetectSeasonality?: boolean;
}

export interface UpdateBaselineOptions {
  newData: DataPoint[];
  preserveSeasonality?: boolean;
}

// ============================================================================
// Baseline Builder Class
// ============================================================================

class BaselineBuilder {
  /**
   * Build a baseline from data
   */
  async buildBaseline(metricName: string, options: BuildBaselineOptions): Promise<BaselineInfo> {
    const config: BaselineConfig = {
      ...DEFAULT_BASELINE_CONFIG,
      metricName,
      ...options.config,
    };

    // Preprocess data
    const preprocessed = dataPreprocessor.preprocess(options.data, {
      outlierRemoval: config.excludeAnomalies,
      outlierThreshold: 3,
      fillMissing: true,
      normalize: false,
    });

    const data = preprocessed.data;
    if (data.length === 0) {
      throw new Error(`No valid data points for baseline: ${metricName}`);
    }

    // Auto-detect seasonality if requested
    if (options.autoDetectSeasonality && !config.seasonality.enabled) {
      const seasonalityResult = seasonalityAnalyzer.analyze(data);
      if (seasonalityResult.hasSeasonality) {
        config.seasonality = seasonalityAnalyzer.buildConfig(seasonalityResult);
      }
    }

    // Deseasonalize data if seasonality is enabled
    let processedData = data;
    if (config.seasonality.enabled) {
      processedData = data.map((d) => ({
        timestamp: d.timestamp,
        value: seasonalityAnalyzer.deseasonalize(d.value, d.timestamp, config.seasonality),
      }));
    }

    // Calculate baseline based on method
    const values = processedData.map((d) => d.value);
    const baseline = this.calculateBaseline(values, config.calculationMethod, config.windowSize);

    // Add metadata
    const baselineInfo: BaselineInfo = {
      ...baseline,
      period: this.getPeriodLabel(config.windowSize),
      sampleCount: data.length,
      lastUpdated: Date.now(),
    };

    // Save to storage
    await anomalyStorage.saveBaseline(metricName, baselineInfo, config);

    return baselineInfo;
  }

  /**
   * Update an existing baseline with new data
   */
  async updateBaseline(metricName: string, options: UpdateBaselineOptions): Promise<BaselineInfo> {
    const existing = await anomalyStorage.getBaseline(metricName);
    if (!existing) {
      throw new Error(`Baseline not found: ${metricName}`);
    }

    // Get existing config
    const config = options.preserveSeasonality
      ? existing.config
      : { ...existing.config, seasonality: { enabled: false, patterns: [] } };

    // Build new baseline with combined config
    return this.buildBaseline(metricName, {
      data: options.newData,
      config,
      autoDetectSeasonality: !options.preserveSeasonality,
    });
  }

  /**
   * Get baseline for a metric
   */
  async getBaseline(metricName: string): Promise<BaselineInfo | null> {
    const record = await anomalyStorage.getBaseline(metricName);
    return record?.baseline ?? null;
  }

  /**
   * Get baseline with config
   */
  async getBaselineWithConfig(metricName: string): Promise<{ baseline: BaselineInfo; config: BaselineConfig } | null> {
    const record = await anomalyStorage.getBaseline(metricName);
    if (!record) return null;
    return { baseline: record.baseline, config: record.config };
  }

  /**
   * Calculate baseline using specified method
   */
  private calculateBaseline(
    values: number[],
    method: BaselineMethod,
    windowSize: number
  ): Omit<BaselineInfo, 'period' | 'sampleCount' | 'lastUpdated'> {
    switch (method) {
      case 'moving_average':
        return this.calculateMovingAverageBaseline(values, windowSize);
      case 'exponential_smoothing':
        return this.calculateExponentialSmoothingBaseline(values);
      case 'percentile':
        return this.calculatePercentileBaseline(values);
      case 'median':
        return this.calculateMedianBaseline(values);
      default:
        return this.calculateMovingAverageBaseline(values, windowSize);
    }
  }

  /**
   * Calculate baseline using simple moving average
   */
  private calculateMovingAverageBaseline(
    values: number[],
    windowSize: number
  ): Omit<BaselineInfo, 'period' | 'sampleCount' | 'lastUpdated'> {
    // Use last N days of data for baseline
    const effectiveWindow = Math.min(values.length, windowSize);
    const windowValues = values.slice(-effectiveWindow);

    const stats = calculateStats(windowValues);

    return {
      mean: stats.mean,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
    };
  }

  /**
   * Calculate baseline using exponential smoothing
   * More weight to recent values
   */
  private calculateExponentialSmoothingBaseline(
    values: number[],
    alpha: number = 0.3
  ): Omit<BaselineInfo, 'period' | 'sampleCount' | 'lastUpdated'> {
    if (values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0 };
    }

    // Calculate exponentially smoothed mean
    let smoothedMean = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothedMean = alpha * values[i] + (1 - alpha) * smoothedMean;
    }

    // Calculate exponentially smoothed variance
    let smoothedVariance = 0;
    for (let i = 0; i < values.length; i++) {
      const weight = Math.pow(1 - alpha, values.length - 1 - i);
      smoothedVariance += weight * Math.pow(values[i] - smoothedMean, 2);
    }
    smoothedVariance /= values.length;

    const stats = calculateStats(values);

    return {
      mean: smoothedMean,
      stdDev: Math.sqrt(smoothedVariance),
      min: stats.min,
      max: stats.max,
    };
  }

  /**
   * Calculate baseline using percentiles
   * More robust to outliers
   */
  private calculatePercentileBaseline(
    values: number[]
  ): Omit<BaselineInfo, 'period' | 'sampleCount' | 'lastUpdated'> {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    // Use median as mean (more robust)
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Use IQR-based standard deviation estimate
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const iqr = sorted[q3Index] - sorted[q1Index];
    // IQR / 1.35 approximates standard deviation for normal distribution
    const stdDevEstimate = iqr / 1.35;

    // Use 5th and 95th percentiles for min/max
    const p5Index = Math.floor(n * 0.05);
    const p95Index = Math.floor(n * 0.95);

    return {
      mean: median,
      stdDev: stdDevEstimate,
      min: sorted[p5Index],
      max: sorted[p95Index],
    };
  }

  /**
   * Calculate baseline using median absolute deviation (MAD)
   * Most robust to outliers
   */
  private calculateMedianBaseline(
    values: number[]
  ): Omit<BaselineInfo, 'period' | 'sampleCount' | 'lastUpdated'> {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    // Median
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    // Median Absolute Deviation
    const absoluteDeviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
    const mad =
      n % 2 === 0
        ? (absoluteDeviations[n / 2 - 1] + absoluteDeviations[n / 2]) / 2
        : absoluteDeviations[Math.floor(n / 2)];

    // MAD * 1.4826 approximates standard deviation for normal distribution
    const stdDevEstimate = mad * 1.4826;

    return {
      mean: median,
      stdDev: stdDevEstimate,
      min: sorted[0],
      max: sorted[n - 1],
    };
  }

  /**
   * Get period label
   */
  private getPeriodLabel(windowSize: number): string {
    if (windowSize <= 7) return `${windowSize}d`;
    if (windowSize <= 30) return `${Math.round(windowSize / 7)}w`;
    return `${Math.round(windowSize / 30)}m`;
  }

  /**
   * Check if baseline needs update
   */
  async needsUpdate(metricName: string, maxAge: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const baseline = await this.getBaseline(metricName);
    if (!baseline) return true;

    const age = Date.now() - baseline.lastUpdated;
    return age > maxAge;
  }

  /**
   * Build baselines for multiple metrics
   */
  async buildMultipleBaselines(
    metrics: { name: string; data: DataPoint[] }[],
    config?: Partial<BaselineConfig>
  ): Promise<Map<string, BaselineInfo>> {
    const results = new Map<string, BaselineInfo>();

    for (const metric of metrics) {
      try {
        const baseline = await this.buildBaseline(metric.name, {
          data: metric.data,
          config,
          autoDetectSeasonality: true,
        });
        results.set(metric.name, baseline);
      } catch (error) {
        console.error(`Failed to build baseline for ${metric.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Calculate expected value for a timestamp
   */
  async getExpectedValue(metricName: string, timestamp: number): Promise<number | null> {
    const record = await anomalyStorage.getBaseline(metricName);
    if (!record) return null;

    let expectedValue = record.baseline.mean;

    // Apply seasonality adjustment
    if (record.config.seasonality.enabled) {
      expectedValue = seasonalityAnalyzer.reseasonalize(
        expectedValue,
        timestamp,
        record.config.seasonality
      );
    }

    return expectedValue;
  }

  /**
   * Calculate expected range for a timestamp
   */
  async getExpectedRange(
    metricName: string,
    timestamp: number,
    sigmas: number = 2
  ): Promise<{ lower: number; upper: number } | null> {
    const record = await anomalyStorage.getBaseline(metricName);
    if (!record) return null;

    const baseline = record.baseline;
    let mean = baseline.mean;
    let stdDev = baseline.stdDev;

    // Apply seasonality adjustment
    if (record.config.seasonality.enabled) {
      const adjustment = seasonalityAnalyzer.getAdjustment(timestamp, record.config.seasonality);
      mean *= adjustment;
      stdDev *= adjustment;
    }

    return {
      lower: mean - sigmas * stdDev,
      upper: mean + sigmas * stdDev,
    };
  }

  /**
   * Get all baselines
   */
  async getAllBaselines(): Promise<{ metricName: string; baseline: BaselineInfo }[]> {
    const records = await anomalyStorage.getAllBaselines();
    return records.map((r) => ({ metricName: r.metricName, baseline: r.baseline }));
  }

  /**
   * Delete a baseline
   */
  async deleteBaseline(metricName: string): Promise<void> {
    await anomalyStorage.deleteBaseline(metricName);
  }

  /**
   * Clear all baselines
   */
  async clearAllBaselines(): Promise<void> {
    await anomalyStorage.clearBaselines();
  }
}

// Export singleton instance
export const baselineBuilder = new BaselineBuilder();
