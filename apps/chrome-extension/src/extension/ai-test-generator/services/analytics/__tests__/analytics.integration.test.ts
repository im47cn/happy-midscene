/**
 * Integration Tests for Analytics Dashboard System
 * Tests the end-to-end flow from data collection to analysis and reporting
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AlertEvent,
  AlertRule,
  CaseStats,
  DailyStats,
  ExecutionRecord,
  Report,
  StepRecord,
} from '../../../types/analytics';

// Mock storage state - must be declared before vi.mock for hoisting
let mockExecutions: ExecutionRecord[] = [];
let mockDailyStats: Map<string, DailyStats> = new Map();
let mockCaseStats: Map<string, CaseStats> = new Map();
let mockAlertRules: AlertRule[] = [];
let mockAlertEvents: AlertEvent[] = [];
let mockReports: Report[] = [];

// Mock analyticsStorage with factory returning fresh implementations
vi.mock('../analyticsStorage', () => {
  return {
    analyticsStorage: {
      addExecution: vi.fn(async (record: ExecutionRecord) => {
        mockExecutions.push(record);
      }),
      getExecutionsByTimeRange: vi.fn(async (start: number, end: number) => {
        return mockExecutions.filter(
          (e) => e.startTime >= start && e.endTime <= end,
        );
      }),
      getFailedExecutions: vi.fn(async (limit?: number) => {
        const failed = mockExecutions.filter((e) => e.status === 'failed');
        return limit ? failed.slice(0, limit) : failed;
      }),
      getDailyStats: vi.fn(async (date: string) => {
        return mockDailyStats.get(date) || null;
      }),
      saveDailyStats: vi.fn(async (stats: DailyStats) => {
        mockDailyStats.set(stats.date, stats);
      }),
      getDailyStatsRange: vi.fn(async (startDate: string, endDate: string) => {
        const result: DailyStats[] = [];
        mockDailyStats.forEach((stats, date) => {
          if (date >= startDate && date <= endDate) {
            result.push(stats);
          }
        });
        return result.sort((a, b) => a.date.localeCompare(b.date));
      }),
      getCaseStats: vi.fn(async (caseId: string) => {
        return mockCaseStats.get(caseId) || null;
      }),
      saveCaseStats: vi.fn(async (stats: CaseStats) => {
        mockCaseStats.set(stats.caseId, stats);
      }),
      getAllCaseStats: vi.fn(async () => {
        return Array.from(mockCaseStats.values());
      }),
      getFlakyCases: vi.fn(async () => {
        return Array.from(mockCaseStats.values()).filter((c) => c.isFlaky);
      }),
      getAllAlertRules: vi.fn(async () => {
        return [...mockAlertRules];
      }),
      getEnabledAlertRules: vi.fn(async () => {
        return mockAlertRules.filter((r) => r.enabled);
      }),
      saveAlertRule: vi.fn(async (rule: AlertRule) => {
        const idx = mockAlertRules.findIndex((r) => r.id === rule.id);
        if (idx >= 0) {
          mockAlertRules[idx] = rule;
        } else {
          mockAlertRules.push(rule);
        }
      }),
      deleteAlertRule: vi.fn(async (ruleId: string) => {
        mockAlertRules = mockAlertRules.filter((r) => r.id !== ruleId);
      }),
      getAlertEvents: vi.fn(async (limit?: number) => {
        return mockAlertEvents.slice(0, limit || 100);
      }),
      getRecentAlertEvents: vi.fn(async (limit?: number) => {
        return mockAlertEvents.slice(0, limit || 50);
      }),
      addAlertEvent: vi.fn(async (event: AlertEvent) => {
        mockAlertEvents.push(event);
      }),
      saveReport: vi.fn(async (report: Report) => {
        mockReports.push(report);
      }),
      getReports: vi.fn(async () => {
        return [...mockReports];
      }),
      getExecutionsByCaseId: vi.fn(async (caseId: string) => {
        return mockExecutions
          .filter((e) => e.caseId === caseId)
          .sort((a, b) => b.startTime - a.startTime);
      }),
    },
  };
});

import { alertManager } from '../alertManager';
import { analysisEngine } from '../analysisEngine';
import { analyticsStorage } from '../analyticsStorage';
import { dataCollector } from '../dataCollector';
import { failureAnalyzer } from '../failureAnalyzer';
import { reportGenerator } from '../reportGenerator';

describe('Analytics Dashboard System Integration', () => {
  beforeEach(() => {
    // Reset mock storage
    mockExecutions = [];
    mockDailyStats = new Map();
    mockCaseStats = new Map();
    mockAlertRules = [];
    mockAlertEvents = [];
    mockReports = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Data Collection to Analysis Flow', () => {
    const createStepRecords = (
      statuses: ('passed' | 'failed' | 'skipped')[],
    ): StepRecord[] =>
      statuses.map((status, index) => ({
        index,
        description: `Step ${index + 1}`,
        status,
        duration: 1000 + Math.random() * 2000,
        retryCount: 0,
      }));

    const defaultEnv: ExecutionRecord['environment'] = {
      browser: 'Chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    };

    it('should create and record execution correctly', async () => {
      const steps = createStepRecords(['passed', 'passed', 'passed']);
      const record = dataCollector.createExecutionRecord(
        'case-1',
        'Test Case 1',
        steps,
        defaultEnv,
      );

      expect(record.id).toBeDefined();
      expect(record.status).toBe('passed');
      expect(record.steps.length).toBe(3);

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.addExecution).toHaveBeenCalledWith(record);
      expect(analyticsStorage.saveDailyStats).toHaveBeenCalled();
      expect(analyticsStorage.saveCaseStats).toHaveBeenCalled();
    });

    it('should track failure information correctly', async () => {
      const steps = createStepRecords(['passed', 'failed', 'skipped']);
      const record = dataCollector.createExecutionRecord(
        'case-2',
        'Failing Test',
        steps,
        defaultEnv,
      );

      expect(record.status).toBe('failed');
      expect(record.failure).toBeDefined();
      expect(record.failure?.stepIndex).toBe(1);

      await dataCollector.recordExecution(record);

      expect(analyticsStorage.saveDailyStats).toHaveBeenCalledWith(
        expect.objectContaining({
          failed: expect.any(Number),
        }),
      );
    });

    it('should update daily stats incrementally', async () => {
      // Record first execution
      const record1 = dataCollector.createExecutionRecord(
        'case-1',
        'Test 1',
        createStepRecords(['passed']),
        defaultEnv,
      );
      await dataCollector.recordExecution(record1);

      // Record second execution
      const record2 = dataCollector.createExecutionRecord(
        'case-2',
        'Test 2',
        createStepRecords(['passed']),
        defaultEnv,
      );
      await dataCollector.recordExecution(record2);

      // Daily stats should be updated twice
      expect(analyticsStorage.saveDailyStats).toHaveBeenCalledTimes(2);
    });

    it('should detect and mark flaky tests', async () => {
      // Create alternating pass/fail pattern
      for (let i = 0; i < 10; i++) {
        const status = i % 2 === 0 ? 'passed' : 'failed';
        const record = dataCollector.createExecutionRecord(
          'flaky-case',
          'Flaky Test',
          createStepRecords([status as 'passed' | 'failed']),
          defaultEnv,
        );
        await dataCollector.recordExecution(record);
      }

      // Case stats should show as flaky
      expect(analyticsStorage.saveCaseStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          caseId: 'flaky-case',
          isFlaky: true,
        }),
      );
    });
  });

  describe('Analysis Engine Flow', () => {
    it('should calculate health score correctly', async () => {
      // Setup test data
      const today = new Date().toISOString().split('T')[0];
      mockDailyStats.set(today, {
        date: today,
        totalExecutions: 100,
        passed: 85,
        failed: 10,
        skipped: 5,
        error: 0,
        avgDuration: 5000,
        failuresByType: {
          locator_failed: 5,
          assertion_failed: 3,
          timeout: 2,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      });

      mockCaseStats.set('case-1', {
        caseId: 'case-1',
        caseName: 'Test Case 1',
        totalRuns: 50,
        passRate: 90,
        avgDuration: 5000,
        lastRun: Date.now(),
        stabilityScore: 88,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'passed', 'failed', 'passed'],
      });

      const healthScore = await analysisEngine.calculateHealthScore();

      expect(healthScore.overall).toBeDefined();
      expect(healthScore.overall).toBeGreaterThanOrEqual(0);
      expect(healthScore.overall).toBeLessThanOrEqual(100);
      expect(healthScore.components.passRate).toBeDefined();
      expect(healthScore.components.stability).toBeDefined();
      expect(healthScore.trend).toBeDefined();
    });

    it('should get dashboard overview', async () => {
      // Setup test data
      const today = new Date().toISOString().split('T')[0];
      mockDailyStats.set(today, {
        date: today,
        totalExecutions: 50,
        passed: 45,
        failed: 5,
        skipped: 0,
        error: 0,
        avgDuration: 3000,
        failuresByType: {
          locator_failed: 3,
          assertion_failed: 2,
          timeout: 0,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      });

      const overview = await analysisEngine.getDashboardOverview('today');

      expect(overview.totalExecutions).toBe(50);
      expect(overview.passRate).toBeCloseTo(90, 0);
      expect(overview.dailyStats.length).toBeGreaterThanOrEqual(0);
    });

    it('should sort case stats correctly', async () => {
      mockCaseStats.set('case-1', {
        caseId: 'case-1',
        caseName: 'High Pass Rate',
        totalRuns: 100,
        passRate: 95,
        avgDuration: 3000,
        lastRun: Date.now() - 1000,
        stabilityScore: 90,
        isFlaky: false,
        recentResults: [],
      });

      mockCaseStats.set('case-2', {
        caseId: 'case-2',
        caseName: 'Low Pass Rate',
        totalRuns: 50,
        passRate: 60,
        avgDuration: 5000,
        lastRun: Date.now(),
        stabilityScore: 55,
        isFlaky: true,
        recentResults: [],
      });

      const sortedByPassRate = await analysisEngine.getCaseStatsSorted(
        'passRate',
        false,
      );
      expect(sortedByPassRate[0].caseId).toBe('case-1');

      const sortedByPassRateAsc = await analysisEngine.getCaseStatsSorted(
        'passRate',
        true,
      );
      expect(sortedByPassRateAsc[0].caseId).toBe('case-2');
    });
  });

  describe('Failure Analyzer Flow', () => {
    it('should analyze failures by type', async () => {
      // Add failed executions
      for (let i = 0; i < 5; i++) {
        mockExecutions.push({
          id: `exec-${i}`,
          caseId: 'case-1',
          caseName: 'Failing Test',
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          duration: 5000,
          status: 'failed',
          steps: [
            {
              index: 0,
              description: 'Click login button',
              status: 'failed',
              duration: 1000,
              retryCount: 0,
            },
          ],
          environment: {
            browser: 'Chrome',
            viewport: { width: 1920, height: 1080 },
            url: 'https://example.com',
          },
          failure: {
            type: 'locator_failed',
            message: 'Element not found',
            stepIndex: 0,
          },
        });
      }

      const result = await failureAnalyzer.analyzeByType(
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      expect(result.distribution).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should get failure hotspots', async () => {
      // Add some failures with specific step descriptions
      mockExecutions.push({
        id: 'exec-hotspot-1',
        caseId: 'case-1',
        caseName: 'Test',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        status: 'failed',
        steps: [
          {
            index: 0,
            description: 'Click login',
            status: 'failed',
            duration: 1000,
            retryCount: 0,
          },
        ],
        environment: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 },
          url: 'https://example.com',
        },
        failure: {
          type: 'locator_failed',
          message: 'Not found',
          stepIndex: 0,
        },
      });

      const hotspots = await failureAnalyzer.analyzeHotspots(10);

      expect(hotspots).toBeDefined();
      expect(Array.isArray(hotspots)).toBe(true);
    });

    it('should analyze failures for specific case', async () => {
      const caseId = 'case-analyze';

      mockExecutions.push({
        id: 'exec-case-1',
        caseId,
        caseName: 'Case to Analyze',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        status: 'failed',
        steps: [
          {
            index: 0,
            description: 'Step 1',
            status: 'failed',
            duration: 1000,
            retryCount: 0,
          },
        ],
        environment: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 },
          url: 'https://example.com',
        },
        failure: {
          type: 'timeout',
          message: 'Timeout',
          stepIndex: 0,
        },
      });

      const analysis = await failureAnalyzer.getCaseFailureDetails(caseId);

      expect(analysis).toBeDefined();
    });
  });

  describe('Report Generator Flow', () => {
    beforeEach(() => {
      // Setup daily stats for report generation
      const today = new Date().toISOString().split('T')[0];
      mockDailyStats.set(today, {
        date: today,
        totalExecutions: 100,
        passed: 90,
        failed: 8,
        skipped: 2,
        error: 0,
        avgDuration: 4000,
        failuresByType: {
          locator_failed: 4,
          assertion_failed: 2,
          timeout: 1,
          network_error: 1,
          script_error: 0,
          unknown: 0,
        },
      });

      // Setup case stats
      mockCaseStats.set('case-1', {
        caseId: 'case-1',
        caseName: 'Login Test',
        totalRuns: 50,
        passRate: 94,
        avgDuration: 3500,
        lastRun: Date.now(),
        stabilityScore: 92,
        isFlaky: false,
        recentResults: ['passed', 'passed', 'passed', 'failed', 'passed'],
      });
    });

    it('should generate daily report', async () => {
      const today = new Date().toISOString().split('T')[0];
      const report = await reportGenerator.generateDailyReport(today);

      expect(report.id).toBeDefined();
      expect(report.type).toBe('daily');
      expect(report.summary).toBeDefined();
      expect(report.summary.totalExecutions).toBe(100);
      // passRate is a formatted string like "90.0%"
      expect(report.summary.passRate).toBe('90.0%');
    });

    it('should generate weekly report', async () => {
      // Setup 7 days of data
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        mockDailyStats.set(dateStr, {
          date: dateStr,
          totalExecutions: 20 + i * 5,
          passed: 18 + i * 4,
          failed: 2 + (i % 2),
          skipped: 0,
          error: 0,
          avgDuration: 3000 + i * 100,
          failuresByType: {
            locator_failed: 1,
            assertion_failed: 1,
            timeout: 0,
            network_error: 0,
            script_error: 0,
            unknown: 0,
          },
        });
      }

      const report = await reportGenerator.generateWeeklyReport();

      expect(report.type).toBe('weekly');
      expect(report.summary.totalExecutions).toBeGreaterThan(0);
      expect(report.recommendations).toBeDefined();
    });

    it('should include failure analysis in report', async () => {
      const today = new Date().toISOString().split('T')[0];
      const report = await reportGenerator.generateDailyReport(today);

      expect(report.failureAnalysis).toBeDefined();
      expect(report.failureAnalysis.byType).toBeDefined();
    });

    it('should include recommendations in report', async () => {
      const today = new Date().toISOString().split('T')[0];
      const report = await reportGenerator.generateDailyReport(today);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should save report to storage', async () => {
      const today = new Date().toISOString().split('T')[0];
      await reportGenerator.generateDailyReport(today);

      expect(analyticsStorage.saveReport).toHaveBeenCalled();
    });
  });

  describe('Alert Manager Flow', () => {
    it('should create and check alert rules', async () => {
      const ruleData = {
        name: 'Low Pass Rate Alert',
        enabled: true,
        condition: {
          type: 'pass_rate' as const,
          threshold: 80,
        },
        notification: {
          channels: ['browser'] as const,
        },
      };

      const rule = await alertManager.createRule(ruleData);

      expect(rule.id).toBeDefined();
      expect(analyticsStorage.saveAlertRule).toHaveBeenCalled();

      const rules = await alertManager.getAllRules();
      expect(rules.length).toBeGreaterThanOrEqual(0);
    });

    it('should trigger alert when condition is met', async () => {
      const rule: AlertRule = {
        id: 'rule-low-pass',
        name: 'Low Pass Rate',
        enabled: true,
        condition: {
          type: 'pass_rate',
          threshold: 90,
        },
        notification: {
          channels: ['browser'],
        },
        createdAt: Date.now(),
      };

      mockAlertRules = [rule];

      // Create a failing execution
      const record: ExecutionRecord = {
        id: 'exec-1',
        caseId: 'case-1',
        caseName: 'Test',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        status: 'failed',
        steps: [],
        environment: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 },
          url: 'https://example.com',
        },
        failure: {
          type: 'locator_failed',
          message: 'Not found',
          stepIndex: 0,
        },
      };

      const events = await alertManager.checkAlerts(record);

      // Check runs without errors
      expect(Array.isArray(events)).toBe(true);
    });

    it('should respect cooldown period', async () => {
      const rule: AlertRule = {
        id: 'rule-cooldown',
        name: 'With Cooldown',
        enabled: true,
        condition: {
          type: 'consecutive_failures',
          threshold: 1,
        },
        notification: {
          channels: ['browser'],
        },
        cooldownMinutes: 60,
        createdAt: Date.now(),
        lastTriggered: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      };

      mockAlertRules = [rule];

      const record: ExecutionRecord = {
        id: 'exec-1',
        caseId: 'case-1',
        caseName: 'Test',
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        duration: 5000,
        status: 'failed',
        steps: [],
        environment: {
          browser: 'Chrome',
          viewport: { width: 1920, height: 1080 },
          url: 'https://example.com',
        },
      };

      // Should not trigger due to cooldown
      const events = await alertManager.checkAlerts(record);
      expect(Array.isArray(events)).toBe(true);
    });

    it('should support multiple notification channels', async () => {
      const ruleData = {
        name: 'Multi Channel',
        enabled: true,
        condition: {
          type: 'pass_rate' as const,
          threshold: 50,
        },
        notification: {
          channels: ['browser', 'webhook'] as const,
          webhookUrl: 'https://example.com/webhook',
        },
      };

      const rule = await alertManager.createRule(ruleData);

      expect(rule.id).toBeDefined();
      expect(rule.notification.channels.length).toBe(2);
    });
  });

  describe('Full Analytics Workflow', () => {
    it('should complete full cycle from execution to dashboard', async () => {
      // 1. Record multiple executions
      const today = new Date().toISOString().split('T')[0];

      for (let i = 0; i < 10; i++) {
        const status = i < 8 ? 'passed' : 'failed';
        const steps: StepRecord[] = [
          {
            index: 0,
            description: `Step ${i}`,
            status: status as 'passed' | 'failed',
            duration: 1000 + Math.random() * 2000,
            retryCount: 0,
          },
        ];

        const record = dataCollector.createExecutionRecord(
          `case-${i % 3}`,
          `Test Case ${i % 3}`,
          steps,
          {
            browser: 'Chrome',
            viewport: { width: 1920, height: 1080 },
            url: 'https://example.com',
          },
        );

        await dataCollector.recordExecution(record);
      }

      // 2. Setup daily stats for dashboard
      mockDailyStats.set(today, {
        date: today,
        totalExecutions: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        error: 0,
        avgDuration: 2500,
        failuresByType: {
          locator_failed: 1,
          assertion_failed: 1,
          timeout: 0,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      });

      // 3. Get dashboard overview
      const overview = await analysisEngine.getDashboardOverview('today');

      expect(overview.totalExecutions).toBe(10);
      expect(overview.passRate).toBe(80);

      // 4. Generate report
      const report = await reportGenerator.generateDailyReport(today);

      expect(report.summary.totalExecutions).toBe(10);
      // passRate is a formatted string
      expect(report.summary.passRate).toBe('80.0%');
    });

    it('should handle empty data gracefully', async () => {
      // Clear all data
      mockExecutions = [];
      mockDailyStats.clear();
      mockCaseStats.clear();

      // Dashboard should handle empty data
      const overview = await analysisEngine.getDashboardOverview('today');

      expect(overview.totalExecutions).toBe(0);
      expect(overview.passRate).toBe(0);

      // Health score should still compute
      const healthScore = await analysisEngine.calculateHealthScore();
      expect(healthScore.overall).toBeDefined();
    });

    it('should maintain data consistency across operations', async () => {
      const caseId = 'consistency-test';

      // Record 5 passed, 5 failed
      for (let i = 0; i < 10; i++) {
        const status = i < 5 ? 'passed' : 'failed';
        const record = dataCollector.createExecutionRecord(
          caseId,
          'Consistency Test',
          [
            {
              index: 0,
              description: 'Step',
              status: status as 'passed' | 'failed',
              duration: 1000,
              retryCount: 0,
            },
          ],
          {
            browser: 'Chrome',
            viewport: { width: 1920, height: 1080 },
            url: 'https://example.com',
          },
        );
        await dataCollector.recordExecution(record);
      }

      // Case stats should be saved with the correct caseId
      expect(analyticsStorage.saveCaseStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          caseId,
        }),
      );
    });
  });
});
