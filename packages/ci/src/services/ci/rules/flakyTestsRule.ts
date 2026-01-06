/**
 * Flaky Tests Rule
 *
 * Checks if the number of flaky tests exceeds the limit.
 */

import type { CIExecutionResult, TestCaseResult } from '../../../types/ci';
import type { QualityRule, RuleEvaluationResult } from './types';

/**
 * Flaky tests quality gate rule
 */
export class FlakyTestsRule implements QualityRule {
  readonly id = 'flaky-tests';
  readonly name = 'Flaky Tests';
  readonly description = 'Number of flaky tests must not exceed limit';
  readonly blocking = false;

  evaluate(
    results: CIExecutionResult,
    threshold: number,
  ): RuleEvaluationResult {
    const flakyCount = this.countFlakyTests(results);
    const passed = flakyCount <= threshold;

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed,
      actual: `${flakyCount}`,
      expected: `<= ${threshold}`,
      blocking: this.blocking,
      error: passed
        ? undefined
        : `${flakyCount} flaky tests exceeds limit ${threshold}`,
    };
  }

  /**
   * Count flaky tests from results
   * A test is considered flaky if:
   * 1. It's marked as flaky in the results
   * 2. It has retryCount > 0 and eventually passed
   */
  private countFlakyTests(results: CIExecutionResult): number {
    // First check the explicit flaky count
    if (results.flaky !== undefined) {
      return results.flaky;
    }

    // Count tests that have retryCount > 0 and eventually passed
    const tests = results.tests || results.testCases || [];
    return tests.filter(
      (t: TestCaseResult) =>
        (t.retryCount !== undefined &&
          t.retryCount > 0 &&
          t.status === 'passed') ||
        t.status === 'flaky',
    ).length;
  }
}
