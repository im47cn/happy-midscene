/**
 * Recommendation Engine
 * Generates optimization recommendations from analysis results
 */

import type {
  CoverageGap,
  EfficiencyAnalysis,
  MaintainabilityAnalysis,
  Priority,
  Recommendation,
  RecommendationType,
  RedundancyReport,
  StabilityAnalysis,
} from '../../types/optimization';
import { impactEstimator } from './impactEstimator';
import type { IRecommendEngine } from './interfaces';

// Storage key for adoption tracking
const ADOPTION_STORAGE_KEY = 'optimization-adoptions';

class RecommendEngine implements IRecommendEngine {
  private recommendationCounter = 0;

  /**
   * Generate recommendations from analysis results
   */
  async generateRecommendations(analysis: {
    efficiency?: EfficiencyAnalysis;
    redundancy?: RedundancyReport;
    gaps?: CoverageGap[];
    stability?: StabilityAnalysis;
    maintainability?: MaintainabilityAnalysis;
  }): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Generate efficiency recommendations
    if (analysis.efficiency) {
      recommendations.push(
        ...this.generateEfficiencyRecommendations(analysis.efficiency),
      );
    }

    // Generate redundancy recommendations
    if (analysis.redundancy) {
      recommendations.push(
        ...this.generateRedundancyRecommendations(analysis.redundancy),
      );
    }

    // Generate coverage recommendations
    if (analysis.gaps) {
      recommendations.push(
        ...this.generateCoverageRecommendations(analysis.gaps),
      );
    }

    // Generate stability recommendations
    if (analysis.stability) {
      recommendations.push(
        ...this.generateStabilityRecommendations(analysis.stability),
      );
    }

    // Generate maintainability recommendations
    if (analysis.maintainability) {
      recommendations.push(
        ...this.generateMaintainabilityRecommendations(
          analysis.maintainability,
        ),
      );
    }

    // Prioritize and return
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Prioritize recommendations by impact and effort
   */
  prioritizeRecommendations(
    recommendations: Recommendation[],
  ): Recommendation[] {
    return recommendations.sort((a, b) => {
      // First by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by ROI
      const roiA = impactEstimator.calculateROI(a);
      const roiB = impactEstimator.calculateROI(b);
      return roiB - roiA;
    });
  }

  /**
   * Estimate impact of a recommendation
   */
  estimateImpact(recommendation: Recommendation) {
    return impactEstimator.estimateImpact(recommendation);
  }

