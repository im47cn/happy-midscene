/**
 * Data Collector Tests
 * Tests for data collection and aggregation functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ExecutionRecord, StepRecord } from '../../../types/analytics';

// Mock analyticsStorage
vi.mock('../analyticsStorage', () => ({
  analyticsStorage: {
    addExecution: vi.fn().mockResolvedValue(undefined),
    getDailyStats: vi.fn().mockResolvedValue(null),
    saveDailyStats: vi.fn().mockResolvedValue(undefined),
    getCaseStats: vi.fn().mockResolvedValue(null),
    saveCaseStats: vi.fn().mockResolvedValue(undefined),
    getExecutionsByTimeRange: vi.fn().mockResolvedValue([]),
  },
}));

import { dataCollector } from '../dataCollector';
import { analyticsStorage } from '../analyticsStorage';

describe('DataCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createExecutionRecord', () => {
    const createSteps = (statuses: ('passed' | 'failed' | 'skipped')[]): StepRecord[] =>
      statuses.map((status, index) => ({
        index,
        description: `Step ${index + 1}`,
        status,
        duration: 1000,
        retryCount: 0,
      }));

    const defaultEnv: ExecutionRecord['environment'] = {
      browser: 'Chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    };

    it('should create execution record with passed status when all steps pass', () => {
      const steps = createSteps(['passed', 'passed', 'passed']);
      const record = dataCollector.createExecutionRecord(
        'case-1',
        'Test Case 1',
        steps,
        defaultEnv
      );

      expect(record.caseId).toBe('case-1');
      expect(record.caseName).toBe('Test Case 1');
      expect(record.status).toBe('passed');
      expect(record.steps.length).toBe(3);
      expect(record.failure).toBeUndefined();
      expect(record.duration).toBe(3000);
    });

    it('should create execution record with failed status when a step fails', () => {
      const steps = createSteps(['passed', 'failed', 'skipped']);
      const record = dataCollector.createExecutionRecord(
        'case-1',
        'Test Case 1',
        steps,
        defaultEnv
      );

      expect(record.status).toBe('failed');
      expect(record.failure).toBeDefined();
      expect(record.failure?.stepIndex).toBe(1);
    });

    it('should include healing information when provided', () => {
      const steps = createSteps(['passed']);
      const healing = {
        attempted: true,
        success: true,
        strategy: 'deepThink' as const,
      };
      const record = dataCollector.createExecutionRecord(
        'case-1',
        'Test Case 1',
        steps,
        defaultEnv,
        healing
      );

      expect(record.healing).toEqual(healing);
    });

    it('should generate unique IDs for each record', () => {
      const steps = createSteps(['passed']);
      const record1 = dataCollector.createExecutionRecord('case-1', 'Test', steps, defaultEnv);
      const record2 = dataCollector.createExecutionRecord('case-1', 'Test', steps, defaultEnv);

      expect(record1.id).not.toBe(record2.id);
    });
  });

  describe('recordExecution', () => {
    const createMockRecord = (overrides?: Partial<ExecutionRecord>): ExecutionRecord => ({
      id: `exec-${Date.now()}`,
      caseId: 'case-1',
      caseName: 'Test Case 1',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      duration: 5000,
      status: 'passed',
      steps: [{ index: 0, description: 'Step 1', status: 'passed', duration: 5000, retryCount: 0 }],
      environment: {
        browser: 'Chrome',
        viewport: { width: 1920, height: 1080 },
        url: 'https://example.com',
      },
      ...overrides,
    });

    it('should store execution and update stats', async () => {
      const record = createMockRecord();

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.addExecution).toHaveBeenCalledWith(record);
      expect(analyticsStorage.saveDailyStats).toHaveBeenCalled();
      expect(analyticsStorage.saveCaseStats).toHaveBeenCalled();
    });

    it('should create new daily stats for first execution of the day', async () => {
      vi.mocked(analyticsStorage.getDailyStats).mockResolvedValue(null);
      const record = createMockRecord({ status: 'passed' });

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveDailyStats).toHaveBeenCalledWith(
        expect.objectContaining({
          totalExecutions: 1,
          passed: 1,
          failed: 0,
        })
      );
    });

    it('should update existing daily stats', async () => {
      vi.mocked(analyticsStorage.getDailyStats).mockResolvedValue({
        date: '2024-01-15',
        totalExecutions: 5,
        passed: 4,
        failed: 1,
        skipped: 0,
        error: 0,
        avgDuration: 3000,
        failuresByType: {
          locator_failed: 1,
          assertion_failed: 0,
          timeout: 0,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      });

      const record = createMockRecord({ status: 'passed', duration: 5000 });
      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveDailyStats).toHaveBeenCalledWith(
        expect.objectContaining({
          totalExecutions: 6,
          passed: 5,
        })
      );
    });

    it('should track failure types in daily stats', async () => {
      vi.mocked(analyticsStorage.getDailyStats).mockResolvedValue(null);
      const record = createMockRecord({
        status: 'failed',
        failure: {
          type: 'locator_failed',
          message: 'Element not found',
          stepIndex: 0,
        },
      });

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveDailyStats).toHaveBeenCalledWith(
        expect.objectContaining({
          failuresByType: expect.objectContaining({
            locator_failed: 1,
          }),
        })
      );
    });

    it('should create new case stats for first execution', async () => {
      vi.mocked(analyticsStorage.getCaseStats).mockResolvedValue(null);
      const record = createMockRecord({ status: 'passed' });

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveCaseStats).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-1',
          totalRuns: 1,
          passRate: 100,
          isFlaky: false,
        })
      );
    });

    it('should update case stats with new results', async () => {
      vi.mocked(analyticsStorage.getCaseStats).mockResolvedValue({
        caseId: 'case-1',
        caseName: 'Test Case 1',
        totalRuns: 5,
        passRate: 80,
        avgDuration: 4000,
        lastRun: Date.now() - 86400000,
        stabilityScore: 85,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'failed', 'passed', 'passed'],
      });

      const record = createMockRecord({ status: 'passed' });
      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveCaseStats).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRuns: 6,
          recentResults: expect.arrayContaining(['passed']),
        })
      );
    });
  });

  describe('stability metrics', () => {
    it('should detect flaky tests correctly', async () => {
      vi.mocked(analyticsStorage.getCaseStats).mockResolvedValue({
        caseId: 'case-1',
        caseName: 'Flaky Test',
        totalRuns: 9,
        passRate: 55,
        avgDuration: 3000,
        lastRun: Date.now() - 1000,
        stabilityScore: 55,
        isFlaky: false,
        recentResults: ['passed', 'failed', 'passed', 'failed', 'passed', 'failed', 'passed', 'failed', 'passed'],
      });

      const record: ExecutionRecord = {
        id: 'exec-test',
        caseId: 'case-1',
        caseName: 'Flaky Test',
        startTime: Date.now() - 3000,
        endTime: Date.now(),
        duration: 3000,
        status: 'failed',
        steps: [],
        environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
      };

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveCaseStats).toHaveBeenCalledWith(
        expect.objectContaining({
          isFlaky: true,
        })
      );
    });

    it('should not mark consistently passing tests as flaky', async () => {
      vi.mocked(analyticsStorage.getCaseStats).mockResolvedValue({
        caseId: 'case-1',
        caseName: 'Stable Test',
        totalRuns: 9,
        passRate: 100,
        avgDuration: 3000,
        lastRun: Date.now() - 1000,
        stabilityScore: 100,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'passed', 'passed'],
      });

      const record: ExecutionRecord = {
        id: 'exec-test',
        caseId: 'case-1',
        caseName: 'Stable Test',
        startTime: Date.now() - 3000,
        endTime: Date.now(),
        duration: 3000,
        status: 'passed',
        steps: [],
        environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
      };

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveCaseStats).toHaveBeenCalledWith(
        expect.objectContaining({
          isFlaky: false,
        })
      );
    });
  });

  describe('getExecutionStats', () => {
    it('should return empty stats when no executions', async () => {
      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue([]);

      const stats = await dataCollector.getExecutionStats(
        Date.now() - 86400000,
        Date.now()
      );

      expect(stats).toEqual({
        total: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
        avgDuration: 0,
      });
    });

    it('should calculate correct stats from executions', async () => {
      const executions: ExecutionRecord[] = [
        {
          id: 'exec-1',
          caseId: 'case-1',
          caseName: 'Test 1',
          startTime: Date.now() - 5000,
          endTime: Date.now(),
          duration: 5000,
          status: 'passed',
          steps: [],
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
        {
          id: 'exec-2',
          caseId: 'case-2',
          caseName: 'Test 2',
          startTime: Date.now() - 3000,
          endTime: Date.now(),
          duration: 3000,
          status: 'passed',
          steps: [],
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
        {
          id: 'exec-3',
          caseId: 'case-3',
          caseName: 'Test 3',
          startTime: Date.now() - 4000,
          endTime: Date.now(),
          duration: 4000,
          status: 'failed',
          steps: [],
          environment: { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' },
        },
      ];
      vi.mocked(analyticsStorage.getExecutionsByTimeRange).mockResolvedValue(executions);

      const stats = await dataCollector.getExecutionStats(
        Date.now() - 86400000,
        Date.now()
      );

      expect(stats.total).toBe(3);
      expect(stats.passed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.passRate).toBeCloseTo(66.67, 1);
      expect(stats.avgDuration).toBe(4000);
    });
  });

  describe('failure type inference', () => {
    const testInferFailureType = (description: string, expectedType: string) => {
      const steps: StepRecord[] = [{
        index: 0,
        description,
        status: 'failed',
        duration: 1000,
        retryCount: 0,
      }];

      const record = dataCollector.createExecutionRecord(
        'case-1',
        'Test',
        steps,
        { browser: 'Chrome', viewport: { width: 1920, height: 1080 }, url: 'https://example.com' }
      );

      return record.failure?.type;
    };

    it('should infer locator_failed for click/locate steps', () => {
      expect(testInferFailureType('Click the submit button')).toBe('locator_failed');
      expect(testInferFailureType('Locate the login form')).toBe('locator_failed');
      expect(testInferFailureType('Find element by id')).toBe('locator_failed');
    });

    it('should infer assertion_failed for assert/verify steps', () => {
      expect(testInferFailureType('Assert page title')).toBe('assertion_failed');
      expect(testInferFailureType('Expect text to be visible')).toBe('assertion_failed');
      expect(testInferFailureType('Verify user logged in')).toBe('assertion_failed');
    });

    it('should infer timeout for timeout/wait steps', () => {
      expect(testInferFailureType('Wait for page load')).toBe('timeout');
      expect(testInferFailureType('Timeout waiting for response')).toBe('timeout');
    });

    it('should infer network_error for network/api steps', () => {
      expect(testInferFailureType('Network request failed')).toBe('network_error');
      expect(testInferFailureType('API call returned error')).toBe('network_error');
    });

    it('should infer script_error for script errors', () => {
      expect(testInferFailureType('Script execution error')).toBe('script_error');
    });

    it('should return unknown for unrecognized failures', () => {
      // Note: "happened" contains no keywords that match specific failure types
      expect(testInferFailureType('The system crashed randomly')).toBe('unknown');
    });
  });
});
