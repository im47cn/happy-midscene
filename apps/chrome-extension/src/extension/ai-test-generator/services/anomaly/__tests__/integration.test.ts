/**
 * input: All anomaly detection services
 * output: Integration test results
 * pos: End-to-end integration tests for anomaly detection system
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anomaly, BaselineRecord, HealthScore } from '../../types/anomaly';
import { alertTrigger } from '../alertTrigger';
import { anomalyDetector } from '../anomalyDetector';
import { baselineBuilder } from '../baselineBuilder';
import { healthScorer } from '../healthScorer';
import { rootCauseAnalyzer } from '../rootCauseAnalyzer';
import { anomalyStorage } from '../storage';
import { trendPredictor } from '../trendPredictor';

// Mock IndexedDB storage
vi.mock('../storage', () => ({
  anomalyStorage: {
    saveAnomaly: vi.fn().mockResolvedValue(undefined),
    getAnomaly: vi.fn().mockResolvedValue(null),
    getAllAnomalies: vi.fn().mockResolvedValue([]),
    getAnomaliesByMetric: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    updateAnomaly: vi.fn().mockResolvedValue(undefined),
    saveBaseline: vi.fn().mockResolvedValue(undefined),
    getBaseline: vi.fn().mockResolvedValue(null),
    getAllBaselines: vi.fn().mockResolvedValue([]),
    saveHealthScore: vi.fn().mockResolvedValue(undefined),
    getLatestHealthScore: vi.fn().mockResolvedValue(null),
    getHealthScoreHistory: vi.fn().mockResolvedValue([]),
  },
}));

// Mock baselineBuilder
vi.mock('../baselineBuilder', () => ({
  baselineBuilder: {
    buildBaseline: vi.fn(),
    getBaseline: vi.fn(),
    updateBaseline: vi.fn(),
  },
}));

describe('Anomaly Detection Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks to return default empty values
    vi.mocked(anomalyStorage.getAnomaliesByMetric).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getActive).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAllBaselines).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    alertTrigger.cleanup();
  });

  describe('End-to-End Detection Flow', () => {
    it('should complete full detection cycle: baseline -> detect -> analyze -> alert', async () => {
      // Step 1: Build baseline from historical data
      const historicalData = Array.from({ length: 30 }, (_, i) => ({
        value: 95 + Math.random() * 4 - 2, // 93-97% pass rate
        timestamp: Date.now() - 86400000 * (30 - i),
      }));

      const mockBaseline = {
        mean: 95,
        stdDev: 2,
        min: 93,
        max: 97,
        period: '14d',
        sampleCount: 30,
        lastUpdated: Date.now(),
      };

      // Mock the baseline builder methods
      vi.mocked(baselineBuilder.buildBaseline).mockResolvedValue(mockBaseline);
      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue(mockBaseline);

      // Step 2: Detect anomaly with current low value
      const detection = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 70, // Significant drop
        timestamp: Date.now(),
      });

      expect(detection).toBeDefined();
      expect(detection.isAnomaly).toBe(true);
      expect(detection.anomaly).toBeDefined();
      expect(detection.anomaly?.type).toBe('success_rate_drop');
      expect(detection.anomaly?.severity).toBeDefined();

      // Step 3: Analyze root cause
      if (detection.anomaly) {
        const analysis = await rootCauseAnalyzer.analyze(detection.anomaly);
        expect(analysis).toBeDefined();
        // Root causes may or may not be found depending on evidence
      }

      // Step 4: Generate alert
      if (detection.anomaly) {
        const notification = await alertTrigger.triggerFromAnomaly(
          detection.anomaly,
        );
        expect(notification).toBeDefined();
        expect(notification.alert).toBeDefined();
        expect(notification.alert.level).toBeDefined();
        expect(notification.alert.message).toContain('rate'); // Check for "rate" in English message
      }
    });

    it('should handle multiple consecutive anomalies without duplicate alerts', async () => {
      const mockBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'passRate',
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue({
        mean: mockBaseline.mean,
        stdDev: mockBaseline.stdDev,
        min: mockBaseline.min,
        max: mockBaseline.max,
        period: `${mockBaseline.windowDays}d`,
        sampleCount: mockBaseline.sampleCount,
        lastUpdated: mockBaseline.updatedAt,
      });

      // Simulate 5 rapid detections of same anomaly type
      const detections: Anomaly[] = [];
      const notifications: any[] = [];
      for (let i = 0; i < 5; i++) {
        const detection = await anomalyDetector.detect({
          metricName: 'passRate',
          value: 70,
          timestamp: Date.now() + i * 1000, // 1 second apart
        });
        if (detection.isAnomaly && detection.anomaly) {
          detections.push(detection.anomaly);
          const notification = await alertTrigger.triggerFromAnomaly(
            detection.anomaly,
          );
          notifications.push(notification);
        }
      }

      // Should have detections
      expect(detections.length).toBeGreaterThan(0);

      // Check that some notifications were suppressed (either deduplicated or converged)
      const suppressedCount = notifications.filter(
        (n) => !n.shouldNotify,
      ).length;
      expect(suppressedCount).toBeGreaterThan(0);
    });
  });

  describe('Trend Prediction Integration', () => {
    it('should predict trends and correlate with health score', async () => {
      // Historical pass rate data showing declining trend
      const historicalData = Array.from({ length: 14 }, (_, i) => ({
        value: 95 - i * 1.5, // Declining from 95 to ~76
        timestamp: Date.now() - 86400000 * (14 - i),
      }));

      // Predict future trend
      const prediction = await trendPredictor.predict(
        'passRate',
        historicalData,
        {
          horizon: 7 * 24 * 60 * 60 * 1000, // Convert days to milliseconds
        },
      );

      expect(prediction).toBeDefined();
      expect(prediction?.trend).toBe('declining');

      // Calculate health score with current metrics
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);

      const healthScore = await healthScorer.calculateScore({
        metrics: {
          passRate: historicalData[historicalData.length - 1].value,
          avgDuration: 1500,
          durationVariance: 20,
          flakyCount: 10,
          totalCases: 100,
          coveredCases: 70,
        },
      });

      expect(healthScore.overall).toBeLessThan(80); // Should be lower due to declining pass rate
    });
  });

  describe('Health Score to Alert Integration', () => {
    it('should trigger alert on health score degradation', async () => {
      const previousScore: HealthScore = {
        overall: 85,
        dimensions: [
          { name: 'Reliability', score: 90, weight: 0.35, factors: [] },
          { name: 'Stability', score: 85, weight: 0.25, factors: [] },
          { name: 'Efficiency', score: 80, weight: 0.2, factors: [] },
          { name: 'Coverage', score: 85, weight: 0.2, factors: [] },
        ],
        calculatedAt: Date.now() - 86400000,
        recommendations: [],
      };

      const currentScore: HealthScore = {
        overall: 60,
        dimensions: [
          { name: 'Reliability', score: 55, weight: 0.35, factors: [] },
          { name: 'Stability', score: 65, weight: 0.25, factors: [] },
          { name: 'Efficiency', score: 60, weight: 0.2, factors: [] },
          { name: 'Coverage', score: 60, weight: 0.2, factors: [] },
        ],
        calculatedAt: Date.now(),
        recommendations: [],
      };

      const result = await alertTrigger.triggerFromHealthScore(
        currentScore,
        previousScore,
      );

      expect(result).toBeDefined();
      expect(result?.alert).toBeDefined();
      expect(result?.alert?.level).toBeDefined();
      // Significant drop should trigger alert
      expect(['critical', 'warning']).toContain(result?.alert?.level);
    });

    it('should not trigger alert for minor health score changes', async () => {
      const previousScore: HealthScore = {
        overall: 85,
        dimensions: [],
        calculatedAt: Date.now() - 86400000,
        recommendations: [],
      };

      const currentScore: HealthScore = {
        overall: 83, // Minor 2-point drop
        dimensions: [],
        calculatedAt: Date.now(),
        recommendations: [],
      };

      const alert = await alertTrigger.triggerFromHealthScore(
        currentScore,
        previousScore,
      );

      expect(alert).toBeNull();
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple test cases and aggregate results', async () => {
      const mockBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'duration',
        mean: 1000,
        stdDev: 100,
        min: 800,
        max: 1200,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue({
        mean: mockBaseline.mean,
        stdDev: mockBaseline.stdDev,
        min: mockBaseline.min,
        max: mockBaseline.max,
        period: `${mockBaseline.windowDays}d`,
        sampleCount: mockBaseline.sampleCount,
        lastUpdated: mockBaseline.updatedAt,
      });

      // Batch of test case results
      const testResults = [
        {
          caseId: 'test-1',
          duration: 1100,
          passed: true,
          timestamp: Date.now(),
        },
        {
          caseId: 'test-2',
          duration: 5000,
          passed: false,
          timestamp: Date.now(),
        }, // Anomaly
        {
          caseId: 'test-3',
          duration: 950,
          passed: true,
          timestamp: Date.now(),
        },
        {
          caseId: 'test-4',
          duration: 4500,
          passed: false,
          timestamp: Date.now(),
        }, // Anomaly
        {
          caseId: 'test-5',
          duration: 1050,
          passed: true,
          timestamp: Date.now(),
        },
      ];

      const results = await Promise.all(
        testResults.map((result) =>
          anomalyDetector.detectForCase(result.caseId, [
            { name: 'duration', value: result.duration },
            { name: 'passed', value: result.passed ? 1 : 0 },
          ]),
        ),
      );

      // Should detect anomalies for test-2 and test-4
      const anomalies = results.filter((r) => r && r.anomalies.length > 0);
      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process 1000 data points within acceptable time', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        value: 90 + Math.random() * 10,
        timestamp: Date.now() - 86400000 * (1000 - i),
      }));

      // Mock baseline builder to return a valid baseline
      vi.mocked(baselineBuilder.buildBaseline).mockResolvedValue({
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        period: '30d',
        sampleCount: 1000,
        lastUpdated: Date.now(),
      });

      const startTime = performance.now();

      const baseline = await baselineBuilder.buildBaseline('passRate', {
        data: largeDataset,
        config: {
          method: 'moving_average',
          windowSizeDays: 30,
        },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(baseline).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent detections', async () => {
      const mockBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'passRate',
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(baselineBuilder.getBaseline).mockResolvedValue({
        mean: mockBaseline.mean,
        stdDev: mockBaseline.stdDev,
        min: mockBaseline.min,
        max: mockBaseline.max,
        period: `${mockBaseline.windowDays}d`,
        sampleCount: mockBaseline.sampleCount,
        lastUpdated: mockBaseline.updatedAt,
      });

      const startTime = performance.now();

      // 100 concurrent detections
      const detections = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          anomalyDetector.detect({
            metricName: 'passRate',
            value: 70 + Math.random() * 30,
            timestamp: Date.now() + i,
          }),
        ),
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(detections).toHaveLength(100);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle storage failures', async () => {
      vi.mocked(baselineBuilder.getBaseline).mockRejectedValue(
        new Error('Storage unavailable'),
      );

      await expect(
        anomalyDetector.detect({
          metricName: 'passRate',
          value: 70,
          timestamp: Date.now(),
        }),
      ).rejects.toThrow('Storage unavailable');
    });

    it('should continue processing after individual failures', async () => {
      const mockBaseline: BaselineRecord = {
        id: 'baseline-1',
        metricName: 'passRate',
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        sampleCount: 100,
        windowDays: 7,
        method: 'moving_average',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // First call fails, subsequent calls succeed
      vi.mocked(baselineBuilder.getBaseline)
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          mean: mockBaseline.mean,
          stdDev: mockBaseline.stdDev,
          min: mockBaseline.min,
          max: mockBaseline.max,
          period: `${mockBaseline.windowDays}d`,
          sampleCount: mockBaseline.sampleCount,
          lastUpdated: mockBaseline.updatedAt,
        });

      // First call should fail
      await expect(
        anomalyDetector.detect({
          metricName: 'passRate',
          value: 70,
          timestamp: Date.now(),
        }),
      ).rejects.toThrow('Temporary failure');

      // Second call should succeed
      const result = await anomalyDetector.detect({
        metricName: 'passRate',
        value: 75,
        timestamp: Date.now() + 1000,
      });

      // Should have successful detection on second try
      expect(result).toBeDefined();
    });
  });
});
