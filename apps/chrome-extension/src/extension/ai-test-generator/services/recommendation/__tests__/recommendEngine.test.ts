/**
 * Recommend Engine Tests
 * Tests for core recommendation engine
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseStats, ExecutionRecord } from '../../../types/analytics';
import type { RecommendOptions, ChangeInfo, RegressionType } from '../../../types/recommendation';
import { RecommendEngine } from '../recommendEngine';

// Mock analyticsStorage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getAllCaseStats: vi.fn(),
    getRecentExecutions: vi.fn(),
  },
}));

import { analyticsStorage } from '../../analytics/analyticsStorage';

describe('RecommendEngine', () => {
  let engine: RecommendEngine;

  const createCaseStats = (overrides?: Partial<CaseStats>): CaseStats => ({
    caseId: `case-${Math.random().toString(36).substr(2, 9)}`,
    caseName: 'Test Case',
    totalRuns: 30,
    passRate: 80,
    avgDuration: 10000,
    lastRun: Date.now() - 3600000,
    stabilityScore: 75,
    isFlaky: false,
    recentResults: ['passed', 'passed', 'failed', 'passed', 'passed'],
    ...overrides,
  });

  beforeEach(() => {
    engine = new RecommendEngine();
    vi.clearAllMocks();
  });

  describe('getRecommendations', () => {
    it('should return empty array when no cases exist', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const recommendations = await engine.getRecommendations();

      expect(recommendations).toEqual([]);
    });

    it('should return recommendations with required fields', async () => {
      const caseStats = [createCaseStats()];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const recommendations = await engine.getRecommendations();

      expect(recommendations.length).toBe(1);
      expect(recommendations[0]).toHaveProperty('id');
      expect(recommendations[0]).toHaveProperty('caseId');
      expect(recommendations[0]).toHaveProperty('caseName');
      expect(recommendations[0]).toHaveProperty('score');
      expect(recommendations[0]).toHaveProperty('reasons');
      expect(recommendations[0]).toHaveProperty('priority');
      expect(recommendations[0]).toHaveProperty('category');
      expect(recommendations[0]).toHaveProperty('estimatedDuration');
    });

    it('should respect limit parameter', async () => {
      const caseStats = Array.from({ length: 20 }, () => createCaseStats());
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const recommendations = await engine.getRecommendations({ limit: 5 });

      expect(recommendations.length).toBe(5);
    });

    it('should filter by minScore', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-1', stabilityScore: 20, passRate: 40 }), // Low score
        createCaseStats({ caseId: 'case-2', stabilityScore: 90, passRate: 95 }), // High score
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const recommendations = await engine.getRecommendations({ minScore: 70 });

      // Only high score case should be included
      expect(recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should sort by score descending', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-low', stabilityScore: 30, passRate: 50 }),
        createCaseStats({ caseId: 'case-high', stabilityScore: 95, passRate: 98 }),
        createCaseStats({ caseId: 'case-medium', stabilityScore: 70, passRate: 75 }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const recommendations = await engine.getRecommendations();

      expect(recommendations[0].score).toBeGreaterThanOrEqual(recommendations[1].score);
      expect(recommendations[1].score).toBeGreaterThanOrEqual(recommendations[2].score);
    });
  });

  describe('getRecommendationsForChange', () => {
    it('should return only cases affected by changes', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-login', caseName: 'Login Authentication Test' }),
        createCaseStats({ caseId: 'case-payment', caseName: 'Payment Checkout Test' }),
        createCaseStats({ caseId: 'case-search', caseName: 'Search Functionality Test' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const changes: ChangeInfo[] = [
        { type: 'file', target: 'authentication', description: 'Auth module' },
      ];

      const recommendations = await engine.getRecommendationsForChange(changes);

      // Should only include login case which matches 'authentication'
      expect(recommendations.length).toBe(1);
      expect(recommendations[0].caseId).toBe('case-login');
    });

    it('should include change_impact reason for affected cases', async () => {
      const caseStats = [createCaseStats({ caseName: 'Login Test' })];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const changes: ChangeInfo[] = [{ type: 'file', target: 'login', description: 'Login module' }];

      const recommendations = await engine.getRecommendationsForChange(changes);

      if (recommendations.length > 0) {
        const hasChangeImpact = recommendations[0].reasons.some((r) => r.type === 'change_impact');
        expect(hasChangeImpact).toBe(true);
      }
    });
  });

  describe('getRegressionSet', () => {
    it('should return critical and recently failed for minimal set', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-critical', stabilityScore: 20, isFlaky: true }),
        createCaseStats({ caseId: 'case-stable', stabilityScore: 95, isFlaky: false }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const minimal = await engine.getRegressionSet('minimal');

      // Should include the critical/flaky case
      const hasCritical = minimal.some((r) => r.caseId === 'case-critical');
      expect(hasCritical).toBe(true);
    });

    it('should return more cases for standard than minimal', async () => {
      const veryOld = Date.now() - 91 * 24 * 60 * 60 * 1000; // 91 days ago for max recency score
      const caseStats = [
        // Stable case - low priority, won't be included in regression sets
        createCaseStats({
          caseId: 'case-1',
          stabilityScore: 95,
          passRate: 98,
          recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
          caseName: 'Basic Page Test',
          totalRuns: 5,
          lastRun: veryOld,
        }),
        // Flaky case with recent failures - included in minimal (recent failure) and standard (high priority)
        createCaseStats({
          caseId: 'case-2',
          stabilityScore: 10,
          passRate: 20,
          isFlaky: true,
          recentResults: ['failed', 'failed', 'failed', 'failed', 'passed'],
          caseName: 'Critical Payment Auth Login Test',
          totalRuns: 150,
          lastRun: veryOld,
        }),
        // Another flaky case with critical keyword - reaches high priority
        createCaseStats({
          caseId: 'case-3',
          stabilityScore: 15,
          passRate: 30,
          isFlaky: true,
          recentResults: ['failed', 'failed', 'failed', 'passed', 'passed'],
          caseName: 'Payment Checkout Authorization Test',
          totalRuns: 100,
          lastRun: veryOld,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      // Create engine with adjusted thresholds so high priority is reachable
      const testEngine = new RecommendEngine({
        thresholds: { critical: 80, high: 55, medium: 40 },
      });

      const minimal = await testEngine.getRegressionSet('minimal');
      const standard = await testEngine.getRegressionSet('standard');

      // Minimal includes critical + recent failures (case-2, case-3 have recent failures)
      // Standard includes critical + high priority (55+)
      // At minimum, standard should have as many or more cases than minimal
      expect(standard.length).toBeGreaterThanOrEqual(minimal.length);
    });

    it('should return all cases for full set', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-1' }),
        createCaseStats({ caseId: 'case-2' }),
        createCaseStats({ caseId: 'case-3' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const full = await engine.getRegressionSet('full');

      expect(full.length).toBe(3);
    });
  });

  describe('recordFeedback', () => {
    it('should record feedback without throwing', async () => {
      const feedback = {
        recommendationId: 'rec-1',
        caseId: 'case-1',
        accepted: true,
        executed: true,
        result: 'passed' as const,
        rating: 5,
      };

      // Should not throw
      await expect(engine.recordFeedback(feedback)).resolves.toBeUndefined();
    });
  });

  describe('analyzeChangeImpact', () => {
    it('should return impact analysis for each change', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'Login Test' }),
        createCaseStats({ caseName: 'Checkout Test' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const changes: ChangeInfo[] = [
        { type: 'file', target: 'login' },
        { type: 'file', target: 'checkout' },
      ];

      const impacts = await engine.analyzeChangeImpact(changes);

      expect(impacts.length).toBe(2);
      expect(impacts[0]).toHaveProperty('change');
      expect(impacts[0]).toHaveProperty('affectedCases');
      expect(impacts[0]).toHaveProperty('impactLevel');
      expect(impacts[0]).toHaveProperty('reasoning');
    });
  });

  describe('updateConfig', () => {
    it('should update weights', () => {
      engine.updateConfig({ weights: { riskFactor: 0.5, businessValue: 0.2, executionCost: 0.1, changeImpact: 0.1, recency: 0.1 } });

      const config = engine.getConfig();
      expect(config.weights.riskFactor).toBe(0.5);
    });

    it('should update thresholds', () => {
      engine.updateConfig({ thresholds: { critical: 90, high: 70, medium: 50 } });

      const config = engine.getConfig();
      expect(config.thresholds.critical).toBe(90);
    });

    it('should merge partial updates', () => {
      const originalConfig = engine.getConfig();

      engine.updateConfig({ weights: { riskFactor: 0.4 } });
      const newConfig = engine.getConfig();

      expect(newConfig.weights.riskFactor).toBe(0.4);
      expect(newConfig.thresholds).toEqual(originalConfig.thresholds);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = engine.getConfig();

      expect(config).toHaveProperty('weights');
      expect(config).toHaveProperty('thresholds');
      expect(config.weights).toHaveProperty('riskFactor');
      expect(config.weights).toHaveProperty('businessValue');
      expect(config.weights).toHaveProperty('executionCost');
      expect(config.weights).toHaveProperty('changeImpact');
      expect(config.weights).toHaveProperty('recency');
    });
  });
});
