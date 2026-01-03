/**
 * Optimization Report Generator
 * Generates comprehensive optimization reports
 */

import type {
  AnalyzeOptions,
  CoverageGap,
  EfficiencyAnalysis,
  MaintainabilityAnalysis,
  OptimizationReport,
  OptimizationSummary,
  Priority,
  Recommendation,
  RecommendationType,
  RedundancyReport,
  ResourceOptimization,
  StabilityAnalysis,
} from '../../types/optimization';
import type { IOptimizationReport } from './interfaces';
import { efficiencyAnalyzer } from './efficiencyAnalyzer';
import { redundancyDetector } from './redundancyDetector';
import { gapIdentifier } from './gapIdentifier';
import { stabilityAnalyzer } from './stabilityAnalyzer';
import { maintainabilityAnalyzer } from './maintainabilityAnalyzer';
import { recommendEngine } from './recommendEngine';
import { impactEstimator } from './impactEstimator';

class OptimizationReportGenerator implements IOptimizationReport {
  /**
   * Generate comprehensive optimization report
   */
  async generate(
    recommendations: Recommendation[],
    options?: AnalyzeOptions,
  ): Promise<OptimizationReport> {
    // Run all analyses in parallel
    const [efficiency, redundancy, gaps, stability, maintainability] =
      await Promise.all([
        efficiencyAnalyzer.analyze(),
        redundancyDetector.detect(),
        gapIdentifier.identify(),
        stabilityAnalyzer.analyze(),
        maintainabilityAnalyzer.analyze(),
      ]);

    // Generate recommendations if not provided
    const finalRecommendations =
      recommendations.length > 0
        ? recommendations
        : await recommendEngine.generateRecommendations({
            efficiency,
            redundancy,
            gaps,
            stability,
            maintainability,
          });

    // Generate resource optimizations
    const resourceOptimizations = this.generateResourceOptimizations(efficiency);

    // Create summary
    const summary = this.createSummary(finalRecommendations, efficiency);

    return {
      id: `report-${Date.now()}`,
      generatedAt: Date.now(),
      summary,
      efficiencyAnalysis: efficiency,
      redundancyReport: redundancy,
      coverageGaps: gaps,
      stabilityAnalysis: stability,
      maintainabilityAnalysis: maintainability,
      recommendations: finalRecommendations,
      resourceOptimizations,
    };
  }

  /**
   * Export report as HTML
   */
  exportHTML(report: OptimizationReport): string {
    const priorityColors: Record<Priority, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#16a34a',
    };

