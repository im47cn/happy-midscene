/**
 * Critical Tests Rule
 *
 * Ensures all critical tests pass.
 */

import type { CIExecutionResult } from '../../../types/ci';
import type { TestCaseResult } from '../../../types/ci';
import type { QualityRule, RuleEvaluationResult } from './types';

/**
 * Critical tests quality gate rule
 */
export class CriticalTestsRule implements QualityRule {
  readonly id = 'critical-tests';
  readonly name = 'Critical Tests';
  readonly description = 'All critical tests must pass';
  readonly blocking = true;

  evaluate(
    results: CIExecutionResult,
    _threshold: number,
  ): RuleEvaluationResult {
    const tests = results.tests || results.testCases || [];
    const criticalFailed = tests.filter(
      (t: TestCaseResult) => t.critical && t.status === 'failed',
    ).length;
    const passed = criticalFailed === 0;

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed,
      actual: `${criticalFailed} failed`,
      expected: '0 failed',
      blocking: this.blocking,
      error: passed ? undefined : `${criticalFailed} critical test(s) failed`,
    };
  }
}
