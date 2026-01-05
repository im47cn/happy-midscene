/**
 * input: Anomaly data, baseline info, historical context
 * output: Severity scores and impact assessments
 * pos: Severity calculation layer for anomaly prioritization
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Severity,
  AnomalyType,
  BaselineInfo,
  RootCause,
} from '../../types/anomaly';
import {
  SEVERITY_FACTOR_WEIGHTS,
  SEVERITY_DEVIATION_THRESHOLDS,
} from '../../types/anomaly';

// ============================================================================
// Types
// ============================================================================

export interface SeverityInput {
  deviation: number; // How far from baseline (standard deviations or percentage)
  anomalyType: AnomalyType;
  duration?: number; // How long has this anomaly persisted (ms)
  affectedCases?: number; // Number of test cases affected
  totalCases?: number; // Total test cases in scope
  isRegression?: boolean; // Is this a regression from previous state
  consecutiveFailures?: number; // Number of consecutive failures
  historicalFrequency?: number; // How often this anomaly occurred before (0-1)
}

export interface SeverityResult {
  severity: Severity;
  score: number; // 0-100 numerical score
  factors: SeverityFactor[];
  recommendation: string;
}

export interface SeverityFactor {
  name: string;
  weight: number;
  value: number;
  contribution: number; // Contribution to final score
}

export interface ImpactAssessment {
  scope: 'low' | 'medium' | 'high' | 'critical';
  affectedPercentage: number;
  estimatedImpact: string;
  urgency: 'low' | 'medium' | 'high' | 'immediate';
}

// ============================================================================
// Severity Evaluator Class
// ============================================================================

class SeverityEvaluator {
  private readonly thresholds = SEVERITY_DEVIATION_THRESHOLDS;

  /**
   * Evaluate severity based on multiple factors
   */
  evaluate(input: SeverityInput): SeverityResult {
    const factors = this.calculateFactors(input);
    const score = this.calculateScore(factors);
    const severity = this.scoreToSeverity(score);
    const recommendation = this.generateRecommendation(severity, input, factors);

    return {
      severity,
      score,
      factors,
      recommendation,
    };
  }

  /**
   * Calculate individual severity factors
   */
  private calculateFactors(input: SeverityInput): SeverityFactor[] {
    const factors: SeverityFactor[] = [];

    // Factor 1: Deviation magnitude
    const deviationFactor = this.calculateDeviationFactor(input.deviation);
    factors.push({
      name: 'deviation',
      weight: SEVERITY_FACTOR_WEIGHTS.deviation,
      value: Math.abs(input.deviation),
      contribution: deviationFactor * SEVERITY_FACTOR_WEIGHTS.deviation * 100,
    });

    // Factor 2: Duration (if provided)
    if (input.duration !== undefined) {
      const durationFactor = this.calculateDurationFactor(input.duration);
      factors.push({
        name: 'duration',
        weight: SEVERITY_FACTOR_WEIGHTS.duration,
        value: input.duration,
        contribution: durationFactor * SEVERITY_FACTOR_WEIGHTS.duration * 100,
      });
    }

    // Factor 3: Frequency/recurrence
    if (input.historicalFrequency !== undefined) {
      const frequencyFactor = this.calculateFrequencyFactor(input.historicalFrequency);
      factors.push({
        name: 'frequency',
        weight: SEVERITY_FACTOR_WEIGHTS.frequency,
        value: input.historicalFrequency,
        contribution: frequencyFactor * SEVERITY_FACTOR_WEIGHTS.frequency * 100,
      });
    }

    // Factor 4: Impact scope
    if (input.affectedCases !== undefined && input.totalCases !== undefined) {
      const impactFactor = this.calculateImpactFactor(input.affectedCases, input.totalCases);
      factors.push({
        name: 'impact',
        weight: SEVERITY_FACTOR_WEIGHTS.impact,
        value: input.affectedCases / Math.max(input.totalCases, 1),
        contribution: impactFactor * SEVERITY_FACTOR_WEIGHTS.impact * 100,
      });
    }

    // Factor 5: Regression penalty
    if (input.isRegression) {
      factors.push({
        name: 'regression',
        weight: 0.15,
        value: 1,
        contribution: 15, // Fixed 15 point penalty for regressions
      });
    }

    // Factor 6: Consecutive failures
    if (input.consecutiveFailures !== undefined && input.consecutiveFailures > 1) {
      const consecutiveFactor = this.calculateConsecutiveFactor(input.consecutiveFailures);
      factors.push({
        name: 'consecutive',
        weight: 0.1,
        value: input.consecutiveFailures,
        contribution: consecutiveFactor * 10,
      });
    }

    // Factor 7: Anomaly type severity multiplier
    const typeMultiplier = this.getTypeMultiplier(input.anomalyType);
    if (typeMultiplier !== 1) {
      factors.push({
        name: 'type_modifier',
        weight: 0,
        value: typeMultiplier,
        contribution: 0, // Applied as multiplier, not additive
      });
    }

    return factors;
  }

  /**
   * Calculate deviation factor (0-1)
   */
  private calculateDeviationFactor(deviation: number): number {
    const absDeviation = Math.abs(deviation);

    // Map deviation to 0-1 scale
    // < 2 sigma: low
    // 2-3 sigma: medium
    // 3-4 sigma: high
    // > 4 sigma: critical
    if (absDeviation < 2) return absDeviation / 4; // 0-0.5
    if (absDeviation < 3) return 0.5 + (absDeviation - 2) * 0.25; // 0.5-0.75
    if (absDeviation < 4) return 0.75 + (absDeviation - 3) * 0.15; // 0.75-0.9
    return Math.min(1, 0.9 + (absDeviation - 4) * 0.025); // 0.9-1.0
  }

  /**
   * Calculate duration factor (0-1)
   */
  private calculateDurationFactor(durationMs: number): number {
    const hours = durationMs / (1000 * 60 * 60);

    // < 1 hour: low
    // 1-4 hours: medium
    // 4-24 hours: high
    // > 24 hours: critical
    if (hours < 1) return hours * 0.25;
    if (hours < 4) return 0.25 + (hours - 1) * 0.167;
    if (hours < 24) return 0.75 + (hours - 4) * 0.0125;
    return Math.min(1, 0.95 + (hours - 24) * 0.001);
  }

  /**
   * Calculate frequency factor (0-1)
   */
  private calculateFrequencyFactor(frequency: number): number {
    // Higher frequency = more severe (recurring issue)
    // Frequency is expected to be 0-1 (percentage of occurrences)
    return Math.pow(frequency, 0.5); // Square root to not penalize too heavily
  }

  /**
   * Calculate impact factor based on affected scope
   */
  private calculateImpactFactor(affected: number, total: number): number {
    if (total === 0) return 0;

    const percentage = affected / total;

    // < 5%: low
    // 5-20%: medium
    // 20-50%: high
    // > 50%: critical
    if (percentage < 0.05) return percentage * 5; // 0-0.25
    if (percentage < 0.2) return 0.25 + (percentage - 0.05) * 3.33; // 0.25-0.75
    if (percentage < 0.5) return 0.75 + (percentage - 0.2) * 0.67; // 0.75-0.95
    return Math.min(1, 0.95 + (percentage - 0.5) * 0.1);
  }

  /**
   * Calculate consecutive failures factor
   */
  private calculateConsecutiveFactor(consecutive: number): number {
    // Exponential increase for consecutive failures
    // 2 = 0.3, 3 = 0.5, 5 = 0.8, 10 = 1.0
    return Math.min(1, Math.log10(consecutive) / Math.log10(10));
  }

  /**
   * Get type-based severity multiplier
   */
  private getTypeMultiplier(type: AnomalyType): number {
    const multipliers: Record<AnomalyType, number> = {
      duration_spike: 1.0,
      failure_spike: 1.3, // Failures are more severe
      flaky_pattern: 0.9, // Flaky tests are annoying but less critical
      performance_degradation: 1.1,
      success_rate_drop: 1.2,
      resource_anomaly: 1.0,
      trend_change: 0.8, // Trends need attention but aren't immediate
      seasonal_deviation: 0.7, // Expected variations
    };

    return multipliers[type] ?? 1.0;
  }

  /**
   * Calculate final score from factors
   */
  private calculateScore(factors: SeverityFactor[]): number {
    // Sum contributions
    let baseScore = factors
      .filter((f) => f.name !== 'type_modifier')
      .reduce((sum, f) => sum + f.contribution, 0);

    // Apply type multiplier
    const typeModifier = factors.find((f) => f.name === 'type_modifier');
    if (typeModifier) {
      baseScore *= typeModifier.value;
    }

    // Normalize to 0-100 scale
    // Maximum possible base contribution is approximately 100 (with all factors at max)
    return Math.min(100, Math.max(0, baseScore));
  }

  /**
   * Convert numerical score to severity level
   */
  private scoreToSeverity(score: number): Severity {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(
    severity: Severity,
    input: SeverityInput,
    factors: SeverityFactor[]
  ): string {
    const topFactors = factors
      .filter((f) => f.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);

    const primaryFactor = topFactors[0]?.name || 'deviation';

    const recommendations: Record<Severity, Record<string, string>> = {
      critical: {
        deviation: 'Immediate investigation required. Value significantly outside normal range.',
        duration: 'Long-standing critical issue. Escalate to team lead immediately.',
        frequency: 'Recurring critical issue. Root cause analysis mandatory.',
        impact: 'Wide-spread impact. Consider rollback or hotfix.',
        regression: 'Critical regression detected. Block deployments until resolved.',
        consecutive: 'Extended failure sequence. Check for systemic issues.',
        default: 'Critical anomaly detected. Immediate action required.',
      },
      high: {
        deviation: 'Significant deviation from baseline. Investigate within 24 hours.',
        duration: 'Issue persisting for extended period. Schedule investigation.',
        frequency: 'Frequently occurring issue. Add to sprint backlog.',
        impact: 'Affecting significant portion of tests. Prioritize investigation.',
        regression: 'Regression detected. Review recent changes.',
        consecutive: 'Multiple consecutive failures. Check test stability.',
        default: 'High severity anomaly. Plan investigation soon.',
      },
      medium: {
        deviation: 'Notable deviation. Monitor for further changes.',
        duration: 'Issue ongoing. Review if time permits.',
        frequency: 'Occasional issue. Consider adding to backlog.',
        impact: 'Moderate impact. Investigate when convenient.',
        regression: 'Minor regression. Review when time permits.',
        consecutive: 'Some consecutive failures. Watch for patterns.',
        default: 'Medium severity anomaly. Monitor and review.',
      },
      low: {
        deviation: 'Minor deviation within acceptable range. No action needed.',
        duration: 'Short-lived variation. Continue monitoring.',
        frequency: 'Rare occurrence. No immediate action needed.',
        impact: 'Limited impact. Monitor passively.',
        regression: 'Minimal regression. Continue monitoring.',
        consecutive: 'Isolated failures. Normal variation.',
        default: 'Low severity anomaly. Continue normal monitoring.',
      },
    };

    return recommendations[severity][primaryFactor] || recommendations[severity].default;
  }

  /**
   * Assess overall impact of an anomaly
   */
  assessImpact(input: SeverityInput): ImpactAssessment {
    const affectedPercentage =
      input.affectedCases !== undefined && input.totalCases !== undefined
        ? (input.affectedCases / Math.max(input.totalCases, 1)) * 100
        : 0;

    // Determine scope
    let scope: ImpactAssessment['scope'];
    if (affectedPercentage >= 50) scope = 'critical';
    else if (affectedPercentage >= 20) scope = 'high';
    else if (affectedPercentage >= 5) scope = 'medium';
    else scope = 'low';

    // Determine urgency
    let urgency: ImpactAssessment['urgency'];
    if (input.isRegression && scope === 'critical') urgency = 'immediate';
    else if (scope === 'critical' || (input.consecutiveFailures ?? 0) >= 5) urgency = 'high';
    else if (scope === 'high' || input.isRegression) urgency = 'medium';
    else urgency = 'low';

    // Generate impact description
    const estimatedImpact = this.generateImpactDescription(
      scope,
      affectedPercentage,
      input.anomalyType
    );

    return {
      scope,
      affectedPercentage,
      estimatedImpact,
      urgency,
    };
  }

  /**
   * Generate human-readable impact description
   */
  private generateImpactDescription(
    scope: ImpactAssessment['scope'],
    percentage: number,
    type: AnomalyType
  ): string {
    const typeDescriptions: Record<AnomalyType, string> = {
      duration_spike: 'test execution time',
      failure_spike: 'test reliability',
      flaky_pattern: 'test determinism',
      performance_degradation: 'system performance',
      success_rate_drop: 'overall test quality',
      resource_anomaly: 'resource utilization',
      trend_change: 'quality trajectory',
      seasonal_deviation: 'expected patterns',
    };

    const scopeDescriptions = {
      critical: 'severely impacting',
      high: 'significantly affecting',
      medium: 'moderately affecting',
      low: 'minimally affecting',
    };

    return `${scopeDescriptions[scope]} ${typeDescriptions[type]} across ${percentage.toFixed(1)}% of test cases`;
  }

  /**
   * Compare severities
   */
  compareSeverity(a: Severity, b: Severity): number {
    const order: Record<Severity, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    return order[a] - order[b];
  }

  /**
   * Get severity from baseline deviation
   */
  getSeverityFromDeviation(deviation: number, baseline: BaselineInfo): Severity {
    const absDeviation = Math.abs(deviation);
    const normalizedDeviation = baseline.stdDev !== 0 ? absDeviation / baseline.stdDev : absDeviation;

    if (normalizedDeviation >= this.thresholds.critical) return 'critical';
    if (normalizedDeviation >= this.thresholds.high) return 'high';
    if (normalizedDeviation >= this.thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate priority score for sorting anomalies
   */
  calculatePriority(severity: Severity, input: SeverityInput): number {
    const severityScore = { low: 25, medium: 50, high: 75, critical: 100 }[severity];

    // Boost priority for regressions
    const regressionBoost = input.isRegression ? 10 : 0;

    // Boost for high impact
    const impactBoost =
      input.affectedCases !== undefined && input.totalCases !== undefined
        ? ((input.affectedCases / Math.max(input.totalCases, 1)) * 20)
        : 0;

    // Reduce priority for frequently recurring (likely known) issues
    const frequencyPenalty = input.historicalFrequency !== undefined
      ? input.historicalFrequency * 5
      : 0;

    return severityScore + regressionBoost + impactBoost - frequencyPenalty;
  }

  /**
   * Batch evaluate multiple anomalies and sort by priority
   */
  evaluateAndPrioritize(inputs: SeverityInput[]): Array<SeverityResult & { priority: number }> {
    return inputs
      .map((input) => {
        const result = this.evaluate(input);
        const priority = this.calculatePriority(result.severity, input);
        return { ...result, priority };
      })
      .sort((a, b) => b.priority - a.priority);
  }
}

// Export singleton instance
export const severityEvaluator = new SeverityEvaluator();
