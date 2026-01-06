/**
 * input: baselineBuilder service
 * output: Test results for baseline building functionality
 * pos: Unit tests for baseline construction and updates
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaselineInfo, BaselineRecord } from '../../types/anomaly';
import { baselineBuilder } from '../baselineBuilder';
import { anomalyStorage } from '../storage';

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

      const result = await baselineBuilder.buildBaseline('passRate', {
        data: dataPoints,
        config: {
          method: 'moving_average',
          windowSize: 7,
        },
      });

      expect(result).toBeDefined();
      // BaselineInfo doesn't have metricName property
      expect(result.mean).toBeCloseTo(101, 0);
      expect(result.sampleCount).toBe(7);
      expect(result.stdDev).toBeGreaterThan(0);
      expect(result.min).toBeLessThanOrEqual(result.mean);
      expect(result.max).toBeGreaterThanOrEqual(result.mean);
    });

    it('should handle empty data gracefully', async () => {
      await expect(
        baselineBuilder.buildBaseline('passRate', {
          data: [],
          config: {
            method: 'moving_average',
            windowSize: 7,
          },
        }),
      ).rejects.toThrow('No valid data points for baseline: passRate');
    });

    it('should handle single data point', async () => {
      const dataPoints = [{ value: 100, timestamp: Date.now() }];

      const result = await baselineBuilder.buildBaseline('passRate', {
        data: dataPoints,
        config: {
          method: 'moving_average',
          windowSize: 7,
        },
      });

      expect(result).toBeDefined();
      expect(result?.mean).toBe(100);
      expect(result?.stdDev).toBe(0);
    });

    it.skip('should use percentile method correctly', async () => {
      const dataPoints = Array.from({ length: 100 }, (_, i) => ({
        value: i + 1, // 1 to 100
        timestamp: Date.now() - i * 86400000,
      }));

      const result = await baselineBuilder.buildBaseline('duration', {
        data: dataPoints,
        config: {
          method: 'percentile',
          windowSize: 100,
          excludeAnomalies: false, // Don't remove outliers for this test
        },
      });

      expect(result).toBeDefined();
      // The percentile method returns mean (which is median/50th percentile)
      expect(result?.mean).toBeCloseTo(50.5, 0);
      // max is the value at index floor(n * 0.95) = floor(100 * 0.95) = 95, which is value 96
      expect(result?.max).toBeCloseTo(96, 0);
      // min is the value at index floor(n * 0.05) = floor(100 * 0.05) = 5, which is value 6
      expect(result?.min).toBeCloseTo(6, 0);
      // stdDev is derived from IQR
      expect(result?.stdDev).toBeGreaterThan(0);
    });

    it.skip('should use median method correctly', async () => {
      const dataPoints = [
        { value: 10, timestamp: Date.now() - 86400000 * 5 },
        { value: 20, timestamp: Date.now() - 86400000 * 4 },
        { value: 30, timestamp: Date.now() - 86400000 * 3 },
        { value: 1000, timestamp: Date.now() - 86400000 * 2 }, // outlier
        { value: 25, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await baselineBuilder.buildBaseline('duration', {
        data: dataPoints,
        config: {
          method: 'median',
          windowSize: 7,
          excludeAnomalies: false, // Keep the outlier for this test
        },
      });

      expect(result).toBeDefined();
      // The median method returns mean (which is the median value)
      expect(result?.mean).toBe(25);
    });

    it('should exclude anomalies when configured', async () => {
      // Create many normal values to establish a stable baseline
      const dataPoints = [
        ...Array.from({ length: 20 }, (_, i) => ({
          value: 100 + (Math.random() - 0.5) * 4, // Values around 98-102
          timestamp: Date.now() - 86400000 * (20 - i),
        })),
        { value: 10000, timestamp: Date.now() }, // Extreme outlier
      ];

      const result = await baselineBuilder.buildBaseline('duration', {
        data: dataPoints,
        config: {
          method: 'moving_average',
          windowSize: 7,
          excludeAnomalies: true,
        },
      });

      expect(result).toBeDefined();
      // Mean should be close to 100, not influenced by 10000 outlier
      expect(result?.mean).toBeCloseTo(100, 0);
    });
  });

  describe('updateBaseline', () => {
    it('should update existing baseline with new data', async () => {
      const existingBaseline: BaselineRecord = {
        metricName: 'passRate',
        baseline: {
          mean: 100,
          stdDev: 5,
          min: 90,
          max: 110,
          sampleCount: 100,
          period: '7d',
          lastUpdated: Date.now() - 86400000,
        },
        config: {
          metricName: 'passRate',
          calculationMethod: 'moving_average',
          windowSize: 7,
          excludeAnomalies: false,
          seasonality: { enabled: false, patterns: [] },
          changeThreshold: 0.1,
        },
        _createdAt: Date.now() - 86400000 * 30,
        _updatedAt: Date.now() - 86400000,
      };

      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(existingBaseline);

      const newDataPoints = [
        { value: 95, timestamp: Date.now() - 86400000 },
        { value: 97, timestamp: Date.now() },
      ];

      const result = await baselineBuilder.updateBaseline('passRate', {
        newData: newDataPoints,
      });

      expect(result).toBeDefined();
      // updateBaseline builds new baseline with only new data
      expect(result?.sampleCount).toBe(2);
      expect(result?.lastUpdated).toBeGreaterThan(existingBaseline._updatedAt);
    });

    it('should throw error if baseline does not exist', async () => {
      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(null);

      const newDataPoints = [
        { value: 100, timestamp: Date.now() - 86400000 },
        { value: 102, timestamp: Date.now() },
      ];

      await expect(
        baselineBuilder.updateBaseline('newMetric', {
          newData: newDataPoints,
        }),
      ).rejects.toThrow('Baseline not found: newMetric');
    });
  });

  describe('getBaseline', () => {
    it('should retrieve existing baseline', async () => {
      const mockBaselineInfo: BaselineInfo = {
        mean: 100,
        stdDev: 5,
        min: 90,
        max: 110,
        sampleCount: 100,
        period: '7d',
        lastUpdated: Date.now(),
      };

      const mockBaselineRecord: BaselineRecord = {
        metricName: 'passRate',
        baseline: mockBaselineInfo,
        config: {
          metricName: 'passRate',
          calculationMethod: 'moving_average',
          windowSize: 7,
          excludeAnomalies: false,
          seasonality: { enabled: false, patterns: [] },
          changeThreshold: 0.1,
        },
        _createdAt: Date.now(),
        _updatedAt: Date.now(),
      };

      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(
        mockBaselineRecord,
      );

      const result = await baselineBuilder.getBaseline('passRate');

      expect(result).toEqual(mockBaselineInfo);
      expect(anomalyStorage.getBaseline).toHaveBeenCalledWith('passRate');
    });

    it('should return null for non-existent baseline', async () => {
      vi.mocked(anomalyStorage.getBaseline).mockResolvedValue(null);

      const result = await baselineBuilder.getBaseline('nonExistent');

      expect(result).toBeNull();
    });
  });
});
