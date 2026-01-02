/**
 * Analysis Engine
 * Provides analytics computations and insights
 */

import type {
  DailyStats,
  CaseStats,
  HealthScore,
  Hotspot,
  DashboardOverview,
  TimeRange,
  DateRange,
  FailureType,
  DEFAULT_FAILURES_BY_TYPE,
} from '../../types/analytics';
import { analyticsStorage } from './analyticsStorage';

class AnalysisEngine {
  /**
   * Get dashboard overview data
   */
  async getDashboardOverview(
    timeRange: TimeRange,
    customRange?: DateRange
  ): Promise<DashboardOverview> {
    const { startDate, endDate } = this.getDateRange(timeRange, customRange);
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).setHours(23, 59, 59, 999);

    // Get daily stats for the range
    const dailyStats = await analyticsStorage.getDailyStatsRange(
      startDate,
      endDate
    );

    // Get all case stats
    const caseStats = await analyticsStorage.getAllCaseStats();

    // Calculate KPIs
    const totalExecutions = dailyStats.reduce(
      (sum, d) => sum + d.totalExecutions,
      0
    );
    const totalPassed = dailyStats.reduce((sum, d) => sum + d.passed, 0);
    const passRate =
      totalExecutions > 0 ? (totalPassed / totalExecutions) * 100 : 0;

    // Calculate average duration
    const avgDuration = this.calculateWeightedAvgDuration(dailyStats);

    // Calculate trends (compare with previous period)
    const passRateTrend = await this.calculatePassRateTrend(
      timeRange,
      passRate
    );
    const avgDurationTrend = await this.calculateDurationTrend(
      timeRange,
      avgDuration
    );

    // Get health score
    const healthScore = await this.calculateHealthScore();

    // Aggregate failure types
    const failuresByType = this.aggregateFailuresByType(dailyStats);

    // Get failure hotspots
    const hotspots = await this.analyzeFailureHotspots();

    // Categorize cases
    const stableCases = caseStats.filter(
      (c) => c.stabilityScore >= 80 && !c.isFlaky
    ).length;
    const flakyCases = caseStats.filter((c) => c.isFlaky).length;
    const unstableCases = caseStats.filter(
      (c) => c.stabilityScore < 50 && !c.isFlaky
    ).length;

