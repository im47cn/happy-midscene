/**
 * ImpactEstimator Tests
 */

import { describe, expect, it } from 'vitest';
import type { Recommendation } from '../../../types/optimization';
import { impactEstimator } from '../impactEstimator';

describe('ImpactEstimator', () => {
  const createRecommendation = (
    overrides: Partial<Recommendation> = {},
  ): Recommendation => ({
    id: 'rec-test',
    type: 'efficiency',
    priority: 'medium',
    title: 'Test Recommendation',
    description: 'Test description',
    impact: {
      description: '',
    },
    effort: 'medium',
    actionItems: [],
    relatedCases: ['case-1', 'case-2'],
    evidence: [],
    createdAt: Date.now(),
    ...overrides,
  });

  describe('estimateTimeSaving', () => {
    it('should estimate higher savings for high priority', () => {
      const highPriority = createRecommendation({ priority: 'high' });
      const lowPriority = createRecommendation({ priority: 'low' });

      const highSaving = impactEstimator.estimateTimeSaving(highPriority);
      const lowSaving = impactEstimator.estimateTimeSaving(lowPriority);

      expect(highSaving).toBeGreaterThan(lowSaving);
    });

    it('should estimate higher savings for more affected cases', () => {
      const manyCases = createRecommendation({
        relatedCases: ['1', '2', '3', '4', '5'],
      });
      const fewCases = createRecommendation({
        relatedCases: ['1'],
      });

      const manySaving = impactEstimator.estimateTimeSaving(manyCases);
      const fewSaving = impactEstimator.estimateTimeSaving(fewCases);

      expect(manySaving).toBeGreaterThan(fewSaving);
    });

    it('should return positive value', () => {
      const rec = createRecommendation();
      expect(impactEstimator.estimateTimeSaving(rec)).toBeGreaterThan(0);
    });
  });

  describe('estimateQualityImprovement', () => {
    it('should return value between 0 and 50', () => {
      const rec = createRecommendation();
      const improvement = impactEstimator.estimateQualityImprovement(rec);

      expect(improvement).toBeGreaterThanOrEqual(0);
      expect(improvement).toBeLessThanOrEqual(50);
    });

    it('should estimate higher improvement for stability type', () => {
      const stability = createRecommendation({ type: 'stability' });
      const resource = createRecommendation({ type: 'resource' });

      const stabilityImprovement =
        impactEstimator.estimateQualityImprovement(stability);
      const resourceImprovement =
        impactEstimator.estimateQualityImprovement(resource);

      expect(stabilityImprovement).toBeGreaterThan(resourceImprovement);
    });
  });

  describe('calculateROI', () => {
    it('should return a number', () => {
      const rec = createRecommendation();
      expect(typeof impactEstimator.calculateROI(rec)).toBe('number');
    });

    it('should return higher ROI for low effort recommendations', () => {
      const lowEffort = createRecommendation({ effort: 'low' });
      const highEffort = createRecommendation({ effort: 'high' });

      const lowEffortROI = impactEstimator.calculateROI(lowEffort);
      const highEffortROI = impactEstimator.calculateROI(highEffort);

      expect(lowEffortROI).toBeGreaterThan(highEffortROI);
    });
  });

  describe('estimateImpact', () => {
    it('should return Impact object with all fields', () => {
      const rec = createRecommendation();
      const impact = impactEstimator.estimateImpact(rec);

      expect(impact).toHaveProperty('timeReduction');
      expect(impact).toHaveProperty('description');
      expect(typeof impact.description).toBe('string');
    });

    it('should include quality improvement for stability recommendations', () => {
      const rec = createRecommendation({ type: 'stability' });
      const impact = impactEstimator.estimateImpact(rec);

      expect(impact.qualityImprovement).toBeGreaterThan(0);
    });
  });

  describe('estimateTotalImpact', () => {
    it('should return zero values for empty array', () => {
      const result = impactEstimator.estimateTotalImpact([]);

      expect(result.totalTimeSaving).toBe(0);
      expect(result.avgQualityImprovement).toBe(0);
      expect(result.avgROI).toBe(0);
    });

    it('should calculate totals for multiple recommendations', () => {
      const recs = [
        createRecommendation({ priority: 'high' }),
        createRecommendation({ priority: 'medium' }),
        createRecommendation({ priority: 'low' }),
      ];

      const result = impactEstimator.estimateTotalImpact(recs);

      expect(result.totalTimeSaving).toBeGreaterThan(0);
      expect(result.avgQualityImprovement).toBeGreaterThan(0);
    });

    it('should aggregate time savings', () => {
      const rec1 = createRecommendation({ relatedCases: ['1', '2'] });
      const rec2 = createRecommendation({ relatedCases: ['3', '4'] });

      const singleResult = impactEstimator.estimateTotalImpact([rec1]);
      const combinedResult = impactEstimator.estimateTotalImpact([rec1, rec2]);

      expect(combinedResult.totalTimeSaving).toBeGreaterThan(
        singleResult.totalTimeSaving,
      );
    });
  });

  describe('compareByImpact', () => {
    it('should sort by priority first', () => {
      const high = createRecommendation({ priority: 'high' });
      const low = createRecommendation({ priority: 'low' });

      expect(impactEstimator.compareByImpact(high, low)).toBeLessThan(0);
      expect(impactEstimator.compareByImpact(low, high)).toBeGreaterThan(0);
    });

    it('should sort by ROI for same priority', () => {
      const lowEffort = createRecommendation({
        priority: 'medium',
        effort: 'low',
      });
      const highEffort = createRecommendation({
        priority: 'medium',
        effort: 'high',
      });

      // Low effort has higher ROI, should come first (negative comparison)
      expect(
        impactEstimator.compareByImpact(lowEffort, highEffort),
      ).toBeLessThan(0);
    });
  });
});
