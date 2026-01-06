/**
 * Recommend Engine
 * Core recommendation engine for test case suggestions
 */

import { uuid } from '@midscene/shared/utils';
import type { CaseStats, ExecutionRecord } from '../../types/analytics';
import type {
  ChangeImpact,
  ChangeInfo,
  Feedback,
  PriorityConfig,
  RecommendContext,
  RecommendOptions,
  Recommendation,
  RegressionType,
} from '../../types/recommendation';
import {
  DEFAULT_PRIORITY_CONFIG,
  scoreToCategory,
  scoreToPriority,
} from '../../types/recommendation';
import { analyticsStorage } from '../analytics/analyticsStorage';
import { ScoreCalculator } from './scoreCalculator';

/**
 * Recommend Engine class
 */
export class RecommendEngine {
  private config: PriorityConfig;

  constructor(config?: Partial<PriorityConfig>) {
    this.config = {
      weights: config?.weights ?? DEFAULT_PRIORITY_CONFIG.weights,
      thresholds: config?.thresholds ?? DEFAULT_PRIORITY_CONFIG.thresholds,
    };
  }

  /**
   * Get recommendations based on current context
   */
  async getRecommendations(
    options?: RecommendOptions,
  ): Promise<Recommendation[]> {
    const context = await this.buildContext();
    const calculator = new ScoreCalculator(context);

    // Calculate scores for all cases
    const recommendations: Recommendation[] = [];

    for (const caseStat of context.caseStats) {
      const { score, reasons } = calculator.calculateRecommendScore(
        caseStat.caseId,
      );

      // Apply filters
      if (options?.minScore !== undefined && score < options.minScore) {
        continue;
      }

      const priority = scoreToPriority(score, this.config.thresholds);
      const category = scoreToCategory(score);

      // Filter by category if specified
      if (options?.categories && !options.categories.includes(category)) {
        continue;
      }

      recommendations.push({
        id: uuid(),
        caseId: caseStat.caseId,
        caseName: caseStat.caseName,
        score,
        reasons,
        priority,
        category,
        estimatedDuration: caseStat.avgDuration,
        lastExecuted: caseStat.lastRun,
        lastResult: caseStat.recentResults[0],
      });
    }

    // Sort by score descending
    recommendations.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = options?.limit ?? recommendations.length;
    let result = recommendations.slice(0, limit);

    // Apply time budget if specified
    if (options?.timeLimit) {
      result = this.applyTimeBudget(result, options.timeLimit);
    }

    return result;
  }

  /**
   * Get recommendations for specific changes
   */
  async getRecommendationsForChange(
    changes: ChangeInfo[],
  ): Promise<Recommendation[]> {
    const context = await this.buildContext();
    context.changes = changes;

    const calculator = new ScoreCalculator(context);
    const recommendations: Recommendation[] = [];

    for (const caseStat of context.caseStats) {
      const { score, reasons } = calculator.calculateRecommendScore(
        caseStat.caseId,
      );

      // Only include cases with meaningful impact
      const impactReason = reasons.find((r) => r.type === 'change_impact');
      if (impactReason) {
        const priority = scoreToPriority(score, this.config.thresholds);
        const category = scoreToCategory(score);

        recommendations.push({
          id: uuid(),
          caseId: caseStat.caseId,
          caseName: caseStat.caseName,
          score,
          reasons,
          priority,
          category,
          estimatedDuration: caseStat.avgDuration,
          lastExecuted: caseStat.lastRun,
          lastResult: caseStat.recentResults[0],
        });
      }
    }

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations;
  }

