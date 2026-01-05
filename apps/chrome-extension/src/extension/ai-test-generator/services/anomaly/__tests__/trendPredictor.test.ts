/**
 * input: trendPredictor service
 * output: Test results for trend prediction functionality
 * pos: Unit tests for trend prediction and forecasting
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { trendPredictor } from '../trendPredictor';
import {
  fitLinearRegression,
  predictLinear,
  linearRegressionPredict,
  fitHoltModel,
  predictHolt,
} from '../models';

describe('TrendPredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('predict', () => {
    it('should predict future values based on historical data', async () => {
      const dataPoints = [
        { value: 90, timestamp: Date.now() - 86400000 * 7 },
        { value: 91, timestamp: Date.now() - 86400000 * 6 },
        { value: 92, timestamp: Date.now() - 86400000 * 5 },
        { value: 93, timestamp: Date.now() - 86400000 * 4 },
        { value: 94, timestamp: Date.now() - 86400000 * 3 },
        { value: 95, timestamp: Date.now() - 86400000 * 2 },
        { value: 96, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await trendPredictor.predict(
        'passRate',
        dataPoints,
        {
          horizon: 7 * 86400000, // 7 days in ms
          steps: 7
        }
      );

      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(7);
      expect(result.trend).toBe('improving');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect declining trend', async () => {
      const dataPoints = [
        { value: 95, timestamp: Date.now() - 86400000 * 7 },
        { value: 93, timestamp: Date.now() - 86400000 * 6 },
        { value: 91, timestamp: Date.now() - 86400000 * 5 },
        { value: 89, timestamp: Date.now() - 86400000 * 4 },
        { value: 87, timestamp: Date.now() - 86400000 * 3 },
        { value: 85, timestamp: Date.now() - 86400000 * 2 },
        { value: 83, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await trendPredictor.predict(
        'passRate',
        dataPoints,
        {
          horizon: 3 * 86400000, // 3 days in ms
          steps: 3
        }
      );

      expect(result.trend).toBe('declining');
    });

    it('should detect stable trend', async () => {
      const dataPoints = [
        { value: 90, timestamp: Date.now() - 86400000 * 7 },
        { value: 91, timestamp: Date.now() - 86400000 * 6 },
        { value: 90, timestamp: Date.now() - 86400000 * 5 },
        { value: 89, timestamp: Date.now() - 86400000 * 4 },
        { value: 90, timestamp: Date.now() - 86400000 * 3 },
        { value: 91, timestamp: Date.now() - 86400000 * 2 },
        { value: 90, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await trendPredictor.predict(
        'passRate',
        dataPoints,
        {
          horizon: 3 * 86400000, // 3 days in ms
          steps: 3
        }
      );

      expect(result.trend).toBe('stable');
    });

    it('should include confidence intervals in predictions', async () => {
      const dataPoints = Array.from({ length: 14 }, (_, i) => ({
        value: 90 + Math.random() * 5,
        timestamp: Date.now() - 86400000 * (14 - i),
      }));

      const result = await trendPredictor.predict(
        'passRate',
        dataPoints,
        {
          horizon: 5 * 86400000, // 5 days in ms
          steps: 5
        }
      );

      result.predictions.forEach((prediction) => {
        expect(prediction.lowerBound).toBeLessThanOrEqual(prediction.value);
        expect(prediction.upperBound).toBeGreaterThanOrEqual(prediction.value);
      });
    });

    it('should handle insufficient data gracefully', async () => {
      const dataPoints = [
        { value: 90, timestamp: Date.now() - 86400000 },
        { value: 91, timestamp: Date.now() },
      ];

      const result = await trendPredictor.predict(
        'passRate',
        dataPoints,
        {
          horizon: 3 * 86400000, // 3 days in ms
          steps: 3
        }
      );

      // Should still return a result but with lower confidence
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle empty data gracefully', async () => {
      const result = await trendPredictor.predict(
        'passRate',
        [],
        {
          horizon: 3 * 86400000, // 3 days in ms
          steps: 3
        }
      );

      expect(result).toBeDefined();
      expect(result.confidence).toBe(0);
      expect(result.trend).toBe('stable');
      expect(result.factors[0].name).toBe('Insufficient Data');
    });
  });

  describe('predictForCase', () => {
    it('should predict trends for a specific test case', async () => {
      const caseHistory = [
        { duration: 1000, passed: true, timestamp: Date.now() - 86400000 * 7 },
        { duration: 1050, passed: true, timestamp: Date.now() - 86400000 * 6 },
        { duration: 1100, passed: true, timestamp: Date.now() - 86400000 * 5 },
        { duration: 1150, passed: true, timestamp: Date.now() - 86400000 * 4 },
        { duration: 1200, passed: true, timestamp: Date.now() - 86400000 * 3 },
        { duration: 1250, passed: false, timestamp: Date.now() - 86400000 * 2 },
        { duration: 1300, passed: false, timestamp: Date.now() - 86400000 * 1 },
      ];

      const result = await trendPredictor.predictForCase({
        caseId: 'test-case-1',
        history: caseHistory,
        horizonDays: 3,
      });

      expect(result).toBeDefined();
      expect(result?.durationTrend).toBeDefined();
      expect(result?.reliabilityTrend).toBeDefined();
    });
  });

  describe('getOverallTrend', () => {
    it('should aggregate trends across multiple metrics', async () => {
      const result = await trendPredictor.getOverallTrend({
        metrics: [
          {
            metricName: 'passRate',
            dataPoints: Array.from({ length: 7 }, (_, i) => ({
              value: 90 + i,
              timestamp: Date.now() - 86400000 * (7 - i),
            })),
          },
          {
            metricName: 'avgDuration',
            dataPoints: Array.from({ length: 7 }, (_, i) => ({
              value: 1000 - i * 50,
              timestamp: Date.now() - 86400000 * (7 - i),
            })),
          },
        ],
        horizonDays: 3,
      });

      expect(result).toBeDefined();
      expect(result.overallDirection).toBeDefined();
      expect(result.metricTrends).toHaveLength(2);
    });
  });

  describe('compareModels', () => {
    it('should compare different prediction models', () => {
      const dataPoints = Array.from({ length: 30 }, (_, i) => ({
        value: 90 + Math.sin(i / 3) * 5 + i * 0.1,
        timestamp: Date.now() - 86400000 * (30 - i),
      }));

      const comparison = trendPredictor.compareModels(
        dataPoints,
        3 * 86400000 // 3 days in ms
      );

      expect(comparison).toBeDefined();
      expect(comparison).toBeInstanceOf(Array);
      expect(comparison.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Prediction Model Tests
// ============================================================================

describe('Prediction Models', () => {
  describe('Linear Regression', () => {
    it('should fit linear regression model', () => {
      const now = Date.now();
      const data = [
        { value: 1, timestamp: now },
        { value: 2, timestamp: now + 3600000 },
        { value: 3, timestamp: now + 2 * 3600000 },
        { value: 4, timestamp: now + 3 * 3600000 },
        { value: 5, timestamp: now + 4 * 3600000 },
        { value: 6, timestamp: now + 5 * 3600000 },
        { value: 7, timestamp: now + 6 * 3600000 },
      ];
      const model = fitLinearRegression(data);

      expect(model.slope * 3600000).toBeCloseTo(1, 1); // 1 per hour
      expect(model.intercept).toBeCloseTo(1, 1);
      expect(model.r2).toBeGreaterThan(0.99);
    });

    it('should predict future values', () => {
      const now = Date.now();
      const data = [
        { value: 10, timestamp: now },
        { value: 20, timestamp: now + 3600000 },
        { value: 30, timestamp: now + 2 * 3600000 },
        { value: 40, timestamp: now + 3 * 3600000 },
        { value: 50, timestamp: now + 4 * 3600000 },
      ];

      // Use linearRegressionPredict which handles the calculation correctly
      const result = linearRegressionPredict(data, 3 * 3600000, 3);

      expect(result.predictions).toHaveLength(3);
      expect(result.predictions[0].value).toBeCloseTo(60, 1);
      expect(result.predictions[1].value).toBeCloseTo(70, 1);
      expect(result.predictions[2].value).toBeCloseTo(80, 1);
    });

    it('should handle noisy data', () => {
      const now = Date.now();
      const data = [
        { value: 10, timestamp: now },
        { value: 22, timestamp: now + 3600000 },
        { value: 28, timestamp: now + 2 * 3600000 },
        { value: 42, timestamp: now + 3 * 3600000 },
        { value: 48, timestamp: now + 4 * 3600000 },
        { value: 61, timestamp: now + 5 * 3600000 },
        { value: 69, timestamp: now + 6 * 3600000 },
      ];
      const model = fitLinearRegression(data);

      // Should still capture the trend (approximately 10 per hour)
      expect(model.slope * 3600000).toBeGreaterThan(8);
      expect(model.slope * 3600000).toBeLessThan(12);
    });
  });

  describe('Holt Exponential Smoothing', () => {
    it('should fit Holt model', () => {
      const now = Date.now();
      const data = [
        { value: 100, timestamp: now },
        { value: 110, timestamp: now + 3600000 },
        { value: 120, timestamp: now + 2 * 3600000 },
        { value: 130, timestamp: now + 3 * 3600000 },
        { value: 140, timestamp: now + 4 * 3600000 },
        { value: 150, timestamp: now + 5 * 3600000 },
        { value: 160, timestamp: now + 6 * 3600000 },
      ];
      const result = fitHoltModel(data, { alpha: 0.3, beta: 0.1 });

      expect(result.model).toBeDefined();
      expect(result.model.level).toBeGreaterThan(0);
      expect(result.model.trend).toBeGreaterThan(0);
    });

    it('should predict future values with trend', () => {
      const now = Date.now();
      const data = [
        { value: 100, timestamp: now },
        { value: 110, timestamp: now + 3600000 },
        { value: 120, timestamp: now + 2 * 3600000 },
        { value: 130, timestamp: now + 3 * 3600000 },
        { value: 140, timestamp: now + 4 * 3600000 },
      ];
      const result = fitHoltModel(data);
      const baseTimestamp = now + 4 * 3600000; // Last data point
      const predictions = predictHolt(result.model, baseTimestamp, 3 * 3600000, 3);

      expect(predictions).toHaveLength(3);
      // Should continue the upward trend
      expect(predictions[0].value).toBeGreaterThan(140);
      expect(predictions[1].value).toBeGreaterThan(predictions[0].value);
    });

    it('should handle decreasing trend', () => {
      const now = Date.now();
      const data = [
        { value: 100, timestamp: now },
        { value: 95, timestamp: now + 3600000 },
        { value: 90, timestamp: now + 2 * 3600000 },
        { value: 85, timestamp: now + 3 * 3600000 },
        { value: 80, timestamp: now + 4 * 3600000 },
        { value: 75, timestamp: now + 5 * 3600000 },
        { value: 70, timestamp: now + 6 * 3600000 },
      ];
      const result = fitHoltModel(data);
      const baseTimestamp = now + 6 * 3600000; // Last data point
      const predictions = predictHolt(result.model, baseTimestamp, 3 * 3600000, 3);

      // Should predict decreasing values
      expect(predictions[0].value).toBeLessThan(70);
    });
  });
});