    return {
      timeRange,
      dateRange: customRange,
      totalExecutions,
      passRate,
      passRateTrend,
      avgDuration,
      avgDurationTrend,
      healthScore,
      dailyStats,
      failuresByType,
      hotspots,
      totalCases: caseStats.length,
      stableCases,
      flakyCases,
      unstableCases,
    };
  }

  /**
   * Calculate overall health score
   */
  async calculateHealthScore(): Promise<HealthScore> {
    const recentDays = 7;
    const { startDate, endDate } = this.getDateRange('7days');

    const dailyStats = await analyticsStorage.getDailyStatsRange(
      startDate,
      endDate
    );
    const caseStats = await analyticsStorage.getAllCaseStats();

    // Pass rate component (0-100)
    const totalExec = dailyStats.reduce((s, d) => s + d.totalExecutions, 0);
    const totalPassed = dailyStats.reduce((s, d) => s + d.passed, 0);
    const passRateScore = totalExec > 0 ? (totalPassed / totalExec) * 100 : 100;

    // Stability component (0-100)
    const avgStability =
      caseStats.length > 0
        ? caseStats.reduce((s, c) => s + c.stabilityScore, 0) / caseStats.length
        : 100;

    // Performance component (0-100)
    // Assuming target duration is 30s, score decreases as duration increases
    const avgDuration = this.calculateWeightedAvgDuration(dailyStats);
    const targetDuration = 30000; // 30 seconds
    const performanceScore = Math.max(
      0,
      100 - ((avgDuration - targetDuration) / targetDuration) * 50
    );

    // Coverage component (placeholder, could be based on actual coverage data)
    const coverageScore = caseStats.length > 0 ? 70 : 0;

    // Calculate overall score
    const overall = Math.round(
      passRateScore * 0.4 +
        avgStability * 0.35 +
        Math.min(100, performanceScore) * 0.15 +
        coverageScore * 0.1
    );

    // Determine trend
    const trend = await this.calculateHealthTrend(overall);

    return {
      overall,
      components: {
        passRate: Math.round(passRateScore),
        stability: Math.round(avgStability),
        performance: Math.round(Math.min(100, performanceScore)),
        coverage: Math.round(coverageScore),
      },
      trend,
    };
  }

  /**
   * Analyze failure hotspots
   */
  async analyzeFailureHotspots(limit: number = 10): Promise<Hotspot[]> {
    const failures = await analyticsStorage.getFailedExecutions(1000);

    if (failures.length === 0) {
      return [];
    }

    // Group by step description
    const stepFailures = new Map<
      string,
      { count: number; type?: FailureType; stepIndex?: number }
    >();

    for (const f of failures) {
      if (f.failure) {
        const failedStep = f.steps[f.failure.stepIndex];
        const key = failedStep?.description || f.failure.message;

        const existing = stepFailures.get(key);
        if (existing) {
          existing.count++;
        } else {
          stepFailures.set(key, {
            count: 1,
            type: f.failure.type,
            stepIndex: f.failure.stepIndex,
          });
        }
      }
    }

    // Convert to hotspots and sort
    const hotspots: Hotspot[] = Array.from(stepFailures.entries())
      .map(([description, data]) => ({
        description,
        failureCount: data.count,
        percentage: (data.count / failures.length) * 100,
        failureType: data.type,
        stepIndex: data.stepIndex,
      }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, limit);

    return hotspots;
  }

  /**
   * Get flaky tests
   */
  async getFlakyCases(): Promise<CaseStats[]> {
    return analyticsStorage.getFlakyCases();
  }

  /**
   * Get case statistics with sorting
   */
  async getCaseStatsSorted(
    sortBy: 'passRate' | 'stability' | 'lastRun' | 'totalRuns' = 'lastRun',
    ascending: boolean = false
  ): Promise<CaseStats[]> {
    const cases = await analyticsStorage.getAllCaseStats();

    cases.sort((a, b) => {
      let comparison: number;
      switch (sortBy) {
        case 'passRate':
          comparison = a.passRate - b.passRate;
          break;
        case 'stability':
          comparison = a.stabilityScore - b.stabilityScore;
          break;
        case 'totalRuns':
          comparison = a.totalRuns - b.totalRuns;
          break;
        case 'lastRun':
        default:
          comparison = a.lastRun - b.lastRun;
          break;
      }
      return ascending ? comparison : -comparison;
    });

    return cases;
  }

  /**
   * Get date range for a time range option
   */
  getDateRange(
    timeRange: TimeRange,
    customRange?: DateRange
  ): { startDate: string; endDate: string } {
    const now = new Date();
    const endDate = this.formatDate(now);

    if (timeRange === 'custom' && customRange) {
      return customRange;
    }

    let daysAgo: number;
    switch (timeRange) {
      case 'today':
        daysAgo = 0;
        break;
      case '7days':
        daysAgo = 6;
        break;
      case '30days':
        daysAgo = 29;
        break;
      default:
        daysAgo = 6;
    }

    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() - daysAgo);
    const startDate = this.formatDate(startTime);

    return { startDate, endDate };
  }

  /**
   * Calculate pass rate trend compared to previous period
   */
  private async calculatePassRateTrend(
    timeRange: TimeRange,
    currentPassRate: number
  ): Promise<number> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const daysDiff =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24);

    // Get previous period
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

    const prevStats = await analyticsStorage.getDailyStatsRange(
      this.formatDate(prevStartDate),
      this.formatDate(prevEndDate)
    );

    const prevTotal = prevStats.reduce((s, d) => s + d.totalExecutions, 0);
    const prevPassed = prevStats.reduce((s, d) => s + d.passed, 0);
    const prevPassRate = prevTotal > 0 ? (prevPassed / prevTotal) * 100 : 0;

    return prevPassRate > 0 ? currentPassRate - prevPassRate : 0;
  }

  /**
   * Calculate duration trend compared to previous period
   */
  private async calculateDurationTrend(
    timeRange: TimeRange,
    currentDuration: number
  ): Promise<number> {
    const { startDate, endDate } = this.getDateRange(timeRange);
    const daysDiff =
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
      (1000 * 60 * 60 * 24);

    // Get previous period
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

    const prevStats = await analyticsStorage.getDailyStatsRange(
      this.formatDate(prevStartDate),
      this.formatDate(prevEndDate)
    );

    const prevDuration = this.calculateWeightedAvgDuration(prevStats);

    if (prevDuration > 0) {
      return ((currentDuration - prevDuration) / prevDuration) * 100;
    }
    return 0;
  }

  /**
   * Calculate health trend
   */
  private async calculateHealthTrend(
    currentScore: number
  ): Promise<'improving' | 'stable' | 'declining'> {
    // Compare with 7 days ago
    const prevEndDate = new Date();
    prevEndDate.setDate(prevEndDate.getDate() - 7);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);

    const prevStats = await analyticsStorage.getDailyStatsRange(
      this.formatDate(prevStartDate),
      this.formatDate(prevEndDate)
    );

    const prevTotal = prevStats.reduce((s, d) => s + d.totalExecutions, 0);
    const prevPassed = prevStats.reduce((s, d) => s + d.passed, 0);
    const prevPassRate = prevTotal > 0 ? (prevPassed / prevTotal) * 100 : 50;

    const diff = currentScore - prevPassRate * 0.5;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  /**
   * Calculate weighted average duration from daily stats
   */
  private calculateWeightedAvgDuration(dailyStats: DailyStats[]): number {
    const totalExec = dailyStats.reduce((s, d) => s + d.totalExecutions, 0);
    if (totalExec === 0) return 0;

    const weightedSum = dailyStats.reduce(
      (s, d) => s + d.avgDuration * d.totalExecutions,
      0
    );
    return weightedSum / totalExec;
  }

  /**
   * Aggregate failure types from daily stats
   */
  private aggregateFailuresByType(
    dailyStats: DailyStats[]
  ): Record<FailureType, number> {
    const result: Record<FailureType, number> = {
      locator_failed: 0,
      assertion_failed: 0,
      timeout: 0,
      network_error: 0,
      script_error: 0,
      unknown: 0,
    };

    for (const stats of dailyStats) {
      for (const [type, count] of Object.entries(stats.failuresByType)) {
        result[type as FailureType] += count;
      }
    }

    return result;
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export const analysisEngine = new AnalysisEngine();
