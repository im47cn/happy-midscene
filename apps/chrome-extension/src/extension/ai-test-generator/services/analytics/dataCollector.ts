/**
 * Data Collector Service
 * Collects and aggregates execution data for analytics
 */

import type {
  CaseStats,
  DEFAULT_FAILURES_BY_TYPE,
  DailyStats,
  ExecutionRecord,
  FailureType,
  StepRecord,
} from '../../types/analytics';
import { analyticsStorage } from './analyticsStorage';

const RECENT_RESULTS_LIMIT = 10;

class DataCollector {
  /**
   * Record a test execution
   */
  async recordExecution(record: ExecutionRecord): Promise<void> {
    // Store execution record
    await analyticsStorage.addExecution(record);

    // Update daily stats
    await this.updateDailyStats(record);

    // Update case stats
    await this.updateCaseStats(record);
  }

  /**
   * Update daily statistics based on a new execution
   */
  private async updateDailyStats(record: ExecutionRecord): Promise<void> {
    const date = this.formatDate(record.startTime);
    let stats = await analyticsStorage.getDailyStats(date);

    if (stats) {
      // Update existing stats
      stats.totalExecutions++;
      stats[record.status]++;

      // Update average duration
      const totalDuration =
        stats.avgDuration * (stats.totalExecutions - 1) + record.duration;
      stats.avgDuration = totalDuration / stats.totalExecutions;

      // Update failure types
      if (record.failure) {
        stats.failuresByType[record.failure.type]++;
      }
    } else {
      // Create new stats
      stats = {
        date,
        totalExecutions: 1,
        passed: record.status === 'passed' ? 1 : 0,
        failed: record.status === 'failed' ? 1 : 0,
        skipped: record.status === 'skipped' ? 1 : 0,
        error: record.status === 'error' ? 1 : 0,
        avgDuration: record.duration,
        failuresByType: {
          locator_failed: 0,
          assertion_failed: 0,
          timeout: 0,
          network_error: 0,
          script_error: 0,
          unknown: 0,
        },
      };

      if (record.failure) {
        stats.failuresByType[record.failure.type]++;
      }
    }

    await analyticsStorage.saveDailyStats(stats);
  }

  /**
   * Update case statistics based on a new execution
   */
  private async updateCaseStats(record: ExecutionRecord): Promise<void> {
    let stats = await analyticsStorage.getCaseStats(record.caseId);

    if (stats) {
      // Update existing stats
      stats.totalRuns++;
      stats.lastRun = record.startTime;

      // Update recent results
      const result: 'passed' | 'failed' =
        record.status === 'passed' ? 'passed' : 'failed';
      stats.recentResults = [result, ...stats.recentResults].slice(
        0,
        RECENT_RESULTS_LIMIT,
      ) as ('passed' | 'failed')[];

      // Recalculate pass rate
      const passCount = stats.recentResults.filter(
        (r) => r === 'passed',
      ).length;
      stats.passRate = (passCount / stats.recentResults.length) * 100;

      // Update average duration
      const totalDuration =
        stats.avgDuration * (stats.totalRuns - 1) + record.duration;
      stats.avgDuration = totalDuration / stats.totalRuns;

      // Update stability score and flaky status
      this.updateStabilityMetrics(stats);
    } else {
      // Create new stats
      const result = record.status === 'passed' ? 'passed' : 'failed';
      stats = {
        caseId: record.caseId,
        caseName: record.caseName,
        totalRuns: 1,
        passRate: record.status === 'passed' ? 100 : 0,
        avgDuration: record.duration,
        lastRun: record.startTime,
        stabilityScore: record.status === 'passed' ? 100 : 0,
        isFlaky: false,
        recentResults: [result],
      };
    }

    await analyticsStorage.saveCaseStats(stats);
  }

