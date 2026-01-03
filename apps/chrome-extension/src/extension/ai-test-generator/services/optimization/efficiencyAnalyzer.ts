/**
 * Efficiency Analyzer
 * Analyzes test execution efficiency and identifies optimization opportunities
 */

import type { ExecutionRecord, StepRecord } from '../../types/analytics';
import type {
  Bottleneck,
  BottleneckType,
  CaseGroup,
  EfficiencyAnalysis,
  ParallelizationPlan,
  ResourceStats,
  SlowCase,
  SlowStep,
} from '../../types/optimization';
import type { IEfficiencyAnalyzer } from './interfaces';
import { analyticsStorage } from '../analytics/analyticsStorage';

// Thresholds for analysis
const SLOW_CASE_PERCENTILE = 90; // Cases slower than 90% are considered slow
const SLOW_STEP_THRESHOLD = 5000; // Steps taking > 5s are slow
const EXCESSIVE_WAIT_THRESHOLD = 3000; // Waits > 3s are excessive
const MIN_EXECUTIONS_FOR_ANALYSIS = 5;

class EfficiencyAnalyzer implements IEfficiencyAnalyzer {
  /**
   * Run full efficiency analysis
   */
  async analyze(): Promise<EfficiencyAnalysis> {
    const executions = await analyticsStorage.getRecentExecutions(1000);

    if (executions.length === 0) {
      return this.createEmptyAnalysis();
    }

    const [slowestCases, bottlenecks, parallelization, resources] =
      await Promise.all([
        this.identifySlowCases(10),
        this.findBottlenecks(),
        this.suggestParallelization(),
        this.analyzeResourceUtilization(executions),
      ]);

    const durations = executions.map((e) => e.duration);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const averageDuration = totalDuration / executions.length;

    return {
      totalDuration,
      averageDuration,
      slowestCases,
      bottlenecks,
      parallelizationOpportunity: parallelization,
      resourceUtilization: resources,
    };
  }

  /**
   * Identify slowest test cases
   */
  async identifySlowCases(limit = 10): Promise<SlowCase[]> {
    const caseStats = await analyticsStorage.getAllCaseStats();

    if (caseStats.length === 0) {
      return [];
    }

    // Sort by average duration descending
    const sortedCases = [...caseStats].sort(
      (a, b) => b.avgDuration - a.avgDuration,
    );

    // Calculate percentile threshold
    const durations = caseStats.map((c) => c.avgDuration).sort((a, b) => a - b);
    const percentileIndex = Math.floor(
      (durations.length * SLOW_CASE_PERCENTILE) / 100,
    );
    const percentileThreshold = durations[percentileIndex] || 0;

    const slowCases: SlowCase[] = [];

    for (const stats of sortedCases.slice(0, limit)) {
      if (stats.avgDuration < percentileThreshold) continue;

      // Get recent executions to analyze slow steps
      const executions = await analyticsStorage.getExecutionsByCaseId(
        stats.caseId,
      );
      const slowSteps = this.analyzeSlowSteps(executions);

      const percentile = this.calculatePercentile(
        stats.avgDuration,
        durations,
      );

      slowCases.push({
        caseId: stats.caseId,
        caseName: stats.caseName,
        averageDuration: stats.avgDuration,
        percentile,
        slowSteps,
      });
    }

    return slowCases;
  }

  /**
   * Find execution bottlenecks
   */
  async findBottlenecks(): Promise<Bottleneck[]> {
    const executions = await analyticsStorage.getRecentExecutions(500);
    const bottlenecks: Bottleneck[] = [];

    // Analyze sequential dependencies
    const sequentialIssues = this.findSequentialDependencies(executions);
    if (sequentialIssues.length > 0) {
      bottlenecks.push({
        type: 'sequential_dependency',
        description: `${sequentialIssues.length} test cases have sequential dependencies`,
        affectedCases: sequentialIssues,
        suggestion: 'Consider extracting shared setup to beforeAll/beforeEach hooks',
      });
    }

    // Analyze excessive waiting
    const waitIssues = this.findExcessiveWaiting(executions);
    if (waitIssues.cases.length > 0) {
      bottlenecks.push({
        type: 'excessive_waiting',
        description: `${waitIssues.totalWaitTime}ms of excessive waiting detected`,
        affectedCases: waitIssues.cases,
        suggestion: 'Replace fixed waits with intelligent wait strategies',
      });
    }

    // Analyze slow operations
    const slowOps = this.findSlowOperations(executions);
    if (slowOps.length > 0) {
      bottlenecks.push({
        type: 'slow_operation',
        description: `${slowOps.length} slow operations identified`,
        affectedCases: [...new Set(slowOps.map((o) => o.caseId))],
        suggestion: 'Optimize slow operations or move to background processing',
      });
    }

    return bottlenecks;
  }

