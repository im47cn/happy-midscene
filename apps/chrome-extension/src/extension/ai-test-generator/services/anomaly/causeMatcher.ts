/**
 * input: Evidence, historical patterns, rule definitions
 * output: Matched root causes with confidence scores
 * pos: Pattern matching engine for root cause identification
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  RootCause,
  RootCauseCategory,
  Evidence,
  Suggestion,
  Anomaly,
  AnomalyType,
} from '../../types/anomaly';
import type { CollectedEvidence, ExecutionContext } from './evidenceCollector';

// ============================================================================
// Types
// ============================================================================

export interface MatchRule {
  id: string;
  category: RootCauseCategory;
  name: string;
  description: string;
  conditions: MatchCondition[];
  suggestions: SuggestionTemplate[];
  baseConfidence: number;
}

export interface MatchCondition {
  type: 'evidence_type' | 'evidence_pattern' | 'anomaly_type' | 'metric_name' | 'severity';
  operator: 'equals' | 'contains' | 'matches' | 'in';
  value: string | string[] | RegExp;
  weight: number; // How much this condition contributes to confidence
  required: boolean; // If true, rule fails without this condition
}

export interface SuggestionTemplate {
  action: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
  conditions?: string[]; // Only include if these conditions matched
}

export interface MatchResult {
  rule: MatchRule;
  confidence: number;
  matchedConditions: string[];
  evidence: Evidence[];
}

export interface HistoricalPattern {
  category: RootCauseCategory;
  fingerprint: string;
  occurrences: number;
  lastSeen: number;
  avgResolutionTime?: number;
  successfulFixes?: string[];
}

// ============================================================================
// Built-in Match Rules
// ============================================================================

const MATCH_RULES: MatchRule[] = [
  // Locator Change Rules
  {
    id: 'locator_element_not_found',
    category: 'locator_change',
    name: 'Element Not Found',
    description: 'Element selector no longer matches any DOM element',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /element not found|no such element|unable to locate/i,
        weight: 0.4,
        required: true,
      },
      {
        type: 'anomaly_type',
        operator: 'in',
        value: ['failure_spike', 'success_rate_drop'],
        weight: 0.2,
        required: false,
      },
    ],
    suggestions: [
      { action: 'Update element selector to match current DOM structure', priority: 1, effort: 'low' },
      { action: 'Add wait conditions for dynamic elements', priority: 2, effort: 'low' },
      { action: 'Consider using more stable selectors (data-testid, aria-label)', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 70,
  },
  {
    id: 'locator_stale_element',
    category: 'locator_change',
    name: 'Stale Element Reference',
    description: 'Element was found but detached from DOM during interaction',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /stale element|element.*detached|element.*not attached/i,
        weight: 0.5,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Add explicit wait after page transitions', priority: 1, effort: 'low' },
      { action: 'Re-query element before interaction', priority: 2, effort: 'low' },
      { action: 'Handle dynamic content loading with proper waits', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 75,
  },

  // Timing Issue Rules
  {
    id: 'timing_timeout',
    category: 'timing_issue',
    name: 'Operation Timeout',
    description: 'Operation exceeded maximum wait time',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /timeout|timed out|exceeded.*wait/i,
        weight: 0.4,
        required: true,
      },
      {
        type: 'anomaly_type',
        operator: 'equals',
        value: 'duration_spike',
        weight: 0.2,
        required: false,
      },
    ],
    suggestions: [
      { action: 'Increase timeout threshold for slow operations', priority: 1, effort: 'low' },
      { action: 'Investigate page load performance', priority: 2, effort: 'medium' },
      { action: 'Add conditional waits instead of fixed delays', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 65,
  },
  {
    id: 'timing_performance_degradation',
    category: 'timing_issue',
    name: 'Performance Degradation',
    description: 'System response time significantly increased',
    conditions: [
      {
        type: 'anomaly_type',
        operator: 'equals',
        value: 'performance_degradation',
        weight: 0.5,
        required: true,
      },
      {
        type: 'evidence_type',
        operator: 'equals',
        value: 'duration_anomaly',
        weight: 0.3,
        required: false,
      },
    ],
    suggestions: [
      { action: 'Profile application to identify bottlenecks', priority: 1, effort: 'medium' },
      { action: 'Check for recent code changes affecting performance', priority: 2, effort: 'low' },
      { action: 'Review database queries and API response times', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 60,
  },

  // Network Issue Rules
  {
    id: 'network_request_failure',
    category: 'network_issue',
    name: 'Network Request Failure',
    description: 'HTTP request failed or returned error status',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /network.*error|fetch.*failed|connection.*refused|status.*[45]\d{2}/i,
        weight: 0.4,
        required: true,
      },
      {
        type: 'evidence_type',
        operator: 'equals',
        value: 'network_failures',
        weight: 0.3,
        required: false,
      },
    ],
    suggestions: [
      { action: 'Verify API endpoint availability and response', priority: 1, effort: 'low' },
      { action: 'Check network connectivity and firewall rules', priority: 2, effort: 'low' },
      { action: 'Add retry logic for transient network failures', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 70,
  },
  {
    id: 'network_server_error',
    category: 'network_issue',
    name: 'Server Error',
    description: 'Server returned 5xx error status',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /5\d{2}|internal server error|service unavailable|bad gateway/i,
        weight: 0.5,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Check server logs for error details', priority: 1, effort: 'low' },
      { action: 'Verify backend service health', priority: 2, effort: 'low' },
      { action: 'Review recent deployments for regressions', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 75,
  },

  // Data Issue Rules
  {
    id: 'data_validation_error',
    category: 'data_issue',
    name: 'Data Validation Error',
    description: 'Data does not match expected format or value',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /assertion.*failed|expected.*but.*received|does not match|validation.*error/i,
        weight: 0.4,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Verify test data is current and valid', priority: 1, effort: 'low' },
      { action: 'Check for data schema changes', priority: 2, effort: 'medium' },
      { action: 'Update assertions to match new data format', priority: 3, effort: 'low' },
    ],
    baseConfidence: 65,
  },
  {
    id: 'data_null_reference',
    category: 'data_issue',
    name: 'Null Reference Error',
    description: 'Attempted to access property of null/undefined',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /undefined.*not.*object|null.*not.*object|cannot read property/i,
        weight: 0.5,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Add null checks before accessing properties', priority: 1, effort: 'low' },
      { action: 'Verify API response structure', priority: 2, effort: 'low' },
      { action: 'Handle edge cases for missing data', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 70,
  },

  // Environment Change Rules
  {
    id: 'environment_browser_update',
    category: 'environment_change',
    name: 'Browser Update Impact',
    description: 'Browser update may have changed behavior',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /chrome.*update|firefox.*update|browser.*version|incompatible/i,
        weight: 0.4,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Test against updated browser version', priority: 1, effort: 'low' },
      { action: 'Review browser changelog for breaking changes', priority: 2, effort: 'medium' },
      { action: 'Update browser-specific workarounds', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 55,
  },

  // Code Change Rules
  {
    id: 'code_regression',
    category: 'code_change',
    name: 'Code Regression',
    description: 'Recent code changes may have introduced issues',
    conditions: [
      {
        type: 'anomaly_type',
        operator: 'in',
        value: ['failure_spike', 'success_rate_drop'],
        weight: 0.3,
        required: true,
      },
      {
        type: 'severity',
        operator: 'in',
        value: ['high', 'critical'],
        weight: 0.2,
        required: false,
      },
    ],
    suggestions: [
      { action: 'Review recent commits for relevant changes', priority: 1, effort: 'low' },
      { action: 'Consider reverting suspicious changes', priority: 2, effort: 'low' },
      { action: 'Add test coverage for affected functionality', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 50,
  },

  // Resource Constraint Rules
  {
    id: 'resource_memory',
    category: 'resource_constraint',
    name: 'Memory Constraint',
    description: 'System running low on memory',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /out of memory|heap.*exceeded|memory.*limit/i,
        weight: 0.5,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Increase memory allocation for test environment', priority: 1, effort: 'low' },
      { action: 'Identify and fix memory leaks', priority: 2, effort: 'high' },
      { action: 'Split large test suites into smaller batches', priority: 3, effort: 'medium' },
    ],
    baseConfidence: 75,
  },
  {
    id: 'resource_rate_limit',
    category: 'resource_constraint',
    name: 'Rate Limiting',
    description: 'API rate limit exceeded',
    conditions: [
      {
        type: 'evidence_pattern',
        operator: 'matches',
        value: /rate.*limit|too many requests|429|quota.*exceeded/i,
        weight: 0.5,
        required: true,
      },
    ],
    suggestions: [
      { action: 'Add delays between API calls', priority: 1, effort: 'low' },
      { action: 'Implement request throttling', priority: 2, effort: 'medium' },
      { action: 'Request rate limit increase from API provider', priority: 3, effort: 'low' },
    ],
    baseConfidence: 80,
  },
];

// ============================================================================
// Cause Matcher Class
// ============================================================================

class CauseMatcher {
  private rules: MatchRule[] = MATCH_RULES;
  private historicalPatterns: Map<string, HistoricalPattern> = new Map();

  /**
   * Match evidence to potential root causes
   */
  match(evidence: CollectedEvidence, anomaly: Anomaly, context?: ExecutionContext): RootCause[] {
    const matchResults = this.evaluateRules(evidence, anomaly, context);

    // Filter and sort by confidence
    const validMatches = matchResults
      .filter((r) => r.confidence >= 40)
      .sort((a, b) => b.confidence - a.confidence);

    // Convert to RootCause objects
    return validMatches.map((match, index) => this.createRootCause(match, index));
  }

  /**
   * Calculate historical similarity
   */
  calculateSimilarity(
    current: CollectedEvidence,
    historical: CollectedEvidence
  ): number {
    let similarity = 0;
    let totalWeight = 0;

    // Compare primary evidence
    const currentTypes = new Set(current.primary.map((e) => e.type));
    const historicalTypes = new Set(historical.primary.map((e) => e.type));

    const commonTypes = [...currentTypes].filter((t) => historicalTypes.has(t));
    const typeWeight = 0.4;
    similarity += (commonTypes.length / Math.max(currentTypes.size, historicalTypes.size)) * typeWeight;
    totalWeight += typeWeight;

    // Compare categories in evidence data
    const currentCategories = new Set(
      current.primary.map((e) => (e.data as Record<string, unknown>).category as string).filter(Boolean)
    );
    const historicalCategories = new Set(
      historical.primary.map((e) => (e.data as Record<string, unknown>).category as string).filter(Boolean)
    );

    if (currentCategories.size > 0 && historicalCategories.size > 0) {
      const commonCategories = [...currentCategories].filter((c) => historicalCategories.has(c));
      const categoryWeight = 0.3;
      similarity += (commonCategories.length / Math.max(currentCategories.size, historicalCategories.size)) * categoryWeight;
      totalWeight += categoryWeight;
    }

    // Compare timeline event patterns
    const currentErrorEvents = current.timeline.filter((e) => e.severity === 'error');
    const historicalErrorEvents = historical.timeline.filter((e) => e.severity === 'error');

    if (currentErrorEvents.length > 0 || historicalErrorEvents.length > 0) {
      const timelineWeight = 0.3;
      const eventSimilarity = 1 - Math.abs(currentErrorEvents.length - historicalErrorEvents.length) / Math.max(currentErrorEvents.length, historicalErrorEvents.length, 1);
      similarity += eventSimilarity * timelineWeight;
      totalWeight += timelineWeight;
    }

    return totalWeight > 0 ? (similarity / totalWeight) * 100 : 0;
  }

  /**
   * Add a custom rule
   */
  addRule(rule: MatchRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all rules
   */
  getRules(): MatchRule[] {
    return [...this.rules];
  }

  /**
   * Record a historical pattern for learning
   */
  recordPattern(
    category: RootCauseCategory,
    evidence: CollectedEvidence,
    resolutionTime?: number,
    fix?: string
  ): void {
    const fingerprint = this.generateFingerprint(evidence);
    const existing = this.historicalPatterns.get(fingerprint);

    if (existing) {
      existing.occurrences++;
      existing.lastSeen = Date.now();
      if (resolutionTime && existing.avgResolutionTime) {
        existing.avgResolutionTime = (existing.avgResolutionTime + resolutionTime) / 2;
      } else if (resolutionTime) {
        existing.avgResolutionTime = resolutionTime;
      }
      if (fix && !existing.successfulFixes?.includes(fix)) {
        existing.successfulFixes = existing.successfulFixes || [];
        existing.successfulFixes.push(fix);
      }
    } else {
      this.historicalPatterns.set(fingerprint, {
        category,
        fingerprint,
        occurrences: 1,
        lastSeen: Date.now(),
        avgResolutionTime: resolutionTime,
        successfulFixes: fix ? [fix] : undefined,
      });
    }
  }

  /**
   * Get historical patterns for a category
   */
  getHistoricalPatterns(category?: RootCauseCategory): HistoricalPattern[] {
    const patterns = Array.from(this.historicalPatterns.values());
    if (category) {
      return patterns.filter((p) => p.category === category);
    }
    return patterns;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Evaluate all rules against evidence
   */
  private evaluateRules(
    evidence: CollectedEvidence,
    anomaly: Anomaly,
    context?: ExecutionContext
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const rule of this.rules) {
      const result = this.evaluateRule(rule, evidence, anomaly, context);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(
    rule: MatchRule,
    evidence: CollectedEvidence,
    anomaly: Anomaly,
    context?: ExecutionContext
  ): MatchResult | null {
    const matchedConditions: string[] = [];
    const matchedEvidence: Evidence[] = [];
    let totalWeight = 0;
    let earnedWeight = 0;

    for (const condition of rule.conditions) {
      totalWeight += condition.weight;
      const { matched, evidenceItems } = this.evaluateCondition(condition, evidence, anomaly, context);

      if (matched) {
        matchedConditions.push(`${condition.type}:${condition.operator}`);
        earnedWeight += condition.weight;
        matchedEvidence.push(...evidenceItems);
      } else if (condition.required) {
        // Required condition not met - rule fails
        return null;
      }
    }

    // Calculate confidence
    const conditionScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 100 : 0;
    const confidence = Math.min(100, (rule.baseConfidence * conditionScore) / 100);

    if (confidence < 40) {
      return null;
    }

    return {
      rule,
      confidence,
      matchedConditions,
      evidence: matchedEvidence,
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: MatchCondition,
    evidence: CollectedEvidence,
    anomaly: Anomaly,
    context?: ExecutionContext
  ): { matched: boolean; evidenceItems: Evidence[] } {
    const matchedEvidence: Evidence[] = [];

    switch (condition.type) {
      case 'evidence_type': {
        const allEvidence = [...evidence.primary, ...evidence.secondary];
        const matched = allEvidence.some((e) => {
          const matches = this.matchValue(e.type, condition.operator, condition.value);
          if (matches) matchedEvidence.push(e);
          return matches;
        });
        return { matched, evidenceItems: matchedEvidence };
      }

      case 'evidence_pattern': {
        const allEvidence = [...evidence.primary, ...evidence.secondary];
        const matched = allEvidence.some((e) => {
          const textToMatch = e.description + (e.data ? JSON.stringify(e.data) : '');
          const matches = this.matchValue(textToMatch, condition.operator, condition.value);
          if (matches) matchedEvidence.push(e);
          return matches;
        });
        return { matched, evidenceItems: matchedEvidence };
      }

      case 'anomaly_type': {
        return {
          matched: this.matchValue(anomaly.type, condition.operator, condition.value),
          evidenceItems: [],
        };
      }

      case 'metric_name': {
        return {
          matched: this.matchValue(anomaly.metric, condition.operator, condition.value),
          evidenceItems: [],
        };
      }

      case 'severity': {
        return {
          matched: this.matchValue(anomaly.severity, condition.operator, condition.value),
          evidenceItems: [],
        };
      }

      default:
        return { matched: false, evidenceItems: [] };
    }
  }

  /**
   * Match a value against a condition
   */
  private matchValue(
    actual: string,
    operator: MatchCondition['operator'],
    expected: string | string[] | RegExp
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;

      case 'contains':
        return typeof expected === 'string' && actual.toLowerCase().includes(expected.toLowerCase());

      case 'matches':
        if (expected instanceof RegExp) {
          return expected.test(actual);
        }
        return new RegExp(expected as string, 'i').test(actual);

      case 'in':
        return Array.isArray(expected) && expected.includes(actual);

      default:
        return false;
    }
  }

  /**
   * Create a RootCause object from match result
   */
  private createRootCause(match: MatchResult, index: number): RootCause {
    const suggestions: Suggestion[] = match.rule.suggestions.map((template) => ({
      action: template.action,
      priority: template.priority,
      effort: template.effort,
    }));

    return {
      id: `rc_${Date.now()}_${index}`,
      category: match.rule.category,
      description: match.rule.description,
      confidence: Math.round(match.confidence),
      evidence: match.evidence,
      suggestions,
    };
  }

  /**
   * Generate a fingerprint for pattern matching
   */
  private generateFingerprint(evidence: CollectedEvidence): string {
    const parts: string[] = [];

    // Include primary evidence types
    const types = [...new Set(evidence.primary.map((e) => e.type))].sort();
    parts.push(types.join(','));

    // Include categories
    const categories = [...new Set(
      evidence.primary
        .map((e) => (e.data as Record<string, unknown>).category as string)
        .filter(Boolean)
    )].sort();
    parts.push(categories.join(','));

    // Include error event count
    const errorCount = evidence.timeline.filter((e) => e.severity === 'error').length;
    parts.push(`errors:${errorCount}`);

    return parts.join('|');
  }
}

// Export singleton instance
export const causeMatcher = new CauseMatcher();
