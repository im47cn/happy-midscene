/**
 * Quality Gate Service
 *
 * Main quality gate evaluator using the rule engine.
 */

import type {
  CIExecutionResult,
  QualityGateConfig,
  QualityGateResult,
} from '../../types/ci';
import { RuleEngine, getRuleEngine } from './ruleEngine';

/**
 * Evaluate quality gate against test results
 */
export async function evaluateQualityGate(
  results: CIExecutionResult | null,
  config: QualityGateConfig,
): Promise<QualityGateResult> {
  const engine = getRuleEngine();

  // Provide default empty result if null
  const defaultResults: CIExecutionResult = results ?? {
    executionId: 'default',
    platform: 'local',
    status: 'passed',
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    passRate: 100,
    duration: 0,
  };

  return engine.evaluate(defaultResults, config);
}

/**
 * Evaluate quality gate with custom baseline for new failures detection
 */
export async function evaluateQualityGateWithBaseline(
  results: CIExecutionResult,
  config: QualityGateConfig,
  baseline?: CIExecutionResult | null,
): Promise<QualityGateResult> {
  const engine = getRuleEngine();

  // If baseline is provided, update the new failures rule
  if (baseline) {
    const { NewFailuresRule } = await import('./rules');
    const newFailuresRule = new NewFailuresRule({ baseline });
    engine.register(newFailuresRule, { threshold: config.maxNewFailures });
  }

  return engine.evaluate(results, config);
}

/**
 * Check if quality gate passed and return appropriate exit code
 */
export function getExitCode(result: QualityGateResult): number {
  return result.passed ? 0 : 1;
}

/**
 * Format quality gate result for display
 */
export function formatQualityGateResult(result: QualityGateResult): string {
  const lines: string[] = [];

  lines.push('Quality Gate Evaluation');
  lines.push('='.repeat(40));

  if (result.passed) {
    lines.push('✅ PASSED');
  } else {
    lines.push('❌ FAILED');
  }

  lines.push('');
  lines.push('Rule Results:');
  lines.push('-'.repeat(40));

  for (const rule of result.rules) {
    const status = rule.passed ? '✅ PASS' : '❌ FAIL';
    const blocking = rule.blocking !== false ? ' [blocking]' : '';
    lines.push(`  ${status}${blocking} - ${rule.ruleName}`);
    lines.push(`    Actual: ${rule.actual}, Expected: ${rule.expected}`);
    if (rule.error) {
      lines.push(`    Error: ${rule.error}`);
    }
  }

  return lines.join('\n');
}
