/**
 * Analysis Engine Tests
 * Tests for analytics computations and insights
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  DailyStats,
  CaseStats,
  ExecutionRecord,
} from '../../../types/analytics';

// Mock analyticsStorage
vi.mock('../analyticsStorage', () => ({
  analyticsStorage: {
    getDailyStatsRange: vi.fn().mockResolvedValue([]),
    getAllCaseStats: vi.fn().mockResolvedValue([]),
    getFlakyCases: vi.fn().mockResolvedValue([]),
    getFailedExecutions: vi.fn().mockResolvedValue([]),
  },
}));

import { analysisEngine } from '../analysisEngine';
import { analyticsStorage } from '../analyticsStorage';

describe('AnalysisEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDateRange', () => {
    it('should return today\'s date range for "today"', () => {
      const { startDate, endDate } = analysisEngine.getDateRange('today');

      const today = new Date().toISOString().split('T')[0];
      expect(startDate).toBe(today);
      expect(endDate).toBe(today);
    });

    it('should return 7 day range for "7days"', () => {
      const { startDate, endDate } = analysisEngine.getDateRange('7days');

      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);

      expect(startDate).toBe(start.toISOString().split('T')[0]);
      expect(endDate).toBe(end.toISOString().split('T')[0]);
    });

    it('should return 30 day range for "30days"', () => {
      const { startDate, endDate } = analysisEngine.getDateRange('30days');

      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);

      expect(startDate).toBe(start.toISOString().split('T')[0]);
      expect(endDate).toBe(end.toISOString().split('T')[0]);
    });

    it('should return custom range when provided', () => {
      const customRange = { startDate: '2024-01-01', endDate: '2024-01-31' };
      const result = analysisEngine.getDateRange('custom', customRange);

      expect(result).toEqual(customRange);
    });
  });

  describe('getDashboardOverview', () => {
    const createDailyStats = (overrides?: Partial<DailyStats>): DailyStats => ({
      date: '2024-01-15',
      totalExecutions: 100,
      passed: 85,
      failed: 10,
      skipped: 3,
      error: 2,
      avgDuration: 15000,
      failuresByType: {
        locator_failed: 5,
        assertion_failed: 3,
        timeout: 1,
        network_error: 0,
        script_error: 1,
        unknown: 0,
      },
      ...overrides,
    });

    const createCaseStats = (overrides?: Partial<CaseStats>): CaseStats => ({
      caseId: 'case-1',
      caseName: 'Test Case 1',
      totalRuns: 50,
      passRate: 90,
      avgDuration: 12000,
      lastRun: Date.now(),
      stabilityScore: 85,
      isFlaky: false,
      recentResults: ['passed', 'passed', 'passed', 'failed', 'passed'],
      ...overrides,
    });

    it('should return correct overview for single day stats', async () => {
      const dailyStats = [createDailyStats()];
      const caseStats = [createCaseStats()];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const overview = await analysisEngine.getDashboardOverview('today');

      expect(overview.totalExecutions).toBe(100);
      expect(overview.passRate).toBe(85);
      expect(overview.avgDuration).toBe(15000);
      expect(overview.totalCases).toBe(1);
      expect(overview.stableCases).toBe(1);
      expect(overview.flakyCases).toBe(0);
    });

    it('should aggregate stats from multiple days', async () => {
      const dailyStats = [
        createDailyStats({ date: '2024-01-14', totalExecutions: 50, passed: 45 }),
        createDailyStats({ date: '2024-01-15', totalExecutions: 50, passed: 40 }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const overview = await analysisEngine.getDashboardOverview('7days');

      expect(overview.totalExecutions).toBe(100);
      expect(overview.passRate).toBe(85); // (45 + 40) / 100 * 100
    });

    it('should categorize cases correctly', async () => {
      const caseStats = [
        createCaseStats({ stabilityScore: 90, isFlaky: false }), // stable
        createCaseStats({ stabilityScore: 60, isFlaky: true }),  // flaky
        createCaseStats({ stabilityScore: 40, isFlaky: false }), // unstable
        createCaseStats({ stabilityScore: 85, isFlaky: false }), // stable
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const overview = await analysisEngine.getDashboardOverview('7days');

      expect(overview.totalCases).toBe(4);
      expect(overview.stableCases).toBe(2);
      expect(overview.flakyCases).toBe(1);
      expect(overview.unstableCases).toBe(1);
    });

    it('should aggregate failure types correctly', async () => {
      const dailyStats = [
        createDailyStats({
          failuresByType: {
            locator_failed: 5,
            assertion_failed: 3,
            timeout: 1,
            network_error: 0,
            script_error: 1,
            unknown: 0,
          },
        }),
        createDailyStats({
          failuresByType: {
            locator_failed: 3,
            assertion_failed: 2,
            timeout: 0,
            network_error: 1,
            script_error: 0,
            unknown: 1,
          },
        }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const overview = await analysisEngine.getDashboardOverview('7days');

      expect(overview.failuresByType.locator_failed).toBe(8);
      expect(overview.failuresByType.assertion_failed).toBe(5);
      expect(overview.failuresByType.timeout).toBe(1);
      expect(overview.failuresByType.network_error).toBe(1);
    });
  });

  describe('calculateHealthScore', () => {
    it('should return high score for high pass rate and stability', async () => {
      const dailyStats = [{
        date: '2024-01-15',
        totalExecutions: 100,
        passed: 95,
        failed: 5,
        skipped: 0,
        error: 0,
        avgDuration: 20000,
        failuresByType: {
          locator_failed: 3,
          assertion_failed: 2,
          timeout: 0,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      }];

      const caseStats = [{
        caseId: 'case-1',
        caseName: 'Test',
        totalRuns: 20,
        passRate: 95,
        avgDuration: 20000,
        lastRun: Date.now(),
        stabilityScore: 92,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'passed', 'passed', 'failed'],
      }];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const score = await analysisEngine.calculateHealthScore();

      expect(score.overall).toBeGreaterThan(80);
      expect(score.components.passRate).toBeGreaterThan(90);
      expect(score.components.stability).toBeGreaterThan(90);
    });

    it('should return low score for low pass rate', async () => {
      const dailyStats = [{
        date: '2024-01-15',
        totalExecutions: 100,
        passed: 30,
        failed: 70,
        skipped: 0,
        error: 0,
        avgDuration: 20000,
        failuresByType: {
          locator_failed: 40,
          assertion_failed: 20,
          timeout: 10,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      }];

      const caseStats = [{
        caseId: 'case-1',
        caseName: 'Test',
        totalRuns: 20,
        passRate: 30,
        avgDuration: 20000,
        lastRun: Date.now(),
        stabilityScore: 35,
        isFlaky: true,
        recentResults: ['failed', 'passed', 'failed', 'failed', 'passed'],
      }];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const score = await analysisEngine.calculateHealthScore();

      expect(score.overall).toBeLessThan(50);
      expect(score.components.passRate).toBeLessThan(40);
    });

    it('should handle empty data gracefully', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const score = await analysisEngine.calculateHealthScore();

      expect(score.overall).toBeDefined();
      expect(score.components.passRate).toBe(100);
      expect(score.components.coverage).toBe(0);
    });
  });

  describe('analyzeFailureHotspots', () => {
    it('should return empty array when no failures', async () => {
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const hotspots = await analysisEngine.analyzeFailureHotspots();

      expect(hotspots).toEqual([]);
    });

    it('should group and rank failures by step description', async () => {
      const failures: ExecutionRecord[] = [
        {
          id: 'exec-1',
          caseId: 'case-1',
          caseName: 'Test 1',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 5000,
          status: 'failed',
          steps: [
            { index: 0, description: 'Click login button', status: 'passed', duration: 1000, retryCount: 0 },
            { index: 1, description: 'Enter username', status: 'failed', duration: 1000, retryCount: 0 },
          ],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 1 },
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
        {
          id: 'exec-2',
          caseId: 'case-2',
          caseName: 'Test 2',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 5000,
          status: 'failed',
          steps: [
            { index: 0, description: 'Enter username', status: 'failed', duration: 1000, retryCount: 0 },
          ],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
        {
          id: 'exec-3',
          caseId: 'case-3',
          caseName: 'Test 3',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 5000,
          status: 'failed',
          steps: [
            { index: 0, description: 'Submit form', status: 'failed', duration: 1000, retryCount: 0 },
          ],
          failure: { type: 'assertion_failed', message: 'Failed', stepIndex: 0 },
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
      ];

      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue(failures);

      const hotspots = await analysisEngine.analyzeFailureHotspots();

      expect(hotspots.length).toBe(2);
      expect(hotspots[0].description).toBe('Enter username');
      expect(hotspots[0].failureCount).toBe(2);
      expect(hotspots[0].percentage).toBeCloseTo(66.67, 1);
    });

    it('should respect limit parameter', async () => {
      const failures: ExecutionRecord[] = Array.from({ length: 20 }, (_, i) => ({
        id: `exec-${i}`,
        caseId: `case-${i}`,
        caseName: `Test ${i}`,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 5000,
        status: 'failed' as const,
        steps: [{ index: 0, description: `Step ${i}`, status: 'failed' as const, duration: 1000, retryCount: 0 }],
        failure: { type: 'locator_failed' as const, message: 'Failed', stepIndex: 0 },
        environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
      }));

      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue(failures);

      const hotspots = await analysisEngine.analyzeFailureHotspots(5);

      expect(hotspots.length).toBe(5);
    });
  });

  describe('getCaseStatsSorted', () => {
    const cases: CaseStats[] = [
      {
        caseId: 'case-1',
        caseName: 'Test A',
        totalRuns: 30,
        passRate: 80,
        avgDuration: 10000,
        lastRun: Date.now() - 86400000,
        stabilityScore: 75,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'failed', 'passed', 'passed'],
      },
      {
        caseId: 'case-2',
        caseName: 'Test B',
        totalRuns: 50,
        passRate: 95,
        avgDuration: 15000,
        lastRun: Date.now(),
        stabilityScore: 90,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
      },
      {
        caseId: 'case-3',
        caseName: 'Test C',
        totalRuns: 20,
        passRate: 60,
        avgDuration: 20000,
        lastRun: Date.now() - 3600000,
        stabilityScore: 55,
        isFlaky: true,
        recentResults: ['passed', 'failed', 'passed', 'failed', 'passed'],
      },
    ];

    beforeEach(() => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([...cases]);
    });

    it('should sort by lastRun descending by default', async () => {
      const sorted = await analysisEngine.getCaseStatsSorted();

      expect(sorted[0].caseId).toBe('case-2');
      expect(sorted[2].caseId).toBe('case-1');
    });

    it('should sort by passRate descending', async () => {
      const sorted = await analysisEngine.getCaseStatsSorted('passRate', false);

      expect(sorted[0].passRate).toBe(95);
      expect(sorted[2].passRate).toBe(60);
    });

    it('should sort by passRate ascending', async () => {
      const sorted = await analysisEngine.getCaseStatsSorted('passRate', true);

      expect(sorted[0].passRate).toBe(60);
      expect(sorted[2].passRate).toBe(95);
    });

    it('should sort by stability', async () => {
      const sorted = await analysisEngine.getCaseStatsSorted('stability', false);

      expect(sorted[0].stabilityScore).toBe(90);
      expect(sorted[2].stabilityScore).toBe(55);
    });

    it('should sort by totalRuns', async () => {
      const sorted = await analysisEngine.getCaseStatsSorted('totalRuns', false);

      expect(sorted[0].totalRuns).toBe(50);
      expect(sorted[2].totalRuns).toBe(20);
    });
  });

  describe('getFlakyCases', () => {
    it('should return flaky cases from storage', async () => {
      const flakyCases: CaseStats[] = [
        {
          caseId: 'case-1',
          caseName: 'Flaky Test',
          totalRuns: 30,
          passRate: 60,
          avgDuration: 10000,
          lastRun: Date.now(),
          stabilityScore: 55,
          isFlaky: true,
          recentResults: ['passed', 'failed', 'passed', 'failed', 'passed'],
        },
      ];

      vi.mocked(analyticsStorage.getFlakyCases).mockResolvedValue(flakyCases);

      const result = await analysisEngine.getFlakyCases();

      expect(result).toEqual(flakyCases);
      expect(analyticsStorage.getFlakyCases).toHaveBeenCalled();
    });
  });
});
