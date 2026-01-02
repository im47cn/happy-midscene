/**
 * Failure Analyzer Service
 * Provides detailed failure analysis and correlation detection
 */

import type {
  ExecutionRecord,
  FailureType,
  Hotspot,
  FAILURE_TYPE_LABELS,
} from '../../types/analytics';
import { analyticsStorage } from './analyticsStorage';

/**
 * Failure pattern detected by the analyzer
 */
export interface FailurePattern {
  type: 'consecutive' | 'time_based' | 'correlated';
  description: string;
  affectedCases: string[];
  occurrences: number;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

/**
 * Failure correlation between two test cases
 */
export interface FailureCorrelation {
  caseIdA: string;
  caseNameA: string;
  caseIdB: string;
  caseNameB: string;
  correlation: number; // 0-1, higher means stronger correlation
  coFailures: number;
}

/**
 * Time-based failure distribution
 */
export interface TimeDistribution {
  hour: number;
  failures: number;
  total: number;
  failureRate: number;
}

class FailureAnalyzer {
  /**
   * Analyze failures by type
   */
  async analyzeByType(
    startTime: number,
    endTime: number
  ): Promise<{
    distribution: Record<FailureType, { count: number; percentage: number }>;
    total: number;
    dominantType: FailureType | null;
  }> {
    const executions = await analyticsStorage.getExecutionsByTimeRange(
      startTime,
      endTime
    );
    const failures = executions.filter((e) => e.status === 'failed');

    const counts: Record<FailureType, number> = {
      locator_failed: 0,
      assertion_failed: 0,
      timeout: 0,
      network_error: 0,
      script_error: 0,
      unknown: 0,
    };

    for (const f of failures) {
      if (f.failure) {
        counts[f.failure.type]++;
      } else {
        counts.unknown++;
      }
    }

    const total = failures.length;
    const distribution: Record<
      FailureType,
      { count: number; percentage: number }
    > = {} as any;
    let maxCount = 0;
    let dominantType: FailureType | null = null;

    for (const [type, count] of Object.entries(counts)) {
      distribution[type as FailureType] = {
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
      if (count > maxCount) {
        maxCount = count;
        dominantType = type as FailureType;
      }
    }

    return { distribution, total, dominantType };
  }

  /**
   * Analyze failure hotspots with detailed step information
   */
  async analyzeHotspots(limit: number = 10): Promise<Hotspot[]> {
    const failures = await analyticsStorage.getFailedExecutions(1000);

    if (failures.length === 0) {
      return [];
    }

    // Group by step description and failure type
    const stepMap = new Map<
      string,
      {
        count: number;
        type: FailureType;
        stepIndex: number;
        cases: Set<string>;
      }
    >();

    for (const f of failures) {
      if (f.failure && f.steps[f.failure.stepIndex]) {
        const step = f.steps[f.failure.stepIndex];
        const key = `${step.description}:${f.failure.type}`;

        const existing = stepMap.get(key);
        if (existing) {
          existing.count++;
          existing.cases.add(f.caseId);
        } else {
          stepMap.set(key, {
            count: 1,
            type: f.failure.type,
            stepIndex: f.failure.stepIndex,
            cases: new Set([f.caseId]),
          });
        }
      }
    }

    // Convert to hotspots
    const hotspots: Hotspot[] = Array.from(stepMap.entries())
      .map(([key, data]) => ({
        description: key.split(':')[0],
        stepIndex: data.stepIndex,
        failureCount: data.count,
        percentage: (data.count / failures.length) * 100,
        failureType: data.type,
      }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, limit);

    return hotspots;
  }

  /**
   * Detect failure patterns
   */
  async detectPatterns(): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];

    // Detect consecutive failures
    const consecutivePatterns = await this.detectConsecutiveFailures();
    patterns.push(...consecutivePatterns);

    // Detect time-based patterns
    const timePatterns = await this.detectTimeBasedPatterns();
    patterns.push(...timePatterns);

    // Detect correlated failures
    const correlatedPatterns = await this.detectCorrelatedFailures();
    patterns.push(...correlatedPatterns);

    return patterns.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Detect consecutive failures for cases
   */
  private async detectConsecutiveFailures(): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];
    const caseStats = await analyticsStorage.getAllCaseStats();

    for (const stats of caseStats) {
      // Check for 3+ consecutive failures
      const results = stats.recentResults;
      let consecutiveFails = 0;
      let maxConsecutive = 0;

      for (const result of results) {
        if (result === 'failed') {
          consecutiveFails++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveFails);
        } else {
          consecutiveFails = 0;
        }
      }

