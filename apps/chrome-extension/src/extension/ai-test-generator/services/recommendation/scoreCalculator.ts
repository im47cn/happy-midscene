/**
 * Score Calculator
 * Calculates recommendation scores based on multiple factors
 */

import type {
  CaseStats,
  ExecutionRecord,
  RecommendReason,
  ReasonType,
  RecommendContext,
  PriorityWeights,
} from '../../types/recommendation';

/**
 * Time thresholds for scoring (in milliseconds)
 */
const TIME_THRESHOLDS = {
  RECENT_FAILURE: 7 * 24 * 60 * 60 * 1000,    // 7 days
  LONG_NOT_RUN: 30 * 24 * 60 * 60 * 1000,     // 30 days
  VERY_LONG_NOT_RUN: 90 * 24 * 60 * 60 * 1000, // 90 days
};

/**
 * Score ranges
 */
const SCORE_RANGES = {
  EXCELLENT: { min: 80, max: 100 },
  GOOD: { min: 60, max: 79 },
  FAIR: { min: 40, max: 59 },
  POOR: { min: 0, max: 39 },
};

/**
 * Score Calculator class
 */
export class ScoreCalculator {
  private context: RecommendContext;
  private weights: PriorityWeights;

  constructor(context: RecommendContext) {
    this.context = context;
    this.weights = context.config.weights;
  }

