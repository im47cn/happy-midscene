/**
 * Optimization Integration Tests
 * End-to-end tests for the optimization analysis system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { efficiencyAnalyzer } from '../efficiencyAnalyzer';
import { redundancyDetector } from '../redundancyDetector';
import { gapIdentifier } from '../gapIdentifier';
import { stabilityAnalyzer } from '../stabilityAnalyzer';
import { maintainabilityAnalyzer } from '../maintainabilityAnalyzer';
import { recommendEngine } from '../recommendEngine';
import { optimizationReport } from '../report';
import { analyticsStorage } from '../../analytics/analyticsStorage';
import type { ExecutionRecord, CaseStats } from '../../../types/analytics';

// Mock analytics storage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getRecentExecutions: vi.fn(),
    getAllCaseStats: vi.fn(),
    getFailedExecutions: vi.fn(),
    getExecutionsByCaseId: vi.fn(),
  },
}));

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('Optimization Integration Tests', () => {
  // Helper to set up all mocks for a test
  const setupMocks = (executions: ExecutionRecord[], caseStats: CaseStats[]) => {
    vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);
    vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
    vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue(
      executions.filter((e) => e.status === 'failed'),
    );
    vi.mocked(analyticsStorage.getExecutionsByCaseId).mockImplementation(
      async (caseId: string) => executions.filter((e) => e.caseId === caseId),
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  // Helper to create mock execution records
  const createExecution = (
    overrides: Partial<ExecutionRecord> = {},
  ): ExecutionRecord => ({
    id: `exec-${Date.now()}-${Math.random()}`,
    caseId: 'case-1',
    caseName: 'Test Case',
    startTime: Date.now() - 30000,
    endTime: Date.now(),
    duration: 30000,
    status: 'passed',
    steps: [
      { index: 0, description: 'Open page', status: 'passed', duration: 1000, retryCount: 0 },
      { index: 1, description: 'Click button', status: 'passed', duration: 500, retryCount: 0 },
      { index: 2, description: 'Verify result', status: 'passed', duration: 200, retryCount: 0 },
    ],
    environment: {
      browser: 'Chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    },
    ...overrides,
  });

  const createCaseStats = (
    overrides: Partial<CaseStats> = {},
  ): CaseStats => ({
    caseId: 'case-1',
    caseName: 'Test Case',
    totalRuns: 10,
    passRate: 80,
    avgDuration: 30000,
    lastRun: Date.now(),
    stabilityScore: 75,
    isFlaky: false,
    recentResults: ['passed', 'passed', 'failed', 'passed', 'passed'] as ('passed' | 'failed')[],
    ...overrides,
  });

  describe('End-to-End Optimization Analysis', () => {
    it('should run complete optimization analysis pipeline', async () => {
      // Setup test data
      const executions = [
        createExecution({ caseId: 'case-1', caseName: 'Login Test', duration: 60000 }),
        createExecution({ caseId: 'case-2', caseName: 'Search Test', duration: 25000 }),
        createExecution({ caseId: 'case-3', caseName: 'Checkout Test', duration: 45000 }),
        createExecution({
          caseId: 'case-1',
          caseName: 'Login Test',
          duration: 55000,
          status: 'failed',
        }),
        createExecution({ caseId: 'case-2', caseName: 'Search Test', duration: 28000 }),
      ];

      const caseStats = [
        createCaseStats({ caseId: 'case-1', caseName: 'Login Test', passRate: 80 }),
        createCaseStats({ caseId: 'case-2', caseName: 'Search Test', passRate: 100 }),
        createCaseStats({ caseId: 'case-3', caseName: 'Checkout Test', passRate: 90 }),
      ];

      setupMocks(executions, caseStats);

      // Run all analyzers
      const [efficiency, redundancy, gaps, stability, maintainability] = await Promise.all([
        efficiencyAnalyzer.analyze(),
        redundancyDetector.detect(),
        gapIdentifier.identify(),
        stabilityAnalyzer.analyze(),
        maintainabilityAnalyzer.analyze(),
      ]);

      // Verify efficiency analysis
      expect(efficiency).toHaveProperty('totalDuration');
      expect(efficiency).toHaveProperty('averageDuration');
      expect(efficiency).toHaveProperty('slowestCases');
      expect(efficiency).toHaveProperty('bottlenecks');

      // Verify redundancy detection
      expect(redundancy).toHaveProperty('redundantGroups');
      expect(redundancy).toHaveProperty('duplicateSteps');
      expect(redundancy).toHaveProperty('overlapScore');

      // Verify gap identification
      expect(gaps).toBeInstanceOf(Array);
      expect(gaps.length).toBeGreaterThan(0);

      // Verify stability analysis
      expect(stability).toHaveProperty('overallScore');
      expect(stability).toHaveProperty('flakyTests');
      expect(stability).toHaveProperty('failurePatterns');

      // Verify maintainability analysis
      expect(maintainability).toHaveProperty('overallScore');
      expect(maintainability).toHaveProperty('issues');
      expect(maintainability).toHaveProperty('bestPracticeViolations');
    });

    it('should generate recommendations from all analysis results', async () => {
      const executions = [
        createExecution({ caseId: 'case-1', duration: 120000 }), // Slow case
        createExecution({ caseId: 'case-1', duration: 115000, status: 'failed' }),
        createExecution({ caseId: 'case-1', duration: 118000 }),
        createExecution({ caseId: 'case-2', duration: 10000 }),
      ];

      const caseStats = [
        createCaseStats({
          caseId: 'case-1',
          passRate: 66,
          isFlaky: true,
          recentResults: ['passed', 'failed', 'passed'] as ('passed' | 'failed')[],
        }),
        createCaseStats({ caseId: 'case-2', passRate: 100 }),
      ];

      setupMocks(executions, caseStats);

      // Run analysis
      const [efficiency, redundancy, stability] = await Promise.all([
        efficiencyAnalyzer.analyze(),
        redundancyDetector.detect(),
        stabilityAnalyzer.analyze(),
      ]);

      // Generate recommendations
      const recommendations = await recommendEngine.generateRecommendations({
        efficiency,
        redundancy,
        stability,
      });

      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);

      // Verify recommendation structure
      for (const rec of recommendations) {
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
        expect(rec).toHaveProperty('actionItems');
      }

      // Prioritize and verify sorting
      const sorted = recommendEngine.prioritizeRecommendations(recommendations);
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

      for (let i = 1; i < sorted.length; i++) {
        const prevPriority = priorityOrder[sorted[i - 1].priority];
        const currPriority = priorityOrder[sorted[i].priority];
        expect(prevPriority).toBeLessThanOrEqual(currPriority);
      }
    });

    it('should track recommendation adoption', async () => {
      // Track adoption
      await recommendEngine.trackAdoption('rec-1', true, 'Improved test speed by 30%');
      await recommendEngine.trackAdoption('rec-2', false, 'Not applicable');

      // Verify storage
      const stored = localStorage.getItem('optimization-adoptions');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed['rec-1'].adopted).toBe(true);
      expect(parsed['rec-1'].notes).toBe('Improved test speed by 30%');
      expect(parsed['rec-2'].adopted).toBe(false);
    });
  });

  describe('Report Generation', () => {
    it('should generate complete HTML report', async () => {
      const executions = [
        createExecution({ caseId: 'case-1', duration: 50000 }),
        createExecution({ caseId: 'case-2', duration: 30000 }),
      ];

      const caseStats = [
        createCaseStats({ caseId: 'case-1' }),
        createCaseStats({ caseId: 'case-2' }),
      ];
      setupMocks(executions, caseStats);

      const [efficiency, redundancy, stability] = await Promise.all([
        efficiencyAnalyzer.analyze(),
        redundancyDetector.detect(),
        stabilityAnalyzer.analyze(),
      ]);

      const recommendations = await recommendEngine.generateRecommendations({
        efficiency,
        redundancy,
        stability,
      });

      // Generate report
      const report = await optimizationReport.generate(recommendations);

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('totalRecommendations');
      expect(report.summary).toHaveProperty('byPriority');
      expect(report.summary).toHaveProperty('byType');

      // Export HTML
      const html = optimizationReport.exportHTML(report);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('测试优化报告');
      expect(html).toContain('效率分析');
    });

    it('should generate complete Markdown report', async () => {
      const executions = [createExecution()];
      const caseStats = [createCaseStats()];
      setupMocks(executions, caseStats);

      const efficiency = await efficiencyAnalyzer.analyze();
      const recommendations = await recommendEngine.generateRecommendations({
        efficiency,
      });

      const report = await optimizationReport.generate(recommendations);
      const markdown = optimizationReport.exportMarkdown(report);

      expect(markdown).toContain('# 测试优化报告');
      expect(markdown).toContain('## 概览');
      expect(markdown).toContain('## 优化建议');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should analyze 100 executions within acceptable time', async () => {
      // Generate 100 mock executions
      const executions: ExecutionRecord[] = [];
      for (let i = 0; i < 100; i++) {
        executions.push(
          createExecution({
            caseId: `case-${i % 10}`,
            caseName: `Test Case ${i % 10}`,
            duration: 20000 + Math.random() * 40000,
          }),
        );
      }

      const caseStats: CaseStats[] = [];
      for (let i = 0; i < 10; i++) {
        caseStats.push(
          createCaseStats({
            caseId: `case-${i}`,
            caseName: `Test Case ${i}`,
          }),
        );
      }

      setupMocks(executions, caseStats);

      const startTime = performance.now();

      await Promise.all([
        efficiencyAnalyzer.analyze(),
        redundancyDetector.detect(),
        stabilityAnalyzer.analyze(),
        maintainabilityAnalyzer.analyze(),
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should handle similarity calculation for 50 cases efficiently', async () => {
      // Generate 50 cases with similar steps
      const executions: ExecutionRecord[] = [];
      for (let i = 0; i < 50; i++) {
        executions.push(
          createExecution({
            caseId: `case-${i}`,
            caseName: `Test Case ${i}`,
            steps: [
              { index: 0, description: 'Open login page', status: 'passed', duration: 1000, retryCount: 0 },
              { index: 1, description: `Enter username ${i}`, status: 'passed', duration: 500, retryCount: 0 },
              { index: 2, description: 'Click submit', status: 'passed', duration: 300, retryCount: 0 },
            ],
          }),
        );
      }

      const caseStats = executions.map((e) =>
        createCaseStats({ caseId: e.caseId, caseName: e.caseName }),
      );
      setupMocks(executions, caseStats);

      const startTime = performance.now();
      const result = await redundancyDetector.findSimilarCases(0.5);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete within 3 seconds (O(n²) comparison)
      expect(duration).toBeLessThan(3000);

      // Should find similar groups
      expect(result).toBeInstanceOf(Array);
    });

    it('should generate recommendations for large analysis quickly', async () => {
      // Create analysis with many items
      const efficiency = {
        totalDuration: 1000000,
        averageDuration: 50000,
        slowestCases: Array.from({ length: 20 }, (_, i) => ({
          caseId: `case-${i}`,
          caseName: `Slow Case ${i}`,
          averageDuration: 100000 - i * 1000,
          percentile: 95 - i,
          slowSteps: [
            { order: 1, description: 'Slow step', duration: 50000, averageDuration: 50000 },
          ],
        })),
        bottlenecks: Array.from({ length: 5 }, (_, i) => ({
          type: 'slow_operation' as const,
          description: `Bottleneck ${i}`,
          affectedCases: [`case-${i}`],
          suggestion: 'Optimize',
        })),
        parallelizationOpportunity: {
          currentParallel: 1,
          recommendedParallel: 4,
          estimatedSaving: 60,
          independentGroups: [],
        },
        resourceUtilization: {
          screenshotSize: 1024000,
          logSize: 10240,
          browserInstances: 1,
        },
      };

      const startTime = performance.now();
      const recommendations = await recommendEngine.generateRecommendations({
        efficiency,
      });
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete within 500ms
      expect(duration).toBeLessThan(500);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Accuracy Validation', () => {
    it('should correctly identify flaky tests', async () => {
      const executions = [
        createExecution({ caseId: 'flaky-1', status: 'passed' }),
        createExecution({ caseId: 'flaky-1', status: 'failed' }),
        createExecution({ caseId: 'flaky-1', status: 'passed' }),
        createExecution({ caseId: 'flaky-1', status: 'failed' }),
        createExecution({ caseId: 'flaky-1', status: 'passed' }),
        createExecution({ caseId: 'stable-1', status: 'passed' }),
        createExecution({ caseId: 'stable-1', status: 'passed' }),
        createExecution({ caseId: 'stable-1', status: 'passed' }),
      ];

      const caseStats = [
        createCaseStats({
          caseId: 'flaky-1',
          caseName: 'Flaky Test',
          passRate: 60,
          isFlaky: true,
          recentResults: ['passed', 'failed', 'passed', 'failed', 'passed'] as ('passed' | 'failed')[],
        }),
        createCaseStats({
          caseId: 'stable-1',
          caseName: 'Stable Test',
          passRate: 100,
          isFlaky: false,
          recentResults: ['passed', 'passed', 'passed'] as ('passed' | 'failed')[],
        }),
      ];

      setupMocks(executions, caseStats);

      const stability = await stabilityAnalyzer.analyze();

      // Should identify flaky test
      expect(stability.flakyTests.length).toBeGreaterThan(0);
      expect(stability.flakyTests.some((t) => t.caseId === 'flaky-1')).toBe(true);

      // Stable test should not be in flaky list
      expect(stability.flakyTests.some((t) => t.caseId === 'stable-1')).toBe(false);
    });

    it('should correctly calculate coverage gaps', async () => {
      const executions = [
        createExecution({
          caseId: 'login-test',
          steps: [
            { index: 0, description: 'Login with valid credentials', status: 'passed', duration: 1000, retryCount: 0 },
          ],
        }),
        createExecution({
          caseId: 'search-test',
          steps: [
            { index: 0, description: 'Search for product', status: 'passed', duration: 500, retryCount: 0 },
          ],
        }),
      ];

      setupMocks(executions, []);

      const gaps = await gapIdentifier.identify();

      // Should have coverage for login and search
      const loginCoverage = await gapIdentifier.calculateCoverage('auth-login');
      const searchCoverage = await gapIdentifier.calculateCoverage('search');

      expect(loginCoverage).toBeGreaterThan(0);
      expect(searchCoverage).toBeGreaterThan(0);

      // Should identify gaps for uncovered features
      const passwordResetGap = gaps.find((g) => g.feature === '密码重置');
      expect(passwordResetGap).toBeDefined();
      expect(passwordResetGap?.currentCoverage).toBe(0);
    });

    it('should correctly identify slow cases', async () => {
      const executions = [
        createExecution({ caseId: 'slow-1', caseName: 'Slow Test', duration: 180000 }),
        createExecution({ caseId: 'slow-1', caseName: 'Slow Test', duration: 175000 }),
        createExecution({ caseId: 'fast-1', caseName: 'Fast Test', duration: 5000 }),
        createExecution({ caseId: 'fast-1', caseName: 'Fast Test', duration: 4500 }),
        createExecution({ caseId: 'medium-1', caseName: 'Medium Test', duration: 30000 }),
      ];

      const caseStats = [
        createCaseStats({ caseId: 'slow-1', avgDuration: 177500 }),
        createCaseStats({ caseId: 'fast-1', avgDuration: 4750 }),
        createCaseStats({ caseId: 'medium-1', avgDuration: 30000 }),
      ];
      setupMocks(executions, caseStats);

      const efficiency = await efficiencyAnalyzer.analyze();
      const slowCases = await efficiencyAnalyzer.identifySlowCases();

      // Slow test should be identified
      expect(slowCases.some((c) => c.caseId === 'slow-1')).toBe(true);

      // Fast test should not be in slow list
      expect(slowCases.some((c) => c.caseId === 'fast-1')).toBe(false);
    });
  });
});
