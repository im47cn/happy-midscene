/**
 * Rule Types
 *
 * Shared types for quality gate rules.
 */

import type { CIExecutionResult } from '../../../types/ci';

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  /** Rule identifier */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Whether rule passed */
  passed: boolean;
  /** Actual value */
  actual: number | string;
  /** Expected threshold */
  expected: number | string;
  /** Error message (if failed) */
  error?: string;
  /** Whether this rule blocks deployment */
  blocking?: boolean;
}

/**
 * Quality rule interface
 */
export interface QualityRule {
  /** Rule identifier */
  readonly id: string;
  /** Rule name */
  readonly name: string;
  /** Rule description */
  readonly description: string;
  /** Whether this rule blocks deployment by default */
  readonly blocking: boolean;

  /**
   * Evaluate the rule against test results
   */
  evaluate(results: CIExecutionResult, threshold: number): RuleEvaluationResult;
}