  /**
   * Calculate comprehensive recommendation score for a case
   */
  calculateRecommendScore(caseId: string): {
    score: number;
    reasons: RecommendReason[];
  } {
    const reasons: RecommendReason[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    // Calculate each factor
    const riskScore = this.calculateRiskScore(caseId);
    const recencyScore = this.calculateRecencyScore(caseId);
    const impactScore = this.calculateChangeImpactScore(caseId);
    const coverageScore = this.calculateCoverageScore(caseId);
    const valueScore = this.calculateBusinessValueScore(caseId);

    // Add reasons for significant factors
    this.addRiskReasons(caseId, reasons, riskScore);
    this.addRecencyReasons(caseId, reasons, recencyScore);
    this.addImpactReasons(caseId, reasons, impactScore);

    // Calculate weighted score
    weightedSum =
      riskScore * this.weights.riskFactor +
      recencyScore * this.weights.recency +
      impactScore * this.weights.changeImpact +
      coverageScore * 0.1 +
      valueScore * this.weights.businessValue;

    totalWeight =
      this.weights.riskFactor +
      this.weights.recency +
      this.weights.changeImpact +
      0.1 +
      this.weights.businessValue;

    const finalScore = Math.round((weightedSum / totalWeight) * 100);

    return { score: Math.min(100, Math.max(0, finalScore)), reasons };
  }

  /**
   * Calculate risk score (0-1) based on case stability and failure patterns
   */
  calculateRiskScore(caseId: string): number {
    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return 0.5; // Default medium risk for new cases

    // Stability risk (inverse of stability score)
    const stabilityRisk = 1 - caseStat.stabilityScore / 100;

    // Recent failure risk
    const recentFailures = caseStat.recentResults.filter((r) => r === 'failed').length;
    const recentFailureRisk = Math.min(recentFailures / 5, 1);

    // Flaky test risk
    const flakyRisk = caseStat.isFlaky ? 0.5 : 0;

    // Combined risk score
    return stabilityRisk * 0.4 + recentFailureRisk * 0.4 + flakyRisk * 0.2;
  }

  /**
   * Calculate recency score (0-1) based on when the case was last executed
   */
  calculateRecencyScore(caseId: string): number {
    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return 0; // No data, low priority

    const now = Date.now();
    const timeSinceLastRun = now - caseStat.lastRun;

    // Cases not run recently get higher priority
    if (timeSinceLastRun > TIME_THRESHOLDS.VERY_LONG_NOT_RUN) {
      return 1; // Highest priority for very old cases
    }
    if (timeSinceLastRun > TIME_THRESHOLDS.LONG_NOT_RUN) {
      return 0.8;
    }
    if (timeSinceLastRun > TIME_THRESHOLDS.RECENT_FAILURE) {
      return 0.5;
    }

    // Recently run cases get lower priority
    return 0.2;
  }

  /**
   * Calculate change impact score (0-1) based on code changes
   */
  calculateChangeImpactScore(caseId: string): number {
    if (!this.context.changes || this.context.changes.length === 0) {
      return 0;
    }

    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return 0;

    // Simple heuristic: if case name contains change target, high impact
    let maxImpact = 0;
    for (const change of this.context.changes) {
      const target = change.target.toLowerCase();
      const caseName = caseStat.caseName.toLowerCase();

      if (caseName.includes(target)) {
        maxImpact = Math.max(maxImpact, 1);
      }
    }

    return maxImpact;
  }

  /**
   * Calculate coverage contribution score (0-1)
   */
  calculateCoverageScore(caseId: string): number {
    // This is a simplified version
    // In a full implementation, this would check:
    // - Whether the case covers unique functionality
    // - Whether it's part of a critical user path
    // - Whether alternative tests cover the same functionality

    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return 0.5;

    // Higher pass rate suggests the test is working and providing coverage
    return caseStat.passRate / 100;
  }

  /**
   * Calculate business value score (0-1)
   * Based on execution frequency and importance indicators in case name
   */
  calculateBusinessValueScore(caseId: string): number {
    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return 0.5;

    let value = 0.5; // Base value

    // Keywords indicating high business value
    const highValueKeywords = [
      'login', 'auth', 'payment', 'checkout', 'checkout',
      'purchase', 'signup', 'register', 'critical', 'smoke',
      '登录', '认证', '支付', '购买', '注册',
    ];

    const caseNameLower = caseStat.caseName.toLowerCase();
    for (const keyword of highValueKeywords) {
      if (caseNameLower.includes(keyword)) {
        value += 0.2;
        break;
      }
    }

    // Frequently run cases are likely more important
    if (caseStat.totalRuns > 50) {
      value += 0.15;
    } else if (caseStat.totalRuns > 20) {
      value += 0.1;
    }

    return Math.min(1, value);
  }

  /**
   * Add risk-based reasons
   */
  private addRiskReasons(
    caseId: string,
    reasons: RecommendReason[],
    riskScore: number,
  ): void {
    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return;

    // High risk due to flakiness
    if (caseStat.isFlaky) {
      reasons.push({
        type: 'high_risk',
        description: '测试不稳定（Flaky），需要验证',
        weight: 0.3,
        data: { stabilityScore: caseStat.stabilityScore },
      });
    }

    // High risk due to low stability
    if (caseStat.stabilityScore < 50 && !caseStat.isFlaky) {
      reasons.push({
        type: 'high_risk',
        description: `稳定性评分较低 (${caseStat.stabilityScore}/100)`,
        weight: 0.25,
        data: { stabilityScore: caseStat.stabilityScore },
      });
    }

    // Recent failures
    const recentFailures = caseStat.recentResults.filter((r) => r === 'failed').length;
    if (recentFailures > 0) {
      reasons.push({
        type: 'recent_failure',
        description: `最近 ${caseStat.recentResults.length} 次执行中有 ${recentFailures} 次失败`,
        weight: 0.4 * (recentFailures / caseStat.recentResults.length),
        data: { recentFailures, totalRecent: caseStat.recentResults.length },
      });
    }
  }

  /**
   * Add recency-based reasons
   */
  private addRecencyReasons(
    caseId: string,
    reasons: RecommendReason[],
    recencyScore: number,
  ): void {
    const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
    if (!caseStat) return;

    const now = Date.now();
    const daysSinceLastRun = Math.floor((now - caseStat.lastRun) / (24 * 60 * 60 * 1000));

    if (daysSinceLastRun > 90) {
      reasons.push({
        type: 'long_not_run',
        description: `超过 ${daysSinceLastRun} 天未执行，可能已过期`,
        weight: 0.3,
        data: { daysSinceLastRun },
      });
    } else if (daysSinceLastRun > 30) {
      reasons.push({
        type: 'long_not_run',
        description: `${daysSinceLastRun} 天未执行`,
        weight: 0.2,
        data: { daysSinceLastRun },
      });
    }
  }

  /**
   * Add impact-based reasons
   */
  private addImpactReasons(
    caseId: string,
    reasons: RecommendReason[],
    impactScore: number,
  ): void {
    if (impactScore > 0 && this.context.changes) {
      const caseStat = this.context.caseStats.find((c) => c.caseId === caseId);
      if (!caseStat) return;

      const affectedChanges = this.context.changes.filter((change) => {
        const target = change.target.toLowerCase();
        return caseStat.caseName.toLowerCase().includes(target);
      });

      if (affectedChanges.length > 0) {
        reasons.push({
          type: 'change_impact',
          description: `可能受以下变更影响: ${affectedChanges.map((c) => c.target).join(', ')}`,
          weight: impactScore * 0.5,
          data: { changes: affectedChanges.map((c) => c.target) },
        });
      }
    }
  }

  /**
   * Calculate risk score for a single case (exported utility)
   */
  static calculateRiskScore(caseStat: CaseStats): number {
    // Stability risk
    const stabilityRisk = 1 - caseStat.stabilityScore / 100;

    // Recent failure risk
    const recentFailures = caseStat.recentResults.filter((r) => r === 'failed').length;
    const recentFailureRisk = Math.min(recentFailures / caseStat.recentResults.length, 1);

    // Flaky risk
    const flakyRisk = caseStat.isFlaky ? 0.5 : 0;

    return stabilityRisk * 0.4 + recentFailureRisk * 0.4 + flakyRisk * 0.2;
  }

  /**
   * Calculate recency score for a single case (exported utility)
   */
  static calculateRecencyScore(caseStat: CaseStats): number {
    const now = Date.now();
    const timeSinceLastRun = now - caseStat.lastRun;

    if (timeSinceLastRun > TIME_THRESHOLDS.VERY_LONG_NOT_RUN) return 1;
    if (timeSinceLastRun > TIME_THRESHOLDS.LONG_NOT_RUN) return 0.8;
    if (timeSinceLastRun > TIME_THRESHOLDS.RECENT_FAILURE) return 0.5;
    return 0.2;
  }
}
