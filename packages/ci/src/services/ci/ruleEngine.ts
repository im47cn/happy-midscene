/**
 * Rule Engine
 *
 * Manages rule registration and execution for quality gates.
 */

import { getDebug } from '@midscene/shared/logger';
import type {
  CIExecutionResult,
  QualityGateConfig,
  QualityGateResult,
  QualityGateRuleResult,
} from '../../types/ci';
import type { QualityRule, RuleEvaluationResult } from './rules/types';
import {
  CriticalTestsRule,
  FlakyTestsRule,
  NewFailuresRule,
  PassRateRule,
} from './rules';

const debug = getDebug('ci:rule-engine');

/**
 * Rule registry entry
 */
interface RuleEntry {
  rule: QualityRule;
  enabled: boolean;
  threshold: number;
}

/**
 * Rule Engine for quality gate evaluation
 */
export class RuleEngine {
  private rules: Map<string, RuleEntry> = new Map();

  constructor() {
    // Register built-in rules
    this.registerBuiltinRules();
  }

  /**
   * Register a new rule
   */
  register(rule: QualityRule, options?: { enabled?: boolean; threshold?: number }): void {
    this.rules.set(rule.id, {
      rule,
      enabled: options?.enabled ?? true,
      threshold: options?.threshold ?? 0,
    });
    debug(`Registered rule: ${rule.id} (${rule.name})`);
  }

