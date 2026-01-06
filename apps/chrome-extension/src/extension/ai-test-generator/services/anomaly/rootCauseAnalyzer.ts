/**
 * input: Anomalies, execution context, evidence
 * output: Root cause analysis with suggestions
 * pos: Core root cause analysis orchestrator
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Anomaly,
  Evidence,
  RootCause,
  RootCauseCategory,
  Suggestion,
} from '../../types/anomaly';
import { type HistoricalPattern, causeMatcher } from './causeMatcher';
import {
  type ChangeInfo,
  type CollectedEvidence,
  type ExecutionContext,
  evidenceCollector,
} from './evidenceCollector';
import { anomalyStorage } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisOptions {
  includeHistorical?: boolean;
  maxRootCauses?: number;
  minConfidence?: number;
  correlateChanges?: boolean;
  recentChanges?: ChangeInfo[];
}

export interface AnalysisResult {
  anomalyId: string;
  rootCauses: RootCause[];
  evidence: CollectedEvidence;
  correlatedChanges: ChangeInfo[];
  analysisTime: number;
  summary: string;
}

export interface FailureAnalysisResult {
  caseId: string;
  executionId: string;
  rootCauses: RootCause[];
  evidence: CollectedEvidence;
  recommendations: Recommendation[];
  summary: string;
}

export interface Recommendation {
  category: RootCauseCategory;
  action: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface BatchAnalysisResult {
  results: AnalysisResult[];
  commonCauses: CommonCause[];
  overallSummary: string;
}

export interface CommonCause {
  category: RootCauseCategory;
  description: string;
  affectedAnomalies: string[];
  confidence: number;
  suggestions: Suggestion[];
}

// ============================================================================
// Root Cause Analyzer Class
// ============================================================================

class RootCauseAnalyzer {
  private readonly defaultOptions: AnalysisOptions = {
    includeHistorical: true,
    maxRootCauses: 5,
    minConfidence: 40,
    correlateChanges: true,
  };

  /**
   * Analyze root cause for a single anomaly
   */
  async analyze(
    anomaly: Anomaly,
    context?: ExecutionContext,
    options: AnalysisOptions = {},
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    // Collect evidence
    const evidence = evidenceCollector.collect(anomaly, context);

    // Match to root causes
    let rootCauses = causeMatcher.match(evidence, anomaly, context);

    // Filter by confidence
    rootCauses = rootCauses.filter(
      (rc) => rc.confidence >= (opts.minConfidence ?? 40),
    );

    // Sort by confidence (highest first)
    rootCauses.sort((a, b) => b.confidence - a.confidence);

    // Limit number of root causes
    rootCauses = rootCauses.slice(0, opts.maxRootCauses ?? 5);

    // Include historical patterns if enabled
    if (opts.includeHistorical) {
      rootCauses = this.enrichWithHistorical(rootCauses);
    }

    // Correlate with recent changes
    let correlatedChanges: ChangeInfo[] = [];
    if (opts.correlateChanges && opts.recentChanges) {
      correlatedChanges = evidenceCollector.correlateChanges(
        anomaly.detectedAt,
        opts.recentChanges,
      );
    }

    // Update anomaly with root causes
    await this.updateAnomalyRootCauses(anomaly.id, rootCauses);

    // Generate summary
    const summary = this.generateAnalysisSummary(
      rootCauses,
      evidence,
      correlatedChanges,
    );

    return {
      anomalyId: anomaly.id,
      rootCauses,
      evidence,
      correlatedChanges,
      analysisTime: Date.now() - startTime,
      summary,
    };
  }

  /**
   * Analyze failure for a specific test case execution
   */
  async analyzeFailure(
    caseId: string,
    executionId: string,
    context: ExecutionContext,
  ): Promise<FailureAnalysisResult> {
    // Create a synthetic anomaly for the failure
    const syntheticAnomaly: Anomaly = {
      id: `failure_${caseId}_${executionId}`,
      type: 'failure_spike',
      severity: context.status === 'error' ? 'high' : 'medium',
      status: 'new',
      detectedAt: context.endTime ?? Date.now(),
      metric: `${caseId}:execution`,
      currentValue: 0,
      expectedValue: 1,
      deviation: -1,
      caseId,
      description: context.errorMessage ?? 'Test execution failed',
    };

    // Collect evidence
    const evidence = evidenceCollector.collect(syntheticAnomaly, context);

    // Match to root causes
    const rootCauses = causeMatcher.match(evidence, syntheticAnomaly, context);

    // Generate recommendations
    const recommendations = this.generateRecommendations(rootCauses, evidence);

    // Generate summary
    const summary = this.generateFailureSummary(
      context,
      rootCauses,
      recommendations,
    );

    return {
      caseId,
      executionId,
      rootCauses,
      evidence,
      recommendations,
      summary,
    };
  }

  /**
   * Get suggestions for a list of root causes
   */
  getSuggestions(rootCauses: RootCause[]): Suggestion[] {
    const allSuggestions: Map<string, Suggestion & { score: number }> =
      new Map();

    for (const rootCause of rootCauses) {
      const confidenceMultiplier = rootCause.confidence / 100;

      for (const suggestion of rootCause.suggestions) {
        const key = suggestion.action;
        const existing = allSuggestions.get(key);
        const score = (4 - suggestion.priority) * confidenceMultiplier;

        if (!existing || existing.score < score) {
          allSuggestions.set(key, {
            ...suggestion,
            score,
            priority: Math.min(suggestion.priority, existing?.priority ?? 99),
          });
        }
      }
    }

    // Sort by priority and score
    return Array.from(allSuggestions.values())
      .sort((a, b) => a.priority - b.priority || b.score - a.score)
      .map(({ score, ...suggestion }) => suggestion);
  }

  /**
   * Analyze multiple anomalies to find common root causes
   */
  async analyzeBatch(
    anomalies: Anomaly[],
    options: AnalysisOptions = {},
  ): Promise<BatchAnalysisResult> {
    const results: AnalysisResult[] = [];

    // Analyze each anomaly
    for (const anomaly of anomalies) {
      const result = await this.analyze(anomaly, undefined, options);
      results.push(result);
    }

    // Find common causes across anomalies
    const commonCauses = this.findCommonCauses(results);

    // Generate overall summary
    const overallSummary = this.generateBatchSummary(results, commonCauses);

    return {
      results,
      commonCauses,
      overallSummary,
    };
  }

  /**
   * Get analysis for an anomaly by ID
   */
  async getAnalysis(anomalyId: string): Promise<AnalysisResult | null> {
    const anomaly = await anomalyStorage.getAnomaly(anomalyId);
    if (!anomaly) {
      return null;
    }

    return this.analyze(anomaly);
  }

  /**
   * Learn from resolved anomalies
   */
  async learnFromResolution(
    anomalyId: string,
    resolutionTime: number,
    fix: string,
  ): Promise<void> {
    const anomaly = await anomalyStorage.getAnomaly(anomalyId);
    if (!anomaly || anomaly.rootCauses.length === 0) {
      return;
    }

    // Record pattern for the primary root cause
    const primaryCause = anomaly.rootCauses[0];
    const evidence = evidenceCollector.collect(anomaly);

    causeMatcher.recordPattern(
      primaryCause.category,
      evidence,
      resolutionTime,
      fix,
    );
  }

  /**
   * Get historical patterns for a category
   */
  getHistoricalPatterns(category?: RootCauseCategory): HistoricalPattern[] {
    return causeMatcher.getHistoricalPatterns(category);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Enrich root causes with historical pattern data
   */
  private enrichWithHistorical(rootCauses: RootCause[]): RootCause[] {
    const historicalPatterns = causeMatcher.getHistoricalPatterns();

    return rootCauses.map((rootCause) => {
      const relevantPatterns = historicalPatterns.filter(
        (p) => p.category === rootCause.category,
      );

      if (relevantPatterns.length > 0) {
        // Add historical fix suggestions
        const historicalFixes = relevantPatterns
          .flatMap((p) => p.successfulFixes ?? [])
          .filter((fix, index, arr) => arr.indexOf(fix) === index);

        if (historicalFixes.length > 0) {
          const historicalSuggestions: Suggestion[] = historicalFixes.map(
            (fix, index) => ({
              action: `Previously successful fix: ${fix}`,
              priority: rootCause.suggestions.length + index + 1,
              effort: 'low' as const,
            }),
          );

          return {
            ...rootCause,
            suggestions: [...rootCause.suggestions, ...historicalSuggestions],
          };
        }
      }

      return rootCause;
    });
  }

  /**
   * Update anomaly with root causes
   */
  private async updateAnomalyRootCauses(
    anomalyId: string,
    rootCauses: RootCause[],
  ): Promise<void> {
    const anomaly = await anomalyStorage.getAnomaly(anomalyId);
    if (anomaly) {
      anomaly.rootCauses = rootCauses;
      await anomalyStorage.saveAnomaly(anomaly);
    }
  }

  /**
   * Generate recommendations from root causes
   */
  private generateRecommendations(
    rootCauses: RootCause[],
    evidence: CollectedEvidence,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const rootCause of rootCauses) {
      const priority = this.mapConfidenceToPriority(rootCause.confidence);

      for (const suggestion of rootCause.suggestions.slice(0, 2)) {
        recommendations.push({
          category: rootCause.category,
          action: suggestion.action,
          priority,
          effort: suggestion.effort,
          rationale: `Based on ${rootCause.description} (${rootCause.confidence}% confidence)`,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
    return recommendations
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
      .slice(0, 10);
  }

  /**
   * Map confidence to priority
   */
  private mapConfidenceToPriority(
    confidence: number,
  ): Recommendation['priority'] {
    if (confidence >= 80) return 'immediate';
    if (confidence >= 60) return 'high';
    if (confidence >= 40) return 'medium';
    return 'low';
  }

  /**
   * Find common causes across multiple analyses
   */
  private findCommonCauses(results: AnalysisResult[]): CommonCause[] {
    const categoryMap: Map<
      RootCauseCategory,
      {
        rootCauses: RootCause[];
        anomalyIds: string[];
      }
    > = new Map();

    // Group by category
    for (const result of results) {
      for (const rootCause of result.rootCauses) {
        const existing = categoryMap.get(rootCause.category);
        if (existing) {
          existing.rootCauses.push(rootCause);
          if (!existing.anomalyIds.includes(result.anomalyId)) {
            existing.anomalyIds.push(result.anomalyId);
          }
        } else {
          categoryMap.set(rootCause.category, {
            rootCauses: [rootCause],
            anomalyIds: [result.anomalyId],
          });
        }
      }
    }

    // Filter to categories affecting multiple anomalies
    const commonCauses: CommonCause[] = [];

    for (const [category, data] of categoryMap) {
      if (data.anomalyIds.length >= 2) {
        // Aggregate suggestions
        const allSuggestions = data.rootCauses.flatMap((rc) => rc.suggestions);
        const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

        // Calculate average confidence
        const avgConfidence = Math.round(
          data.rootCauses.reduce((sum, rc) => sum + rc.confidence, 0) /
            data.rootCauses.length,
        );

        // Get most common description
        const descriptions = data.rootCauses.map((rc) => rc.description);
        const description =
          this.getMostCommon(descriptions) ?? `${category} related issue`;

        commonCauses.push({
          category,
          description,
          affectedAnomalies: data.anomalyIds,
          confidence: avgConfidence,
          suggestions: uniqueSuggestions.slice(0, 3),
        });
      }
    }

    return commonCauses.sort(
      (a, b) => b.affectedAnomalies.length - a.affectedAnomalies.length,
    );
  }

  /**
   * Deduplicate suggestions by action
   */
  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      if (seen.has(s.action)) return false;
      seen.add(s.action);
      return true;
    });
  }

  /**
   * Get most common string in array
   */
  private getMostCommon(arr: string[]): string | undefined {
    const counts = new Map<string, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: string | undefined;

    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  /**
   * Generate analysis summary
   */
  private generateAnalysisSummary(
    rootCauses: RootCause[],
    evidence: CollectedEvidence,
    changes: ChangeInfo[],
  ): string {
    const parts: string[] = [];

    if (rootCauses.length > 0) {
      const primary = rootCauses[0];
      parts.push(
        `Most likely cause: ${primary.description} (${primary.confidence}% confidence)`,
      );

      if (rootCauses.length > 1) {
        parts.push(
          `${rootCauses.length - 1} additional potential cause(s) identified`,
        );
      }
    } else {
      parts.push('No specific root cause identified');
    }

    if (evidence.primary.length > 0) {
      parts.push(
        `Based on ${evidence.primary.length} primary evidence item(s)`,
      );
    }

    if (changes.length > 0) {
      parts.push(`${changes.length} recent change(s) may be related`);
    }

    return parts.join('. ');
  }

  /**
   * Generate failure summary
   */
  private generateFailureSummary(
    context: ExecutionContext,
    rootCauses: RootCause[],
    recommendations: Recommendation[],
  ): string {
    const parts: string[] = [];

    parts.push(`Test ${context.caseId} failed with status: ${context.status}`);

    if (context.errorMessage) {
      const shortError = context.errorMessage.slice(0, 100);
      parts.push(
        `Error: ${shortError}${context.errorMessage.length > 100 ? '...' : ''}`,
      );
    }

    if (rootCauses.length > 0) {
      parts.push(
        `Primary cause: ${rootCauses[0].category} - ${rootCauses[0].description}`,
      );
    }

    if (recommendations.length > 0) {
      parts.push(`Top recommendation: ${recommendations[0].action}`);
    }

    return parts.join('. ');
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(
    results: AnalysisResult[],
    commonCauses: CommonCause[],
  ): string {
    const parts: string[] = [];

    parts.push(`Analyzed ${results.length} anomalies`);

    const totalRootCauses = results.reduce(
      (sum, r) => sum + r.rootCauses.length,
      0,
    );
    parts.push(`Identified ${totalRootCauses} total root causes`);

    if (commonCauses.length > 0) {
      parts.push(
        `Found ${commonCauses.length} common cause(s) affecting multiple anomalies`,
      );
      const topCommon = commonCauses[0];
      parts.push(
        `Most prevalent: ${topCommon.category} (${topCommon.affectedAnomalies.length} anomalies)`,
      );
    }

    return parts.join('. ');
  }
}

// Export singleton instance
export const rootCauseAnalyzer = new RootCauseAnalyzer();