  /**
   * Track recommendation adoption
   */
  async trackAdoption(
    recommendationId: string,
    adopted: boolean,
    notes?: string,
  ): Promise<void> {
    try {
      const stored = localStorage.getItem(ADOPTION_STORAGE_KEY);
      const adoptions = stored ? JSON.parse(stored) : {};

      adoptions[recommendationId] = {
        adopted,
        adoptedAt: Date.now(),
        notes,
      };

      localStorage.setItem(ADOPTION_STORAGE_KEY, JSON.stringify(adoptions));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Generate efficiency recommendations
   */
  private generateEfficiencyRecommendations(
    efficiency: EfficiencyAnalysis,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Slow cases recommendations
    for (const slowCase of efficiency.slowestCases.slice(0, 3)) {
      recommendations.push(
        this.createRecommendation({
          type: 'efficiency',
          priority: slowCase.percentile > 95 ? 'high' : 'medium',
          title: `优化慢速测试: ${slowCase.caseName}`,
          description: `该测试执行时间 ${Math.round(slowCase.averageDuration / 1000)}秒，比 ${slowCase.percentile}% 的测试慢`,
          actionItems: [
            {
              order: 1,
              action: '分析慢速步骤',
              details: slowCase.slowSteps
                .map(
                  (s) =>
                    `步骤 ${s.order}: ${s.description} (${Math.round(s.duration / 1000)}s)`,
                )
                .join('\n'),
            },
            {
              order: 2,
              action: '优化等待策略',
              details: '使用智能等待替代固定延迟',
            },
            {
              order: 3,
              action: '考虑并行执行',
              details: '将独立操作并行化',
            },
          ],
          relatedCases: [slowCase.caseId],
          effort: 'medium',
        }),
      );
    }

    // Bottleneck recommendations
    for (const bottleneck of efficiency.bottlenecks) {
      recommendations.push(
        this.createRecommendation({
          type: 'efficiency',
          priority: 'medium',
          title: `解决执行瓶颈: ${bottleneck.type}`,
          description: bottleneck.description,
          actionItems: [
            {
              order: 1,
              action: bottleneck.suggestion,
            },
          ],
          relatedCases: bottleneck.affectedCases,
          effort: 'medium',
        }),
      );
    }

    // Parallelization recommendation
    const parallel = efficiency.parallelizationOpportunity;
    if (parallel.estimatedSaving > 20) {
      recommendations.push(
        this.createRecommendation({
          type: 'efficiency',
          priority: 'medium',
          title: '增加测试并行度',
          description: `当前并行度: ${parallel.currentParallel}，建议: ${parallel.recommendedParallel}，预计节省 ${parallel.estimatedSaving}% 时间`,
          actionItems: [
            {
              order: 1,
              action: `将并行度从 ${parallel.currentParallel} 提升到 ${parallel.recommendedParallel}`,
            },
            {
              order: 2,
              action: '确保测试间无共享状态',
            },
          ],
          relatedCases: [],
          effort: 'low',
        }),
      );
    }

    return recommendations;
  }

  /**
   * Generate redundancy recommendations
   */
  private generateRedundancyRecommendations(
    redundancy: RedundancyReport,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Redundant groups
    for (const group of redundancy.redundantGroups.slice(0, 5)) {
      const mergeRec = group.mergeRecommendation;
      recommendations.push(
        this.createRecommendation({
          type: 'redundancy',
          priority: group.similarityScore > 0.85 ? 'high' : 'medium',
          title: `${mergeRec.action === 'merge' ? '合并' : '参数化'}相似用例`,
          description: `发现 ${group.cases.length} 个相似度 ${Math.round(group.similarityScore * 100)}% 的用例`,
          actionItems: [
            {
              order: 1,
              action: mergeRec.reason,
            },
            {
              order: 2,
              action: '共同步骤',
              details: group.commonSteps.map((s) => s.description).join('\n'),
            },
          ],
          relatedCases: group.cases,
          effort: 'low',
        }),
      );
    }

    // Duplicate steps
    for (const dupStep of redundancy.duplicateSteps.slice(0, 3)) {
      recommendations.push(
        this.createRecommendation({
          type: 'redundancy',
          priority: 'low',
          title: '提取公共步骤',
          description: `步骤 "${dupStep.step}" 在 ${dupStep.occurrences.length} 个用例中重复`,
          actionItems: [
            {
              order: 1,
              action: dupStep.extractionRecommendation,
            },
          ],
          relatedCases: dupStep.occurrences.map((o) => o.caseId),
          effort: 'low',
        }),
      );
    }

    return recommendations;
  }

  /**
   * Generate coverage recommendations
   */
  private generateCoverageRecommendations(
    gaps: CoverageGap[],
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    for (const gap of gaps.slice(0, 5)) {
      const priority = this.riskToPriority(gap.riskLevel);
      recommendations.push(
        this.createRecommendation({
          type: 'coverage',
          priority,
          title: `补充测试覆盖: ${gap.feature}`,
          description: `当前覆盖率 ${gap.currentCoverage}%，建议达到 ${gap.recommendedCoverage}%`,
          actionItems: gap.missingScenarios.map((scenario, idx) => ({
            order: idx + 1,
            action: `新增用例: ${scenario.suggestedCase.name}`,
            details: scenario.description,
          })),
          relatedCases: [],
          effort: 'medium',
        }),
      );
    }

    return recommendations;
  }

  /**
   * Generate stability recommendations
   */
  private generateStabilityRecommendations(
    stability: StabilityAnalysis,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Flaky tests
    for (const flaky of stability.flakyTests.slice(0, 5)) {
      recommendations.push(
        this.createRecommendation({
          type: 'stability',
          priority: flaky.flakyRate > 0.3 ? 'critical' : 'high',
          title: `修复不稳定测试: ${flaky.caseName}`,
          description: `Flaky 率 ${Math.round(flaky.flakyRate * 100)}%，共执行 ${flaky.totalRuns} 次`,
          actionItems: [
            ...flaky.rootCauses.map((cause, idx) => ({
              order: idx + 1,
              action: `根因: ${cause.description}`,
              details: `置信度: ${Math.round(cause.confidence * 100)}%`,
            })),
            ...flaky.recommendations.map((rec, idx) => ({
              order: flaky.rootCauses.length + idx + 1,
              action: rec,
            })),
          ],
          relatedCases: [flaky.caseId],
          effort: 'high',
        }),
      );
    }

    // Failure patterns
    for (const pattern of stability.failurePatterns.slice(0, 3)) {
      recommendations.push(
        this.createRecommendation({
          type: 'stability',
          priority: 'medium',
          title: `解决失败模式: ${pattern.commonFactor}`,
          description: `影响 ${pattern.affectedCases.length} 个用例，发生 ${pattern.frequency} 次`,
          actionItems: [
            {
              order: 1,
              action: pattern.solution,
            },
          ],
          relatedCases: pattern.affectedCases,
          effort: 'medium',
        }),
      );
    }

    // Environment issues
    for (const issue of stability.environmentIssues) {
      recommendations.push(
        this.createRecommendation({
          type: 'stability',
          priority: 'medium',
          title: `解决环境问题: ${issue.type}`,
          description: issue.description,
          actionItems: [
            {
              order: 1,
              action: issue.suggestion,
            },
          ],
          relatedCases: issue.affectedCases,
          effort: 'medium',
        }),
      );
    }

    return recommendations;
  }

  /**
   * Generate maintainability recommendations
   */
  private generateMaintainabilityRecommendations(
    maintainability: MaintainabilityAnalysis,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Group issues by type
    const issuesByType = new Map<string, typeof maintainability.issues>();
    for (const issue of maintainability.issues) {
      const existing = issuesByType.get(issue.type);
      if (existing) {
        existing.push(issue);
      } else {
        issuesByType.set(issue.type, [issue]);
      }
    }

    // Create recommendation for each issue type
    for (const [type, issues] of issuesByType) {
      if (issues.length > 0) {
        const firstIssue = issues[0];
        recommendations.push(
          this.createRecommendation({
            type: 'maintainability',
            priority: firstIssue.severity,
            title: `改进维护性: ${this.getIssueTypeLabel(type)}`,
            description: `发现 ${issues.length} 个相关问题`,
            actionItems: issues.slice(0, 3).map((issue, idx) => ({
              order: idx + 1,
              action: `${issue.caseName}: ${issue.description}`,
              details: issue.suggestion,
            })),
            relatedCases: issues.map((i) => i.caseId),
            effort: 'medium',
          }),
        );
      }
    }

    // Best practice violations
    for (const violation of maintainability.bestPracticeViolations.slice(
      0,
      3,
    )) {
      recommendations.push(
        this.createRecommendation({
          type: 'maintainability',
          priority: violation.severity,
          title: `遵循最佳实践: ${violation.rule}`,
          description: `${violation.violations.length} 个用例违反此规则`,
          actionItems: [
            {
              order: 1,
              action: violation.recommendation,
            },
            ...violation.violations.slice(0, 3).map((v, idx) => ({
              order: idx + 2,
              action: `${v.caseName}: ${v.detail}`,
            })),
          ],
          relatedCases: violation.violations.map((v) => v.caseId),
          effort: 'low',
        }),
      );
    }

    return recommendations;
  }

  /**
   * Create a recommendation with generated ID
   */
  private createRecommendation(params: {
    type: RecommendationType;
    priority: Priority;
    title: string;
    description: string;
    actionItems: { order: number; action: string; details?: string }[];
    relatedCases: string[];
    effort: 'low' | 'medium' | 'high';
  }): Recommendation {
    const id = `rec-${Date.now()}-${this.recommendationCounter++}`;
    // Create a temporary recommendation with placeholder impact for estimation
    const tempRecommendation: Recommendation = {
      id,
      type: params.type,
      priority: params.priority,
      title: params.title,
      description: params.description,
      impact: { description: '' },
      effort: params.effort,
      actionItems: params.actionItems,
      relatedCases: params.relatedCases,
      evidence: [],
      createdAt: Date.now(),
    };
    const impact = impactEstimator.estimateImpact(tempRecommendation);

    return {
      id,
      type: params.type,
      priority: params.priority,
      title: params.title,
      description: params.description,
      impact,
      effort: params.effort,
      actionItems: params.actionItems,
      relatedCases: params.relatedCases,
      evidence: [],
      createdAt: Date.now(),
    };
  }

  /**
   * Convert risk level to priority
   */
  private riskToPriority(
    risk: 'critical' | 'high' | 'medium' | 'low',
  ): Priority {
    return risk;
  }

  /**
   * Get label for issue type
   */
  private getIssueTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      hardcoded_selector: '硬编码选择器',
      long_steps: '步骤过长',
      missing_cleanup: '缺少清理',
      duplicate_logic: '重复逻辑',
      poor_naming: '命名不规范',
    };
    return labels[type] || type;
  }
}

export const recommendEngine = new RecommendEngine();
