/**
 * Failure Analyzer Tests
 * Tests for failure analysis and pattern detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionRecord, CaseStats } from '../../../types/analytics';

// Mock analyticsStorage
vi.mock('../analyticsStorage', () => ({
  analyticsStorage: {
    getExecutionsByTimeRange: vi.fn().mockResolvedValue([]),
    getFailedExecutions: vi.fn().mockResolvedValue([]),
    getAllCaseStats: vi.fn().mockResolvedValue([]),
    getRecentExecutions: vi.fn().mockResolvedValue([]),
    getExecutionsByCaseId: vi.fn().mockResolvedValue([]),
  },
}));

import { failureAnalyzer } from '../failureAnalyzer';
import { analyticsStorage } from '../analyticsStorage';

describe('FailureAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createExecution = (overrides?: Partial<ExecutionRecord>): ExecutionRecord => ({
    id: `exec-${Date.now()}-${Math.random()}`,
    caseId: 'case-1',
    caseName: 'Test Case 1',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    duration: 5000,
    status: 'passed',
    steps: [
      { index: 0, description: 'Click button', status: 'passed', duration: 2000, retryCount: 0 },
      { index: 1, description: 'Enter text', status: 'passed', duration: 3000, retryCount: 0 },
    ],
    environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
    ...overrides,
  });

  describe('analyzeByType', () => {
    it('should return empty distribution when no executions', async () => {
      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue([]);

      const result = await failureAnalyzer.analyzeByType(
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total).toBe(0);
      expect(result.dominantType).toBeNull();
    });

    it('should count failures by type correctly', async () => {
      const executions: ExecutionRecord[] = [
        createExecution({
          status: 'failed',
          failure: { type: 'locator_failed', message: 'Element not found', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          failure: { type: 'locator_failed', message: 'Element not found', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          failure: { type: 'assertion_failed', message: 'Assertion failed', stepIndex: 1 },
        }),
        createExecution({ status: 'passed' }),
      ];

      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue(executions);

      const result = await failureAnalyzer.analyzeByType(
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.total).toBe(3);
      expect(result.distribution.locator_failed.count).toBe(2);
      expect(result.distribution.assertion_failed.count).toBe(1);
      expect(result.dominantType).toBe('locator_failed');
    });

    it('should calculate percentages correctly', async () => {
      const executions: ExecutionRecord[] = [
        createExecution({
          status: 'failed',
          failure: { type: 'timeout', message: 'Timeout', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          failure: { type: 'timeout', message: 'Timeout', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          failure: { type: 'network_error', message: 'Network error', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          failure: { type: 'network_error', message: 'Network error', stepIndex: 0 },
        }),
      ];

      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue(executions);

      const result = await failureAnalyzer.analyzeByType(
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.distribution.timeout.percentage).toBe(50);
      expect(result.distribution.network_error.percentage).toBe(50);
    });

    it('should count unknown when failure info is missing', async () => {
      const executions: ExecutionRecord[] = [
        createExecution({ status: 'failed' }), // No failure info
      ];

      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue(executions);

      const result = await failureAnalyzer.analyzeByType(
        Date.now() - 86400000,
        Date.now()
      );

      expect(result.distribution.unknown.count).toBe(1);
    });
  });

  describe('analyzeHotspots', () => {
    it('should return empty array when no failures', async () => {
      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue([]);

      const hotspots = await failureAnalyzer.analyzeHotspots();

      expect(hotspots).toEqual([]);
    });

    it('should group failures by step description and type', async () => {
      const failures: ExecutionRecord[] = [
        createExecution({
          status: 'failed',
          steps: [{ index: 0, description: 'Click login button', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          steps: [{ index: 0, description: 'Click login button', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        }),
        createExecution({
          status: 'failed',
          steps: [{ index: 0, description: 'Enter password', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        }),
      ];

      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue(failures);

      const hotspots = await failureAnalyzer.analyzeHotspots();

      expect(hotspots.length).toBe(2);
      expect(hotspots[0].description).toBe('Click login button');
      expect(hotspots[0].failureCount).toBe(2);
      expect(hotspots[0].percentage).toBeCloseTo(66.67, 1);
    });

    it('should respect limit parameter', async () => {
      const failures: ExecutionRecord[] = Array.from({ length: 20 }, (_, i) =>
        createExecution({
          status: 'failed',
          steps: [{ index: 0, description: `Step ${i}`, status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        })
      );

      vi.mocked(analyticsStorage.getFailedExecutions).mockResolvedValue(failures);

      const hotspots = await failureAnalyzer.analyzeHotspots(5);

      expect(hotspots.length).toBe(5);
    });
  });

  describe('detectPatterns', () => {
    it('should detect consecutive failure patterns', async () => {
      const caseStats: CaseStats[] = [
        {
          caseId: 'case-1',
          caseName: 'Failing Test',
          totalRuns: 10,
          passRate: 40,
          avgDuration: 5000,
          lastRun: Date.now(),
          stabilityScore: 40,
          isFlaky: false,
          recentResults: ['failed', 'failed', 'failed', 'failed', 'passed', 'passed', 'passed', 'passed', 'passed', 'passed'],
        },
      ];

      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const patterns = await failureAnalyzer.detectPatterns();

      const consecutivePattern = patterns.find(p => p.type === 'consecutive');
      expect(consecutivePattern).toBeDefined();
      expect(consecutivePattern?.occurrences).toBe(4);
      expect(consecutivePattern?.severity).toBe('medium');
    });

    it('should detect high severity consecutive failures (5+)', async () => {
      const caseStats: CaseStats[] = [
        {
          caseId: 'case-1',
          caseName: 'Severely Failing Test',
          totalRuns: 10,
          passRate: 20,
          avgDuration: 5000,
          lastRun: Date.now(),
          stabilityScore: 20,
          isFlaky: false,
          recentResults: ['failed', 'failed', 'failed', 'failed', 'failed', 'failed', 'passed', 'passed', 'passed', 'passed'],
        },
      ];

      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const patterns = await failureAnalyzer.detectPatterns();

      const consecutivePattern = patterns.find(p => p.type === 'consecutive');
      expect(consecutivePattern?.severity).toBe('high');
    });

    it('should detect time-based failure patterns', async () => {
      const now = Date.now();
      const hour = new Date(now).getHours();

      // Create executions all in the same hour with high failure rate
      const executions: ExecutionRecord[] = [
        createExecution({ startTime: now - 1000, status: 'failed' }),
        createExecution({ startTime: now - 2000, status: 'failed' }),
        createExecution({ startTime: now - 3000, status: 'failed' }),
        createExecution({ startTime: now - 4000, status: 'failed' }),
        createExecution({ startTime: now - 5000, status: 'passed' }),
      ];

      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      const patterns = await failureAnalyzer.detectPatterns();

      const timePattern = patterns.find(p => p.type === 'time_based');
      expect(timePattern).toBeDefined();
      expect(timePattern?.description).toContain(`${hour}:00`);
    });
  });

  describe('calculateFailureCorrelations', () => {
    it('should return empty array when no executions', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const correlations = await failureAnalyzer.calculateFailureCorrelations();

      expect(correlations).toEqual([]);
    });

    it('should detect correlated failures', async () => {
      const baseTime = Date.now();

      // Cases that fail together in the same time window
      const executions: ExecutionRecord[] = [
        createExecution({ caseId: 'case-a', caseName: 'Test A', startTime: baseTime, status: 'failed' }),
        createExecution({ caseId: 'case-b', caseName: 'Test B', startTime: baseTime + 1000, status: 'failed' }),
        createExecution({ caseId: 'case-a', caseName: 'Test A', startTime: baseTime + 3600000, status: 'failed' }),
        createExecution({ caseId: 'case-b', caseName: 'Test B', startTime: baseTime + 3601000, status: 'failed' }),
        createExecution({ caseId: 'case-a', caseName: 'Test A', startTime: baseTime + 7200000, status: 'failed' }),
        createExecution({ caseId: 'case-b', caseName: 'Test B', startTime: baseTime + 7201000, status: 'failed' }),
      ];

      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      const correlations = await failureAnalyzer.calculateFailureCorrelations();

      expect(correlations.length).toBeGreaterThan(0);
      const correlation = correlations.find(
        c => (c.caseIdA === 'case-a' && c.caseIdB === 'case-b') ||
             (c.caseIdA === 'case-b' && c.caseIdB === 'case-a')
      );
      expect(correlation).toBeDefined();
      expect(correlation?.correlation).toBeGreaterThan(0.3);
    });
  });

  describe('getTimeDistribution', () => {
    it('should return distribution for all 24 hours', async () => {
      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue([]);

      const distribution = await failureAnalyzer.getTimeDistribution(
        Date.now() - 86400000,
        Date.now()
      );

      expect(distribution.length).toBe(24);
      distribution.forEach(d => {
        expect(d.hour).toBeGreaterThanOrEqual(0);
        expect(d.hour).toBeLessThan(24);
      });
    });

    it('should calculate failure rates per hour', async () => {
      const now = new Date();
      now.setHours(10, 0, 0, 0);
      const hour10 = now.getTime();

      const executions: ExecutionRecord[] = [
        createExecution({ startTime: hour10, status: 'passed' }),
        createExecution({ startTime: hour10 + 1000, status: 'passed' }),
        createExecution({ startTime: hour10 + 2000, status: 'failed' }),
        createExecution({ startTime: hour10 + 3000, status: 'failed' }),
      ];

      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue(executions);

      const distribution = await failureAnalyzer.getTimeDistribution(
        Date.now() - 86400000,
        Date.now()
      );

      const hour10Stats = distribution.find(d => d.hour === 10);
      expect(hour10Stats?.total).toBe(4);
      expect(hour10Stats?.failures).toBe(2);
      expect(hour10Stats?.failureRate).toBe(50);
    });
  });

  describe('getCaseFailureDetails', () => {
    it('should return detailed failure info for a case', async () => {
      const executions: ExecutionRecord[] = [
        createExecution({
          caseId: 'case-1',
          status: 'failed',
          steps: [{ index: 0, description: 'Click button', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        }),
        createExecution({
          caseId: 'case-1',
          status: 'failed',
          steps: [{ index: 0, description: 'Click button', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'locator_failed', message: 'Failed', stepIndex: 0 },
        }),
        createExecution({
          caseId: 'case-1',
          status: 'failed',
          steps: [{ index: 0, description: 'Enter text', status: 'failed', duration: 1000, retryCount: 0 }],
          failure: { type: 'timeout', message: 'Timeout', stepIndex: 0 },
        }),
        createExecution({ caseId: 'case-1', status: 'passed' }),
      ];

      vi.mocked(analyticsStorage.getExecutionsByCaseId).mockResolvedValue(executions);

      const details = await failureAnalyzer.getCaseFailureDetails('case-1');

      expect(details.totalFailures).toBe(3);
      expect(details.failuresByType.locator_failed).toBe(2);
      expect(details.failuresByType.timeout).toBe(1);
      expect(details.commonFailureSteps.length).toBe(2);
      expect(details.commonFailureSteps[0].description).toBe('Click button');
      expect(details.commonFailureSteps[0].count).toBe(2);
    });

    it('should handle case with no failures', async () => {
      const executions: ExecutionRecord[] = [
        createExecution({ caseId: 'case-1', status: 'passed' }),
        createExecution({ caseId: 'case-1', status: 'passed' }),
      ];

      vi.mocked(analyticsStorage.getExecutionsByCaseId).mockResolvedValue(executions);

      const details = await failureAnalyzer.getCaseFailureDetails('case-1');

      expect(details.totalFailures).toBe(0);
      expect(details.commonFailureSteps).toEqual([]);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for locator_failed', () => {
      const suggestions = failureAnalyzer.getSuggestions('locator_failed');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('定位器') || s.includes('自愈'))).toBe(true);
    });

    it('should return suggestions for assertion_failed', () => {
      const suggestions = failureAnalyzer.getSuggestions('assertion_failed');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('期望值') || s.includes('断言'))).toBe(true);
    });

    it('should return suggestions for timeout', () => {
      const suggestions = failureAnalyzer.getSuggestions('timeout');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('超时') || s.includes('时间'))).toBe(true);
    });

    it('should return suggestions for network_error', () => {
      const suggestions = failureAnalyzer.getSuggestions('network_error');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('网络') || s.includes('API'))).toBe(true);
    });

    it('should return suggestions for unknown failures', () => {
      const suggestions = failureAnalyzer.getSuggestions('unknown');

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
