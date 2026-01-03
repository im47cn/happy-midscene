/**
 * Stability Analyzer
 * Analyzes test stability and identifies flaky tests
 */

import type { CaseStats, ExecutionRecord } from '../../types/analytics';
import type {
  EnvironmentIssue,
  FailurePattern,
  FlakyTestAnalysis,
  RootCause,
  StabilityAnalysis,
} from '../../types/optimization';
import type { IStabilityAnalyzer } from './interfaces';
import { analyticsStorage } from '../analytics/analyticsStorage';

// Thresholds for stability analysis
const FLAKY_THRESHOLD = 0.1; // 10% flaky rate
const HIGH_FLAKY_THRESHOLD = 0.3; // 30% flaky rate
const MIN_RUNS_FOR_ANALYSIS = 5;
const PATTERN_MIN_OCCURRENCES = 3;

class StabilityAnalyzer implements IStabilityAnalyzer {
  /**
   * Run full stability analysis
   */
  async analyze(): Promise<StabilityAnalysis> {
    const [flakyTests, failurePatterns, environmentIssues] = await Promise.all([
      this.identifyFlakyTests(),
      this.findPatterns(),
      this.analyzeEnvironmentIssues(),
    ]);

    // Calculate overall stability score
    const caseStats = await analyticsStorage.getAllCaseStats();
    const overallScore = this.calculateOverallScore(caseStats, flakyTests);

    return {
      overallScore,
      flakyTests,
      failurePatterns,
      environmentIssues,
    };
  }

  /**
   * Identify flaky tests
   */
  async identifyFlakyTests(): Promise<FlakyTestAnalysis[]> {
    const caseStats = await analyticsStorage.getAllCaseStats();
    const flakyTests: FlakyTestAnalysis[] = [];

    for (const stats of caseStats) {
      if (stats.totalRuns < MIN_RUNS_FOR_ANALYSIS) continue;

      // Calculate flaky rate from recent results
      const flakyRate = this.calculateFlakyRate(stats.recentResults);

      if (flakyRate >= FLAKY_THRESHOLD) {
        // Get execution history for root cause analysis
        const executions = await analyticsStorage.getExecutionsByCaseId(
          stats.caseId,
        );
        const rootCauses = this.analyzeRootCauses(executions);
        const recommendations = this.generateRecommendations(rootCauses);

        flakyTests.push({
          caseId: stats.caseId,
          caseName: stats.caseName,
          flakyRate,
          totalRuns: stats.totalRuns,
          passCount: Math.round(stats.totalRuns * stats.passRate),
          failCount: stats.totalRuns - Math.round(stats.totalRuns * stats.passRate),
          rootCauses,
          recommendations,
        });
      }
    }

    // Sort by flaky rate descending
    return flakyTests.sort((a, b) => b.flakyRate - a.flakyRate);
  }

