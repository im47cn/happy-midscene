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

      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints,
        horizonDays: 7,
      });

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

      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints,
        horizonDays: 3,
      });

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

      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints,
        horizonDays: 3,
      });

      expect(result.trend).toBe('stable');
    });

    it('should include confidence intervals in predictions', async () => {
      const dataPoints = Array.from({ length: 14 }, (_, i) => ({
        value: 90 + Math.random() * 5,
        timestamp: Date.now() - 86400000 * (14 - i),
      }));

      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints,
        horizonDays: 5,
      });

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

      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints,
        horizonDays: 3,
      });

      // Should still return a result but with lower confidence
      expect(result).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should return null for empty data', async () => {
      const result = await trendPredictor.predict({
        metricName: 'passRate',
        dataPoints: [],
        horizonDays: 3,
      });

      expect(result).toBeNull();
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
    it('should compare different prediction models', async () => {
      const dataPoints = Array.from({ length: 30 }, (_, i) => ({
        value: 90 + Math.sin(i / 3) * 5 + i * 0.1,
        timestamp: Date.now() - 86400000 * (30 - i),
      }));

      const comparison = await trendPredictor.compareModels({
        dataPoints,
        models: ['linear', 'exponential_smoothing'],
      });

      expect(comparison).toBeDefined();
      expect(comparison.bestModel).toBeDefined();
      expect(comparison.modelResults).toHaveLength(2);
    });
  });
});

// ============================================================================
// Prediction Model Tests
// ============================================================================

describe('Prediction Models', () => {
  describe('Linear Regression', () => {
    it('should fit linear regression model', () => {
      const data = [1, 2, 3, 4, 5, 6, 7];
      const model = fitLinearRegression(data);

      expect(model.slope).toBeCloseTo(1, 1);
      expect(model.intercept).toBeCloseTo(1, 1);
      expect(model.rSquared).toBeGreaterThan(0.99);
    });

    it('should predict future values', () => {
      const data = [10, 20, 30, 40, 50];
      const model = fitLinearRegression(data);
      const predictions = predictLinear(model, 3);

      expect(predictions).toHaveLength(3);
      expect(predictions[0]).toBeCloseTo(60, 1);
      expect(predictions[1]).toBeCloseTo(70, 1);
      expect(predictions[2]).toBeCloseTo(80, 1);
    });

    it('should handle noisy data', () => {
      const data = [10, 22, 28, 42, 48, 61, 69];
      const model = fitLinearRegression(data);

      // Should still capture the trend
      expect(model.slope).toBeGreaterThan(8);
      expect(model.slope).toBeLessThan(12);
    });
  });

  describe('Holt Exponential Smoothing', () => {
    it('should fit Holt model', () => {
      const data = [100, 110, 120, 130, 140, 150, 160];
      const model = fitHoltModel(data, { alpha: 0.3, beta: 0.1 });

      expect(model).toBeDefined();
      expect(model.level).toBeGreaterThan(0);
      expect(model.trend).toBeGreaterThan(0);
    });

    it('should predict future values with trend', () => {
      const data = [100, 110, 120, 130, 140];
      const model = fitHoltModel(data);
      const predictions = predictHolt(model, 3);

      expect(predictions).toHaveLength(3);
      // Should continue the upward trend
      expect(predictions[0]).toBeGreaterThan(140);
      expect(predictions[1]).toBeGreaterThan(predictions[0]);
    });

    it('should handle decreasing trend', () => {
      const data = [100, 95, 90, 85, 80, 75, 70];
      const model = fitHoltModel(data);
      const predictions = predictHolt(model, 3);

      // Should predict decreasing values
      expect(predictions[0]).toBeLessThan(70);
    });
  });
});
