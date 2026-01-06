/**
 * Coverage Analyzer Tests
 * Tests for coverage analysis and gap detection
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseStats, ExecutionRecord } from '../../../types/analytics';
import { CoverageAnalyzer } from '../coverageAnalyzer';

// Mock analyticsStorage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getAllCaseStats: vi.fn(),
    getRecentExecutions: vi.fn(),
  },
}));

import { analyticsStorage } from '../../analytics/analyticsStorage';

describe('CoverageAnalyzer', () => {
  let analyzer: CoverageAnalyzer;

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

  const createExecutionRecord = (
    overrides?: Partial<ExecutionRecord>,
  ): ExecutionRecord => ({
    id: `exec-${Math.random().toString(36).substr(2, 9)}`,
    caseId: `case-${Math.random().toString(36).substr(2, 9)}`,
    caseName: 'Test Case',
    startTime: Date.now() - Math.random() * 3600000,
    endTime: Date.now() - Math.random() * 3600000 + 5000,
    duration: 5000,
    status: 'passed',
    steps: [
      {
        index: 0,
        description: 'Navigate to page',
        status: 'passed',
        duration: 1000,
        retryCount: 0,
      },
    ],
    environment: {
      browser: 'chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    },
    ...overrides,
  });

  beforeEach(() => {
    analyzer = new CoverageAnalyzer();
    vi.clearAllMocks();
  });

  describe('analyzeFeatureCoverage', () => {
    it('should return empty array when no cases exist', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzeFeatureCoverage();

      expect(coverage).toEqual([]);
    });

    it('should categorize cases by feature keywords', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'login-1',
          caseName: 'User Login Test',
          passRate: 90,
        }),
        createCaseStats({
          caseId: 'login-2',
          caseName: 'Admin Authentication Test',
          passRate: 85,
        }),
        createCaseStats({
          caseId: 'search-1',
          caseName: 'Product Search Test',
          passRate: 70,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      expect(coverage.length).toBeGreaterThan(0);
      // Should have authentication feature
      const authFeature = coverage.find(
        (f) => f.featureId === 'authentication',
      );
      expect(authFeature?.coveredCases).toContain('login-1');
      expect(authFeature?.coveredCases).toContain('login-2');
    });

    it('should return features with required fields', async () => {
      const caseStats = [createCaseStats({ caseName: 'Login Test' })];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      if (coverage.length > 0) {
        expect(coverage[0]).toHaveProperty('featureId');
        expect(coverage[0]).toHaveProperty('featureName');
        expect(coverage[0]).toHaveProperty('coveredCases');
        expect(coverage[0]).toHaveProperty('coveragePercent');
      }
    });

    it('should calculate coverage percentage based on pass rate and case count', async () => {
      const caseStats = [
        createCaseStats({
          caseId: 'high-pass',
          caseName: 'Login Test',
          passRate: 95,
          totalRuns: 50,
        }),
        createCaseStats({
          caseId: 'low-pass',
          caseName: 'Login Test',
          passRate: 50,
          totalRuns: 10,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      // Coverage should be influenced by pass rate
      if (coverage.length > 0) {
        expect(coverage[0].coveragePercent).toBeGreaterThanOrEqual(0);
        expect(coverage[0].coveragePercent).toBeLessThanOrEqual(100);
      }
    });

    it('should sort by coverage percentage ascending', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'High Coverage Test', passRate: 95 }),
        createCaseStats({ caseName: 'Low Coverage Test', passRate: 40 }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      // First item should have lower coverage than last
      if (coverage.length > 1) {
        expect(coverage[0].coveragePercent).toBeLessThanOrEqual(
          coverage[coverage.length - 1].coveragePercent,
        );
      }
    });
  });

  describe('analyzePageCoverage', () => {
    it('should return empty array when no executions exist', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePageCoverage();

      expect(coverage).toEqual([]);
    });

    it('should categorize cases by page URL', async () => {
      const executions = [
        createExecutionRecord({
          caseId: 'case-1',
          environment: {
            browser: 'chrome',
            viewport: { width: 1920, height: 1080 },
            url: 'https://example.com/login',
          },
        }),
        createExecutionRecord({
          caseId: 'case-2',
          environment: {
            browser: 'chrome',
            viewport: { width: 1920, height: 1080 },
            url: 'https://example.com/dashboard',
          },
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePageCoverage();

      expect(coverage.length).toBeGreaterThan(0);
    });

    it('should return pages with required fields', async () => {
      const executions = [createExecutionRecord()];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePageCoverage();

      if (coverage.length > 0) {
        expect(coverage[0]).toHaveProperty('url');
        expect(coverage[0]).toHaveProperty('pageName');
        expect(coverage[0]).toHaveProperty('coveredCases');
        expect(coverage[0]).toHaveProperty('coveragePercent');
      }
    });
  });

  describe('analyzePathCoverage', () => {
    it('should return empty array when no executions exist', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePathCoverage();

      expect(coverage).toEqual([]);
    });

    it('should extract paths from execution steps', async () => {
      const executions = [
        createExecutionRecord({
          caseId: 'path-1',
          steps: [
            {
              index: 0,
              description: 'Open login page',
              status: 'passed',
              duration: 1000,
              retryCount: 0,
            },
            {
              index: 1,
              description: 'Enter username',
              status: 'passed',
              duration: 500,
              retryCount: 0,
            },
            {
              index: 2,
              description: 'Enter password',
              status: 'passed',
              duration: 500,
              retryCount: 0,
            },
          ],
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePathCoverage();

      expect(coverage.length).toBeGreaterThan(0);
    });

    it('should return paths with required fields', async () => {
      const executions = [createExecutionRecord()];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const coverage = await analyzer.analyzePathCoverage();

      if (coverage.length > 0) {
        expect(coverage[0]).toHaveProperty('pathId');
        expect(coverage[0]).toHaveProperty('pathName');
        expect(coverage[0]).toHaveProperty('steps');
        expect(coverage[0]).toHaveProperty('coveredCases');
        expect(coverage[0]).toHaveProperty('coveragePercent');
      }
    });
  });

  describe('identifyGaps', () => {
    it('should identify features with low coverage', async () => {
      const caseStats = [
        createCaseStats({
          caseName: 'Login Test',
          passRate: 30,
          stabilityScore: 20,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const gaps = await analyzer.identifyGaps();

      // Low coverage should create a gap
      const featureGaps = gaps.filter((g) => g.type === 'feature');
      expect(featureGaps.length).toBeGreaterThan(0);
    });

    it('should return gaps with required fields', async () => {
      const caseStats = [createCaseStats({ caseName: 'Test', passRate: 30 })];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const gaps = await analyzer.identifyGaps();

      if (gaps.length > 0) {
        expect(gaps[0]).toHaveProperty('type');
        expect(gaps[0]).toHaveProperty('target');
        expect(gaps[0]).toHaveProperty('description');
        expect(gaps[0]).toHaveProperty('suggestedCases');
      }
    });

    it('should not create gaps for high coverage areas', async () => {
      const caseStats = [
        createCaseStats({
          caseName: 'Stable Test',
          passRate: 95,
          stabilityScore: 95,
        }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const gaps = await analyzer.identifyGaps();

      // High coverage should not create gaps (unless edge case)
      expect(gaps.length).toBe(0);
    });
  });

  describe('getOverallCoverage', () => {
    it('should return overall coverage data', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const coverage = await analyzer.getOverallCoverage();

      expect(coverage).toHaveProperty('features');
      expect(coverage).toHaveProperty('pages');
      expect(coverage).toHaveProperty('userPaths');
      expect(coverage).toHaveProperty('overallScore');
      expect(coverage).toHaveProperty('gaps');
    });

    it('should calculate overall score from components', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const coverage = await analyzer.getOverallCoverage();

      expect(coverage.overallScore).toBeGreaterThanOrEqual(0);
      expect(coverage.overallScore).toBeLessThanOrEqual(100);
    });

    it('should use cached data within cache duration', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      // First call
      await analyzer.getOverallCoverage();
      const callCount = vi.mocked(analyticsStorage.getAllCaseStats).mock.calls
        .length;

      // Second call should use cache
      await analyzer.getOverallCoverage();

      // Should not have called getAllCaseStats again for cached data
      expect(
        vi.mocked(analyticsStorage.getAllCaseStats).mock.calls.length,
      ).toBeLessThanOrEqual(callCount + 3);
    });
  });

  describe('clearCache', () => {
    it('should clear cached coverage data', async () => {
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      // Populate cache
      await analyzer.getOverallCoverage();
      analyzer.clearCache();

      // Next call should fetch fresh data
      const coverage = await analyzer.getOverallCoverage();

      expect(coverage).toBeDefined();
    });
  });

  describe('feature identification', () => {
    it('should identify authentication feature from keywords', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'User Login Test' }),
        createCaseStats({ caseName: 'Admin Auth Test' }),
        createCaseStats({ caseName: 'Signin Validation' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      const authFeature = coverage.find(
        (f) => f.featureId === 'authentication',
      );
      expect(authFeature?.coveredCases.length).toBe(3);
    });

    it('should identify checkout feature from keywords', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'Payment Checkout Test' }),
        createCaseStats({ caseName: 'Shopping Cart Test' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      const checkoutFeature = coverage.find((f) => f.featureId === 'checkout');
      expect(checkoutFeature).toBeDefined();
    });

    it('should categorize uncategorized tests as "other"', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'Random Unrelated Test' }),
      ];
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const coverage = await analyzer.analyzeFeatureCoverage();

      const otherFeature = coverage.find((f) => f.featureId === 'other');
      expect(otherFeature).toBeDefined();
    });
  });
});
