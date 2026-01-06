/**
 * Pass Rate Rule
 *
 * Checks if the overall pass rate meets the threshold.
 */

import type { CIExecutionResult } from '../../../types/ci';
import type { QualityRule, RuleEvaluationResult } from './types';

/**
 * Pass rate quality gate rule
 */
export class PassRateRule implements QualityRule {
  readonly id = 'pass-rate';
  readonly name = 'Pass Rate';
  readonly description = 'Overall test pass rate must meet minimum threshold';
  readonly blocking = true;

  evaluate(
    results: CIExecutionResult,
    threshold: number,
  ): RuleEvaluationResult {
    const passRate = results.passRate ?? 0;
    const passed = passRate >= threshold;

    return {
      ruleId: this.id,
      ruleName: this.name,
      passed,
      actual: `${passRate.toFixed(1)}%`,
      expected: `>= ${threshold}%`,
      blocking: this.blocking,
      error: passed
        ? undefined
        : `Pass rate ${passRate.toFixed(1)}% is below threshold ${threshold}%`,
    };
  }
}