  /**
   * Find failure patterns across tests
   */
  async findPatterns(): Promise<FailurePattern[]> {
    const executions = await analyticsStorage.getFailedExecutions(500);
    const patterns: FailurePattern[] = [];

    // Group failures by error message
    const errorGroups = new Map<
      string,
      { caseIds: Set<string>; count: number }
    >();

    for (const exec of executions) {
      if (exec.failure) {
        const key = this.normalizeErrorMessage(exec.failure.message);
        const existing = errorGroups.get(key);
        if (existing) {
          existing.caseIds.add(exec.caseId);
          existing.count++;
        } else {
          errorGroups.set(key, {
            caseIds: new Set([exec.caseId]),
            count: 1,
          });
        }
      }
    }

    // Convert to patterns
    let patternIndex = 0;
    for (const [message, data] of errorGroups) {
      if (data.count >= PATTERN_MIN_OCCURRENCES) {
        const commonFactor = this.identifyCommonFactor(message);
        patterns.push({
          patternId: `pattern-${patternIndex++}`,
          pattern: message,
          frequency: data.count,
          affectedCases: [...data.caseIds],
          commonFactor,
          solution: this.getSolutionForPattern(message, commonFactor),
        });
      }
    }

    // Sort by frequency descending
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Suggest fixes for a specific case
   */
  async suggestFixes(caseId: string): Promise<string[]> {
    const executions = await analyticsStorage.getExecutionsByCaseId(caseId);

    if (executions.length === 0) {
      return ['No execution history available for analysis'];
    }

    const rootCauses = this.analyzeRootCauses(executions);
    return this.generateRecommendations(rootCauses);
  }

  /**
   * Analyze environment issues across tests
   */
  private async analyzeEnvironmentIssues(): Promise<EnvironmentIssue[]> {
    const executions = await analyticsStorage.getFailedExecutions(500);
    const issues: EnvironmentIssue[] = [];

    // Analyze browser-related issues
    const browserIssues = this.analyzeBrowserIssues(executions);
    if (browserIssues) {
      issues.push(browserIssues);
    }

    // Analyze viewport-related issues
    const viewportIssues = this.analyzeViewportIssues(executions);
    if (viewportIssues) {
      issues.push(viewportIssues);
    }

    // Analyze timing-related issues
    const timingIssues = this.analyzeTimingIssues(executions);
    if (timingIssues) {
      issues.push(timingIssues);
    }

    return issues;
  }

  /**
   * Calculate flaky rate from recent results
   */
  private calculateFlakyRate(
    results: ('passed' | 'failed')[],
  ): number {
    if (results.length < 2) return 0;

    let flips = 0;
    for (let i = 1; i < results.length; i++) {
      if (results[i] !== results[i - 1]) {
        flips++;
      }
    }

    return flips / (results.length - 1);
  }

  /**
   * Analyze root causes from execution history
   */
  private analyzeRootCauses(executions: ExecutionRecord[]): RootCause[] {
    const causes: RootCause[] = [];
    const failedExecutions = executions.filter((e) => e.status === 'failed');

    if (failedExecutions.length === 0) return causes;

    // Analyze timing patterns
    const timingIssues = this.detectTimingIssues(failedExecutions);
    if (timingIssues.detected) {
      causes.push({
        type: 'timing',
        description: timingIssues.description,
        confidence: timingIssues.confidence,
      });
    }

    // Analyze network issues
    const networkIssues = this.detectNetworkIssues(failedExecutions);
    if (networkIssues.detected) {
      causes.push({
        type: 'network',
        description: networkIssues.description,
        confidence: networkIssues.confidence,
      });
    }

    // Analyze data dependencies
    const dataIssues = this.detectDataDependencies(failedExecutions);
    if (dataIssues.detected) {
      causes.push({
        type: 'data_dependency',
        description: dataIssues.description,
        confidence: dataIssues.confidence,
      });
    }

    // Analyze race conditions
    const raceConditions = this.detectRaceConditions(failedExecutions);
    if (raceConditions.detected) {
      causes.push({
        type: 'race_condition',
        description: raceConditions.description,
        confidence: raceConditions.confidence,
      });
    }

    // If no specific cause found, mark as unknown
    if (causes.length === 0) {
      causes.push({
        type: 'unknown',
        description: 'Unable to determine specific root cause',
        confidence: 0.5,
      });
    }

    return causes.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect timing-related issues
   */
  private detectTimingIssues(executions: ExecutionRecord[]): {
    detected: boolean;
    description: string;
    confidence: number;
  } {
    const timeoutFailures = executions.filter(
      (e) => e.failure?.type === 'timeout',
    );
    const hasTimingKeywords = executions.some((e) =>
      e.failure?.message.toLowerCase().includes('timeout'),
    );

    if (timeoutFailures.length > 0 || hasTimingKeywords) {
      return {
        detected: true,
        description: 'Tests fail due to timing issues or timeouts',
        confidence: 0.8,
      };
    }

    return { detected: false, description: '', confidence: 0 };
  }

  /**
   * Detect network-related issues
   */
  private detectNetworkIssues(executions: ExecutionRecord[]): {
    detected: boolean;
    description: string;
    confidence: number;
  } {
    const networkFailures = executions.filter(
      (e) => e.failure?.type === 'network_error',
    );
    const hasNetworkKeywords = executions.some((e) => {
      const msg = e.failure?.message.toLowerCase() || '';
      return (
        msg.includes('network') ||
        msg.includes('connection') ||
        msg.includes('fetch')
      );
    });

    if (networkFailures.length > 0 || hasNetworkKeywords) {
      return {
        detected: true,
        description: 'Tests fail due to network instability',
        confidence: 0.75,
      };
    }

    return { detected: false, description: '', confidence: 0 };
  }

  /**
   * Detect data dependency issues
   */
  private detectDataDependencies(executions: ExecutionRecord[]): {
    detected: boolean;
    description: string;
    confidence: number;
  } {
    const hasDataKeywords = executions.some((e) => {
      const msg = e.failure?.message.toLowerCase() || '';
      return (
        msg.includes('not found') ||
        msg.includes('undefined') ||
        msg.includes('null') ||
        msg.includes('data')
      );
    });

    if (hasDataKeywords) {
      return {
        detected: true,
        description: 'Tests depend on specific data that may not be available',
        confidence: 0.6,
      };
    }

    return { detected: false, description: '', confidence: 0 };
  }

  /**
   * Detect race conditions
   */
  private detectRaceConditions(executions: ExecutionRecord[]): {
    detected: boolean;
    description: string;
    confidence: number;
  } {
    // Check for intermittent failures at different steps
    const failureSteps = executions
      .filter((e) => e.failure)
      .map((e) => e.failure!.stepIndex);
    const uniqueSteps = new Set(failureSteps);

    // If failures occur at multiple different steps, might be race condition
    if (uniqueSteps.size > 2) {
      return {
        detected: true,
        description:
          'Tests fail at different steps, suggesting race conditions',
        confidence: 0.5,
      };
    }

    return { detected: false, description: '', confidence: 0 };
  }

  /**
   * Generate recommendations based on root causes
   */
  private generateRecommendations(causes: RootCause[]): string[] {
    const recommendations: string[] = [];

    for (const cause of causes) {
      switch (cause.type) {
        case 'timing':
          recommendations.push('Add explicit waits for elements to be visible/clickable');
          recommendations.push('Use smart wait strategies instead of fixed delays');
          recommendations.push('Increase timeout values for slow operations');
          break;
        case 'network':
          recommendations.push('Add retry logic for network requests');
          recommendations.push('Mock external API calls in tests');
          recommendations.push('Add network stability checks before critical operations');
          break;
        case 'data_dependency':
          recommendations.push('Use dedicated test data fixtures');
          recommendations.push('Reset test data before each test run');
          recommendations.push('Avoid relying on shared state between tests');
          break;
        case 'race_condition':
          recommendations.push('Add proper synchronization between actions');
          recommendations.push('Wait for specific conditions before proceeding');
          recommendations.push('Avoid parallel operations that may conflict');
          break;
        case 'environment':
          recommendations.push('Ensure consistent test environment');
          recommendations.push('Use containerized testing environment');
          break;
        default:
          recommendations.push('Review failed test logs for more details');
          recommendations.push('Add more detailed error logging');
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Analyze browser-related issues
   */
  private analyzeBrowserIssues(
    executions: ExecutionRecord[],
  ): EnvironmentIssue | null {
    const browserGroups = new Map<string, number>();

    for (const exec of executions) {
      const browser = exec.environment.browser;
      browserGroups.set(browser, (browserGroups.get(browser) || 0) + 1);
    }

    // Check if failures are concentrated in specific browser
    if (browserGroups.size > 1) {
      const entries = [...browserGroups.entries()].sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((sum, [_, count]) => sum + count, 0);
      const topBrowser = entries[0];

      if (topBrowser[1] / total > 0.7) {
        return {
          type: 'browser',
          description: `70%+ of failures occur in ${topBrowser[0]}`,
          affectedCases: executions
            .filter((e) => e.environment.browser === topBrowser[0])
            .map((e) => e.caseId),
          suggestion: `Review browser-specific behavior for ${topBrowser[0]}`,
        };
      }
    }

    return null;
  }

  /**
   * Analyze viewport-related issues
   */
  private analyzeViewportIssues(
    executions: ExecutionRecord[],
  ): EnvironmentIssue | null {
    const mobileViewports = executions.filter(
      (e) => e.environment.viewport.width < 768,
    );

    if (mobileViewports.length > executions.length * 0.5) {
      return {
        type: 'viewport',
        description: 'High failure rate on mobile viewports',
        affectedCases: mobileViewports.map((e) => e.caseId),
        suggestion: 'Add responsive design tests and mobile-specific handling',
      };
    }

    return null;
  }

  /**
   * Analyze timing-related environment issues
   */
  private analyzeTimingIssues(
    executions: ExecutionRecord[],
  ): EnvironmentIssue | null {
    const timeoutExecutions = executions.filter(
      (e) => e.failure?.type === 'timeout',
    );

    if (timeoutExecutions.length > executions.length * 0.3) {
      return {
        type: 'timing',
        description: 'High rate of timeout failures detected',
        affectedCases: [...new Set(timeoutExecutions.map((e) => e.caseId))],
        suggestion: 'Review and increase timeout values, add retry logic',
      };
    }

    return null;
  }

  /**
   * Normalize error message for pattern matching
   */
  private normalizeErrorMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .slice(0, 100); // Limit length
  }

  /**
   * Identify common factor in error pattern
   */
  private identifyCommonFactor(pattern: string): string {
    if (pattern.includes('timeout')) return 'Timing/Wait Issues';
    if (pattern.includes('not found') || pattern.includes('element'))
      return 'Element Locator Issues';
    if (pattern.includes('network') || pattern.includes('fetch'))
      return 'Network Issues';
    if (pattern.includes('assert') || pattern.includes('expect'))
      return 'Assertion Failures';
    return 'Unknown';
  }

  /**
   * Get solution for a failure pattern
   */
  private getSolutionForPattern(pattern: string, factor: string): string {
    switch (factor) {
      case 'Timing/Wait Issues':
        return 'Add explicit waits or increase timeout values';
      case 'Element Locator Issues':
        return 'Use more stable selectors or add element existence checks';
      case 'Network Issues':
        return 'Add network stability checks or mock external calls';
      case 'Assertion Failures':
        return 'Review assertion logic and expected values';
      default:
        return 'Review error logs and add defensive checks';
    }
  }

  /**
   * Calculate overall stability score
   */
  private calculateOverallScore(
    caseStats: CaseStats[],
    flakyTests: FlakyTestAnalysis[],
  ): number {
    if (caseStats.length === 0) return 100;

    // Average stability from case stats
    const avgStability =
      caseStats.reduce((sum, c) => sum + c.stabilityScore, 0) / caseStats.length;

    // Penalty for flaky tests
    const flakyPenalty =
      (flakyTests.length / caseStats.length) * 30; // Up to 30 point penalty

    // Penalty for high flaky rates
    const highFlakyPenalty = flakyTests
      .filter((f) => f.flakyRate >= HIGH_FLAKY_THRESHOLD)
      .length * 5;

    const score = Math.max(0, avgStability - flakyPenalty - highFlakyPenalty);
    return Math.round(score);
  }
}

export const stabilityAnalyzer = new StabilityAnalyzer();