  /**
   * Suggest parallelization opportunities
   */
  async suggestParallelization(): Promise<ParallelizationPlan> {
    const caseStats = await analyticsStorage.getAllCaseStats();
    const executions = await analyticsStorage.getRecentExecutions(500);

    // Default values
    const currentParallel = 1;
    const recommendedParallel = Math.min(4, Math.ceil(caseStats.length / 5));

    // Find independent test groups
    const independentGroups = this.findIndependentGroups(executions);

    // Estimate time saving
    const totalDuration = caseStats.reduce((sum, c) => sum + c.avgDuration, 0);
    const parallelDuration = this.estimateParallelDuration(
      caseStats,
      recommendedParallel,
    );
    const estimatedSaving =
      totalDuration > 0
        ? ((totalDuration - parallelDuration) / totalDuration) * 100
        : 0;

    return {
      currentParallel,
      recommendedParallel,
      estimatedSaving: Math.round(estimatedSaving),
      independentGroups,
    };
  }

  /**
   * Analyze slow steps within executions
   */
  private analyzeSlowSteps(executions: ExecutionRecord[]): SlowStep[] {
    if (executions.length === 0) return [];

    // Aggregate step durations
    const stepDurations = new Map<
      number,
      { total: number; count: number; description: string }
    >();

    for (const exec of executions) {
      for (const step of exec.steps) {
        const existing = stepDurations.get(step.index);
        if (existing) {
          existing.total += step.duration;
          existing.count++;
        } else {
          stepDurations.set(step.index, {
            total: step.duration,
            count: 1,
            description: step.description,
          });
        }
      }
    }

    // Find slow steps
    const slowSteps: SlowStep[] = [];

    for (const [index, data] of stepDurations) {
      const avgDuration = data.total / data.count;
      if (avgDuration > SLOW_STEP_THRESHOLD) {
        slowSteps.push({
          order: index,
          description: data.description,
          duration: avgDuration,
          averageDuration: avgDuration,
          suggestion: this.getSuggestionForSlowStep(data.description, avgDuration),
        });
      }
    }

    return slowSteps.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Get suggestion for optimizing a slow step
   */
  private getSuggestionForSlowStep(
    description: string,
    duration: number,
  ): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('wait') || lowerDesc.includes('delay')) {
      return 'Consider using smart wait strategies instead of fixed delays';
    }
    if (lowerDesc.includes('navigate') || lowerDesc.includes('goto')) {
      return 'Consider caching page state or using faster navigation methods';
    }
    if (lowerDesc.includes('scroll')) {
      return 'Consider scrolling to element directly instead of gradual scroll';
    }
    if (lowerDesc.includes('type') || lowerDesc.includes('input')) {
      return 'Consider using direct value setting instead of character-by-character typing';
    }
    if (duration > 10000) {
      return 'This step is very slow. Consider breaking it into smaller steps or optimizing the underlying operation';
    }

