/**
 * input: Test execution metrics, baseline data
 * output: Detected anomalies with severity and status
 * pos: Core anomaly detection orchestrator combining all algorithms
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Anomaly,
  AnomalyStatus,
  AnomalyType,
  BaselineInfo,
  DetectionConfig,
  Severity,
} from '../../types/anomaly';
import { DEFAULT_THRESHOLDS } from '../../types/anomaly';
import {
  type ExecutionResult,
  detectConsecutiveFailures,
  detectFlakyPattern,
  detectPassRateChange,
} from './algorithms/consecutive';
import { type IQRDetectionOptions, detectIQRAnomaly } from './algorithms/iqr';
import {
  type MovingAverageOptions,
  detectBollingerBandAnomalies,
  detectMovingAverageAnomaly,
} from './algorithms/movingAverage';
import {
  type ZScoreDetectionOptions,
  detectModifiedZScoreAnomaly,
  detectZScoreAnomaly,
} from './algorithms/zScore';
import { baselineBuilder } from './baselineBuilder';
import { type DataPoint, dataPreprocessor } from './dataPreprocessor';
import { type SeverityInput, severityEvaluator } from './severityEvaluator';
import { anomalyStorage } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface DetectionOptions {
  metricName: string;
  value: number;
  timestamp?: number;
  caseId?: string;
  caseName?: string;
  config?: Partial<DetectionConfig>;
  historicalValues?: number[];
  executionResults?: ExecutionResult[];
}

export interface BatchDetectionOptions {
  metrics: Array<{
    name: string;
    value: number;
    caseId?: string;
    caseName?: string;
  }>;
  timestamp?: number;
  config?: Partial<DetectionConfig>;
}

export interface DetectionResult {
  isAnomaly: boolean;
  anomaly?: Anomaly;
  details: {
    algorithm: string;
    deviation: number;
    threshold: number;
    baseline?: BaselineInfo;
  };
}

export interface CaseDetectionResult {
  caseId: string;
  anomalies: Anomaly[];
  overallStatus: 'normal' | 'warning' | 'critical';
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  enabled: true,
  algorithms: ['zscore', 'iqr', 'moving_average'],
  sensitivity: 'medium',
  thresholds: DEFAULT_THRESHOLDS,
  minDataPoints: 10,
  detectionWindow: 30, // days
};

// ============================================================================
// Anomaly Detector Class
// ============================================================================

class AnomalyDetector {
  private readonly idPrefix = 'anomaly';
  private idCounter = 0;

  /**
   * Detect anomaly for a single metric value
   */
  async detect(options: DetectionOptions): Promise<DetectionResult> {
    const config: DetectionConfig = {
      ...DEFAULT_DETECTION_CONFIG,
      ...options.config,
    };

    if (!config.enabled) {
      return {
        isAnomaly: false,
        details: { algorithm: 'none', deviation: 0, threshold: 0 },
      };
    }

    const timestamp = options.timestamp ?? Date.now();

    // Get baseline for this metric
    const baseline = await baselineBuilder.getBaseline(options.metricName);

    // If no baseline and historical values provided, use those for comparison
    if (
      !baseline &&
      (!options.historicalValues ||
        options.historicalValues.length < config.minDataPoints)
    ) {
      return {
        isAnomaly: false,
        details: {
          algorithm: 'insufficient_data',
          deviation: 0,
          threshold: 0,
        },
      };
    }

    // Run detection algorithms
    const results = await this.runAlgorithms(
      options.value,
      baseline,
      options.historicalValues || [],
      config,
    );

    // Combine results - anomaly if any algorithm flags it
    const anomalyResults = results.filter((r) => r.isAnomaly);

    if (anomalyResults.length === 0) {
      return {
        isAnomaly: false,
        details: {
          algorithm: 'all',
          deviation: results[0]?.deviation || 0,
          threshold: this.getThreshold(config.sensitivity),
          baseline: baseline ?? undefined,
        },
      };
    }

    // Create anomaly record
    const primaryResult = anomalyResults.sort(
      (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation),
    )[0];
    const anomalyType = this.determineAnomalyType(
      options.metricName,
      primaryResult.deviation,
    );

    const severityInput: SeverityInput = {
      deviation: primaryResult.deviation,
      anomalyType,
      duration: 0,
      isRegression: await this.checkIfRegression(
        options.metricName,
        options.caseId,
      ),
    };

    const severityResult = severityEvaluator.evaluate(severityInput);

    const anomaly: Anomaly = {
      id: this.generateId(),
      type: anomalyType,
      severity: severityResult.severity,
      status: 'new',
      detectedAt: timestamp,
      metric: options.metricName,
      currentValue: options.value,
      expectedValue:
        baseline?.mean ?? this.calculateMean(options.historicalValues || []),
      deviation: primaryResult.deviation,
      caseId: options.caseId,
      caseName: options.caseName,
      description: this.generateDescription(
        anomalyType,
        primaryResult.deviation,
        options.metricName,
      ),
    };

    // Save to storage
    await anomalyStorage.saveAnomaly(anomaly);

    return {
      isAnomaly: true,
      anomaly,
      details: {
        algorithm: primaryResult.algorithm,
        deviation: primaryResult.deviation,
        threshold: this.getThreshold(config.sensitivity),
        baseline: baseline ?? undefined,
      },
    };
  }

  /**
   * Detect anomalies for a specific test case
   */
  async detectForCase(
    caseId: string,
    metrics: { name: string; value: number }[],
    config?: Partial<DetectionConfig>,
  ): Promise<CaseDetectionResult> {
    const anomalies: Anomaly[] = [];
    const timestamp = Date.now();

    for (const metric of metrics) {
      const result = await this.detect({
        metricName: `${caseId}:${metric.name}`,
        value: metric.value,
        timestamp,
        caseId,
        config,
      });

      if (result.isAnomaly && result.anomaly) {
        anomalies.push(result.anomaly);
      }
    }

    // Determine overall status
    let overallStatus: 'normal' | 'warning' | 'critical' = 'normal';
    if (
      anomalies.some((a) => a.severity === 'critical' || a.severity === 'high')
    ) {
      overallStatus = 'critical';
    } else if (anomalies.length > 0) {
      overallStatus = 'warning';
    }

    return {
      caseId,
      anomalies,
      overallStatus,
    };
  }

  /**
   * Batch detect anomalies for multiple metrics
   */
  async detectBatch(
    options: BatchDetectionOptions,
  ): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];
    const timestamp = options.timestamp ?? Date.now();

    for (const metric of options.metrics) {
      const result = await this.detect({
        metricName: metric.name,
        value: metric.value,
        timestamp,
        caseId: metric.caseId,
        caseName: metric.caseName,
        config: options.config,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Detect patterns in execution results
   */
  async detectPatterns(
    caseId: string,
    results: ExecutionResult[],
    config?: Partial<DetectionConfig>,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const timestamp = Date.now();

    // Detect consecutive failures
    const consecutiveResult = detectConsecutiveFailures(results, {
      failureThreshold: 3,
    });
    if (consecutiveResult.isAnomaly) {
      const anomaly = await this.createPatternAnomaly(
        caseId,
        'failure_spike',
        consecutiveResult.consecutiveFailures,
        `Detected ${consecutiveResult.consecutiveFailures} consecutive failures`,
        timestamp,
      );
      anomalies.push(anomaly);
    }

    // Detect flaky pattern (positional parameters: results, minExecutions, flakyThreshold)
    const flakyResult = detectFlakyPattern(results, 10, 0.3);
    if (flakyResult.isFlaky) {
      const anomaly = await this.createPatternAnomaly(
        caseId,
        'flaky_pattern',
        flakyResult.alternations,
        `Flaky test pattern: ${(flakyResult.flakyScore * 100).toFixed(1)}% instability`,
        timestamp,
      );
      anomalies.push(anomaly);
    }

    // Detect pass rate change (positional parameters: results, windowSize, changeThreshold)
    const passRateResult = detectPassRateChange(results, 10, 0.2);
    if (passRateResult.hasChange) {
      const anomalyType =
        passRateResult.change < 0 ? 'success_rate_drop' : 'trend_change';
      const anomaly = await this.createPatternAnomaly(
        caseId,
        anomalyType,
        Math.abs(passRateResult.change),
        `Pass rate ${passRateResult.change < 0 ? 'dropped' : 'increased'} by ${(Math.abs(passRateResult.change) * 100).toFixed(1)}%`,
        timestamp,
      );
      anomalies.push(anomaly);
    }

    return anomalies;
  }

  /**
   * Get all active anomalies
   */
  async getActiveAnomalies(filters?: {
    severity?: Severity[];
    type?: AnomalyType[];
    caseId?: string;
  }): Promise<Anomaly[]> {
    let anomalies = await anomalyStorage.getActiveAnomalies();

    if (filters?.severity && filters.severity.length > 0) {
      anomalies = anomalies.filter((a) =>
        filters.severity!.includes(a.severity),
      );
    }

    if (filters?.type && filters.type.length > 0) {
      anomalies = anomalies.filter((a) => filters.type!.includes(a.type));
    }

    if (filters?.caseId) {
      anomalies = anomalies.filter((a) => a.caseId === filters.caseId);
    }

    return anomalies;
  }

  /**
   * Get anomalies by time range
   */
  async getAnomaliesByTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<Anomaly[]> {
    return anomalyStorage.getAnomaliesByTimeRange(startTime, endTime);
  }

  /**
   * Update anomaly status
   */
  async updateStatus(anomalyId: string, status: AnomalyStatus): Promise<void> {
    const anomaly = await anomalyStorage.getAnomaly(anomalyId);
    if (anomaly) {
      anomaly.status = status;
      if (status === 'resolved') {
        anomaly.resolvedAt = Date.now();
      }
      await anomalyStorage.saveAnomaly(anomaly);
    }
  }

  /**
   * Acknowledge an anomaly
   */
  async acknowledge(anomalyId: string): Promise<void> {
    await this.updateStatus(anomalyId, 'acknowledged');
  }

  /**
   * Resolve an anomaly
   */
  async resolve(anomalyId: string): Promise<void> {
    await this.updateStatus(anomalyId, 'resolved');
  }

  /**
   * Get anomaly by ID
   */
  async getAnomaly(anomalyId: string): Promise<Anomaly | null> {
    return anomalyStorage.getAnomaly(anomalyId);
  }

  /**
   * Delete an anomaly
   */
  async deleteAnomaly(anomalyId: string): Promise<void> {
    await anomalyStorage.deleteAnomaly(anomalyId);
  }

  /**
   * Get anomaly statistics
   */
  async getStatistics(timeRange?: { start: number; end: number }): Promise<{
    total: number;
    bySeverity: Record<Severity, number>;
    byType: Record<AnomalyType, number>;
    byStatus: Record<AnomalyStatus, number>;
  }> {
    let anomalies: Anomaly[];

    if (timeRange) {
      anomalies = await this.getAnomaliesByTimeRange(
        timeRange.start,
        timeRange.end,
      );
    } else {
      anomalies = await anomalyStorage.getAllAnomalies();
    }

    const bySeverity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const byType: Partial<Record<AnomalyType, number>> = {};
    const byStatus: Record<AnomalyStatus, number> = {
      new: 0,
      acknowledged: 0,
      investigating: 0,
      resolved: 0,
    };

    for (const anomaly of anomalies) {
      bySeverity[anomaly.severity]++;
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
      byStatus[anomaly.status]++;
    }

    return {
      total: anomalies.length,
      bySeverity,
      byType: byType as Record<AnomalyType, number>,
      byStatus,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Run detection algorithms
   */
  private async runAlgorithms(
    value: number,
    baseline: BaselineInfo | null,
    historicalValues: number[],
    config: DetectionConfig,
  ): Promise<
    Array<{ algorithm: string; isAnomaly: boolean; deviation: number }>
  > {
    const results: Array<{
      algorithm: string;
      isAnomaly: boolean;
      deviation: number;
    }> = [];
    const threshold = this.getThreshold(config.sensitivity);

    // Z-Score detection
    if (config.algorithms.includes('zscore') && baseline) {
      const zscoreResult = detectZScoreAnomaly(value, baseline, { threshold });
      results.push({
        algorithm: 'zscore',
        isAnomaly: zscoreResult.isAnomaly,
        deviation: zscoreResult.zScore,
      });
    }

    // Modified Z-Score (for robustness)
    if (config.algorithms.includes('zscore') && historicalValues.length >= 5) {
      const modifiedResult = detectModifiedZScoreAnomaly(
        value,
        historicalValues,
        threshold + 0.5,
      );
      results.push({
        algorithm: 'modified_zscore',
        isAnomaly: modifiedResult.isAnomaly,
        deviation: modifiedResult.zScore,
      });
    }

    // IQR detection
    if (config.algorithms.includes('iqr') && historicalValues.length >= 4) {
      const iqrResult = detectIQRAnomaly(value, historicalValues, {
        multiplier: 1.5,
      });
      results.push({
        algorithm: 'iqr',
        isAnomaly: iqrResult.isAnomaly,
        deviation: iqrResult.deviation,
      });
    }

    // Moving Average detection
    if (
      config.algorithms.includes('moving_average') &&
      historicalValues.length >= 10
    ) {
      const maResult = detectMovingAverageAnomaly(value, historicalValues, {
        windowSize: Math.min(10, historicalValues.length),
        threshold,
      });
      results.push({
        algorithm: 'moving_average',
        isAnomaly: maResult.isAnomaly,
        deviation: (maResult.percentageDeviation / 100) * threshold,
      });
    }

    return results;
  }

  /**
   * Get threshold based on sensitivity
   */
  private getThreshold(sensitivity: 'low' | 'medium' | 'high'): number {
    const thresholds = {
      low: 4, // Less sensitive, only flag major anomalies
      medium: 3, // Standard 3-sigma
      high: 2, // More sensitive, flag smaller deviations
    };
    return thresholds[sensitivity];
  }

  /**
   * Determine anomaly type from metric name and deviation direction
   */
  private determineAnomalyType(
    metricName: string,
    deviation: number,
  ): AnomalyType {
    const lowerName = metricName.toLowerCase();

    if (lowerName.includes('duration') || lowerName.includes('time')) {
      return deviation > 0 ? 'duration_spike' : 'performance_degradation';
    }

    if (lowerName.includes('failure') || lowerName.includes('error')) {
      return 'failure_spike';
    }

    if (lowerName.includes('success') || lowerName.includes('pass')) {
      return deviation < 0 ? 'success_rate_drop' : 'trend_change';
    }

    if (
      lowerName.includes('memory') ||
      lowerName.includes('cpu') ||
      lowerName.includes('resource')
    ) {
      return 'resource_anomaly';
    }

    return deviation > 0 ? 'duration_spike' : 'performance_degradation';
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    type: AnomalyType,
    deviation: number,
    metricName: string,
  ): string {
    const absDeviation = Math.abs(deviation);
    const direction = deviation > 0 ? 'above' : 'below';

    const typeDescriptions: Record<AnomalyType, string> = {
      duration_spike: `Test execution time ${absDeviation.toFixed(1)}σ ${direction} baseline`,
      failure_spike: `Failure rate ${absDeviation.toFixed(1)}σ ${direction} normal`,
      flaky_pattern: 'Inconsistent test results detected',
      performance_degradation: `Performance ${absDeviation.toFixed(1)}σ ${direction} baseline`,
      success_rate_drop: `Success rate ${absDeviation.toFixed(1)}σ ${direction} baseline`,
      resource_anomaly: `Resource usage ${absDeviation.toFixed(1)}σ ${direction} normal`,
      trend_change: `Metric trend changed significantly`,
      seasonal_deviation: `Unusual deviation from seasonal pattern`,
    };

    return (
      typeDescriptions[type] ||
      `${metricName} is ${absDeviation.toFixed(1)}σ ${direction} expected`
    );
  }

  /**
   * Check if this is a regression from previous good state
   */
  private async checkIfRegression(
    metricName: string,
    caseId?: string,
  ): Promise<boolean> {
    // Get recent anomalies for this metric
    const recentAnomalies =
      await anomalyStorage.getAnomaliesByMetric(metricName);

    if (recentAnomalies.length === 0) {
      return false;
    }

    // Check if there was a resolved anomaly recently
    const resolvedRecently = recentAnomalies.some(
      (a) =>
        a.status === 'resolved' &&
        a.resolvedAt &&
        Date.now() - a.resolvedAt < 7 * 24 * 60 * 60 * 1000,
    );

    return resolvedRecently;
  }

  /**
   * Create pattern-based anomaly
   */
  private async createPatternAnomaly(
    caseId: string,
    type: AnomalyType,
    deviation: number,
    description: string,
    timestamp: number,
  ): Promise<Anomaly> {
    const severityInput: SeverityInput = {
      deviation,
      anomalyType: type,
    };

    const severityResult = severityEvaluator.evaluate(severityInput);

    const anomaly: Anomaly = {
      id: this.generateId(),
      type,
      severity: severityResult.severity,
      status: 'new',
      detectedAt: timestamp,
      metric: `${caseId}:pattern`,
      currentValue: deviation,
      expectedValue: 0,
      deviation,
      caseId,
      description,
    };

    await anomalyStorage.saveAnomaly(anomaly);
    return anomaly;
  }

  /**
   * Calculate mean of values
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Generate unique anomaly ID
   */
  private generateId(): string {
    return `${this.idPrefix}_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Clear all anomalies
   */
  async clearAll(): Promise<void> {
    await anomalyStorage.clearAnomalies();
  }

  /**
   * Auto-resolve stale anomalies
   */
  async autoResolveStale(
    maxAgeMs: number = 7 * 24 * 60 * 60 * 1000,
  ): Promise<number> {
    const anomalies = await anomalyStorage.getActiveAnomalies();
    const now = Date.now();
    let resolvedCount = 0;

    for (const anomaly of anomalies) {
      if (now - anomaly.detectedAt > maxAgeMs) {
        await this.resolve(anomaly.id);
        resolvedCount++;
      }
    }

    return resolvedCount;
  }
}

// Export singleton instance
export const anomalyDetector = new AnomalyDetector();
