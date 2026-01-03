/**
 * Priority Ranker
 * Ranks test cases by priority based on multiple factors
 */

import type {
  RankedCase,
  Priority,
  PriorityConfig,
  PriorityWeights,
} from '../../types/recommendation';
import type { CaseStats } from '../../types/analytics';
import { analyticsStorage } from '../analytics/analyticsStorage';
import { ScoreCalculator } from './scoreCalculator';
import { DEFAULT_PRIORITY_CONFIG, scoreToPriority } from '../../types/recommendation';

/**
 * Priority Ranker class
 */
export class PriorityRanker {
  private config: PriorityConfig;

  constructor(config?: Partial<PriorityConfig>) {
    this.config = {
      weights: config?.weights ?? DEFAULT_PRIORITY_CONFIG.weights,
      thresholds: config?.thresholds ?? DEFAULT_PRIORITY_CONFIG.thresholds,
    };
  }

  /**
   * Rank cases by priority
   */
  async rankCases(caseIds?: string[], config?: Partial<PriorityConfig>): Promise<RankedCase[]> {
    const effectiveConfig = config
      ? { ...this.config, ...config }
      : this.config;

    const allCaseStats = await analyticsStorage.getAllCaseStats();
    const casesToRank = caseIds
      ? allCaseStats.filter((c) => caseIds.includes(c.caseId))
      : allCaseStats;

    const context = {
      caseStats: casesToRank,
      recentExecutions: [],
      config: effectiveConfig,
      changes: [],
    };

    const calculator = new ScoreCalculator(context);

    const ranked: RankedCase[] = casesToRank.map((caseStat) => {
      const factors = this.calculateFactors(caseStat, calculator);
      const score = this.calculateWeightedScore(factors, effectiveConfig.weights);
      const priority = scoreToPriority(score, effectiveConfig.thresholds);

      return {
        caseId: caseStat.caseId,
        caseName: caseStat.caseName,
        priority,
        score,
        factors,
      };
    });

    // Sort by priority first, then by score
    ranked.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });

    return ranked;
  }

  /**
   * Get priority for a single case
   */
  async getPriority(caseId: string): Promise<Priority> {
    const ranked = await this.rankCases([caseId]);
    return ranked[0]?.priority ?? 'low';
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PriorityConfig>): void {
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
    if (config.thresholds) {
      this.config.thresholds = { ...this.config.thresholds, ...config.thresholds };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PriorityConfig {
    return { ...this.config };
  }

  /**
   * Calculate individual factors for a case
   */
  private calculateFactors(caseStat: CaseStats, calculator: ScoreCalculator): Record<string, number> {
    return {
      risk: calculator.calculateRiskScore(caseStat.caseId),
      recency: ScoreCalculator.calculateRecencyScore(caseStat),
      businessValue: this.calculateBusinessValue(caseStat),
      changeImpact: 0, // Would need change context
      coverage: caseStat.passRate / 100,
      stability: caseStat.stabilityScore / 100,
    };
  }

  /**
   * Calculate weighted score from factors
   */
  private calculateWeightedScore(factors: Record<string, number>, weights: PriorityWeights): number {
    return Math.round(
      (factors.risk * weights.riskFactor +
        factors.businessValue * weights.businessValue +
        factors.recency * weights.recency +
        factors.changeImpact * weights.changeImpact) *
        100,
    );
  }

  /**
   * Calculate business value factor
   */
  private calculateBusinessValue(caseStat: CaseStats): number {
    let value = 0.5;

    const highValueKeywords = [
      'login',
      'auth',
      'payment',
      'checkout',
      'purchase',
      'signup',
      'register',
      'critical',
      'smoke',
    ];

    const caseNameLower = caseStat.caseName.toLowerCase();
    for (const keyword of highValueKeywords) {
      if (caseNameLower.includes(keyword)) {
        value += 0.3;
        break;
      }
    }

    // Execution frequency indicates importance
    if (caseStat.totalRuns > 50) value += 0.15;
    else if (caseStat.totalRuns > 20) value += 0.1;

    return Math.min(1, value);
  }

  /**
   * Get priority distribution statistics
   */
  async getPriorityDistribution(caseIds?: string[]): Promise<Record<Priority, number>> {
    const ranked = await this.rankCases(caseIds);

    return {
      critical: ranked.filter((r) => r.priority === 'critical').length,
      high: ranked.filter((r) => r.priority === 'high').length,
      medium: ranked.filter((r) => r.priority === 'medium').length,
      low: ranked.filter((r) => r.priority === 'low').length,
    };
  }
}

// Export singleton instance
export const priorityRanker = new PriorityRanker();