    const typeLabels: Record<RecommendationType, string> = {
      efficiency: '执行效率',
      redundancy: '冗余消除',
      coverage: '覆盖率',
      stability: '稳定性',
      maintainability: '维护性',
      priority: '优先级',
      resource: '资源优化',
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>测试优化报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1e40af; margin-bottom: 10px; }
    h2 { color: #1e3a8a; margin: 30px 0 15px; border-bottom: 2px solid #dbeafe; padding-bottom: 5px; }
    h3 { color: #3b82f6; margin: 20px 0 10px; }
    .meta { color: #6b7280; margin-bottom: 30px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .card { background: #f8fafc; border-radius: 8px; padding: 15px; border: 1px solid #e2e8f0; }
    .card-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .card-label { color: #64748b; font-size: 14px; }
    .recommendation { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .recommendation-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .priority { padding: 2px 8px; border-radius: 4px; color: white; font-size: 12px; font-weight: 500; }
    .type-tag { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .action-list { list-style: none; margin-top: 10px; }
    .action-list li { padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
    .action-list li:last-child { border-bottom: none; }
    .action-order { color: #3b82f6; font-weight: bold; margin-right: 8px; }
    .score { font-size: 48px; font-weight: bold; }
    .score.good { color: #16a34a; }
    .score.medium { color: #ca8a04; }
    .score.bad { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <h1>测试优化报告</h1>
  <p class="meta">生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}</p>

  <h2>概览</h2>
  <div class="summary">
    <div class="card">
      <div class="card-value">${report.summary.totalRecommendations}</div>
      <div class="card-label">优化建议</div>
    </div>
    <div class="card">
      <div class="card-value">${this.formatDuration(report.summary.estimatedTotalSavings.time)}</div>
      <div class="card-label">预计节省时间</div>
    </div>
    <div class="card">
      <div class="card-value">${report.summary.estimatedTotalSavings.percentage}%</div>
      <div class="card-label">效率提升</div>
    </div>
    <div class="card">
      <div class="card-value score ${report.stabilityAnalysis.overallScore >= 80 ? 'good' : report.stabilityAnalysis.overallScore >= 60 ? 'medium' : 'bad'}">${report.stabilityAnalysis.overallScore}</div>
      <div class="card-label">稳定性评分</div>
    </div>
    <div class="card">
      <div class="card-value score ${report.maintainabilityAnalysis.overallScore >= 80 ? 'good' : report.maintainabilityAnalysis.overallScore >= 60 ? 'medium' : 'bad'}">${report.maintainabilityAnalysis.overallScore}</div>
      <div class="card-label">维护性评分</div>
    </div>
  </div>

  <h2>按优先级分布</h2>
  <div class="summary">
    ${Object.entries(report.summary.byPriority)
      .map(
        ([priority, count]) => `
      <div class="card">
        <div class="card-value" style="color: ${priorityColors[priority as Priority]}">${count}</div>
        <div class="card-label">${priority === 'critical' ? '紧急' : priority === 'high' ? '高优先' : priority === 'medium' ? '中优先' : '低优先'}</div>
      </div>
    `,
      )
      .join('')}
  </div>

  <h2>优化建议</h2>
  ${report.recommendations
    .map(
      (rec) => `
    <div class="recommendation">
      <div class="recommendation-header">
        <span class="priority" style="background: ${priorityColors[rec.priority]}">${rec.priority}</span>
        <span class="type-tag">${typeLabels[rec.type]}</span>
        <strong>${rec.title}</strong>
      </div>
      <p>${rec.description}</p>
      <p><em>${rec.impact.description}</em></p>
      <ul class="action-list">
        ${rec.actionItems
          .map(
            (item) => `
          <li><span class="action-order">${item.order}.</span> ${item.action}</li>
        `,
          )
          .join('')}
      </ul>
    </div>
  `,
    )
    .join('')}

  <h2>效率分析</h2>
  <table>
    <tr><th>指标</th><th>值</th></tr>
    <tr><td>总执行时间</td><td>${this.formatDuration(report.efficiencyAnalysis.totalDuration)}</td></tr>
    <tr><td>平均执行时间</td><td>${this.formatDuration(report.efficiencyAnalysis.averageDuration)}</td></tr>
    <tr><td>慢速用例数</td><td>${report.efficiencyAnalysis.slowestCases.length}</td></tr>
    <tr><td>瓶颈数量</td><td>${report.efficiencyAnalysis.bottlenecks.length}</td></tr>
  </table>

  <h2>冗余分析</h2>
  <table>
    <tr><th>指标</th><th>值</th></tr>
    <tr><td>冗余组数</td><td>${report.redundancyReport.redundantGroups.length}</td></tr>
    <tr><td>重复步骤数</td><td>${report.redundancyReport.duplicateSteps.length}</td></tr>
    <tr><td>重叠度评分</td><td>${report.redundancyReport.overlapScore}%</td></tr>
    <tr><td>潜在节省</td><td>${this.formatDuration(report.redundancyReport.potentialSavings)}</td></tr>
  </table>

  <h2>覆盖率缺口</h2>
  ${report.coverageGaps.length > 0
    ? `
    <table>
      <tr><th>功能</th><th>当前覆盖</th><th>建议覆盖</th><th>风险等级</th></tr>
      ${report.coverageGaps
        .map(
          (gap) => `
        <tr>
          <td>${gap.feature}</td>
          <td>${gap.currentCoverage}%</td>
          <td>${gap.recommendedCoverage}%</td>
          <td>${gap.riskLevel}</td>
        </tr>
      `,
        )
        .join('')}
    </table>
  `
    : '<p>没有发现覆盖率缺口</p>'}

  <h2>稳定性分析</h2>
  <table>
    <tr><th>指标</th><th>值</th></tr>
    <tr><td>整体稳定性评分</td><td>${report.stabilityAnalysis.overallScore}/100</td></tr>
    <tr><td>不稳定测试数</td><td>${report.stabilityAnalysis.flakyTests.length}</td></tr>
    <tr><td>失败模式数</td><td>${report.stabilityAnalysis.failurePatterns.length}</td></tr>
    <tr><td>环境问题数</td><td>${report.stabilityAnalysis.environmentIssues.length}</td></tr>
  </table>

  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #6b7280; font-size: 14px;">
    由 Midscene.js 测试优化系统生成
  </footer>
</body>
</html>
`;
  }

  /**
   * Export report as Markdown
   */
  exportMarkdown(report: OptimizationReport): string {
    const priorityEmoji: Record<Priority, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const lines: string[] = [
      '# 测试优化报告',
      '',
      `> 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
      '',
      '## 概览',
      '',
      `| 指标 | 值 |`,
      `|------|-----|`,
      `| 优化建议数 | ${report.summary.totalRecommendations} |`,
      `| 预计节省时间 | ${this.formatDuration(report.summary.estimatedTotalSavings.time)} |`,
      `| 效率提升 | ${report.summary.estimatedTotalSavings.percentage}% |`,
      `| 稳定性评分 | ${report.stabilityAnalysis.overallScore}/100 |`,
      `| 维护性评分 | ${report.maintainabilityAnalysis.overallScore}/100 |`,
      '',
      '### 按优先级分布',
      '',
      `| 优先级 | 数量 |`,
      `|--------|------|`,
      ...Object.entries(report.summary.byPriority).map(
        ([priority, count]) =>
          `| ${priorityEmoji[priority as Priority]} ${priority} | ${count} |`,
      ),
      '',
      '## 优化建议',
      '',
    ];

    for (const rec of report.recommendations) {
      lines.push(`### ${priorityEmoji[rec.priority]} ${rec.title}`);
      lines.push('');
      lines.push(`**类型**: ${rec.type} | **优先级**: ${rec.priority} | **工作量**: ${rec.effort}`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      lines.push(`*${rec.impact.description}*`);
      lines.push('');
      lines.push('**行动项:**');
      for (const item of rec.actionItems) {
        lines.push(`${item.order}. ${item.action}`);
        if (item.details) {
          lines.push(`   - ${item.details}`);
        }
      }
      lines.push('');
    }

    lines.push('## 效率分析');
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 总执行时间 | ${this.formatDuration(report.efficiencyAnalysis.totalDuration)} |`);
    lines.push(`| 平均执行时间 | ${this.formatDuration(report.efficiencyAnalysis.averageDuration)} |`);
    lines.push(`| 慢速用例数 | ${report.efficiencyAnalysis.slowestCases.length} |`);
    lines.push(`| 瓶颈数量 | ${report.efficiencyAnalysis.bottlenecks.length} |`);
    lines.push('');

    lines.push('## 冗余分析');
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 冗余组数 | ${report.redundancyReport.redundantGroups.length} |`);
    lines.push(`| 重复步骤数 | ${report.redundancyReport.duplicateSteps.length} |`);
    lines.push(`| 重叠度评分 | ${report.redundancyReport.overlapScore}% |`);
    lines.push('');

    if (report.coverageGaps.length > 0) {
      lines.push('## 覆盖率缺口');
      lines.push('');
      lines.push(`| 功能 | 当前覆盖 | 建议覆盖 | 风险等级 |`);
      lines.push(`|------|----------|----------|----------|`);
      for (const gap of report.coverageGaps) {
        lines.push(`| ${gap.feature} | ${gap.currentCoverage}% | ${gap.recommendedCoverage}% | ${gap.riskLevel} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('*由 Midscene.js 测试优化系统生成*');

    return lines.join('\n');
  }

  /**
   * Create summary from recommendations
   */
  private createSummary(
    recommendations: Recommendation[],
    efficiency: EfficiencyAnalysis,
  ): OptimizationSummary {
    const byPriority: Record<Priority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const byType: Record<RecommendationType, number> = {
      efficiency: 0,
      redundancy: 0,
      coverage: 0,
      stability: 0,
      maintainability: 0,
      priority: 0,
      resource: 0,
    };

    for (const rec of recommendations) {
      byPriority[rec.priority]++;
      byType[rec.type]++;
    }

    const totalImpact = impactEstimator.estimateTotalImpact(recommendations);

    // Calculate efficiency improvement percentage
    const efficiencyPercentage =
      efficiency.totalDuration > 0
        ? Math.round(
            (totalImpact.totalTimeSaving / efficiency.totalDuration) * 100,
          )
        : 0;

    return {
      totalRecommendations: recommendations.length,
      byPriority,
      byType,
      estimatedTotalSavings: {
        time: totalImpact.totalTimeSaving,
        percentage: Math.min(50, efficiencyPercentage), // Cap at 50%
      },
      topIssues: recommendations.slice(0, 3).map((r) => r.title),
    };
  }

  /**
   * Generate resource optimization suggestions
   */
  private generateResourceOptimizations(
    efficiency: EfficiencyAnalysis,
  ): ResourceOptimization[] {
    const optimizations: ResourceOptimization[] = [];

    // Screenshot optimization
    if (efficiency.resourceUtilization.screenshotSize > 1024 * 1024) {
      optimizations.push({
        type: 'screenshot',
        currentUsage: efficiency.resourceUtilization.screenshotSize,
        recommendedUsage: efficiency.resourceUtilization.screenshotSize * 0.3,
        estimatedSaving: {
          value: Math.round(
            (efficiency.resourceUtilization.screenshotSize * 0.7) / 1024,
          ),
          unit: 'KB',
        },
        suggestion: '仅保存失败测试的截图，减少存储空间',
      });
    }

    // Parallel optimization
    const parallel = efficiency.parallelizationOpportunity;
    if (parallel.recommendedParallel > parallel.currentParallel) {
      optimizations.push({
        type: 'parallel',
        currentUsage: parallel.currentParallel,
        recommendedUsage: parallel.recommendedParallel,
        estimatedSaving: {
          value: parallel.estimatedSaving,
          unit: '%',
        },
        suggestion: `将并行度从 ${parallel.currentParallel} 提升到 ${parallel.recommendedParallel}`,
      });
    }

    // Browser reuse
    optimizations.push({
      type: 'browser_reuse',
      currentUsage: 0,
      recommendedUsage: 1,
      estimatedSaving: {
        value: 30,
        unit: '%',
      },
      suggestion: '启用浏览器实例复用，减少启动时间',
    });

    return optimizations;
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}秒`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`;
    return `${Math.round(ms / 3600000)}小时`;
  }
}

export const optimizationReport = new OptimizationReportGenerator();
