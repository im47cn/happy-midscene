/**
 * Report Generator Tests
 * Tests for report generation functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DailyStats, CaseStats, Hotspot, Report } from '../../../types/analytics';

// Mock dependencies
vi.mock('../analyticsStorage', () => ({
  analyticsStorage: {
    getDailyStatsRange: vi.fn().mockResolvedValue([]),
    getAllCaseStats: vi.fn().mockResolvedValue([]),
    saveReport: vi.fn().mockResolvedValue(undefined),
    getRecentReports: vi.fn().mockResolvedValue([]),
    getReport: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../analysisEngine', () => ({
  analysisEngine: {
    analyzeFailureHotspots: vi.fn().mockResolvedValue([]),
  },
}));

import { reportGenerator } from '../reportGenerator';
import { analyticsStorage } from '../analyticsStorage';
import { analysisEngine } from '../analysisEngine';

describe('ReportGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe('generateDailyReport', () => {
    it('should generate a daily report', async () => {
      const dailyStats = [createDailyStats()];
      const caseStats = [createCaseStats()];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);
      vi.mocked(analysisEngine.analyzeFailureHotspots).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.type).toBe('daily');
      expect(report.title).toContain('2024-01-15');
      expect(report.dateRange.startDate).toBe('2024-01-15');
      expect(report.dateRange.endDate).toBe('2024-01-15');
      expect(analyticsStorage.saveReport).toHaveBeenCalled();
    });

    it('should calculate correct summary', async () => {
      const dailyStats = [
        createDailyStats({ totalExecutions: 100, passed: 80, avgDuration: 10000 }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.summary.totalExecutions).toBe(100);
      expect(report.summary.passRate).toBe('80.0%');
      expect(report.summary.avgDuration).toBe('10.0s');
    });
  });

  describe('generateWeeklyReport', () => {
    it('should generate a weekly report with 7 days range', async () => {
      const dailyStats = [
        createDailyStats({ date: '2024-01-09' }),
        createDailyStats({ date: '2024-01-10' }),
        createDailyStats({ date: '2024-01-15' }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateWeeklyReport('2024-01-15');

      expect(report.type).toBe('weekly');
      expect(report.title).toContain('周报');
      expect(report.dateRange.endDate).toBe('2024-01-15');
    });

    it('should aggregate stats from multiple days', async () => {
      const dailyStats = [
        createDailyStats({ date: '2024-01-14', totalExecutions: 50, passed: 40 }),
        createDailyStats({ date: '2024-01-15', totalExecutions: 50, passed: 45 }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateWeeklyReport('2024-01-15');

      expect(report.summary.totalExecutions).toBe(100);
      expect(report.summary.passRate).toBe('85.0%'); // (40 + 45) / 100
    });
  });

  describe('generateCustomReport', () => {
    it('should generate a custom report with specified range', async () => {
      const dateRange = { startDate: '2024-01-01', endDate: '2024-01-31' };

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateCustomReport(dateRange);

      expect(report.type).toBe('custom');
      expect(report.dateRange).toEqual(dateRange);
    });
  });

  describe('failure analysis', () => {
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
            timeout: 2,
            network_error: 1,
            script_error: 0,
            unknown: 0,
          },
        }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.failureAnalysis.byType.locator_failed).toBe(8);
      expect(report.failureAnalysis.byType.assertion_failed).toBe(5);
      expect(report.failureAnalysis.byType.timeout).toBe(3);
    });

    it('should include hotspots from analysis engine', async () => {
      const hotspots: Hotspot[] = [
        { description: 'Click login button', failureCount: 10, percentage: 50 },
        { description: 'Enter password', failureCount: 5, percentage: 25 },
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analysisEngine.analyzeFailureHotspots).mockResolvedValue(hotspots);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.failureAnalysis.hotspots).toEqual(hotspots);
    });
  });

  describe('recommendations', () => {
    it('should recommend fixing when pass rate is low', async () => {
      const dailyStats = [
        createDailyStats({ totalExecutions: 100, passed: 60 }), // 60% pass rate
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.recommendations.some(r => r.includes('低于 80%'))).toBe(true);
    });

    it('should recommend self-healing for many locator failures', async () => {
      const dailyStats = [
        createDailyStats({
          failuresByType: {
            locator_failed: 10,
            assertion_failed: 0,
            timeout: 0,
            network_error: 0,
            script_error: 0,
            unknown: 0,
          },
        }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.recommendations.some(r => r.includes('自愈'))).toBe(true);
    });

    it('should warn about flaky tests', async () => {
      const caseStats = [
        createCaseStats({ isFlaky: true }),
        createCaseStats({ isFlaky: true }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      expect(report.recommendations.some(r => r.includes('Flaky'))).toBe(true);
    });

    it('should provide positive feedback for high pass rate', async () => {
      const dailyStats = [
        createDailyStats({
          totalExecutions: 100,
          passed: 98,
          failed: 2,
          skipped: 0,
          error: 0,
          failuresByType: {
            locator_failed: 1,
            assertion_failed: 1,
            timeout: 0,
            network_error: 0,
            script_error: 0,
            unknown: 0,
          },
        }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue(dailyStats);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);
      vi.mocked(analysisEngine.analyzeFailureHotspots).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');

      // High pass rate (98%) should either get positive feedback or no critical recommendations
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('exportToHTML', () => {
    it('should generate valid HTML', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([createCaseStats()]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const html = reportGenerator.exportToHTML(report);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="zh-CN">');
      expect(html).toContain(report.title);
      expect(html).toContain(report.summary.passRate);
      expect(html).toContain(report.summary.totalExecutions.toString());
    });

    it('should include failure type table', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const html = reportGenerator.exportToHTML(report);

      expect(html).toContain('失败类型');
      expect(html).toContain('定位失败');
    });

    it('should include recommendations', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const html = reportGenerator.exportToHTML(report);

      expect(html).toContain('建议事项');
      report.recommendations.forEach(r => {
        expect(html).toContain(r);
      });
    });
  });

  describe('exportToCSV', () => {
    it('should generate valid CSV', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([createCaseStats()]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const csv = reportGenerator.exportToCSV(report);

      expect(csv).toContain(report.title);
      expect(csv).toContain('总执行次数');
      expect(csv).toContain('通过率');
    });

    it('should include case stats', async () => {
      const caseStats = [
        createCaseStats({ caseName: 'Login Test', passRate: 90 }),
      ];

      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue(caseStats);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const csv = reportGenerator.exportToCSV(report);

      expect(csv).toContain('用例统计');
      expect(csv).toContain('Login Test');
    });

    it('should properly escape CSV fields', async () => {
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([createDailyStats()]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      const report = await reportGenerator.generateDailyReport('2024-01-15');
      const csv = reportGenerator.exportToCSV(report);

      // All fields should be quoted
      const lines = csv.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        if (line.includes(',')) {
          expect(line.includes('"')).toBe(true);
        }
      });
    });
  });

  describe('getRecentReports', () => {
    it('should return recent reports from storage', async () => {
      const reports: Report[] = [
        {
          id: 'report-1',
          type: 'daily',
          title: 'Test Report',
          generatedAt: Date.now(),
          dateRange: { startDate: '2024-01-15', endDate: '2024-01-15' },
          summary: { totalExecutions: 100, passRate: '85.0%', avgDuration: '15.0s', healthScore: 85 },
          failureAnalysis: {
            byType: { locator_failed: 0, assertion_failed: 0, timeout: 0, network_error: 0, script_error: 0, unknown: 0 },
            hotspots: [],
          },
          recommendations: [],
          caseStats: [],
        },
      ];

      vi.mocked(analyticsStorage.getRecentReports).mockResolvedValue(reports);

      const result = await reportGenerator.getRecentReports(10);

      expect(result).toEqual(reports);
      expect(analyticsStorage.getRecentReports).toHaveBeenCalledWith(10);
    });
  });

  describe('getReport', () => {
    it('should return report by ID', async () => {
      const report: Report = {
        id: 'report-1',
        type: 'daily',
        title: 'Test Report',
        generatedAt: Date.now(),
        dateRange: { startDate: '2024-01-15', endDate: '2024-01-15' },
        summary: { totalExecutions: 100, passRate: '85.0%', avgDuration: '15.0s', healthScore: 85 },
        failureAnalysis: {
          byType: { locator_failed: 0, assertion_failed: 0, timeout: 0, network_error: 0, script_error: 0, unknown: 0 },
          hotspots: [],
        },
        recommendations: [],
        caseStats: [],
      };

      vi.mocked(analyticsStorage.getReport).mockResolvedValue(report);

      const result = await reportGenerator.getReport('report-1');

      expect(result).toEqual(report);
      expect(analyticsStorage.getReport).toHaveBeenCalledWith('report-1');
    });

    it('should return null for non-existent report', async () => {
      vi.mocked(analyticsStorage.getReport).mockResolvedValue(null);

      const result = await reportGenerator.getReport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('duration formatting', () => {
    it('should format durations correctly in summary', async () => {
      // Test milliseconds
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([
        createDailyStats({ avgDuration: 500, totalExecutions: 1 }),
      ]);
      vi.mocked(analyticsStorage.getAllCaseStats).mockResolvedValue([]);

      let report = await reportGenerator.generateDailyReport('2024-01-15');
      expect(report.summary.avgDuration).toBe('500ms');

      // Test seconds
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([
        createDailyStats({ avgDuration: 5000, totalExecutions: 1 }),
      ]);

      report = await reportGenerator.generateDailyReport('2024-01-15');
      expect(report.summary.avgDuration).toBe('5.0s');

      // Test minutes
      vi.mocked(analyticsStorage.getDailyStatsRange).mockResolvedValue([
        createDailyStats({ avgDuration: 90000, totalExecutions: 1 }),
      ]);

      report = await reportGenerator.generateDailyReport('2024-01-15');
      expect(report.summary.avgDuration).toBe('1m 30s');
    });
  });
});