  /**
   * Unregister a rule
   */
  unregister(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      debug(`Unregistered rule: ${ruleId}`);
    }
  }

  /**
   * Enable a rule
   */
  enable(ruleId: string): void {
    const entry = this.rules.get(ruleId);
    if (entry) {
      entry.enabled = true;
      debug(`Enabled rule: ${ruleId}`);
    }
  }

  /**
   * Disable a rule
   */
  disable(ruleId: string): void {
    const entry = this.rules.get(ruleId);
    if (entry) {
      entry.enabled = false;
      debug(`Disabled rule: ${ruleId}`);
    }
  }

  /**
   * Set threshold for a rule
   */
  setThreshold(ruleId: string, threshold: number): void {
    const entry = this.rules.get(ruleId);
    if (entry) {
      entry.threshold = threshold;
      debug(`Set threshold for ${ruleId}: ${threshold}`);
    }
  }

  /**
   * Get all registered rules
   */
  getRules(): QualityRule[] {
    return Array.from(this.rules.values()).map((entry) => entry.rule);
  }

  /**
   * Evaluate all enabled rules against test results
   */
  evaluate(
    results: CIExecutionResult,
    config: QualityGateConfig,
  ): QualityGateResult {
    // Apply config settings
    this.applyConfig(config);

    const ruleResults: QualityGateRuleResult[] = [];

    for (const [ruleId, entry] of this.rules.entries()) {
      if (!entry.enabled) {
        continue;
      }

      try {
        const evaluation = entry.rule.evaluate(results, entry.threshold);
        ruleResults.push(evaluation);
        debug(
          `Rule ${ruleId}: ${evaluation.passed ? 'PASS' : 'FAIL'} (${evaluation.actual} vs ${evaluation.expected})`,
        );
      } catch (error) {
        debug(`Error evaluating rule ${ruleId}: ${error}`);
        ruleResults.push({
          ruleId,
          ruleName: entry.rule.name,
          passed: false,
          actual: 'error',
          expected: 'success',
          error: `Rule evaluation failed: ${error}`,
        });
      }
    }

    // Check if any blocking rules failed
    const blockingFailures = ruleResults.filter(
      (r) => !r.passed && r.blocking !== false,
    );

    return {
      passed: blockingFailures.length === 0,
      rules: ruleResults,
    };
  }

  /**
   * Apply quality gate configuration to rules
   */
  private applyConfig(config: QualityGateConfig): void {
    // Pass rate rule
    if (config.enabled !== false) {
      this.setThreshold('pass-rate', config.passRateThreshold);
    } else {
      // Disable all if quality gate is disabled
      for (const ruleId of this.rules.keys()) {
        this.disable(ruleId);
      }
      return;
    }

    // Critical tests rule
    if (config.criticalTestsMustPass) {
      this.enable('critical-tests');
    } else {
      this.disable('critical-tests');
    }

    // New failures rule
    this.setThreshold('new-failures', config.maxNewFailures);

    // Flaky tests rule
    this.setThreshold('flaky-tests', config.maxFlakyTests);

    // Custom rules
    if (config.customRules) {
      for (const customRule of config.customRules) {
        // Custom rules are evaluated separately
        this.registerCustomRule(customRule);
      }
    }
  }

  /**
   * Register a custom rule from config
   */
  private registerCustomRule(ruleConfig: {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: number | string;
    blocking: boolean;
  }): void {
    // Create a dynamic rule from config
    const customRule: QualityRule = {
      id: ruleConfig.id,
      name: ruleConfig.name,
      description: `Custom rule for ${ruleConfig.metric}`,
      blocking: ruleConfig.blocking,
      evaluate: (results: CIExecutionResult, _threshold: number): RuleEvaluationResult => {
        const actual = this.getMetricValue(results, ruleConfig.metric);
        const passed = this.compareValues(
          actual,
          ruleConfig.threshold,
          ruleConfig.operator,
        );

        return {
          ruleId: ruleConfig.id,
          ruleName: ruleConfig.name,
          passed,
          actual: String(actual),
          expected: `${ruleConfig.operator} ${ruleConfig.threshold}`,
          blocking: ruleConfig.blocking,
          error: passed
            ? undefined
            : `Custom rule ${ruleConfig.name} failed: ${actual} ${ruleConfig.operator} ${ruleConfig.threshold}`,
        };
      },
    };

    this.register(customRule, { threshold: Number(ruleConfig.threshold) });
  }

  /**
   * Get metric value from results
   */
  private getMetricValue(results: CIExecutionResult, metric: string): number {
    switch (metric) {
      case 'pass-rate':
        return results.passRate;
      case 'total':
        return results.totalTests;
      case 'passed':
        return results.passed;
      case 'failed':
        return results.failed;
      case 'skipped':
        return results.skipped;
      case 'flaky':
        return results.flaky ?? 0;
      case 'duration':
        return results.duration;
      default:
        return 0;
    }
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: number,
    expected: number | string,
    operator: string,
  ): boolean {
    const expectedNum = Number(expected);
    if (isNaN(expectedNum)) {
      return false;
    }

    switch (operator) {
      case 'eq':
        return actual === expectedNum;
      case 'gt':
        return actual > expectedNum;
      case 'gte':
        return actual >= expectedNum;
      case 'lt':
        return actual < expectedNum;
      case 'lte':
        return actual <= expectedNum;
      case 'percentage':
        return actual >= expectedNum;
      default:
        return false;
    }
  }

  /**
   * Register built-in rules
   */
  private registerBuiltinRules(): void {
    // Pass rate rule - threshold set from config
    this.register(new PassRateRule(), { enabled: true, threshold: 80 });

    // Critical tests rule - threshold not used
    this.register(new CriticalTestsRule(), { enabled: false, threshold: 0 });

    // New failures rule
    this.register(new NewFailuresRule(), { enabled: true, threshold: 10 });

    // Flaky tests rule
    this.register(new FlakyTestsRule(), { enabled: true, threshold: 5 });

    debug(`Registered ${this.rules.size} built-in rules`);
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.rules.clear();
    this.registerBuiltinRules();
    debug('Reset rule engine to default state');
  }
}

/**
 * Global rule engine instance
 */
let globalRuleEngine: RuleEngine | null = null;

/**
 * Get or create the global rule engine instance
 */
export function getRuleEngine(): RuleEngine {
  if (!globalRuleEngine) {
    globalRuleEngine = new RuleEngine();
  }
  return globalRuleEngine;
}

/**
 * Reset the global rule engine
 */
export function resetRuleEngine(): void {
  if (globalRuleEngine) {
    globalRuleEngine.reset();
  }
  globalRuleEngine = null;
}
