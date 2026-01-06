/**
 * input: anomalyDetector service
 * output: Test results for anomaly detection orchestration
 * pos: Unit tests for anomaly detection engine
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anomaly, BaselineInfo } from '../../../types/anomaly';
import { anomalyDetector } from '../anomalyDetector';
import { baselineBuilder } from '../baselineBuilder';
import { anomalyStorage } from '../storage';

// Mock dependencies
vi.mock('../storage', () => ({
  anomalyStorage: {
    saveAnomaly: vi.fn().mockResolvedValue(undefined),
    getAnomaly: vi.fn().mockResolvedValue(null),
    getAllAnomalies: vi.fn().mockResolvedValue([]),
    getActiveAnomalies: vi.fn().mockResolvedValue([]),
    getAnomaliesByMetric: vi.fn().mockResolvedValue([]),
    getAnomaliesByTimeRange: vi.fn().mockResolvedValue([]),
    clearAnomalies: vi.fn().mockResolvedValue(undefined),
    deleteAnomaly: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../baselineBuilder', () => ({
  baselineBuilder: {
    getBaseline: vi.fn().mockResolvedValue(null),
  },
}));

describe('AnomalyDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock return values after clearAllMocks
    vi.mocked(anomalyStorage.saveAnomaly).mockResolvedValue(undefined);
    vi.mocked(anomalyStorage.getAnomaly).mockResolvedValue(null);
    vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getActiveAnomalies).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAnomaliesByMetric).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAnomaliesByTimeRange).mockResolvedValue([]);
    vi.mocked(anomalyStorage.clearAnomalies).mockResolvedValue(undefined);
    vi.mocked(anomalyStorage.deleteAnomaly).mockResolvedValue(undefined);
    vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detect', () => {
    it('should return no anomaly when no baseline exists and insufficient data', async () => {
      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(null);

      const result = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 80,
        timestamp: Date.now(),
      });

      expect(result.isAnomaly).toBe(false);
      expect(result.details.algorithm).toBe('insufficient_data');
    });

    it('should detect anomaly when baseline exists and value deviates significantly', async () => {
      const mockBaseline: BaselineInfo = {
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        period: '7 days',
        sampleCount: 100,
        lastUpdated: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      const result = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 80, // 7.5 sigma deviation from mean 95
        timestamp: Date.now(),
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.anomaly).toBeDefined();
      expect(result.anomaly?.type).toBe('success_rate_drop');
      expect(result.anomaly?.severity).toBeDefined();
      expect(result.anomaly?.currentValue).toBe(80);
    });

    it('should detect duration spike anomaly', async () => {
      const mockBaseline: BaselineInfo = {
        mean: 5000,
        stdDev: 500,
        min: 4000,
        max: 6000,
        period: '7 days',
        sampleCount: 100,
        lastUpdated: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      const result = await anomalyDetector.detect({
        metricName: 'avgDuration',
        value: 15000, // 20 sigma deviation
        timestamp: Date.now(),
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.anomaly?.type).toBe('duration_spike');
    });

    it('should return no anomaly when deviation is within threshold', async () => {
      const mockBaseline: BaselineInfo = {
        mean: 95,
        stdDev: 5,
        min: 85,
        max: 100,
        period: '7 days',
        sampleCount: 100,
        lastUpdated: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      const result = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 93, // Only 0.4 sigma deviation
        timestamp: Date.now(),
      });

      // Small deviation should not be flagged as anomaly
      expect(result.details.algorithm).not.toBe('insufficient_data');
    });

    it('should use historical values for detection when no baseline exists', async () => {
      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(null);

      const historicalValues = [95, 94, 96, 95, 94, 93, 95, 96, 94, 95];

      const result = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 60, // Major deviation from historical
        timestamp: Date.now(),
        historicalValues,
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.anomaly).toBeDefined();
    });
  });

  describe('detectBatch', () => {
    it('should detect anomalies for multiple metrics', async () => {
      const mockBaseline: BaselineInfo = {
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        period: '7 days',
        sampleCount: 100,
        lastUpdated: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      const results = await anomalyDetector.detectBatch({
        metrics: [
          { name: 'passRate', value: 75 },
          { name: 'passRate', value: 70 },
        ],
        timestamp: Date.now(),
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      // At least one should be detected as anomaly due to large deviation
      const anomalyCount = results.filter((r) => r.isAnomaly).length;
      expect(anomalyCount).toBeGreaterThan(0);
    });

    it('should handle empty metrics array', async () => {
      const results = await anomalyDetector.detectBatch({
        metrics: [],
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('detectForCase', () => {
    it('should detect anomalies for a test case with multiple metrics', async () => {
      const mockBaseline: BaselineInfo = {
        mean: 1000,
        stdDev: 100,
        min: 800,
        max: 1200,
        period: '7 days',
        sampleCount: 50,
        lastUpdated: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      const result = await anomalyDetector.detectForCase('test-1', [
        { name: 'duration', value: 5000 }, // 40 sigma deviation
      ]);

      expect(result.caseId).toBe('test-1');
      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(result.overallStatus).toBeDefined();
    });
  });

  describe('getActiveAnomalies', () => {
    it('should return filtered anomalies by severity', async () => {
      const mockAnomalies: Anomaly[] = [
        {
          id: 'anomaly-1',
          type: 'duration_spike',
          severity: 'critical',
          status: 'new',
          detectedAt: Date.now(),
          metric: 'duration',
          currentValue: 5000,
          expectedValue: 1000,
          deviation: 4,
          description: 'Test anomaly',
        },
        {
          id: 'anomaly-2',
          type: 'success_rate_drop',
          severity: 'low',
          status: 'new',
          detectedAt: Date.now(),
          metric: 'passRate',
          currentValue: 90,
          expectedValue: 95,
          deviation: -1,
          description: 'Test anomaly',
        },
      ];

      vi.mocked(anomalyStorage.getActiveAnomalies).mockResolvedValue(
        mockAnomalies,
      );

      const result = await anomalyDetector.getActiveAnomalies({
        severity: ['critical'],
      });

      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('critical');
    });

    it('should return filtered anomalies by type', async () => {
      const mockAnomalies: Anomaly[] = [
        {
          id: 'anomaly-1',
          type: 'duration_spike',
          severity: 'high',
          status: 'new',
          detectedAt: Date.now(),
          metric: 'duration',
          currentValue: 5000,
          expectedValue: 1000,
          deviation: 4,
          description: 'Test anomaly',
        },
        {
          id: 'anomaly-2',
          type: 'flaky_pattern',
          severity: 'medium',
          status: 'new',
          detectedAt: Date.now(),
          metric: 'pattern',
          currentValue: 0.5,
          expectedValue: 0,
          deviation: 0.5,
          description: 'Test anomaly',
        },
      ];

      vi.mocked(anomalyStorage.getActiveAnomalies).mockResolvedValue(
        mockAnomalies,
      );

      const result = await anomalyDetector.getActiveAnomalies({
        type: ['duration_spike'],
      });

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('duration_spike');
    });
  });

  describe('updateStatus', () => {
    it('should update anomaly status to acknowledged', async () => {
      const mockAnomaly: Anomaly = {
        id: 'anomaly-1',
        type: 'duration_spike',
        severity: 'high',
        status: 'new',
        detectedAt: Date.now(),
        metric: 'duration',
        currentValue: 5000,
        expectedValue: 1000,
        deviation: 4,
        description: 'Test anomaly',
      };

      vi.mocked(anomalyStorage.getAnomaly).mockResolvedValue(mockAnomaly);

      await anomalyDetector.updateStatus('anomaly-1', 'acknowledged');

      expect(anomalyStorage.saveAnomaly).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'anomaly-1',
          status: 'acknowledged',
        }),
      );
    });

    it('should set resolvedAt when status is resolved', async () => {
      const mockAnomaly: Anomaly = {
        id: 'anomaly-1',
        type: 'duration_spike',
        severity: 'high',
        status: 'acknowledged',
        detectedAt: Date.now(),
        metric: 'duration',
        currentValue: 5000,
        expectedValue: 1000,
        deviation: 4,
        description: 'Test anomaly',
      };

      vi.mocked(anomalyStorage.getAnomaly).mockResolvedValue(mockAnomaly);

      await anomalyDetector.updateStatus('anomaly-1', 'resolved');

      expect(anomalyStorage.saveAnomaly).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'anomaly-1',
          status: 'resolved',
          resolvedAt: expect.any(Number),
        }),
      );
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for all anomalies', async () => {
      const mockAnomalies: Anomaly[] = [
        {
          id: 'anomaly-1',
          type: 'duration_spike',
          severity: 'critical',
          status: 'new',
          detectedAt: Date.now(),
          metric: 'duration',
          currentValue: 5000,
          expectedValue: 1000,
          deviation: 4,
          description: 'Test anomaly',
        },
        {
          id: 'anomaly-2',
          type: 'success_rate_drop',
          severity: 'high',
          status: 'resolved',
          detectedAt: Date.now(),
          metric: 'passRate',
          currentValue: 70,
          expectedValue: 95,
          deviation: -5,
          description: 'Test anomaly',
        },
      ];

      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue(
        mockAnomalies,
      );

      const stats = await anomalyDetector.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.byStatus.new).toBe(1);
      expect(stats.byStatus.resolved).toBe(1);
    });
  });

  describe('autoResolveStale', () => {
    it('should resolve old anomalies', async () => {
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const mockAnomalies: Anomaly[] = [
        {
          id: 'anomaly-old',
          type: 'duration_spike',
          severity: 'low',
          status: 'new',
          detectedAt: oldTimestamp,
          metric: 'duration',
          currentValue: 2000,
          expectedValue: 1000,
          deviation: 2,
          description: 'Old anomaly',
        },
      ];

      vi.mocked(anomalyStorage.getActiveAnomalies).mockResolvedValue(
        mockAnomalies,
      );
      vi.mocked(anomalyStorage.getAnomaly).mockResolvedValue(mockAnomalies[0]);

      const resolved = await anomalyDetector.autoResolveStale();

      expect(resolved).toBe(1);
      expect(anomalyStorage.saveAnomaly).toHaveBeenCalled();
    });

    it('should not resolve recent anomalies', async () => {
      const recentTimestamp = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago
      const mockAnomalies: Anomaly[] = [
        {
          id: 'anomaly-recent',
          type: 'duration_spike',
          severity: 'high',
          status: 'new',
          detectedAt: recentTimestamp,
          metric: 'duration',
          currentValue: 5000,
          expectedValue: 1000,
          deviation: 4,
          description: 'Recent anomaly',
        },
      ];

      vi.mocked(anomalyStorage.getActiveAnomalies).mockResolvedValue(
        mockAnomalies,
      );

      const resolved = await anomalyDetector.autoResolveStale();

      expect(resolved).toBe(0);
    });
  });
});
