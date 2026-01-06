/**
 * New Failures Rule
 *
 * Checks if the number of new failures exceeds the limit.
 * Compares against a baseline of known failures.
 */

import type { CIExecutionResult, TestCaseResult } from '../../../types/ci';
import type { QualityRule, RuleEvaluationResult } from './types';

/**
 * Baseline comparison options
 */
interface BaselineOptions {
  /** Baseline results to compare against */
  baseline?: CIExecutionResult | null;
  /** Paths of known failing tests */
  knownFailures?: string[];
}

/**
 * New failures quality gate rule
 */
export class NewFailuresRule implements QualityRule {
  readonly id = 'new-failures';
  readonly name = 'New Failures';
  readonly description = 'Number of new failures must not exceed limit';
  readonly blocking = true;

  private options?: BaselineOptions;

  constructor(options?: BaselineOptions) {
    this.options = options;
  }

  evaluate(
    results: CIExecutionResult,
    threshold: number,
  ): RuleEvaluationResult {
    const newFailures = this.countNewFailures(results);
    const passed = newFailures <= threshold;

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed,
      actual: `${newFailures}`,
      expected: `<= ${threshold}`,
      blocking: this.blocking,
      error: passed
        ? undefined
        : `${newFailures} new failures exceeds limit ${threshold}`,
    };
  }

  /**
   * Count new failures by comparing with baseline
   */
  private countNewFailures(results: CIExecutionResult): number {
    const tests = results.tests || results.testCases || [];
    const currentlyFailing = new Set(
      tests
        .filter((t: TestCaseResult) => t.status === 'failed')
        .map((t: TestCaseResult) => t.id || t.name),
    );

    // If no baseline, count all failures as new
    if (!this.options?.baseline && !this.options?.knownFailures?.length) {
      return currentlyFailing.size;
    }

    // Use known failures list if provided
    if (this.options?.knownFailures?.length) {
      const knownSet = new Set(this.options.knownFailures);
      return Array.from(currentlyFailing).filter(
        (id: string) => !knownSet.has(id),
      ).length;
    }

    // Compare with baseline results
    if (this.options?.baseline) {
      const baselineTests =
        this.options.baseline.tests || this.options.baseline.testCases || [];
      const baselineFailing = new Set(
        baselineTests
          .filter((t: TestCaseResult) => t.status === 'failed')
          .map((t: TestCaseResult) => t.id || t.name),
      );

      return Array.from(currentlyFailing).filter(
        (id: string) => !baselineFailing.has(id),
      ).length;
    }

    return currentlyFailing.size;
  }
}
