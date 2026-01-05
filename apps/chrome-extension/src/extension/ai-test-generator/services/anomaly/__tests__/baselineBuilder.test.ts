/**
 * input: baselineBuilder service
 * output: Test results for baseline building functionality
 * pos: Unit tests for baseline construction and updates
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { baselineBuilder } from '../baselineBuilder';
import { anomalyStorage } from '../storage';
import type { BaselineRecord } from '../../types/anomaly';

// Mock storage
vi.mock('../storage', () => ({
  anomalyStorage: {
    saveBaseline: vi.fn().mockResolvedValue(undefined),
    getBaseline: vi.fn().mockResolvedValue(null),
    getAllBaselines: vi.fn().mockResolvedValue([]),
  },
}));

describe('BaselineBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildBaseline', () => {
    it('should build baseline from data points', async () => {
      const dataPoints = [
        { value: 100, timestamp: Date.now() - 86400000 * 7 },
        { value: 105, timestamp: Date.now() - 86400000 * 6 },
        { value: 98, timestamp: Date.now() - 86400000 * 5 },
        { value: 102, timestamp: Date.now() - 86400000 * 4 },
        { value: 100, timestamp: Date.now() - 86400000 * 3 },
        { value: 103, timestamp: Date.now() - 86400000 * 2 },
        { value: 99, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await baselineBuilder.buildBaseline({
        metricName: 'passRate',
        dataPoints,
        method: 'moving_average',
        windowDays: 7,
      });

      expect(result).toBeDefined();
      expect(result.metricName).toBe('passRate');
      expect(result.mean).toBeCloseTo(101, 0);
      expect(result.sampleCount).toBe(7);
      expect(result.stdDev).toBeGreaterThan(0);
      expect(result.min).toBeLessThanOrEqual(result.mean);
      expect(result.max).toBeGreaterThanOrEqual(result.mean);
    });

    it('should handle empty data gracefully', async () => {
      const result = await baselineBuilder.buildBaseline({
        metricName: 'passRate',
        dataPoints: [],
        method: 'moving_average',
        windowDays: 7,
      });

      expect(result).toBeNull();
    });

    it('should handle single data point', async () => {
      const dataPoints = [{ value: 100, timestamp: Date.now() }];

      const result = await baselineBuilder.buildBaseline({
        metricName: 'passRate',
        dataPoints,
        method: 'moving_average',
        windowDays: 7,
      });

      expect(result).toBeDefined();
      expect(result?.mean).toBe(100);
      expect(result?.stdDev).toBe(0);
    });

    it('should use percentile method correctly', async () => {
      const dataPoints = Array.from({ length: 100 }, (_, i) => ({
        value: i + 1, // 1 to 100
        timestamp: Date.now() - i * 86400000,
      }));

      const result = await baselineBuilder.buildBaseline({
        metricName: 'duration',
        dataPoints,
        method: 'percentile',
        windowDays: 100,
      });

      expect(result).toBeDefined();
      expect(result?.percentile50).toBeCloseTo(50, 0);
      expect(result?.percentile90).toBeCloseTo(90, 0);
      expect(result?.percentile95).toBeCloseTo(95, 0);
    });

    it('should use median method correctly', async () => {
      const dataPoints = [
        { value: 10, timestamp: Date.now() - 86400000 * 5 },
        { value: 20, timestamp: Date.now() - 86400000 * 4 },
        { value: 30, timestamp: Date.now() - 86400000 * 3 },
        { value: 1000, timestamp: Date.now() - 86400000 * 2 }, // outlier
        { value: 25, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await baselineBuilder.buildBaseline({
        metricName: 'duration',
        dataPoints,
        method: 'median',
        windowDays: 7,
      });

      expect(result).toBeDefined();
      // Median should be robust to outlier
      expect(result?.median).toBe(25);
    });

    it('should exclude anomalies when configured', async () => {
      const dataPoints = [
        { value: 100, timestamp: Date.now() - 86400000 * 5 },
        { value: 102, timestamp: Date.now() - 86400000 * 4 },
        { value: 98, timestamp: Date.now() - 86400000 * 3 },
        { value: 500, timestamp: Date.now() - 86400000 * 2 }, // outlier
        { value: 101, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await baselineBuilder.buildBaseline({
        metricName: 'duration',
        dataPoints,
        method: 'moving_average',
        windowDays: 7,
        excludeAnomalies: true,
      });

      expect(result).toBeDefined();
      // Mean should be close to 100, not influenced by 500
      expect(result?.mean).toBeLessThan(150);
    });
  });

  describe('updateBaseline', () => {
    it('should update existing baseline with new data', async () => {
      const existingBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'passRate',
        mean: 100,
        stdDev: 5,
        min: 90,
        max: 110,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now() - 86400000,
      };

      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(existingBaseline);

      const newDataPoints = [
        { value: 95, timestamp: Date.now() - 86400000 },
        { value: 97, timestamp: Date.now() },
      ];

      const result = await baselineBuilder.updateBaseline({
        metricName: 'passRate',
        newDataPoints,
      });

      expect(result).toBeDefined();
      expect(result?.sampleCount).toBeGreaterThan(existingBaseline.sampleCount);
      expect(result?.updatedAt).toBeGreaterThan(existingBaseline.updatedAt);
    });

    it('should create new baseline if none exists', async () => {
      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(null);

      const newDataPoints = [
        { value: 100, timestamp: Date.now() - 86400000 },
        { value: 102, timestamp: Date.now() },
      ];

      const result = await baselineBuilder.updateBaseline({
        metricName: 'newMetric',
        newDataPoints,
      });

      expect(result).toBeDefined();
      expect(result?.metricName).toBe('newMetric');
    });
  });

  describe('getBaseline', () => {
    it('should retrieve existing baseline', async () => {
      const mockBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'passRate',
        mean: 100,
        stdDev: 5,
        min: 90,
        max: 110,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(mockBaseline);

      const result = await baselineBuilder.getBaseline('passRate');

      expect(result).toEqual(mockBaseline);
      expect(anomalyStorage.getBaseline).toHaveBeenCalledWith('passRate');
    });

    it('should return null for non-existent baseline', async () => {
      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(null);

      const result = await baselineBuilder.getBaseline('nonExistent');

      expect(result).toBeNull();
    });
  });

  describe('calculateDeviation', () => {
    it('should calculate deviation from baseline', () => {
      const baseline = {
        mean: 100,
        stdDev: 10,
      };

      const deviation = baselineBuilder.calculateDeviation(120, baseline);

      expect(deviation.absoluteDeviation).toBe(20);
      expect(deviation.percentageDeviation).toBe(20);
      expect(deviation.zScore).toBe(2);
    });

    it('should handle negative deviation', () => {
      const baseline = {
        mean: 100,
        stdDev: 10,
      };

      const deviation = baselineBuilder.calculateDeviation(80, baseline);

      expect(deviation.absoluteDeviation).toBe(-20);
      expect(deviation.percentageDeviation).toBe(-20);
      expect(deviation.zScore).toBe(-2);
    });

    it('should handle zero stdDev', () => {
      const baseline = {
        mean: 100,
        stdDev: 0,
      };

      const deviation = baselineBuilder.calculateDeviation(110, baseline);

      expect(deviation.absoluteDeviation).toBe(10);
      expect(deviation.zScore).toBe(0); // Can't calculate z-score with 0 stdDev
    });
  });

  describe('isSignificantDeviation', () => {
    it('should identify significant deviation', () => {
      const baseline = {
        mean: 100,
        stdDev: 10,
      };

      // 3 standard deviations is significant
      expect(baselineBuilder.isSignificantDeviation(130, baseline, 2)).toBe(true);
      expect(baselineBuilder.isSignificantDeviation(70, baseline, 2)).toBe(true);
    });

    it('should not flag normal values', () => {
      const baseline = {
        mean: 100,
        stdDev: 10,
      };

      expect(baselineBuilder.isSignificantDeviation(105, baseline, 2)).toBe(false);
      expect(baselineBuilder.isSignificantDeviation(95, baseline, 2)).toBe(false);
    });
  });
});