  /**
   * Update stability metrics for a case
   */
  private updateStabilityMetrics(stats: CaseStats): void {
    const results = stats.recentResults;
    if (results.length < 2) {
      stats.stabilityScore = stats.passRate;
      stats.isFlaky = false;
      return;
    }

    // Count transitions (pass->fail or fail->pass)
    let transitions = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i] !== results[i - 1]) {
        transitions++;
      }
    }

    // Calculate stability score
    // More transitions = less stable
    const transitionRate = transitions / (results.length - 1);
    const consistencyScore = (1 - transitionRate) * 100;

    // Combine with pass rate
    stats.stabilityScore = Math.round(
      stats.passRate * 0.6 + consistencyScore * 0.4,
    );

    // Determine if flaky
    // Flaky: has both passes and failures, and fail rate between 20-80%
    const failCount = results.filter((r) => r === 'failed').length;
    const failRate = failCount / results.length;
    stats.isFlaky =
      results.length >= 3 &&
      failRate > 0.2 &&
      failRate < 0.8 &&
      transitions >= 2;
  }

  /**
   * Create an execution record from raw execution data
   */
  createExecutionRecord(
    caseId: string,
    caseName: string,
    steps: StepRecord[],
    environment: ExecutionRecord['environment'],
    healing?: ExecutionRecord['healing'],
  ): ExecutionRecord {
    const now = Date.now();
    const startTime =
      steps.length > 0 ? now - this.calculateTotalDuration(steps) : now;

    // Determine overall status
    const failedStep = steps.find((s) => s.status === 'failed');
    const allPassed = steps.every(
      (s) => s.status === 'passed' || s.status === 'skipped',
    );
    const status = failedStep ? 'failed' : allPassed ? 'passed' : 'error';

    // Build failure info if any
    let failure: ExecutionRecord['failure'] | undefined;
    if (failedStep) {
      failure = {
        type: this.inferFailureType(failedStep.description),
        message: `Step ${failedStep.index + 1} failed: ${failedStep.description}`,
        stepIndex: failedStep.index,
      };
    }

    return {
      id: `exec-${now}-${Math.random().toString(36).substr(2, 9)}`,
      caseId,
      caseName,
      startTime,
      endTime: now,
      duration: this.calculateTotalDuration(steps),
      status,
      steps,
      failure,
      healing,
      environment,
    };
  }

  /**
   * Infer failure type from step description
   */
  private inferFailureType(description: string): FailureType {
    const lower = description.toLowerCase();

    if (
      lower.includes('click') ||
      lower.includes('locate') ||
      lower.includes('find') ||
      lower.includes('element')
    ) {
      return 'locator_failed';
    }

    if (
      lower.includes('assert') ||
      lower.includes('expect') ||
      lower.includes('verify') ||
      lower.includes('check')
    ) {
      return 'assertion_failed';
    }

    if (lower.includes('timeout') || lower.includes('wait')) {
      return 'timeout';
    }

    if (
      lower.includes('network') ||
      lower.includes('request') ||
      lower.includes('api')
    ) {
      return 'network_error';
    }

    if (lower.includes('script') || lower.includes('error')) {
      return 'script_error';
    }

    return 'unknown';
  }

  /**
   * Calculate total duration from steps
   */
  private calculateTotalDuration(steps: StepRecord[]): number {
    return steps.reduce((total, step) => total + step.duration, 0);
  }

  /**
   * Format timestamp to date string (YYYY-MM-DD)
   */
  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }

  /**
   * Get execution statistics for a time range
   */
  async getExecutionStats(
    startTime: number,
    endTime: number,
  ): Promise<{
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    avgDuration: number;
  }> {
    const executions = await analyticsStorage.getExecutionsByTimeRange(
      startTime,
      endTime,
    );

    if (executions.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
        avgDuration: 0,
      };
    }

    const passed = executions.filter((e) => e.status === 'passed').length;
    const failed = executions.filter(
      (e) => e.status === 'failed' || e.status === 'error',
    ).length;
    const totalDuration = executions.reduce((sum, e) => sum + e.duration, 0);

    return {
      total: executions.length,
      passed,
      failed,
      passRate: (passed / executions.length) * 100,
      avgDuration: totalDuration / executions.length,
    };
  }
}

export const dataCollector = new DataCollector();