      if (maxConsecutive >= 3) {
        patterns.push({
          type: 'consecutive',
          description: `"${stats.caseName}" 连续失败 ${maxConsecutive} 次`,
          affectedCases: [stats.caseId],
          occurrences: maxConsecutive,
          severity: maxConsecutive >= 5 ? 'high' : 'medium',
          suggestion: '检查测试环境或用例实现是否有问题',
        });
      }
    }

    return patterns;
  }

  /**
   * Detect time-based failure patterns
   */
  private async detectTimeBasedPatterns(): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];
    const recentExecutions = await analyticsStorage.getRecentExecutions(500);

    // Group by hour
    const hourStats = new Map<
      number,
      { failures: number; total: number; cases: Set<string> }
    >();

    for (const exec of recentExecutions) {
      const hour = new Date(exec.startTime).getHours();
      const existing = hourStats.get(hour) || {
        failures: 0,
        total: 0,
        cases: new Set(),
      };
      existing.total++;
      if (exec.status === 'failed') {
        existing.failures++;
        existing.cases.add(exec.caseId);
      }
      hourStats.set(hour, existing);
    }

    // Find hours with high failure rates
    for (const [hour, stats] of hourStats) {
      if (stats.total >= 5) {
        const failRate = stats.failures / stats.total;
        if (failRate > 0.5) {
          patterns.push({
            type: 'time_based',
            description: `${hour}:00 - ${hour + 1}:00 时段失败率较高 (${(failRate * 100).toFixed(1)}%)`,
            affectedCases: Array.from(stats.cases),
            occurrences: stats.failures,
            severity: failRate > 0.7 ? 'high' : 'medium',
            suggestion: '考虑检查该时段的系统负载或定时任务',
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect correlated failures (cases that tend to fail together)
   */
  private async detectCorrelatedFailures(): Promise<FailurePattern[]> {
    const patterns: FailurePattern[] = [];
    const correlations = await this.calculateFailureCorrelations();

    // Find strong correlations
    for (const corr of correlations) {
      if (corr.correlation > 0.6 && corr.coFailures >= 3) {
        patterns.push({
          type: 'correlated',
          description: `"${corr.caseNameA}" 与 "${corr.caseNameB}" 经常同时失败`,
          affectedCases: [corr.caseIdA, corr.caseIdB],
          occurrences: corr.coFailures,
          severity: corr.correlation > 0.8 ? 'high' : 'medium',
          suggestion: '可能存在共同依赖或环境问题，建议排查共享资源',
        });
      }
    }

    return patterns;
  }

  /**
   * Calculate failure correlations between cases
   */
  async calculateFailureCorrelations(): Promise<FailureCorrelation[]> {
    const recentExecutions = await analyticsStorage.getRecentExecutions(1000);
    const correlations: FailureCorrelation[] = [];

    // Group executions by time window (e.g., same hour)
    const timeWindows = new Map<string, ExecutionRecord[]>();
    for (const exec of recentExecutions) {
      const windowKey = this.getTimeWindow(exec.startTime);
      const existing = timeWindows.get(windowKey) || [];
      existing.push(exec);
      timeWindows.set(windowKey, existing);
    }

    // Calculate co-failure counts between cases
    const caseMap = new Map<string, string>(); // caseId -> caseName
    const failurePairs = new Map<string, number>();
    const caseFailures = new Map<string, number>();

    for (const executions of timeWindows.values()) {
      const failedCases = executions
        .filter((e) => e.status === 'failed')
        .map((e) => {
          caseMap.set(e.caseId, e.caseName);
          return e.caseId;
        });

      // Count individual failures
      for (const caseId of failedCases) {
        caseFailures.set(caseId, (caseFailures.get(caseId) || 0) + 1);
      }

      // Count co-failures
      for (let i = 0; i < failedCases.length; i++) {
        for (let j = i + 1; j < failedCases.length; j++) {
          const key = [failedCases[i], failedCases[j]].sort().join(':');
          failurePairs.set(key, (failurePairs.get(key) || 0) + 1);
        }
      }
    }

    // Calculate correlation coefficients
    for (const [key, coFailures] of failurePairs) {
      const [caseIdA, caseIdB] = key.split(':');
      const failuresA = caseFailures.get(caseIdA) || 0;
      const failuresB = caseFailures.get(caseIdB) || 0;

      if (failuresA > 0 && failuresB > 0) {
        // Simple correlation: co-failures / min(failuresA, failuresB)
        const correlation = coFailures / Math.min(failuresA, failuresB);

        if (correlation > 0.3) {
          correlations.push({
            caseIdA,
            caseNameA: caseMap.get(caseIdA) || caseIdA,
            caseIdB,
            caseNameB: caseMap.get(caseIdB) || caseIdB,
            correlation,
            coFailures,
          });
        }
      }
    }

    return correlations.sort((a, b) => b.correlation - a.correlation);
  }

  /**
   * Get time distribution of failures
   */
  async getTimeDistribution(
    startTime: number,
    endTime: number
  ): Promise<TimeDistribution[]> {
    const executions = await analyticsStorage.getExecutionsByTimeRange(
      startTime,
      endTime
    );

    const hourStats = new Map<number, { failures: number; total: number }>();

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      hourStats.set(h, { failures: 0, total: 0 });
    }

    // Count executions by hour
    for (const exec of executions) {
      const hour = new Date(exec.startTime).getHours();
      const stats = hourStats.get(hour)!;
      stats.total++;
      if (exec.status === 'failed') {
        stats.failures++;
      }
    }

    return Array.from(hourStats.entries()).map(([hour, stats]) => ({
      hour,
      failures: stats.failures,
      total: stats.total,
      failureRate: stats.total > 0 ? (stats.failures / stats.total) * 100 : 0,
    }));
  }

  /**
   * Get failure details for a specific case
   */
  async getCaseFailureDetails(caseId: string): Promise<{
    totalFailures: number;
    failuresByType: Record<FailureType, number>;
    commonFailureSteps: Array<{
      description: string;
      count: number;
      lastOccurred: number;
    }>;
    recentFailures: ExecutionRecord[];
  }> {
    const executions = await analyticsStorage.getExecutionsByCaseId(caseId);
    const failures = executions.filter((e) => e.status === 'failed');

    const failuresByType: Record<FailureType, number> = {
      locator_failed: 0,
      assertion_failed: 0,
      timeout: 0,
      network_error: 0,
      script_error: 0,
      unknown: 0,
    };

    const stepFailures = new Map<
      string,
      { count: number; lastOccurred: number }
    >();

    for (const f of failures) {
      if (f.failure) {
        failuresByType[f.failure.type]++;

        const step = f.steps[f.failure.stepIndex];
        if (step) {
          const existing = stepFailures.get(step.description);
          if (existing) {
            existing.count++;
            existing.lastOccurred = Math.max(existing.lastOccurred, f.startTime);
          } else {
            stepFailures.set(step.description, {
              count: 1,
              lastOccurred: f.startTime,
            });
          }
        }
      } else {
        failuresByType.unknown++;
      }
    }

    const commonFailureSteps = Array.from(stepFailures.entries())
      .map(([description, data]) => ({
        description,
        count: data.count,
        lastOccurred: data.lastOccurred,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFailures: failures.length,
      failuresByType,
      commonFailureSteps,
      recentFailures: failures.slice(0, 10),
    };
  }

  /**
   * Generate failure suggestions based on failure type
   */
  getSuggestions(failureType: FailureType): string[] {
    const suggestions: Record<FailureType, string[]> = {
      locator_failed: [
        '检查元素定位器是否正确',
        '考虑启用自愈功能',
        '增加等待时间或使用显式等待',
        '检查页面是否正确加载',
      ],
      assertion_failed: [
        '验证期望值是否正确',
        '检查数据依赖是否满足',
        '考虑使用更灵活的断言条件',
      ],
      timeout: [
        '增加超时时间配置',
        '检查网络连接和服务响应',
        '优化页面加载性能',
      ],
      network_error: [
        '检查网络连接稳定性',
        '验证 API 端点是否可用',
        '检查代理或防火墙设置',
      ],
      script_error: [
        '检查测试脚本语法',
        '验证变量和函数定义',
        '查看详细的错误堆栈信息',
      ],
      unknown: [
        '查看详细的执行日志',
        '检查测试环境状态',
        '尝试重新执行以确认问题',
      ],
    };

    return suggestions[failureType] || suggestions.unknown;
  }

  /**
   * Get time window key for correlation analysis
   */
  private getTimeWindow(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.toISOString().split('T')[0]}-${date.getHours()}`;
  }
}

export const failureAnalyzer = new FailureAnalyzer();