    return 'Review this step for optimization opportunities';
  }

  /**
   * Find cases with sequential dependencies
   */
  private findSequentialDependencies(executions: ExecutionRecord[]): string[] {
    // Group executions by case
    const caseExecutions = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = caseExecutions.get(exec.caseId);
      if (existing) {
        existing.push(exec);
      } else {
        caseExecutions.set(exec.caseId, [exec]);
      }
    }

    const dependentCases: string[] = [];

    // Analyze step patterns for dependencies
    for (const [caseId, execs] of caseExecutions) {
      if (execs.length < MIN_EXECUTIONS_FOR_ANALYSIS) continue;

      // Check if first steps consistently involve setup that could be shared
      const firstSteps = execs.map((e) => e.steps[0]?.description || '');
      const uniqueFirstSteps = new Set(firstSteps);

      if (
        uniqueFirstSteps.size === 1 &&
        this.isSetupStep(firstSteps[0])
      ) {
        dependentCases.push(caseId);
      }
    }

    return dependentCases;
  }

  /**
   * Check if a step description indicates setup
   */
  private isSetupStep(description: string): boolean {
    const setupKeywords = ['login', 'navigate', 'setup', 'init', 'open', 'goto'];
    const lowerDesc = description.toLowerCase();
    return setupKeywords.some((keyword) => lowerDesc.includes(keyword));
  }

  /**
   * Find excessive waiting in test executions
   */
  private findExcessiveWaiting(
    executions: ExecutionRecord[],
  ): { cases: string[]; totalWaitTime: number } {
    const affectedCases = new Set<string>();
    let totalWaitTime = 0;

    for (const exec of executions) {
      for (const step of exec.steps) {
        if (
          step.duration > EXCESSIVE_WAIT_THRESHOLD &&
          this.isWaitStep(step.description)
        ) {
          affectedCases.add(exec.caseId);
          totalWaitTime += step.duration - EXCESSIVE_WAIT_THRESHOLD;
        }
      }
    }

    return {
      cases: [...affectedCases],
      totalWaitTime,
    };
  }

  /**
   * Check if a step is a wait step
   */
  private isWaitStep(description: string): boolean {
    const waitKeywords = ['wait', 'delay', 'sleep', 'pause'];
    const lowerDesc = description.toLowerCase();
    return waitKeywords.some((keyword) => lowerDesc.includes(keyword));
  }

  /**
   * Find slow operations across executions
   */
  private findSlowOperations(
    executions: ExecutionRecord[],
  ): { caseId: string; stepIndex: number; duration: number }[] {
    const slowOps: { caseId: string; stepIndex: number; duration: number }[] =
      [];

    for (const exec of executions) {
      for (const step of exec.steps) {
        if (step.duration > SLOW_STEP_THRESHOLD) {
          slowOps.push({
            caseId: exec.caseId,
            stepIndex: step.index,
            duration: step.duration,
          });
        }
      }
    }

    return slowOps;
  }

  /**
   * Find independent test groups for parallelization
   */
  private findIndependentGroups(executions: ExecutionRecord[]): CaseGroup[] {
    // Group by URL/feature (simple heuristic)
    const urlGroups = new Map<string, Set<string>>();

    for (const exec of executions) {
      const baseUrl = this.extractBaseUrl(exec.environment.url);
      const existing = urlGroups.get(baseUrl);
      if (existing) {
        existing.add(exec.caseId);
      } else {
        urlGroups.set(baseUrl, new Set([exec.caseId]));
      }
    }

    const groups: CaseGroup[] = [];
    let groupIndex = 0;

    for (const [url, caseIds] of urlGroups) {
      if (caseIds.size > 1) {
        groups.push({
          groupId: `group-${groupIndex++}`,
          caseIds: [...caseIds],
          reason: `Tests targeting ${url} can run in parallel`,
        });
      }
    }

    return groups;
  }

  /**
   * Extract base URL from full URL
   */
  private extractBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.split('/').slice(0, 2).join('/')}`;
    } catch {
      return url;
    }
  }

  /**
   * Estimate parallel execution duration
   */
  private estimateParallelDuration(
    caseStats: { avgDuration: number }[],
    parallelCount: number,
  ): number {
    if (caseStats.length === 0 || parallelCount === 0) return 0;

    const durations = caseStats.map((c) => c.avgDuration).sort((a, b) => b - a);

    // Simple estimation: divide into parallel buckets
    const buckets: number[] = new Array(parallelCount).fill(0);

    for (const duration of durations) {
      // Add to the bucket with minimum total time
      const minBucketIndex = buckets.indexOf(Math.min(...buckets));
      buckets[minBucketIndex] += duration;
    }

    return Math.max(...buckets);
  }

  /**
   * Analyze resource utilization
   */
  private async analyzeResourceUtilization(
    executions: ExecutionRecord[],
  ): Promise<ResourceStats> {
    // Estimate based on execution data
    const avgStepsPerCase =
      executions.length > 0
        ? executions.reduce((sum, e) => sum + e.steps.length, 0) /
          executions.length
        : 0;

    // Rough estimates
    const screenshotSize = avgStepsPerCase * 50 * 1024; // ~50KB per screenshot
    const logSize = avgStepsPerCase * 1024; // ~1KB per step log

    return {
      screenshotSize,
      logSize,
      browserInstances: 1,
    };
  }

  /**
   * Calculate percentile of a value in a sorted array
   */
  private calculatePercentile(value: number, sortedValues: number[]): number {
    const index = sortedValues.findIndex((v) => v >= value);
    if (index === -1) return 100;
    return Math.round((index / sortedValues.length) * 100);
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(): EfficiencyAnalysis {
    return {
      totalDuration: 0,
      averageDuration: 0,
      slowestCases: [],
      bottlenecks: [],
      parallelizationOpportunity: {
        currentParallel: 1,
        recommendedParallel: 1,
        estimatedSaving: 0,
        independentGroups: [],
      },
      resourceUtilization: {
        screenshotSize: 0,
        logSize: 0,
        browserInstances: 1,
      },
    };
  }
}

export const efficiencyAnalyzer = new EfficiencyAnalyzer();
