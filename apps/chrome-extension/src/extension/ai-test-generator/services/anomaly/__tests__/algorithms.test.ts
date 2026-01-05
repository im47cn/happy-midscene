/**
 * input: Detection algorithms from algorithms/
 * output: Test results for z-score, IQR, moving average, consecutive patterns
 * pos: Unit tests for detection algorithm implementations
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { describe, expect, it } from 'vitest';
import {
  // Z-Score
  calculateZScore,
  detectZScoreAnomaly,
  detectZScoreAnomalies,
  calculateModifiedZScore,
  calculateMAD,
  // IQR
  calculateIQRStats,
  detectIQRAnomaly,
  detectIQRAnomalies,
  getAnomalyPercentage,
  // Moving Average
  calculateSMA,
  calculateEMA,
  calculateMovingStdDev,
  detectMovingAverageAnomaly,
  calculateBollingerBands,
  // Consecutive
  detectConsecutiveFailures,
  detectFlakyPattern,
  detectPassRateChange,
  getFailureTrend,
} from '../algorithms';
import type { BaselineInfo } from '../../../types/anomaly';

// ============================================================================
// Helper Functions
// ============================================================================

function createBaselineFromData(data: number[]): BaselineInfo {
  if (data.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      period: 'test',
      sampleCount: 0,
      lastUpdated: Date.now(),
    };
  }
  const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  return {
    mean,
    stdDev,
    min: Math.min(...data),
    max: Math.max(...data),
    period: 'test',
    sampleCount: data.length,
    lastUpdated: Date.now(),
  };
}

// ============================================================================
// Z-Score Tests
// ============================================================================

describe('Z-Score Detection', () => {
  describe('calculateZScore', () => {
    it('should calculate z-score correctly', () => {
      const data = [10, 12, 14, 16, 18]; // mean=14, stdDev=~2.83
      const baseline = createBaselineFromData(data);
      const value = 20;
      const result = calculateZScore(value, baseline.mean, baseline.stdDev);
      expect(result).toBeCloseTo(2.12, 1);
    });

    it('should return 0 for value equal to mean', () => {
      const data = [10, 20, 30];
      const baseline = createBaselineFromData(data);
      const value = 20;
      const result = calculateZScore(value, baseline.mean, baseline.stdDev);
      expect(result).toBeCloseTo(0, 1);
    });

    it('should handle data with zero standard deviation', () => {
      const result = calculateZScore(15, 10, 0);
      expect(result).toBe(0);
    });
  });

  describe('detectZScoreAnomaly', () => {
    it('should detect anomaly for high z-score', () => {
      const data = [10, 11, 12, 10, 11, 12, 10, 11];
      const baseline = createBaselineFromData(data);
      const result = detectZScoreAnomaly(30, baseline, { threshold: 2 });
      expect(result.isAnomaly).toBe(true);
      expect(Math.abs(result.zScore)).toBeGreaterThan(2);
    });

    it('should not detect anomaly for normal value', () => {
      const data = [10, 11, 12, 10, 11, 12, 10, 11];
      const baseline = createBaselineFromData(data);
      const result = detectZScoreAnomaly(11, baseline, { threshold: 2 });
      expect(result.isAnomaly).toBe(false);
    });

    it('should handle empty baseline data', () => {
      const baseline = createBaselineFromData([]);
      const result = detectZScoreAnomaly(10, baseline);
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('detectZScoreAnomalies', () => {
    it('should detect multiple anomalies', () => {
      const data = [10, 11, 10, 11, 10, 11];
      const baseline = createBaselineFromData(data);
      const testData = [10, 11, 50, 10, 11, 10, 60, 11];
      const anomalies = detectZScoreAnomalies(testData, baseline, { threshold: 2 });
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('calculateMAD', () => {
    it('should be more robust to outliers than standard deviation', () => {
      const data = [10, 11, 12, 10, 11, 100]; // 100 is outlier
      const result = calculateMAD(data);
      expect(result.mad).toBeLessThan(10); // MAD should be much smaller than stdDev
    });

    it('should calculate median correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const result = calculateMAD(data);
      expect(result.median).toBe(3);
    });
  });
});

// ============================================================================
// IQR Tests
// ============================================================================

describe('IQR Detection', () => {
  describe('calculateIQRStats', () => {
    it('should calculate quartiles correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = calculateIQRStats(data);
      expect(stats.q1).toBeCloseTo(3, 0); // Q1 is around 3
      expect(stats.q2).toBeCloseTo(5.5, 1); // Median (Q2)
      expect(stats.q3).toBeCloseTo(8, 0); // Q3 is around 8
      expect(stats.iqr).toBeCloseTo(5, 0);
    });

    it('should handle small datasets', () => {
      const data = [1, 5, 10];
      const stats = calculateIQRStats(data);
      expect(stats.q2).toBe(5);
    });
  });

  describe('detectIQRAnomaly', () => {
    it('should detect outliers beyond IQR bounds', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = detectIQRAnomaly(100, data);
      expect(result.isAnomaly).toBe(true);
      expect(result.isHigh).toBe(true);
    });

    it('should detect low outliers', () => {
      const data = [10, 11, 12, 13, 14, 15];
      const result = detectIQRAnomaly(-10, data);
      expect(result.isAnomaly).toBe(true);
      expect(result.isLow).toBe(true);
    });

    it('should not flag normal values', () => {
      const data = [10, 11, 12, 13, 14, 15];
      const result = detectIQRAnomaly(12, data);
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('getAnomalyPercentage', () => {
    it('should calculate anomaly percentage', () => {
      const data = [1, 2, 3, 4, 5, 100]; // 100 is likely outlier
      const percentage = getAnomalyPercentage(data);
      expect(percentage).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// Moving Average Tests
// ============================================================================

describe('Moving Average Detection', () => {
  describe('calculateSMA', () => {
    it('should calculate simple moving average', () => {
      const data = [1, 2, 3, 4, 5];
      const sma = calculateSMA(data, 3);
      expect(sma).toHaveLength(5);
      expect(sma[2]).toBeCloseTo(2, 5); // avg of [1,2,3]
      expect(sma[3]).toBeCloseTo(3, 5); // avg of [2,3,4]
      expect(sma[4]).toBeCloseTo(4, 5); // avg of [3,4,5]
    });

    it('should handle window larger than data', () => {
      const data = [1, 2, 3];
      const sma = calculateSMA(data, 5);
      expect(sma).toHaveLength(3);
      // Should use average of all values when window is larger
      sma.forEach((v) => expect(v).toBeCloseTo(2, 5));
    });
  });

  describe('calculateEMA', () => {
    it('should calculate exponential moving average', () => {
      const data = [10, 20, 30, 40, 50];
      const ema = calculateEMA(data, 0.5);
      expect(ema).toHaveLength(5);
      // EMA should smooth the data
      expect(ema[ema.length - 1]).toBeLessThan(50);
    });

    it('should give more weight to recent values', () => {
      const data = [10, 10, 10, 10, 100];
      const ema = calculateEMA(data, 0.5);
      // Last EMA should be influenced by the spike
      expect(ema[ema.length - 1]).toBeGreaterThan(30);
    });
  });

  describe('calculateMovingStdDev', () => {
    it('should calculate moving standard deviation', () => {
      const data = [10, 12, 11, 13, 12, 14];
      const stdDev = calculateMovingStdDev(data, 3);
      expect(stdDev).toHaveLength(6);
      stdDev.forEach((sd) => expect(sd).toBeGreaterThanOrEqual(0));
    });
  });

  describe('detectMovingAverageAnomaly', () => {
    it('should detect sudden spikes', () => {
      const historical = [10, 11, 10, 11, 10];
      const result = detectMovingAverageAnomaly(50, historical, {
        windowSize: 3,
        threshold: 2,
      });
      expect(result.isAnomaly).toBe(true);
    });

    it('should not flag normal values', () => {
      const historical = [10, 11, 10, 11, 10];
      const result = detectMovingAverageAnomaly(11, historical, {
        windowSize: 3,
        threshold: 2,
      });
      expect(result.isAnomaly).toBe(false);
    });
  });

  describe('calculateBollingerBands', () => {
    it('should calculate upper and lower bands', () => {
      const data = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const bands = calculateBollingerBands(data, 5, 2);
      expect(bands.upper).toHaveLength(11);
      expect(bands.middle).toHaveLength(11);
      expect(bands.lower).toHaveLength(11);
      // Upper should be above middle, lower below
      for (let i = 4; i < bands.middle.length; i++) {
        expect(bands.upper[i]).toBeGreaterThan(bands.middle[i]);
        expect(bands.lower[i]).toBeLessThan(bands.middle[i]);
      }
    });
  });
});

// ============================================================================
// Consecutive Pattern Tests
// ============================================================================

describe('Consecutive Pattern Detection', () => {
  describe('detectConsecutiveFailures', () => {
    it('should detect consecutive failures', () => {
      const results = [
        { passed: true, timestamp: 1 },
        { passed: false, timestamp: 2 },
        { passed: false, timestamp: 3 },
        { passed: false, timestamp: 4 },
        { passed: false, timestamp: 5 },
      ];
      const detection = detectConsecutiveFailures(results, { failureThreshold: 3 });
      expect(detection.isAnomaly).toBe(true);
      expect(detection.consecutiveFailures).toBeGreaterThanOrEqual(3);
    });

    it('should not detect when below threshold', () => {
      const results = [
        { passed: true, timestamp: 1 },
        { passed: false, timestamp: 2 },
        { passed: false, timestamp: 3 },
        { passed: true, timestamp: 4 },
      ];
      const detection = detectConsecutiveFailures(results, { failureThreshold: 3 });
      expect(detection.isAnomaly).toBe(false);
    });
  });

  describe('detectFlakyPattern', () => {
    it('should detect flaky tests (alternating pass/fail)', () => {
      const results = [
        { passed: true, timestamp: 1 },
        { passed: false, timestamp: 2 },
        { passed: true, timestamp: 3 },
        { passed: false, timestamp: 4 },
        { passed: true, timestamp: 5 },
        { passed: false, timestamp: 6 },
      ];
      const detection = detectFlakyPattern(results, 6, 0.3);
      expect(detection.isFlaky).toBe(true);
      expect(detection.flakyScore).toBeGreaterThan(0.3);
    });

    it('should not flag stable tests', () => {
      const results = [
        { passed: true, timestamp: 1 },
        { passed: true, timestamp: 2 },
        { passed: true, timestamp: 3 },
        { passed: true, timestamp: 4 },
        { passed: true, timestamp: 5 },
      ];
      const detection = detectFlakyPattern(results, 5, 0.3);
      expect(detection.isFlaky).toBe(false);
    });
  });

  describe('detectPassRateChange', () => {
    it('should detect significant pass rate drop', () => {
      // Need at least 2x windowSize (default 10) = 20 results
      const previousResults = Array.from({ length: 10 }, (_, i) => ({
        passed: true,
        timestamp: i + 1,
      })); // 100% pass rate
      const currentResults = Array.from({ length: 10 }, (_, i) => ({
        passed: i % 4 === 0, // 25% pass rate
        timestamp: i + 11,
      }));

      const detection = detectPassRateChange([...previousResults, ...currentResults], 10, 0.2);
      expect(detection.hasChange).toBe(true);
      expect(detection.change).toBeLessThan(0); // Decline
    });
  });

  describe('getFailureTrend', () => {
    it('should identify increasing failure trend', () => {
      const results = [
        { passed: true, timestamp: 1 },
        { passed: true, timestamp: 2 },
        { passed: true, timestamp: 3 },
        { passed: true, timestamp: 4 },
        { passed: true, timestamp: 5 },
        { passed: false, timestamp: 6 },
        { passed: false, timestamp: 7 },
        { passed: false, timestamp: 8 },
        { passed: false, timestamp: 9 },
        { passed: false, timestamp: 10 },
      ];
      const trend = getFailureTrend(results, 5);
      expect(trend.trend).toBe('increasing');
    });

    it('should identify decreasing failure trend', () => {
      const results = [
        { passed: false, timestamp: 1 },
        { passed: false, timestamp: 2 },
        { passed: false, timestamp: 3 },
        { passed: false, timestamp: 4 },
        { passed: false, timestamp: 5 },
        { passed: true, timestamp: 6 },
        { passed: true, timestamp: 7 },
        { passed: true, timestamp: 8 },
        { passed: true, timestamp: 9 },
        { passed: true, timestamp: 10 },
      ];
      const trend = getFailureTrend(results, 5);
      expect(trend.trend).toBe('decreasing');
    });
  });
});
