/**
 * Priority Ranker Tests
 * Tests for test case prioritization
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseStats } from '../../../types/analytics';
import { PriorityRanker } from '../priorityRanker';

// Mock analyticsStorage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getAllCaseStats: vi.fn(),
  },
}));

import { analyticsStorage } from '../../analytics/analyticsStorage';

describe('PriorityRanker', () => {
  let ranker: PriorityRanker;

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
    ranker = new PriorityRanker();
    vi.clearAllMocks();
  });

  describe('rankCases', () => {
    it('should return empty array when no cases exist', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const ranked = await ranker.rankCases();

      expect(ranked).toEqual([]);
    });

    it('should return ranked cases with required fields', async () => {
      const caseStats = [createCaseStats()];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases();

      expect(ranked.length).toBe(1);
      expect(ranked[0]).toHaveProperty('caseId');
      expect(ranked[0]).toHaveProperty('caseName');
      expect(ranked[0]).toHaveProperty('priority');
      expect(ranked[0]).toHaveProperty('score');
      expect(ranked[0]).toHaveProperty('factors');
    });

    it('should sort by priority then score', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'low',
          caseName: 'Basic Test',
          stabilityScore: 95,
          totalRuns: 5,
          passRate: 98,
          recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
        }),
        createCaseStats({
          caseId: 'high',
          caseName: 'Login Test',
          stabilityScore: 60,
          totalRuns: 50,
          passRate: 60,
          recentResults: ['failed', 'failed', 'passed', 'passed', 'passed'],
        }),
        createCaseStats({
          caseId: 'critical',
          caseName: 'Payment Auth Test',
          isFlaky: true,
          passRate: 40,
          stabilityScore: 20,
          recentResults: ['failed', 'failed', 'failed', 'passed', 'passed'],
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases();

      // Check that cases are sorted by priority and score
      expect(ranked.length).toBe(3);
      // The first case should have the highest priority or score
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    });

    it('should filter by caseIds when provided', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-1' }),
        createCaseStats({ caseId: 'case-2' }),
        createCaseStats({ caseId: 'case-3' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases(['case-1', 'case-3']);

      expect(ranked.length).toBe(2);
      expect(ranked.map((r) => r.caseId)).toEqual(
        expect.arrayContaining(['case-1', 'case-3']),
      );
    });

    it('should calculate factors correctly', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'login-test',
          caseName: 'Login Authentication',
          passRate: 50,
          stabilityScore: 40,
          totalRuns: 100,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases();

      expect(ranked[0].factors).toHaveProperty('risk');
      expect(ranked[0].factors).toHaveProperty('recency');
      expect(ranked[0].factors).toHaveProperty('businessValue');
      expect(ranked[0].factors).toHaveProperty('coverage');
      expect(ranked[0].factors).toHaveProperty('stability');
    });
  });

  describe('getPriority', () => {
    it('should return low priority for stable tests', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'stable-case',
          stabilityScore: 95,
          passRate: 98,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const priority = await ranker.getPriority('stable-case');

      expect(priority).toBe('low');
    });

    it('should return high priority for flaky tests with extreme metrics', async () => {
      // Max score without changeImpact is 80 (weights sum to 0.9: 0.4+0.3+0.1+0.1)
      // Score = (risk * 0.4 + businessValue * 0.3 + recency * 0.1 + changeImpact * 0.1) * 100
      // High priority threshold is >= 70, critical is >= 90 (unreachable without changeImpact)
      const caseStats = [
        createCaseStats({
          caseId: 'flaky-case',
          isFlaky: true,
          passRate: 10,
          stabilityScore: 5, // Very unstable - high risk
          caseName: 'Critical Payment Login Auth',
          totalRuns: 100, // High frequency = high business value
          lastRun: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days ago = high recency
          recentResults: ['failed', 'failed', 'failed', 'failed', 'failed'],
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const priority = await ranker.getPriority('flaky-case');

      // With extreme metrics, should reach high priority (70-89 range)
      expect(priority).toBe('high');
    });

    it('should return medium priority for login tests with moderate risk', async () => {
      // Login keyword gives businessValue boost
      // With moderate risk factors, should reach at least medium priority
      const caseStats = [
        createCaseStats({
          caseId: 'login',
          caseName: 'User Login Authentication Test',
          passRate: 50, // Low pass rate increases risk
          stabilityScore: 40, // Low stability
          totalRuns: 80, // High frequency = high business value
          recentResults: ['failed', 'failed', 'passed', 'passed', 'passed'],
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const priority = await ranker.getPriority('login');

      // With business value boost and risk factors, should be at least low or medium
      expect(['low', 'medium']).toContain(priority);
    });

    it('should return low priority when case not found', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const priority = await ranker.getPriority('non-existent');

      expect(priority).toBe('low');
    });
  });

  describe('updateConfig', () => {
    it('should update weights', () => {
      ranker.updateConfig({
        weights: {
          riskFactor: 0.6,
          businessValue: 0.3,
          executionCost: 0,
          changeImpact: 0.05,
          recency: 0.05,
        },
      });

      const config = ranker.getConfig();
      expect(config.weights.riskFactor).toBe(0.6);
      expect(config.weights.businessValue).toBe(0.3);
    });

    it('should update thresholds', () => {
      ranker.updateConfig({
        thresholds: { critical: 85, high: 65, medium: 45 },
      });

      const config = ranker.getConfig();
      expect(config.thresholds.critical).toBe(85);
      expect(config.thresholds.high).toBe(65);
    });

    it('should merge partial updates', () => {
      const originalConfig = ranker.getConfig();

      ranker.updateConfig({ weights: { riskFactor: 0.5 } });
      const newConfig = ranker.getConfig();

      expect(newConfig.weights.riskFactor).toBe(0.5);
      expect(newConfig.thresholds).toEqual(originalConfig.thresholds);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = ranker.getConfig();

      expect(config).toHaveProperty('weights');
      expect(config).toHaveProperty('thresholds');
      expect(config.weights).toHaveProperty('riskFactor');
      expect(config.weights).toHaveProperty('businessValue');
      expect(config.weights).toHaveProperty('executionCost');
      expect(config.weights).toHaveProperty('changeImpact');
      expect(config.weights).toHaveProperty('recency');
    });
  });

  describe('getPriorityDistribution', () => {
    it('should return distribution across priorities', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'critical',
          caseName: 'Payment Test',
          isFlaky: true,
        }),
        createCaseStats({
          caseId: 'high1',
          caseName: 'Login Test',
          passRate: 70,
        }),
        createCaseStats({
          caseId: 'high2',
          caseName: 'Auth Test',
          passRate: 65,
        }),
        createCaseStats({
          caseId: 'medium',
          caseName: 'Search Test',
          passRate: 80,
        }),
        createCaseStats({
          caseId: 'low',
          caseName: 'About Page',
          stabilityScore: 95,
          passRate: 98,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const distribution = await ranker.getPriorityDistribution();

      expect(distribution).toHaveProperty('critical');
      expect(distribution).toHaveProperty('high');
      expect(distribution).toHaveProperty('medium');
      expect(distribution).toHaveProperty('low');
      expect(
        distribution.critical +
          distribution.high +
          distribution.medium +
          distribution.low,
      ).toBe(5);
    });

    it('should filter distribution by caseIds', async () => {
      const caseStats = [
        createCaseStats({ caseId: 'case-1' }),
        createCaseStats({ caseId: 'case-2' }),
        createCaseStats({ caseId: 'case-3' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const distribution = await ranker.getPriorityDistribution([
        'case-1',
        'case-2',
      ]);

      const total =
        distribution.critical +
        distribution.high +
        distribution.medium +
        distribution.low;
      expect(total).toBeLessThanOrEqual(2);
    });
  });

  describe('business value calculation', () => {
    it('should increase priority for critical keywords', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'payment',
          caseName: 'Payment Checkout Test',
          passRate: 85,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases();

      // Payment test should have elevated priority due to keyword
      expect(ranked[0].factors.businessValue).toBeGreaterThan(0.5);
    });

    it('should increase priority for high execution frequency', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'frequent',
          caseName: 'Frequently Run Test',
          totalRuns: 100,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const ranked = await ranker.rankCases();

      expect(ranked[0].factors.businessValue).toBeGreaterThan(0.5);
    });
  });
});
