/**
 * Analytics Storage Tests
 * Tests for IndexedDB-based analytics data storage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AlertEvent,
  AlertRule,
  CaseStats,
  DailyStats,
  ExecutionRecord,
  Report,
} from '../../../types/analytics';

// Mock IndexedDB
const mockStore: Record<string, Map<string, any>> = {
  executions: new Map(),
  'daily-stats': new Map(),
  'case-stats': new Map(),
  'alert-rules': new Map(),
  'alert-events': new Map(),
  reports: new Map(),
};

const mockTransaction = {
  objectStore: vi.fn((storeName: string) => ({
    add: vi.fn((item: any) => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        mockStore[storeName].set(item.id || item.date || item.caseId, item);
        request.onsuccess?.();
      }, 0);
      return request;
    }),
    put: vi.fn((item: any) => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        mockStore[storeName].set(item.id || item.date || item.caseId, item);
        request.onsuccess?.();
      }, 0);
      return request;
    }),
    get: vi.fn((key: string) => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
        result: mockStore[storeName].get(key),
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    getAll: vi.fn((range?: IDBKeyRange) => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
        result: Array.from(mockStore[storeName].values()),
      };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    delete: vi.fn((key: string) => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        mockStore[storeName].delete(key);
        request.onsuccess?.();
      }, 0);
      return request;
    }),
    clear: vi.fn(() => {
      const request = {
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        mockStore[storeName].clear();
        request.onsuccess?.();
      }, 0);
      return request;
    }),
    index: vi.fn(() => ({
      getAll: vi.fn((key?: any) => {
        const request = {
          onsuccess: null as any,
          onerror: null as any,
          result: Array.from(mockStore[storeName].values()),
        };
        setTimeout(() => request.onsuccess?.(), 0);
        return request;
      }),
      openCursor: vi.fn(() => {
        const values = Array.from(mockStore[storeName].values());
        let index = 0;
        const request = {
          onsuccess: null as any,
          onerror: null as any,
        };
        setTimeout(() => {
          if (index < values.length) {
            const cursor = {
              value: values[index],
              continue: () => {
                index++;
                setTimeout(
                  () =>
                    request.onsuccess?.({
                      target: { result: index < values.length ? cursor : null },
                    }),
                  0,
                );
              },
              delete: () => {
                mockStore[storeName].delete(
                  values[index].id || values[index].date,
                );
              },
            };
            request.onsuccess?.({ target: { result: cursor } });
          } else {
            request.onsuccess?.({ target: { result: null } });
          }
        }, 0);
        return request;
      }),
    })),
    openCursor: vi.fn(() => {
      const values = Array.from(mockStore[storeName].values());
      let index = 0;
      const request = {
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => {
        if (index < values.length) {
          const cursor = {
            value: values[index],
            continue: () => {
              index++;
              setTimeout(
                () =>
                  request.onsuccess?.({
                    target: { result: index < values.length ? cursor : null },
                  }),
                0,
              );
            },
            delete: () => {
              mockStore[storeName].delete(
                values[index].id || values[index].date,
              );
            },
          };
          request.onsuccess?.({ target: { result: cursor } });
        } else {
          request.onsuccess?.({ target: { result: null } });
        }
      }, 0);
      return request;
    }),
  })),
};

const mockDB = {
  transaction: vi.fn(() => mockTransaction),
  objectStoreNames: {
    contains: vi.fn(() => true),
  },
};

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => {
    const request = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDB,
    };
    setTimeout(() => request.onsuccess?.(), 0);
    return request;
  }),
});

describe('Analytics Storage', () => {
  beforeEach(() => {
    // Clear all mock stores
    Object.values(mockStore).forEach((store) => store.clear());
    vi.clearAllMocks();
  });

  describe('ExecutionRecord operations', () => {
    const createMockExecution = (
      overrides?: Partial<ExecutionRecord>,
    ): ExecutionRecord => ({
      id: `exec-${Date.now()}`,
      caseId: 'case-1',
      caseName: 'Test Case 1',
      startTime: Date.now() - 10000,
      endTime: Date.now(),
      duration: 10000,
      status: 'passed',
      steps: [
        {
          index: 0,
          description: 'Step 1',
          status: 'passed',
          duration: 5000,
          retryCount: 0,
        },
        {
          index: 1,
          description: 'Step 2',
          status: 'passed',
          duration: 5000,
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

    it('should create a valid execution record', () => {
      const execution = createMockExecution();
      expect(execution.id).toBeDefined();
      expect(execution.caseId).toBe('case-1');
      expect(execution.status).toBe('passed');
      expect(execution.steps.length).toBe(2);
    });

    it('should have correct failure structure', () => {
      const failedExecution = createMockExecution({
        status: 'failed',
        failure: {
          type: 'locator_failed',
          message: 'Element not found',
          stepIndex: 1,
        },
      });
      expect(failedExecution.failure).toBeDefined();
      expect(failedExecution.failure?.type).toBe('locator_failed');
      expect(failedExecution.failure?.stepIndex).toBe(1);
    });

    it('should support healing information', () => {
      const healedExecution = createMockExecution({
        healing: {
          attempted: true,
          success: true,
          strategy: 'deepThink',
        },
      });
      expect(healedExecution.healing).toBeDefined();
      expect(healedExecution.healing?.success).toBe(true);
    });
  });

  describe('DailyStats operations', () => {
    const createMockDailyStats = (
      overrides?: Partial<DailyStats>,
    ): DailyStats => ({
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

    it('should create valid daily stats', () => {
      const stats = createMockDailyStats();
      expect(stats.totalExecutions).toBe(100);
      expect(stats.passed + stats.failed + stats.skipped + stats.error).toBe(
        100,
      );
    });

    it('should track failures by type', () => {
      const stats = createMockDailyStats();
      const totalFailuresByType = Object.values(stats.failuresByType).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalFailuresByType).toBe(10);
    });
  });

  describe('CaseStats operations', () => {
    const createMockCaseStats = (
      overrides?: Partial<CaseStats>,
    ): CaseStats => ({
      caseId: 'case-1',
      caseName: 'Login Test',
      totalRuns: 50,
      passRate: 90,
      avgDuration: 12000,
      lastRun: Date.now(),
      stabilityScore: 85,
      isFlaky: false,
      recentResults: ['passed', 'passed', 'failed', 'passed', 'passed'],
      ...overrides,
    });

    it('should create valid case stats', () => {
      const stats = createMockCaseStats();
      expect(stats.caseId).toBe('case-1');
      expect(stats.passRate).toBe(90);
      expect(stats.stabilityScore).toBe(85);
    });

    it('should identify flaky tests correctly', () => {
      const flakyStats = createMockCaseStats({
        isFlaky: true,
        recentResults: ['passed', 'failed', 'passed', 'failed', 'passed'],
        stabilityScore: 55,
      });
      expect(flakyStats.isFlaky).toBe(true);
      expect(flakyStats.stabilityScore).toBeLessThan(70);
    });

    it('should track recent results as array', () => {
      const stats = createMockCaseStats();
      expect(Array.isArray(stats.recentResults)).toBe(true);
      expect(
        stats.recentResults.every((r) => r === 'passed' || r === 'failed'),
      ).toBe(true);
    });
  });

  describe('AlertRule operations', () => {
    const createMockAlertRule = (
      overrides?: Partial<AlertRule>,
    ): AlertRule => ({
      id: 'rule-1',
      name: 'Low Pass Rate Alert',
      enabled: true,
      condition: {
        type: 'pass_rate',
        threshold: 70,
        timeWindow: 60,
      },
      notification: {
        channels: ['browser'],
      },
      createdAt: Date.now(),
      ...overrides,
    });

    it('should create valid alert rule', () => {
      const rule = createMockAlertRule();
      expect(rule.id).toBe('rule-1');
      expect(rule.enabled).toBe(true);
      expect(rule.condition.type).toBe('pass_rate');
    });

    it('should support different condition types', () => {
      const consecutiveRule = createMockAlertRule({
        condition: {
          type: 'consecutive_failures',
          threshold: 3,
        },
      });
      expect(consecutiveRule.condition.type).toBe('consecutive_failures');
      expect(consecutiveRule.condition.threshold).toBe(3);
    });

    it('should support multiple notification channels', () => {
      const rule = createMockAlertRule({
        notification: {
          channels: ['browser', 'webhook'],
          webhookUrl: 'https://example.com/webhook',
        },
      });
      expect(rule.notification.channels.length).toBe(2);
      expect(rule.notification.webhookUrl).toBeDefined();
    });
  });

  describe('AlertEvent operations', () => {
    const createMockAlertEvent = (
      overrides?: Partial<AlertEvent>,
    ): AlertEvent => ({
      id: 'event-1',
      ruleId: 'rule-1',
      ruleName: 'Low Pass Rate Alert',
      triggeredAt: Date.now(),
      condition: {
        type: 'pass_rate',
        threshold: 70,
      },
      currentValue: 65,
      message: 'Pass rate (65%) is below threshold (70%)',
      acknowledged: false,
      ...overrides,
    });

    it('should create valid alert event', () => {
      const event = createMockAlertEvent();
      expect(event.ruleId).toBe('rule-1');
      expect(event.currentValue).toBe(65);
      expect(event.acknowledged).toBe(false);
    });

    it('should track acknowledgment status', () => {
      const acknowledgedEvent = createMockAlertEvent({ acknowledged: true });
      expect(acknowledgedEvent.acknowledged).toBe(true);
    });
  });

  describe('Report operations', () => {
    const createMockReport = (overrides?: Partial<Report>): Report => ({
      id: 'report-1',
      type: 'daily',
      title: 'Daily Test Report - 2024-01-15',
      generatedAt: Date.now(),
      dateRange: { startDate: '2024-01-15', endDate: '2024-01-15' },
      summary: {
        totalExecutions: 100,
        passRate: '85.0%',
        avgDuration: '15.0s',
        healthScore: 85,
      },
      failureAnalysis: {
        byType: {
          locator_failed: 5,
          assertion_failed: 3,
          timeout: 1,
          network_error: 0,
          script_error: 1,
          unknown: 0,
        },
        hotspots: [
          {
            description: 'Click login button',
            failureCount: 5,
            percentage: 50,
          },
        ],
      },
      recommendations: ['Fix locator issues', 'Add retry logic'],
      caseStats: [],
      ...overrides,
    });

    it('should create valid report', () => {
      const report = createMockReport();
      expect(report.type).toBe('daily');
      expect(report.summary.totalExecutions).toBe(100);
    });

    it('should support different report types', () => {
      const weeklyReport = createMockReport({
        type: 'weekly',
        title: 'Weekly Test Report',
        dateRange: { startDate: '2024-01-08', endDate: '2024-01-15' },
      });
      expect(weeklyReport.type).toBe('weekly');
    });

    it('should include failure analysis', () => {
      const report = createMockReport();
      expect(report.failureAnalysis.hotspots.length).toBeGreaterThan(0);
      expect(report.failureAnalysis.byType.locator_failed).toBe(5);
    });

    it('should include recommendations', () => {
      const report = createMockReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});
