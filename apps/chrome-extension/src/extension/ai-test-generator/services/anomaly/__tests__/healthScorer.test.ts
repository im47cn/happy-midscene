/**
 * input: healthScorer service
 * output: Test results for health scoring functionality
 * pos: Unit tests for health score calculation
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthScore } from '../../types/anomaly';
import { healthScorer } from '../healthScorer';
import { anomalyStorage } from '../storage';

// Mock storage
vi.mock('../storage', () => ({
  anomalyStorage: {
    saveHealthScore: vi.fn().mockResolvedValue(undefined),
    getLatestHealthScore: vi.fn().mockResolvedValue(null),
    getHealthScoreHistory: vi.fn().mockResolvedValue([]),
    getAllAnomalies: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getAllBaselines: vi.fn().mockResolvedValue([]),
  },
}));

describe('HealthScorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations with default values
    vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getActive).mockResolvedValue([]);
    vi.mocked(anomalyStorage.getAllBaselines).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateScore', () => {
    it('should calculate overall health score', async () => {
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);

      const result = await healthScorer.calculateScore({
        metrics: {
          passRate: 95,
          avgDuration: 1000,
          durationVariance: 10,
          flakyCount: 2,
          totalCases: 100,
          coveredCases: 85,
        },
      });

      expect(result).toBeDefined();
      expect(result.overall).toBeGreaterThan(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.dimensions).toHaveLength(4);
    });

    it('should calculate perfect score for ideal metrics', async () => {
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);

      const result = await healthScorer.calculateScore({
        metrics: {
          passRate: 100,
          avgDuration: 500,
          durationVariance: 0,
          consecutiveFailures: 0,
          flakyCount: 0,
          totalCases: 100,
          coveredCases: 100,
          recentAnomalies: 0,
        },
      });

      expect(result.overall).toBeGreaterThanOrEqual(95);
    });

    it('should calculate low score for poor metrics', async () => {
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([
        {
          id: 'anomaly-1',
          type: 'pass_rate_drop',
          severity: 'critical',
          status: 'active',
          detectedAt: Date.now(),
          metric: {
            name: 'passRate',
            currentValue: 50,
            unit: '%',
            timestamp: Date.now(),
          },
          baseline: {
            mean: 95,
            stdDev: 2,
            min: 90,
            max: 100,
            period: '7d',
            sampleCount: 100,
            lastUpdated: Date.now(),
          },
          deviation: {
            absoluteDeviation: -45,
            percentageDeviation: -47,
            zScore: -22.5,
          },
          impact: {
            affectedCases: [],
            affectedFeatures: [],
            estimatedScope: 'high',
          },
          rootCauses: [],
        },
      ]);

      const result = await healthScorer.calculateScore({
        metrics: {
          passRate: 50,
          avgDuration: 10000,
          durationVariance: 50,
          consecutiveFailures: 5,
          flakyCount: 30,
          totalCases: 100,
          coveredCases: 30,
          recentAnomalies: 10,
        },
      });

      expect(result.overall).toBeLessThan(50);
    });

    it('should include all four dimensions', async () => {
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);

      const result = await healthScorer.calculateScore({
        metrics: {
          passRate: 90,
          avgDuration: 1500,
          durationVariance: 15,
          flakyCount: 5,
          totalCases: 100,
          coveredCases: 75,
        },
      });

      const dimensionNames = result.dimensions.map((d) => d.name);
      expect(dimensionNames).toContain('Reliability');
      expect(dimensionNames).toContain('Stability');
      expect(dimensionNames).toContain('Efficiency');
      expect(dimensionNames).toContain('Coverage');
    });

    it('should apply correct weights to dimensions', async () => {
      vi.mocked(anomalyStorage.getAllAnomalies).mockResolvedValue([]);

      const result = await healthScorer.calculateScore({
        metrics: {
          passRate: 90,
          avgDuration: 1500,
          durationVariance: 15,
          flakyCount: 5,
          totalCases: 100,
          coveredCases: 75,
        },
      });

      const totalWeight = result.dimensions.reduce(
        (sum, d) => sum + d.weight,
        0,
      );
      expect(totalWeight).toBeCloseTo(1, 2);
    });
  });

  describe('getScoreHistory', () => {
    it('should retrieve score history', async () => {
      const mockHistory: HealthScore[] = [
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 2,
          recommendations: [],
        },
        {
          overall: 87,
          dimensions: [],
          calculatedAt: Date.now() - 86400000,
          recommendations: [],
        },
        {
          overall: 90,
          dimensions: [],
          calculatedAt: Date.now(),
          recommendations: [],
        },
      ];

      vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue(
        mockHistory,
      );

      const result = await healthScorer.getScoreHistory(7);

      expect(result).toHaveLength(3);
      expect(result[result.length - 1].overall).toBe(90);
    });

    it('should return empty array when no history', async () => {
      vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue([]);

      const result = await healthScorer.getScoreHistory(7);

      expect(result).toHaveLength(0);
    });
  });

  describe('getLatestScore', () => {
    it('should retrieve latest score', async () => {
      const mockScore: HealthScore = {
        overall: 88,
        dimensions: [
          { name: 'Reliability', score: 90, weight: 0.35, factors: [] },
          { name: 'Stability', score: 85, weight: 0.25, factors: [] },
          { name: 'Efficiency', score: 88, weight: 0.2, factors: [] },
          { name: 'Coverage', score: 89, weight: 0.2, factors: [] },
        ],
        calculatedAt: Date.now(),
        recommendations: [],
      };

      vi.mocked(anomalyStorage.getLatestHealthScore).mockResolvedValue(
        mockScore,
      );

      const result = await healthScorer.getLatestScore();

      expect(result).toEqual(mockScore);
    });

    it('should return null when no score exists', async () => {
      vi.mocked(anomalyStorage.getLatestHealthScore).mockResolvedValue(null);

      const result = await healthScorer.getLatestScore();

      expect(result).toBeNull();
    });
  });

  describe('getRecommendations', () => {
    it('should generate recommendations based on low scores', async () => {
      const mockScore: HealthScore = {
        overall: 60,
        dimensions: [
          {
            name: 'Reliability',
            score: 50,
            weight: 0.35,
            factors: [{ name: 'Pass Rate', value: 60, impact: 'negative' }],
          },
          { name: 'Stability', score: 90, weight: 0.25, factors: [] },
          { name: 'Efficiency', score: 85, weight: 0.2, factors: [] },
          {
            name: 'Coverage',
            score: 45,
            weight: 0.2,
            factors: [{ name: 'Test Coverage', value: 40, impact: 'negative' }],
          },
        ],
        calculatedAt: Date.now(),
        recommendations: [],
      };

      vi.mocked(anomalyStorage.getLatestHealthScore).mockResolvedValue(
        mockScore,
      );

      const recommendations = await healthScorer.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      // Should have recommendations for low reliability and coverage
      const hasReliabilityRec = recommendations.some(
        (r) =>
          r.includes('可靠性') ||
          r.includes('Reliability') ||
          r.includes('pass rate'),
      );
      const hasCoverageRec = recommendations.some(
        (r) => r.includes('覆盖') || r.includes('coverage'),
      );
      expect(hasReliabilityRec || hasCoverageRec).toBe(true);
    });

    it('should return empty array for healthy scores', async () => {
      const mockScore: HealthScore = {
        overall: 95,
        dimensions: [
          { name: 'Reliability', score: 98, weight: 0.35, factors: [] },
          { name: 'Stability', score: 95, weight: 0.25, factors: [] },
          { name: 'Efficiency', score: 92, weight: 0.2, factors: [] },
          { name: 'Coverage', score: 90, weight: 0.2, factors: [] },
        ],
        calculatedAt: Date.now(),
        recommendations: [],
      };

      vi.mocked(anomalyStorage.getLatestHealthScore).mockResolvedValue(
        mockScore,
      );

      const recommendations = await healthScorer.getRecommendations();

      // Should have minimal or no recommendations for healthy scores
      expect(recommendations.length).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeTrends', () => {
    it('should detect improving trend', async () => {
      const mockHistory: HealthScore[] = [
        {
          overall: 90,
          dimensions: [],
          calculatedAt: Date.now(),
          recommendations: [],
        },
        {
          overall: 88,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 1,
          recommendations: [],
        },
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 2,
          recommendations: [],
        },
        {
          overall: 82,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 3,
          recommendations: [],
        },
        {
          overall: 78,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 4,
          recommendations: [],
        },
        {
          overall: 75,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 5,
          recommendations: [],
        },
        {
          overall: 70,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 6,
          recommendations: [],
        },
      ];

      vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue(
        mockHistory,
      );

      const analysis = await healthScorer.analyzeTrends(7);

      expect(analysis.overall.direction).toBe('improving');
      expect(analysis.overall.change).toBeGreaterThan(0);
    });

    it('should detect degrading trend', async () => {
      const mockHistory: HealthScore[] = [
        {
          overall: 65,
          dimensions: [],
          calculatedAt: Date.now(),
          recommendations: [],
        },
        {
          overall: 68,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 1,
          recommendations: [],
        },
        {
          overall: 72,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 2,
          recommendations: [],
        },
        {
          overall: 75,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 3,
          recommendations: [],
        },
        {
          overall: 80,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 4,
          recommendations: [],
        },
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 5,
          recommendations: [],
        },
        {
          overall: 90,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 6,
          recommendations: [],
        },
      ];

      vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue(
        mockHistory,
      );

      const analysis = await healthScorer.analyzeTrends(7);

      expect(analysis.overall.direction).toBe('degrading');
      expect(analysis.overall.change).toBeLessThan(0);
    });

    it('should detect stable trend', async () => {
      const mockHistory: HealthScore[] = [
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now(),
          recommendations: [],
        },
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 1,
          recommendations: [],
        },
        {
          overall: 86,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 2,
          recommendations: [],
        },
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 3,
          recommendations: [],
        },
        {
          overall: 84,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 4,
          recommendations: [],
        },
        {
          overall: 86,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 5,
          recommendations: [],
        },
        {
          overall: 85,
          dimensions: [],
          calculatedAt: Date.now() - 86400000 * 6,
          recommendations: [],
        },
      ];

      vi.mocked(anomalyStorage.getHealthScoreHistory).mockResolvedValue(
        mockHistory,
      );

      const analysis = await healthScorer.analyzeTrends(7);

      expect(analysis.overall.direction).toBe('stable');
    });
  });

  describe('getScoreLevel', () => {
    it('should return excellent for scores >= 90', () => {
      expect(healthScorer.getScoreLevel(95)).toBe('excellent');
      expect(healthScorer.getScoreLevel(90)).toBe('excellent');
    });

    it('should return good for scores >= 75', () => {
      expect(healthScorer.getScoreLevel(85)).toBe('good');
      expect(healthScorer.getScoreLevel(75)).toBe('good');
    });

    it('should return fair for scores >= 60', () => {
      expect(healthScorer.getScoreLevel(70)).toBe('fair');
      expect(healthScorer.getScoreLevel(60)).toBe('fair');
    });

    it('should return poor for scores < 60 and >= 40', () => {
      expect(healthScorer.getScoreLevel(50)).toBe('poor');
      expect(healthScorer.getScoreLevel(45)).toBe('poor');
    });

    it('should return critical for scores < 40', () => {
      expect(healthScorer.getScoreLevel(30)).toBe('critical');
      expect(healthScorer.getScoreLevel(0)).toBe('critical');
    });
  });
});
