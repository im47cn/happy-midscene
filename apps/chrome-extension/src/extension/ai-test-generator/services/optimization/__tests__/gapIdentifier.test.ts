/**
 * GapIdentifier Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../../types/analytics';
import { analyticsStorage } from '../../analytics/analyticsStorage';
import { gapIdentifier } from '../gapIdentifier';

// Mock analytics storage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getRecentExecutions: vi.fn(),
    getAllCaseStats: vi.fn(),
  },
}));

describe('GapIdentifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createExecution = (
    overrides: Partial<ExecutionRecord> = {},
  ): ExecutionRecord => ({
    id: 'exec-1',
    caseId: 'case-1',
    caseName: 'Test Case',
    startTime: Date.now(),
    endTime: Date.now() + 30000,
    duration: 30000,
    status: 'passed',
    steps: [
      {
        index: 0,
        description: 'Open page',
        status: 'passed',
        duration: 1000,
        retryCount: 0,
      },
      {
        index: 1,
        description: 'Click button',
        status: 'passed',
        duration: 500,
        retryCount: 0,
      },
    ],
    environment: {
      browser: 'Chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    },
    ...overrides,
  });

  describe('identify', () => {
    it('should identify all features as gaps when no executions', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const gaps = await gapIdentifier.identify();

      // When there are no executions, all features have 0% coverage
      // so all features with required coverage > 0 should be identified as gaps
      expect(gaps.length).toBeGreaterThan(0);
      // All gaps should have 0 current coverage
      for (const gap of gaps) {
        expect(gap.currentCoverage).toBe(0);
      }
    });

    it('should identify gaps based on keyword matching', async () => {
      const executions = [
        createExecution({
          steps: [
            {
              index: 0,
              description: 'Login to the system',
              status: 'passed',
              duration: 1000,
              retryCount: 0,
            },
            {
              index: 1,
              description: 'Navigate to dashboard',
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

      const gaps = await gapIdentifier.identify();

      // Should identify gaps for features not covered (like password reset)
      expect(gaps.length).toBeGreaterThan(0);
    });

    it('should sort gaps by risk level', async () => {
      const executions = [createExecution()];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );

      const gaps = await gapIdentifier.identify();

      // Gaps should be sorted by risk (critical first)
      for (let i = 1; i < gaps.length; i++) {
        const prevRisk = gaps[i - 1].riskLevel;
        const currRisk = gaps[i].riskLevel;
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        expect(riskOrder[prevRisk]).toBeLessThanOrEqual(riskOrder[currRisk]);
      }
    });
  });

  describe('calculateCoverage', () => {
    it('should calculate coverage for known feature', async () => {
      const executions = [
        createExecution({
          steps: [
            {
              index: 0,
              description: 'Login successfully',
              status: 'passed',
              duration: 1000,
              retryCount: 0,
            },
          ],
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(
        executions,
      );

      const coverage = await gapIdentifier.calculateCoverage('auth-login');

      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThanOrEqual(100);
    });

    it('should return 0 for unknown feature', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const coverage = await gapIdentifier.calculateCoverage('unknown-feature');

      expect(coverage).toBe(0);
    });
  });

  describe('suggestCases', () => {
    it('should suggest cases for coverage gaps', async () => {
      const gap = {
        feature: '登录功能',
        currentCoverage: 20,
        recommendedCoverage: 80,
        missingScenarios: [],
        riskLevel: 'high' as const,
      };

      const scenarios = await gapIdentifier.suggestCases(gap);

      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios[0]).toHaveProperty('description');
      expect(scenarios[0]).toHaveProperty('suggestedCase');
    });

    it('should return empty for unknown feature', async () => {
      const gap = {
        feature: 'Unknown Feature',
        currentCoverage: 0,
        recommendedCoverage: 100,
        missingScenarios: [],
        riskLevel: 'critical' as const,
      };

      const scenarios = await gapIdentifier.suggestCases(gap);

      expect(scenarios).toEqual([]);
    });
  });

  describe('assessRisk', () => {
    it('should return critical for large gap', async () => {
      const gap = {
        feature: 'Test',
        currentCoverage: 10,
        recommendedCoverage: 80,
        missingScenarios: [],
        riskLevel: 'low' as const,
      };

      const risk = await gapIdentifier.assessRisk(gap);

      expect(risk).toBe('critical');
    });

    it('should return low for small gap', async () => {
      const gap = {
        feature: 'Test',
        currentCoverage: 75,
        recommendedCoverage: 80,
        missingScenarios: [],
        riskLevel: 'critical' as const,
      };

      const risk = await gapIdentifier.assessRisk(gap);

      expect(risk).toBe('low');
    });
  });
});
