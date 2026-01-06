/**
 * Score Calculator Tests
 * Tests for multi-dimensional scoring calculations
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { CaseStats, ExecutionRecord } from '../../../types/analytics';
import type {
  ChangeInfo,
  RecommendContext,
} from '../../../types/recommendation';
import { DEFAULT_PRIORITY_CONFIG } from '../../../types/recommendation';
import { ScoreCalculator } from '../scoreCalculator';

describe('ScoreCalculator', () => {
  let context: RecommendContext;

  const createCaseStats = (overrides?: Partial<CaseStats>): CaseStats => ({
    caseId: 'case-1',
    caseName: 'Login Test Case',
    totalRuns: 50,
    passRate: 85,
    avgDuration: 12000,
    lastRun: Date.now() - 3600000, // 1 hour ago
    stabilityScore: 80,
    isFlaky: false,
    recentResults: ['passed', 'passed', 'passed', 'passed', 'failed'],
    ...overrides,
  });

  beforeEach(() => {
    context = {
      caseStats: [],
      recentExecutions: [],
      config: DEFAULT_PRIORITY_CONFIG,
      changes: [],
    };
  });

  describe('calculateRiskScore', () => {
    it('should return high risk for unstable tests', () => {
      // stabilityRisk = (100 - 30) / 100 = 0.7, weighted by 0.4 = 0.28
      // With no recent failures and not flaky: 0.28 + 0 + 0 = 0.28
      context.caseStats = [
        createCaseStats({
          stabilityScore: 30,
          isFlaky: false,
          recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
        }),
      ];
      const calculator = new ScoreCalculator(context);
      const risk = calculator.calculateRiskScore('case-1');

      // risk = stabilityRisk * 0.4 + recentFailureRisk * 0.4 + flakyRisk * 0.2
      // 0.7 * 0.4 + 0 * 0.4 + 0 * 0.2 = 0.28
      expect(risk).toBeCloseTo(0.28, 2);
    });

    it('should return high risk for flaky tests', () => {
      // stabilityRisk = 0.3, flakyRisk = 0.5
      // risk = 0.3 * 0.4 + 0 * 0.4 + 0.5 * 0.2 = 0.12 + 0 + 0.1 = 0.22
      context.caseStats = [
        createCaseStats({
          stabilityScore: 70,
          isFlaky: true,
          recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
        }),
      ];
      const calculator = new ScoreCalculator(context);
      const risk = calculator.calculateRiskScore('case-1');

      expect(risk).toBeCloseTo(0.22, 2);
    });

    it('should return high risk for recently failed tests', () => {
      // 2 recent failures out of 5: recentFailureRisk = min(2/5, 1) = 0.4
      // risk = 0.2 * 0.4 + 0.4 * 0.4 + 0 * 0.2 = 0.08 + 0.16 + 0 = 0.24
      context.caseStats = [
        createCaseStats({
          stabilityScore: 80,
          isFlaky: false,
          recentResults: ['failed', 'failed', 'passed', 'passed', 'passed'],
        }),
      ];
      const calculator = new ScoreCalculator(context);
      const risk = calculator.calculateRiskScore('case-1');

      expect(risk).toBeCloseTo(0.24, 2);
    });

    it('should return low risk for stable tests', () => {
      // stabilityRisk = 0.05, no failures, not flaky
      // risk = 0.05 * 0.4 + 0 * 0.4 + 0 * 0.2 = 0.02
      context.caseStats = [
        createCaseStats({
          stabilityScore: 95,
          isFlaky: false,
          recentResults: ['passed', 'passed', 'passed', 'passed', 'passed'],
        }),
      ];
      const calculator = new ScoreCalculator(context);
      const risk = calculator.calculateRiskScore('case-1');

      expect(risk).toBeLessThan(0.1);
    });
  });

  describe('calculateRecencyScore', () => {
    it('should return high score for very old cases', () => {
      // Need MORE than 90 days for VERY_LONG_NOT_RUN threshold
      const ninetyOneDaysAgo = Date.now() - 91 * 24 * 60 * 60 * 1000;
      context.caseStats = [createCaseStats({ lastRun: ninetyOneDaysAgo })];
      const calculator = new ScoreCalculator(context);
      const recency = calculator.calculateRecencyScore('case-1');

      expect(recency).toBe(1);
    });

    it('should return high score for long-not-run cases', () => {
      // Need MORE than 30 days for LONG_NOT_RUN threshold
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      context.caseStats = [createCaseStats({ lastRun: thirtyOneDaysAgo })];
      const calculator = new ScoreCalculator(context);
      const recency = calculator.calculateRecencyScore('case-1');

      expect(recency).toBe(0.8);
    });

    it('should return low score for recently run cases', () => {
      const oneHourAgo = Date.now() - 3600000;
      context.caseStats = [createCaseStats({ lastRun: oneHourAgo })];
      const calculator = new ScoreCalculator(context);
      const recency = calculator.calculateRecencyScore('case-1');

      expect(recency).toBeLessThan(0.5);
    });
  });

  describe('calculateChangeImpactScore', () => {
    it('should return high impact when changes match case name', () => {
      context.caseStats = [
        createCaseStats({ caseName: 'Login Authentication Test' }),
      ];
      context.changes = [
        {
          type: 'file',
          target: 'authentication',
          description: 'Auth module changed',
        },
      ];
      const calculator = new ScoreCalculator(context);
      const impact = calculator.calculateChangeImpactScore('case-1');

      expect(impact).toBe(1);
    });

    it('should return zero impact when no changes', () => {
      context.caseStats = [createCaseStats()];
      const calculator = new ScoreCalculator(context);
      const impact = calculator.calculateChangeImpactScore('case-1');

      expect(impact).toBe(0);
    });

    it('should return zero impact when changes do not match', () => {
      context.caseStats = [createCaseStats({ caseName: 'Login Test' })];
      context.changes = [
        {
          type: 'file',
          target: 'payment',
          description: 'Payment module changed',
        },
      ];
      const calculator = new ScoreCalculator(context);
      const impact = calculator.calculateChangeImpactScore('case-1');

      expect(impact).toBe(0);
    });
  });

  describe('calculateCoverageScore', () => {
    it('should return high score for high pass rate cases', () => {
      context.caseStats = [createCaseStats({ passRate: 95 })];
      const calculator = new ScoreCalculator(context);
      const coverage = calculator.calculateCoverageScore('case-1');

      expect(coverage).toBeGreaterThan(0.9);
    });

    it('should return low score for low pass rate cases', () => {
      context.caseStats = [createCaseStats({ passRate: 40 })];
      const calculator = new ScoreCalculator(context);
      const coverage = calculator.calculateCoverageScore('case-1');

      expect(coverage).toBeLessThan(0.5);
    });
  });

  describe('calculateBusinessValueScore', () => {
    it('should return high score for login tests', () => {
      context.caseStats = [
        createCaseStats({ caseName: 'User Login Authentication Test' }),
      ];
      const calculator = new ScoreCalculator(context);
      const value = calculator.calculateBusinessValueScore('case-1');

      expect(value).toBeGreaterThan(0.6);
    });

    it('should return high score for payment tests', () => {
      context.caseStats = [
        createCaseStats({ caseName: 'Checkout Payment Process Test' }),
      ];
      const calculator = new ScoreCalculator(context);
      const value = calculator.calculateBusinessValueScore('case-1');

      expect(value).toBeGreaterThan(0.6);
    });

    it('should return moderate score for frequently run tests', () => {
      context.caseStats = [
        createCaseStats({ caseName: 'Generic Test', totalRuns: 100 }),
      ];
      const calculator = new ScoreCalculator(context);
      const value = calculator.calculateBusinessValueScore('case-1');

      expect(value).toBeGreaterThan(0.5);
    });

    it('should return base score for unknown tests', () => {
      context.caseStats = [
        createCaseStats({ caseName: 'Some Random Test', totalRuns: 5 }),
      ];
      const calculator = new ScoreCalculator(context);
      const value = calculator.calculateBusinessValueScore('case-1');

      expect(value).toBe(0.5);
    });
  });

  describe('calculateRecommendScore', () => {
    it('should return score between 0 and 100', () => {
      context.caseStats = [createCaseStats()];
      const calculator = new ScoreCalculator(context);
      const { score } = calculator.calculateRecommendScore('case-1');

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return reasons explaining the score', () => {
      context.caseStats = [
        createCaseStats({ stabilityScore: 30, isFlaky: false }),
      ];
      const calculator = new ScoreCalculator(context);
      const { reasons } = calculator.calculateRecommendScore('case-1');

      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toHaveProperty('type');
      expect(reasons[0]).toHaveProperty('description');
      expect(reasons[0]).toHaveProperty('weight');
    });

    it('should include flaky reason for flaky tests', () => {
      context.caseStats = [createCaseStats({ isFlaky: true })];
      const calculator = new ScoreCalculator(context);
      const { reasons } = calculator.calculateRecommendScore('case-1');

      const flakyReason = reasons.find((r) => r.type === 'high_risk');
      expect(flakyReason).toBeDefined();
      expect(flakyReason?.description).toContain('Flaky');
    });

    it('should include recent failure reason for recently failed tests', () => {
      context.caseStats = [
        createCaseStats({
          recentResults: ['failed', 'failed', 'passed', 'passed', 'passed'],
        }),
      ];
      const calculator = new ScoreCalculator(context);
      const { reasons } = calculator.calculateRecommendScore('case-1');

      const failureReason = reasons.find((r) => r.type === 'recent_failure');
      expect(failureReason).toBeDefined();
    });

    it('should include long not run reason for old tests', () => {
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      context.caseStats = [createCaseStats({ lastRun: ninetyDaysAgo })];
      const calculator = new ScoreCalculator(context);
      const { reasons } = calculator.calculateRecommendScore('case-1');

      const recencyReason = reasons.find((r) => r.type === 'long_not_run');
      expect(recencyReason).toBeDefined();
    });
  });

  describe('Static utility methods', () => {
    it('calculateRiskScore should work standalone', () => {
      const caseStat = createCaseStats({ stabilityScore: 50, isFlaky: false });
      const risk = ScoreCalculator.calculateRiskScore(caseStat);

      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it('calculateRecencyScore should work standalone', () => {
      const caseStat = createCaseStats({
        lastRun: Date.now() - 100 * 24 * 60 * 60 * 1000,
      });
      const recency = ScoreCalculator.calculateRecencyScore(caseStat);

      expect(recency).toBe(1);
    });
  });
});
