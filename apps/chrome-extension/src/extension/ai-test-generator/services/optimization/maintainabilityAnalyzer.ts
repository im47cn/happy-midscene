/**
 * Maintainability Analyzer
 * Analyzes test maintainability and identifies quality issues
 */

import type { ExecutionRecord } from '../../types/analytics';
import type {
  BestPracticeViolation,
  MaintainabilityAnalysis,
  MaintainabilityIssue,
  Priority,
} from '../../types/optimization';
import type { IMaintainabilityAnalyzer } from './interfaces';
import { analyticsStorage } from '../analytics/analyticsStorage';

// Thresholds for maintainability checks
const MAX_STEPS_PER_CASE = 20;
const MAX_STEP_LENGTH = 200;
const HARDCODED_SELECTOR_PATTERNS = [
  /\[id=['"][\w-]+['"]\]/,
  /\[class=['"][^'"]+['"]\]/,
  /#[\w-]+/,
  /\.[\w-]+\.[\w-]+\.[\w-]+/, // Multiple class selectors
  /div\s*>\s*div\s*>\s*div/, // Deep nesting
  /\[data-testid\].*\[data-testid\]/, // Chained test IDs
];

// Best practice rules
const BEST_PRACTICE_RULES = [
  {
    id: 'no-hardcoded-selectors',
    name: 'Avoid hardcoded CSS selectors',
    description: 'Use semantic descriptions instead of CSS selectors',
    severity: 'medium' as Priority,
  },
  {
    id: 'step-count-limit',
    name: 'Keep test cases focused',
    description: 'Tests should have less than 20 steps',
    severity: 'medium' as Priority,
  },
  {
    id: 'use-cleanup',
    name: 'Add cleanup steps',
    description: 'Tests should clean up after themselves',
    severity: 'low' as Priority,
  },
  {
    id: 'descriptive-names',
    name: 'Use descriptive step names',
    description: 'Steps should clearly describe the action',
    severity: 'low' as Priority,
  },
  {
    id: 'avoid-fixed-waits',
    name: 'Avoid fixed wait times',
    description: 'Use smart waits instead of fixed delays',
    severity: 'high' as Priority,
  },
];

class MaintainabilityAnalyzer implements IMaintainabilityAnalyzer {
  /**
   * Run full maintainability analysis
   */
  async analyze(): Promise<MaintainabilityAnalysis> {
    const executions = await analyticsStorage.getRecentExecutions(500);
    const caseStats = await analyticsStorage.getAllCaseStats();

    const issues = this.identifyIssues(executions);
    const violations = await this.checkBestPractices();
    const suggestions = this.generateSuggestions(issues, violations);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      issues,
      violations,
      caseStats.length,
    );

    return {
      overallScore,
      issues,
      bestPracticeViolations: violations,
      improvementSuggestions: suggestions,
    };
  }

  /**
   * Evaluate complexity of a specific case
   */
  async evaluateComplexity(caseId: string): Promise<number> {
    const executions = await analyticsStorage.getExecutionsByCaseId(caseId);

    if (executions.length === 0) {
      return 0;
    }

    const latestExec = executions[0];
    const steps = latestExec.steps;

    // Complexity factors
    const stepCountScore = Math.min(100, (steps.length / MAX_STEPS_PER_CASE) * 100);
    const avgStepLength =
      steps.reduce((sum, s) => sum + s.description.length, 0) / steps.length;
    const stepLengthScore = Math.min(100, (avgStepLength / MAX_STEP_LENGTH) * 100);

    // Calculate weighted complexity
    return Math.round(stepCountScore * 0.6 + stepLengthScore * 0.4);
  }

  /**
   * Check best practice violations
   */
  async checkBestPractices(): Promise<BestPracticeViolation[]> {
    const executions = await analyticsStorage.getRecentExecutions(500);
    const violations: BestPracticeViolation[] = [];

    // Group by case
    const caseExecutions = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = caseExecutions.get(exec.caseId);
      if (existing) {
        existing.push(exec);
      } else {
        caseExecutions.set(exec.caseId, [exec]);
      }
    }

    // Check each rule
    for (const rule of BEST_PRACTICE_RULES) {
      const ruleViolations: {
        caseId: string;
        caseName: string;
        detail: string;
      }[] = [];

      for (const [caseId, execs] of caseExecutions) {
        const latestExec = execs[0];
        const violation = this.checkRule(rule.id, latestExec);
        if (violation) {
          ruleViolations.push({
            caseId,
            caseName: latestExec.caseName,
            detail: violation,
          });
        }
      }

      if (ruleViolations.length > 0) {
        violations.push({
          rule: rule.name,
          severity: rule.severity,
          violations: ruleViolations,
          recommendation: this.getRecommendation(rule.id),
        });
      }
    }

    return violations;
  }

  /**
   * Identify maintainability issues
   */
  private identifyIssues(executions: ExecutionRecord[]): MaintainabilityIssue[] {
    const issues: MaintainabilityIssue[] = [];

    // Group by case
    const caseExecutions = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = caseExecutions.get(exec.caseId);
      if (existing) {
        existing.push(exec);
      } else {
        caseExecutions.set(exec.caseId, [exec]);
      }
    }

    for (const [caseId, execs] of caseExecutions) {
      const latestExec = execs[0];
      const steps = latestExec.steps;

      // Check for long test cases
      if (steps.length > MAX_STEPS_PER_CASE) {
        issues.push({
          type: 'long_steps',
          severity: 'medium',
          caseId,
          caseName: latestExec.caseName,
          description: `Test has ${steps.length} steps (recommended: ${MAX_STEPS_PER_CASE})`,
          suggestion: 'Split into smaller, focused test cases',
        });
      }

      // Check for hardcoded selectors
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (this.hasHardcodedSelector(step.description)) {
          issues.push({
            type: 'hardcoded_selector',
            severity: 'medium',
            caseId,
            caseName: latestExec.caseName,
            description: `Step ${i + 1} uses hardcoded selector`,
            suggestion: 'Use semantic descriptions instead',
            location: { stepIndex: i },
          });
        }
      }

      // Check for missing cleanup
      if (!this.hasCleanupStep(steps)) {
        const hasStateChange = steps.some((s) =>
          this.isStateChangingStep(s.description),
        );
        if (hasStateChange) {
          issues.push({
            type: 'missing_cleanup',
            severity: 'low',
            caseId,
            caseName: latestExec.caseName,
            description: 'Test modifies state but lacks cleanup steps',
            suggestion: 'Add cleanup steps to restore initial state',
          });
        }
      }

      // Check for poor naming
      const poorlyNamedSteps = steps.filter((s) =>
        this.hasPoorNaming(s.description),
      );
      if (poorlyNamedSteps.length > 0) {
        issues.push({
          type: 'poor_naming',
          severity: 'low',
          caseId,
          caseName: latestExec.caseName,
          description: `${poorlyNamedSteps.length} steps have unclear names`,
          suggestion: 'Use descriptive names that explain the action',
        });
      }

      // Check for duplicate logic within case
      const duplicateSteps = this.findDuplicateStepsInCase(steps);
      if (duplicateSteps.length > 0) {
        issues.push({
          type: 'duplicate_logic',
          severity: 'low',
          caseId,
          caseName: latestExec.caseName,
          description: `Found ${duplicateSteps.length} duplicate step patterns`,
          suggestion: 'Extract common steps to reusable utilities',
        });
      }
    }

    return issues;
  }

  /**
   * Check if a step contains hardcoded selectors
   */
  private hasHardcodedSelector(description: string): boolean {
    return HARDCODED_SELECTOR_PATTERNS.some((pattern) =>
      pattern.test(description),
    );
  }

  /**
   * Check if execution has cleanup steps
   */
  private hasCleanupStep(
    steps: { description: string }[],
  ): boolean {
    const cleanupKeywords = [
      'cleanup',
      'reset',
      'restore',
      'clear',
      'logout',
      'delete',
      'remove',
    ];
    return steps.some((s) =>
      cleanupKeywords.some((k) => s.description.toLowerCase().includes(k)),
    );
  }

  /**
   * Check if step modifies state
   */
  private isStateChangingStep(description: string): boolean {
    const stateKeywords = [
      'create',
      'add',
      'submit',
      'save',
      'update',
      'delete',
      'register',
    ];
    const lower = description.toLowerCase();
    return stateKeywords.some((k) => lower.includes(k));
  }

  /**
   * Check for poor naming
   */
  private hasPoorNaming(description: string): boolean {
    // Too short
    if (description.length < 10) return true;

    // Only contains generic words
    const genericWords = ['click', 'tap', 'type', 'button', 'link', 'element'];
    const words = description.toLowerCase().split(/\s+/);
    const nonGenericWords = words.filter((w) => !genericWords.includes(w));
    return nonGenericWords.length < 2;
  }

  /**
   * Find duplicate step patterns within a case
   */
  private findDuplicateStepsInCase(
    steps: { description: string }[],
  ): string[] {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];

    for (const step of steps) {
      const normalized = step.description.toLowerCase().trim();
      const count = seen.get(normalized) || 0;
      if (count === 1) {
        duplicates.push(normalized);
      }
      seen.set(normalized, count + 1);
    }

    return duplicates;
  }

  /**
   * Check a specific rule against an execution
   */
  private checkRule(ruleId: string, exec: ExecutionRecord): string | null {
    switch (ruleId) {
      case 'no-hardcoded-selectors': {
        const hardcodedCount = exec.steps.filter((s) =>
          this.hasHardcodedSelector(s.description),
        ).length;
        if (hardcodedCount > 0) {
          return `${hardcodedCount} steps use hardcoded selectors`;
        }
        break;
      }
      case 'step-count-limit':
        if (exec.steps.length > MAX_STEPS_PER_CASE) {
          return `Has ${exec.steps.length} steps (limit: ${MAX_STEPS_PER_CASE})`;
        }
        break;
      case 'use-cleanup':
        if (
          !this.hasCleanupStep(exec.steps) &&
          exec.steps.some((s) => this.isStateChangingStep(s.description))
        ) {
          return 'Modifies state without cleanup';
        }
        break;
      case 'descriptive-names': {
        const poorNames = exec.steps.filter((s) =>
          this.hasPoorNaming(s.description),
        );
        if (poorNames.length > 2) {
          return `${poorNames.length} steps have unclear names`;
        }
        break;
      }
      case 'avoid-fixed-waits': {
        const fixedWaits = exec.steps.filter((s) => {
          const desc = s.description.toLowerCase();
          return (
            desc.includes('wait') &&
            (desc.includes('ms') || desc.includes('second'))
          );
        });
        if (fixedWaits.length > 0) {
          return `${fixedWaits.length} fixed wait steps found`;
        }
        break;
      }
    }
    return null;
  }

  /**
   * Get recommendation for a rule
   */
  private getRecommendation(ruleId: string): string {
    const recommendations: Record<string, string> = {
      'no-hardcoded-selectors':
        'Replace CSS selectors with semantic descriptions like "the submit button" or "the username field"',
      'step-count-limit':
        'Break large tests into smaller, focused scenarios that test one thing each',
      'use-cleanup':
        'Add cleanup steps at the end of tests that modify data or state',
      'descriptive-names':
        'Use action-oriented names like "Enter username in login form" instead of "type text"',
      'avoid-fixed-waits':
        'Use smart waits like "wait for element to be visible" instead of "wait 3 seconds"',
    };
    return recommendations[ruleId] || 'Review and fix the violations';
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(
    issues: MaintainabilityIssue[],
    violations: BestPracticeViolation[],
  ): string[] {
    const suggestions: string[] = [];

    // Group issues by type
    const issueTypes = new Map<string, number>();
    for (const issue of issues) {
      issueTypes.set(issue.type, (issueTypes.get(issue.type) || 0) + 1);
    }

    // Generate suggestions based on issue frequency
    if ((issueTypes.get('hardcoded_selector') || 0) > 5) {
      suggestions.push(
        'Consider adopting semantic selectors throughout the test suite',
      );
    }
    if ((issueTypes.get('long_steps') || 0) > 3) {
      suggestions.push(
        'Review and refactor long test cases into smaller, focused tests',
      );
    }
    if ((issueTypes.get('missing_cleanup') || 0) > 5) {
      suggestions.push(
        'Implement a cleanup framework to ensure tests don\'t affect each other',
      );
    }

    // Add violation-based suggestions
    const highSeverityViolations = violations.filter(
      (v) => v.severity === 'high',
    );
    if (highSeverityViolations.length > 0) {
      suggestions.push(
        'Address high-severity violations first: ' +
          highSeverityViolations.map((v) => v.rule).join(', '),
      );
    }

    // General suggestions
    if (suggestions.length === 0) {
      suggestions.push('Test suite follows most best practices');
      suggestions.push('Consider adding more documentation to complex tests');
    }

    return suggestions;
  }

  /**
   * Calculate overall maintainability score
   */
  private calculateOverallScore(
    issues: MaintainabilityIssue[],
    violations: BestPracticeViolation[],
    totalCases: number,
  ): number {
    if (totalCases === 0) return 100;

    // Penalty for issues
    const issuePenalty = issues.reduce((sum, issue) => {
      const severity: Record<Priority, number> = {
        critical: 10,
        high: 5,
        medium: 3,
        low: 1,
      };
      return sum + severity[issue.severity];
    }, 0);

    // Penalty for violations
    const violationPenalty = violations.reduce((sum, v) => {
      const severity: Record<Priority, number> = {
        critical: 8,
        high: 4,
        medium: 2,
        low: 1,
      };
      return sum + severity[v.severity] * v.violations.length;
    }, 0);

    // Normalize by number of cases
    const normalizedPenalty = (issuePenalty + violationPenalty) / totalCases;

    // Calculate score (100 - penalty, minimum 0)
    return Math.max(0, Math.round(100 - normalizedPenalty));
  }
}

export const maintainabilityAnalyzer = new MaintainabilityAnalyzer();