  /**
   * Get regression test set
   */
  async getRegressionSet(type: RegressionType): Promise<Recommendation[]> {
    const context = await this.buildContext();
    const calculator = new ScoreCalculator(context);

    const allRecommendations: Recommendation[] = [];

    for (const caseStat of context.caseStats) {
      const { score, reasons } = calculator.calculateRecommendScore(
        caseStat.caseId,
      );
      const priority = scoreToPriority(score, this.config.thresholds);
      const category = scoreToCategory(score);

      allRecommendations.push({
        id: uuid(),
        caseId: caseStat.caseId,
        caseName: caseStat.caseName,
        score,
        reasons,
        priority,
        category,
        estimatedDuration: caseStat.avgDuration,
        lastExecuted: caseStat.lastRun,
        lastResult: caseStat.recentResults[0],
      });
    }

    // Select based on regression type
    switch (type) {
      case 'minimal':
        // Critical priority + recently failed
        return allRecommendations
          .filter(
            (r) =>
              r.priority === 'critical' ||
              r.reasons.some((r) => r.type === 'recent_failure'),
          )
          .sort((a, b) => b.score - a.score);

      case 'standard':
        // Critical + High priority
        return allRecommendations
          .filter((r) => r.priority === 'critical' || r.priority === 'high')
          .sort((a, b) => b.score - a.score);

      case 'full':
        // All cases, sorted by priority
        return allRecommendations.sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (
            priorityOrder[a.priority] - priorityOrder[b.priority] ||
            b.score - a.score
          );
        });

      default:
        return allRecommendations;
    }
  }

  /**
   * Record user feedback
   */
  async recordFeedback(feedback: Omit<Feedback, 'timestamp'>): Promise<void> {
    const fullFeedback: Feedback = {
      ...feedback,
      timestamp: Date.now(),
    };

    // Store feedback in IndexedDB
    // Note: This would require extending the analytics storage schema
    // For now, we'll use a simple in-memory approach or console log
    console.log('[RecommendEngine] Recording feedback:', fullFeedback);

    // TODO: Implement proper feedback storage
    // This could be added to the AnalyticsStorage as a new store
  }

  /**
   * Analyze change impact
   */
  async analyzeChangeImpact(changes: ChangeInfo[]): Promise<ChangeImpact[]> {
    const recommendations = await this.getRecommendationsForChange(changes);

    return changes.map((change) => {
      const affectedCases = recommendations
        .filter((r) =>
          r.reasons.some((reason) => reason.type === 'change_impact'),
        )
        .filter((r) => {
          const caseName = r.caseName.toLowerCase();
          const target = change.target.toLowerCase();
          return caseName.includes(target);
        })
        .map((r) => r.caseId);

      const impactLevel = this.determineImpactLevel(
        affectedCases.length,
        recommendations.length,
      );

      return {
        change,
        affectedCases,
        impactLevel,
        reasoning: [
          `检测到 ${affectedCases.length} 个可能受影响的测试用例`,
          impactLevel === 'high' ? '建议全面回归测试' : '建议选择性测试',
        ],
      };
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PriorityConfig>): void {
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
    if (config.thresholds) {
      this.config.thresholds = {
        ...this.config.thresholds,
        ...config.thresholds,
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PriorityConfig {
    return { ...this.config };
  }

  /**
   * Build recommendation context from current data
   */
  private async buildContext(): Promise<RecommendContext> {
    const caseStats = await analyticsStorage.getAllCaseStats();
    const recentExecutions = await analyticsStorage.getRecentExecutions(100);

    return {
      caseStats,
      recentExecutions,
      config: this.config,
    };
  }

  /**
   * Apply time budget constraint to recommendations
   */
  private applyTimeBudget(
    recommendations: Recommendation[],
    timeLimitMinutes: number,
  ): Recommendation[] {
    const timeLimitMs = timeLimitMinutes * 60 * 1000;
    const result: Recommendation[] = [];
    let totalTime = 0;

    // Sort by score/efficiency ratio (score per minute)
    const sorted = [...recommendations].sort((a, b) => {
      const aEfficiency = a.score / (a.estimatedDuration || 1000);
      const bEfficiency = b.score / (b.estimatedDuration || 1000);
      return bEfficiency - aEfficiency;
    });

    for (const rec of sorted) {
      if (totalTime + rec.estimatedDuration <= timeLimitMs) {
        result.push(rec);
        totalTime += rec.estimatedDuration;
      }
    }

    return result;
  }

  /**
   * Determine impact level based on affected cases
   */
  private determineImpactLevel(
    affectedCount: number,
    totalCount: number,
  ): ChangeImpact['impactLevel'] {
    const ratio = affectedCount / Math.max(totalCount, 1);

    if (ratio > 0.3 || affectedCount > 10) return 'high';
    if (ratio > 0.1 || affectedCount > 5) return 'medium';
    return 'low';
  }
}

// Export singleton instance
export const recommendEngine = new RecommendEngine();
