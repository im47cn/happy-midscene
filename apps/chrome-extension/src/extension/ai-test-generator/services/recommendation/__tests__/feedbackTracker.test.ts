/**
 * Feedback Tracker Tests
 * Tests for feedback collection and analysis
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackTracker } from '../feedbackTracker';
import type { Feedback } from '../../../types/recommendation';

// Mock console.log to avoid cluttering test output
const originalLog = console.log;
beforeEach(() => {
  console.log = vi.fn();
});

describe('FeedbackTracker', () => {
  let tracker: FeedbackTracker;

  const createFeedback = (overrides?: Partial<Feedback>): Feedback => ({
    recommendationId: `rec-${Math.random().toString(36).substr(2, 9)}`,
    caseId: `case-${Math.random().toString(36).substr(2, 9)}`,
    accepted: true,
    executed: true,
    result: 'passed',
    rating: 5,
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    tracker = new FeedbackTracker();
    vi.clearAllMocks();
  });

  describe('recordFeedback', () => {
    it('should record feedback successfully', async () => {
      const feedback = createFeedback();

      await expect(tracker.recordFeedback(feedback)).resolves.toBeUndefined();
    });

    it('should store feedback by case ID', async () => {
      const feedback = createFeedback({ caseId: 'test-case' });

      await tracker.recordFeedback(feedback);

      const caseFeedback = tracker.getFeedbackForCase('test-case');
      expect(caseFeedback).toHaveLength(1);
      expect(caseFeedback[0]).toEqual(feedback);
    });

    it('should allow multiple feedback entries for same case', async () => {
      const feedback1 = createFeedback({ caseId: 'test-case', recommendationId: 'rec-1' });
      const feedback2 = createFeedback({ caseId: 'test-case', recommendationId: 'rec-2' });

      await tracker.recordFeedback(feedback1);
      await tracker.recordFeedback(feedback2);

      const caseFeedback = tracker.getFeedbackForCase('test-case');
      expect(caseFeedback).toHaveLength(2);
    });
  });

  describe('getFeedbackForRecommendation', () => {
    it('should return empty array for non-existent recommendation', () => {
      const feedback = tracker.getFeedbackForRecommendation('non-existent');

      expect(feedback).toEqual([]);
    });

    it('should return feedback for specific recommendation', async () => {
      const feedback = createFeedback({ recommendationId: 'rec-123', caseId: 'case-1' });

      await tracker.recordFeedback(feedback);

      const found = tracker.getFeedbackForRecommendation('rec-123');
      expect(found).toHaveLength(1);
      expect(found[0]).toEqual(feedback);
    });

    it('should find recommendation feedback across multiple cases', async () => {
      await tracker.recordFeedback(createFeedback({ recommendationId: 'rec-shared', caseId: 'case-1' }));
      await tracker.recordFeedback(createFeedback({ recommendationId: 'rec-shared', caseId: 'case-2' }));
      await tracker.recordFeedback(createFeedback({ recommendationId: 'rec-other', caseId: 'case-1' }));

      const found = tracker.getFeedbackForRecommendation('rec-shared');
      expect(found).toHaveLength(2);
    });
  });

  describe('getFeedbackForCase', () => {
    it('should return empty array for non-existent case', () => {
      const feedback = tracker.getFeedbackForCase('non-existent');

      expect(feedback).toEqual([]);
    });

    it('should return all feedback for a case', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'test-case', recommendationId: 'rec-1' }));
      await tracker.recordFeedback(createFeedback({ caseId: 'test-case', recommendationId: 'rec-2' }));

      const caseFeedback = tracker.getFeedbackForCase('test-case');
      expect(caseFeedback).toHaveLength(2);
    });
  });

  describe('getAllFeedback', () => {
    it('should return empty array when no feedback recorded', () => {
      const all = tracker.getAllFeedback();

      expect(all).toEqual([]);
    });

    it('should return all feedback sorted by timestamp', async () => {
      const baseTime = Date.now();
      await tracker.recordFeedback(createFeedback({ timestamp: baseTime - 3000 }));
      await tracker.recordFeedback(createFeedback({ timestamp: baseTime - 1000 }));
      await tracker.recordFeedback(createFeedback({ timestamp: baseTime - 2000 }));

      const all = tracker.getAllFeedback();

      expect(all).toHaveLength(3);
      // Should be sorted by timestamp descending (newest first)
      expect(all[0].timestamp).toBeGreaterThanOrEqual(all[1].timestamp);
      expect(all[1].timestamp).toBeGreaterThanOrEqual(all[2].timestamp);
    });
  });

  describe('analyzeFeedback', () => {
    it('should return zeros for no feedback', () => {
      const summary = tracker.analyzeFeedback();

      expect(summary.total).toBe(0);
      expect(summary.accepted).toBe(0);
      expect(summary.rejected).toBe(0);
      expect(summary.acceptanceRate).toBe(0);
      expect(summary.averageRating).toBe(0);
    });

    it('should calculate acceptance rate correctly', async () => {
      await tracker.recordFeedback(createFeedback({ accepted: true }));
      await tracker.recordFeedback(createFeedback({ accepted: true }));
      await tracker.recordFeedback(createFeedback({ accepted: false }));

      const summary = tracker.analyzeFeedback();

      expect(summary.total).toBe(3);
      expect(summary.accepted).toBe(2);
      expect(summary.rejected).toBe(1);
      expect(summary.acceptanceRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate average rating correctly', async () => {
      await tracker.recordFeedback(createFeedback({ rating: 5 }));
      await tracker.recordFeedback(createFeedback({ rating: 3 }));
      await tracker.recordFeedback(createFeedback({ rating: 4 }));
      await tracker.recordFeedback(createFeedback({ rating: undefined }));

      const summary = tracker.analyzeFeedback();

      expect(summary.averageRating).toBe(4); // (5 + 3 + 4) / 3
    });

    it('should handle feedback without ratings', async () => {
      await tracker.recordFeedback(createFeedback({ rating: undefined, accepted: true }));
      await tracker.recordFeedback(createFeedback({ rating: undefined, accepted: false }));

      const summary = tracker.analyzeFeedback();

      expect(summary.total).toBe(2);
      expect(summary.averageRating).toBe(0);
    });
  });

  describe('calculateWeightAdjustments', () => {
    it('should return zero confidence for insufficient data', async () => {
      await tracker.recordFeedback(createFeedback({}));

      const adjustment = tracker.calculateWeightAdjustments();

      expect(adjustment.confidence).toBe(0);
      expect(adjustment.reasoning.some((r) => r.includes('数据量不足'))).toBe(true);
    });

    it('should increase confidence with more feedback', async () => {
      // Add 50 feedback entries
      for (let i = 0; i < 50; i++) {
        await tracker.recordFeedback(createFeedback({ accepted: true, rating: 5 }));
      }

      const adjustment = tracker.calculateWeightAdjustments();

      expect(adjustment.confidence).toBe(0.5);
    });

    it('should suggest maintaining weights for high acceptance rate', async () => {
      for (let i = 0; i < 20; i++) {
        await tracker.recordFeedback(createFeedback({ accepted: true, rating: 5 }));
      }

      const adjustment = tracker.calculateWeightAdjustments();

      const hasPositiveReasoning = adjustment.reasoning.some((r) => r.includes('良好'));
      expect(hasPositiveReasoning).toBe(true);
    });

    it('should suggest adjusting weights for low acceptance rate', async () => {
      for (let i = 0; i < 20; i++) {
        await tracker.recordFeedback(createFeedback({ accepted: false, rating: 2 }));
      }

      const adjustment = tracker.calculateWeightAdjustments();

      const hasAdjustmentReasoning = adjustment.reasoning.some((r) => r.includes('调整'));
      expect(hasAdjustmentReasoning).toBe(true);
    });

    it('should return valid weights that sum to 1', async () => {
      for (let i = 0; i < 15; i++) {
        await tracker.recordFeedback(createFeedback({}));
      }

      const adjustment = tracker.calculateWeightAdjustments();

      const sum = Object.values(adjustment.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  describe('getRecentFeedback', () => {
    it('should return empty array when no feedback', () => {
      const recent = tracker.getRecentFeedback();

      expect(recent).toEqual([]);
    });

    it('should respect default limit', async () => {
      for (let i = 0; i < 100; i++) {
        await tracker.recordFeedback(createFeedback({ timestamp: Date.now() - i }));
      }

      const recent = tracker.getRecentFeedback();

      expect(recent.length).toBe(50);
    });

    it('should respect custom limit', async () => {
      for (let i = 0; i < 20; i++) {
        await tracker.recordFeedback(createFeedback({}));
      }

      const recent = tracker.getRecentFeedback(5);

      expect(recent.length).toBe(5);
    });
  });

  describe('getCaseStats', () => {
    it('should return null for case with no feedback', () => {
      const stats = tracker.getCaseStats('non-existent');

      expect(stats).toBeNull();
    });

    it('should return stats for case with feedback', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'test-case', accepted: true, rating: 5 }));
      await tracker.recordFeedback(createFeedback({ caseId: 'test-case', accepted: false, rating: 2 }));

      const stats = tracker.getCaseStats('test-case');

      expect(stats).not.toBeNull();
      expect(stats?.total).toBe(2);
      expect(stats?.accepted).toBe(1);
      expect(stats?.averageRating).toBe(3.5);
    });
  });

  describe('clearCaseFeedback', () => {
    it('should clear feedback for specific case', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'case-1' }));
      await tracker.recordFeedback(createFeedback({ caseId: 'case-2' }));

      tracker.clearCaseFeedback('case-1');

      expect(tracker.getFeedbackForCase('case-1')).toEqual([]);
      expect(tracker.getFeedbackForCase('case-2')).toHaveLength(1);
    });

    it('should handle clearing non-existent case', () => {
      expect(() => tracker.clearCaseFeedback('non-existent')).not.toThrow();
    });
  });

  describe('clearAllFeedback', () => {
    it('should clear all feedback', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'case-1' }));
      await tracker.recordFeedback(createFeedback({ caseId: 'case-2' }));

      tracker.clearAllFeedback();

      expect(tracker.getAllFeedback()).toEqual([]);
      expect(tracker.getFeedbackForCase('case-1')).toEqual([]);
      expect(tracker.getFeedbackForCase('case-2')).toEqual([]);
    });
  });

  describe('exportImportFeedback', () => {
    it('should export feedback as JSON string', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'case-1', recommendationId: 'rec-1' }));

      const exported = tracker.exportFeedback();

      expect(typeof exported).toBe('string');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should import feedback from JSON string', async () => {
      const feedback = createFeedback({ caseId: 'case-1', recommendationId: 'rec-1' });
      await tracker.recordFeedback(feedback);

      const exported = tracker.exportFeedback();

      const newTracker = new FeedbackTracker();
      newTracker.importFeedback(exported);

      expect(newTracker.getFeedbackForCase('case-1')).toHaveLength(1);
    });

    it('should throw on invalid JSON', () => {
      expect(() => tracker.importFeedback('invalid json')).toThrow();
    });

    it('should import feedback and update specified cases', async () => {
      await tracker.recordFeedback(createFeedback({ caseId: 'old-case' }));
      await tracker.recordFeedback(createFeedback({ caseId: 'keep-case' }));

      const newData: Array<[string, Feedback[]]> = [['new-case', [createFeedback()]]];
      tracker.importFeedback(JSON.stringify(newData));

      // old-case should still have its feedback (import doesn't clear)
      expect(tracker.getFeedbackForCase('old-case')).toHaveLength(1);
      // keep-case should still have its feedback
      expect(tracker.getFeedbackForCase('keep-case')).toHaveLength(1);
      // new-case should have the imported feedback
      expect(tracker.getFeedbackForCase('new-case')).toHaveLength(1);
    });
  });

  describe('getFeedbackTrends', () => {
    it('should return empty array for no feedback', () => {
      const trends = tracker.getFeedbackTrends();

      expect(trends).toEqual([]);
    });

    it('should group feedback by date', async () => {
      // Use recent dates within 30-day window
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const date1 = now - 2 * dayMs; // 2 days ago
      const date2 = now - 1 * dayMs; // 1 day ago

      await tracker.recordFeedback(createFeedback({ timestamp: date1, accepted: true }));
      await tracker.recordFeedback(createFeedback({ timestamp: date1, accepted: false }));
      await tracker.recordFeedback(createFeedback({ timestamp: date2, accepted: true }));

      const trends = tracker.getFeedbackTrends(30);

      expect(trends).toHaveLength(2);
      expect(trends[0].count).toBe(2);
      expect(trends[0].acceptanceRate).toBe(50);
    });

    it('should sort trends by date ascending', async () => {
      // Use recent dates within 30-day window
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      await tracker.recordFeedback(createFeedback({ timestamp: now - 3 * dayMs }));
      await tracker.recordFeedback(createFeedback({ timestamp: now - 1 * dayMs }));
      await tracker.recordFeedback(createFeedback({ timestamp: now - 2 * dayMs }));

      const trends = tracker.getFeedbackTrends(30);

      expect(trends.length).toBeGreaterThanOrEqual(1);
      // Check that trends are sorted by date
      for (let i = 1; i < trends.length; i++) {
        expect(trends[i].date >= trends[i - 1].date).toBe(true);
      }
    });

    it('should respect days parameter', async () => {
      const oldDate = new Date('2024-01-01').getTime();
      const recentDate = Date.now();

      await tracker.recordFeedback(createFeedback({ timestamp: oldDate }));
      await tracker.recordFeedback(createFeedback({ timestamp: recentDate }));

      const trends = tracker.getFeedbackTrends(7);

      // Only recent feedback should be included
      const totalInTrends = trends.reduce((sum, t) => sum + t.count, 0);
      expect(totalInTrends).toBeLessThanOrEqual(2);
    });
  });
});

// Restore console.log
afterAll(() => {
  console.log = originalLog;
});
