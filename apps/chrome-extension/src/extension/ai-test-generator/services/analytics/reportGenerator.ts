/**
 * Report Generator Service
 * Generates analytics reports in various formats with data masking support
 */

import type {
  CaseStats,
  DailyStats,
  DateRange,
  FailureType,
  Hotspot,
  MaskingStats,
  Report,
  ReportFailureAnalysis,
  ReportSummary,
  ReportType,
} from '../../types/analytics';
import { FAILURE_TYPE_LABELS } from '../../types/analytics';
import { auditLogger, maskerEngine } from '../masking';
import { analysisEngine } from './analysisEngine';
import { analyticsStorage } from './analyticsStorage';

class ReportGenerator {
  /**
   * Generate a daily report
   */
  async generateDailyReport(date: string): Promise<Report> {
    const dateRange: DateRange = { startDate: date, endDate: date };
    return this.generateReport('daily', dateRange);
  }

  /**
   * Generate a weekly report
   */
  async generateWeeklyReport(endDate?: string): Promise<Report> {
    const end = endDate || this.formatDate(new Date());
    const startDate = new Date(end);
    startDate.setDate(startDate.getDate() - 6);
    const start = this.formatDate(startDate);

    return this.generateReport('weekly', { startDate: start, endDate: end });
  }

  /**
   * Generate a custom report
   */
  async generateCustomReport(dateRange: DateRange): Promise<Report> {
    return this.generateReport('custom', dateRange);
  }

  /**
   * Generate report for the given type and date range
   */
  private async generateReport(
    type: ReportType,
    dateRange: DateRange,
  ): Promise<Report> {
    const dailyStats = await analyticsStorage.getDailyStatsRange(
      dateRange.startDate,
      dateRange.endDate,
    );

    const caseStats = await analyticsStorage.getAllCaseStats();
    const hotspots = await analysisEngine.analyzeFailureHotspots(5);

    const summary = this.calculateSummary(dailyStats);
    const failureAnalysis = this.analyzeFailures(dailyStats, hotspots);

    // Get masking statistics for the date range
    const maskingStats = await this.getMaskingStats(dateRange);

    const recommendations = this.generateRecommendations(
      summary,
      failureAnalysis,
      caseStats,
    );

    const title = this.generateTitle(type, dateRange);

    // Apply masking to case names if needed
    const maskedCaseStats = await this.maskCaseStats(
      this.getTopCases(caseStats),
    );

    const report: Report = {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      generatedAt: Date.now(),
      dateRange,
      summary,
      failureAnalysis,
      recommendations,
      caseStats: maskedCaseStats,
      maskingStats,
    };

    // Save report
    await analyticsStorage.saveReport(report);

    return report;
  }

  /**
   * Get masking statistics for the date range
   */
  private async getMaskingStats(dateRange: DateRange): Promise<MaskingStats> {
    const config = maskerEngine.getConfig();
    const startTime = new Date(dateRange.startDate).getTime();
    const endTime = new Date(dateRange.endDate).getTime() + 24 * 60 * 60 * 1000; // End of day

    try {
      const auditStats = await auditLogger.getStats(startTime, endTime);

      return {
        enabled: config.enabled,
        totalMasked: auditStats.totalMasked,
        byCategory: auditStats.byCategory,
        byType: auditStats.byType,
      };
    } catch (error) {
      console.debug('Failed to get masking stats:', error);
      return {
        enabled: config.enabled,
        totalMasked: 0,
        byCategory: {},
        byType: { text: 0, screenshot: 0, log: 0, yaml: 0 },
      };
    }
  }

  /**
   * Mask sensitive data in case stats
   */
  private async maskCaseStats(caseStats: CaseStats[]): Promise<CaseStats[]> {
    const config = maskerEngine.getConfig();
    if (!config.enabled || !config.textMasking) {
      return caseStats;
    }

    const maskedStats: CaseStats[] = [];

    for (const stat of caseStats) {
      try {
        const maskedResult = await maskerEngine.maskText(stat.caseName, 'text');
        maskedStats.push({
          ...stat,
          caseName: maskedResult.masked,
        });
      } catch {
        maskedStats.push(stat);
      }
    }

    return maskedStats;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(dailyStats: DailyStats[]): ReportSummary {
    const totalExecutions = dailyStats.reduce(
      (sum, d) => sum + d.totalExecutions,
      0,
    );
    const totalPassed = dailyStats.reduce((sum, d) => sum + d.passed, 0);
    const passRate =
      totalExecutions > 0 ? (totalPassed / totalExecutions) * 100 : 0;

    const totalDuration = dailyStats.reduce(
      (sum, d) => sum + d.avgDuration * d.totalExecutions,
      0,
    );
    const avgDuration =
      totalExecutions > 0 ? totalDuration / totalExecutions : 0;

    // Calculate health score (simplified)
    const healthScore = Math.round(passRate * 0.7 + 30);

    return {
      totalExecutions,
      passRate: `${passRate.toFixed(1)}%`,
      avgDuration: this.formatDuration(avgDuration),
      healthScore: Math.min(100, healthScore),
    };
  }

  /**
   * Analyze failures
   */
  private analyzeFailures(
    dailyStats: DailyStats[],
    hotspots: Hotspot[],
  ): ReportFailureAnalysis {
    const byType: Record<FailureType, number> = {
      locator_failed: 0,
      assertion_failed: 0,
      timeout: 0,
      network_error: 0,
      script_error: 0,
      unknown: 0,
    };

    for (const stats of dailyStats) {
      for (const [type, count] of Object.entries(stats.failuresByType)) {
        byType[type as FailureType] += count;
      }
    }

    return { byType, hotspots };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    summary: ReportSummary,
    failureAnalysis: ReportFailureAnalysis,
    caseStats: CaseStats[],
  ): string[] {
    const recommendations: string[] = [];
    const passRate = Number.parseFloat(summary.passRate);

    // Pass rate recommendations
    if (passRate < 80) {
      recommendations.push(
        `通过率 (${summary.passRate}) 低于 80%，建议重点排查失败用例并修复`,
      );
    }

    // Failure type recommendations
    const { byType } = failureAnalysis;
    const totalFailures = Object.values(byType).reduce((a, b) => a + b, 0);

    if (totalFailures > 0) {
      const dominantType = Object.entries(byType).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const dominantPercentage = (dominantType[1] / totalFailures) * 100;

      if (dominantPercentage > 40) {
        const typeName = FAILURE_TYPE_LABELS[dominantType[0] as FailureType];
        recommendations.push(
          `"${typeName}"类型失败占比 ${dominantPercentage.toFixed(0)}%，建议重点关注此类问题`,
        );
      }
    }

    // Specific failure type recommendations
    if (byType.locator_failed > 5) {
      recommendations.push('多个定位失败，建议启用自愈功能或更新元素定位策略');
    }

    if (byType.timeout > 3) {
      recommendations.push('存在多个超时失败，建议检查网络环境或增加超时配置');
    }

    // Flaky test recommendations
    const flakyCases = caseStats.filter((c) => c.isFlaky);
    if (flakyCases.length > 0) {
      recommendations.push(
        `检测到 ${flakyCases.length} 个 Flaky 测试，建议优先稳定这些用例`,
      );
    }

    // Hotspot recommendations
    if (failureAnalysis.hotspots.length > 0) {
      const topHotspot = failureAnalysis.hotspots[0];
      if (topHotspot.failureCount > 5) {
        recommendations.push(
          `"${topHotspot.description}" 是主要失败热点 (${topHotspot.failureCount}次)，建议重点排查`,
        );
      }
    }

    // Add general recommendation if none generated
    if (recommendations.length === 0) {
      if (passRate >= 95) {
        recommendations.push('测试健康状况良好，继续保持!');
      } else {
        recommendations.push('建议持续关注测试稳定性，定期检查失败用例');
      }
    }

    return recommendations;
  }

  /**
   * Get top cases for report
   */
  private getTopCases(caseStats: CaseStats[]): CaseStats[] {
    // Sort by stability score ascending (worst first)
    return [...caseStats]
      .sort((a, b) => a.stabilityScore - b.stabilityScore)
      .slice(0, 10);
  }

  /**
   * Generate report title
   */
  private generateTitle(type: ReportType, dateRange: DateRange): string {
    switch (type) {
      case 'daily':
        return `测试执行日报 - ${dateRange.startDate}`;
      case 'weekly':
        return `测试执行周报 - ${dateRange.startDate} 至 ${dateRange.endDate}`;
      case 'custom':
        return `测试执行报告 - ${dateRange.startDate} 至 ${dateRange.endDate}`;
    }
  }

  /**
   * Export report to HTML
   */
  exportToHTML(report: Report): string {
    const { byType } = report.failureAnalysis;
    const failureRows = Object.entries(byType)
      .filter(([_, count]) => count > 0)
      .map(
        ([type, count]) =>
          `<tr><td>${FAILURE_TYPE_LABELS[type as FailureType]}</td><td>${count}</td></tr>`,
      )
      .join('');

    const hotspotRows = report.failureAnalysis.hotspots
      .map(
        (h, i) =>
          `<tr><td>${i + 1}</td><td>${h.description}</td><td>${h.failureCount}</td></tr>`,
      )
      .join('');

    const recommendationItems = report.recommendations
      .map((r) => `<li>${r}</li>`)
      .join('');

    // Generate masking stats section
    const maskingSection = this.generateMaskingSection(report);

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #333; }
    h1 { color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 10px; }
    h2 { color: #262626; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 28px; font-weight: bold; color: #1890ff; }
    .summary-label { color: #8c8c8c; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #f0f0f0; padding: 10px; text-align: left; }
    th { background: #fafafa; font-weight: 600; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .generated { color: #8c8c8c; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>

  <h2>执行摘要</h2>
  <div class="summary">
    <div class="summary-card">
      <div class="summary-value">${report.summary.totalExecutions}</div>
      <div class="summary-label">总执行次数</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${report.summary.passRate}</div>
      <div class="summary-label">通过率</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${report.summary.avgDuration}</div>
      <div class="summary-label">平均耗时</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${report.summary.healthScore}</div>
      <div class="summary-label">健康度评分</div>
    </div>
  </div>

  <h2>失败分析</h2>
  <h3>按类型分布</h3>
  <table>
    <tr><th>失败类型</th><th>数量</th></tr>
    ${failureRows || '<tr><td colspan="2">无失败记录</td></tr>'}
  </table>

  <h3>失败热点</h3>
  <table>
    <tr><th>#</th><th>描述</th><th>失败次数</th></tr>
    ${hotspotRows || '<tr><td colspan="3">无失败热点</td></tr>'}
  </table>

  <h2>建议事项</h2>
  <ul>
    ${recommendationItems}
  </ul>

  ${maskingSection}

  <p class="generated">
    生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}<br>
    报告 ID: ${report.id}
  </p>
</body>
</html>`;
  }

  /**
   * Generate masking statistics section for HTML report
   */
  private generateMaskingSection(report: Report): string {
    if (!report.maskingStats || !report.maskingStats.enabled) {
      return '';
    }

    const { totalMasked, byCategory, byType } = report.maskingStats;

    if (totalMasked === 0) {
      return `
  <h2>数据脱敏</h2>
  <p>数据脱敏已启用，本期报告未检测到敏感数据。</p>`;
    }

    const categoryLabels: Record<string, string> = {
      credential: '凭证信息',
      pii: '个人信息',
      financial: '金融信息',
      health: '健康信息',
      custom: '自定义',
    };

    const categoryRows = Object.entries(byCategory)
      .filter(([_, count]) => count > 0)
      .map(
        ([category, count]) =>
          `<tr><td>${categoryLabels[category] || category}</td><td>${count}</td></tr>`,
      )
      .join('');

    return `
  <h2>数据脱敏统计</h2>
  <div class="summary" style="grid-template-columns: repeat(5, 1fr);">
    <div class="summary-card">
      <div class="summary-value">${totalMasked}</div>
      <div class="summary-label">脱敏总数</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${byType.text}</div>
      <div class="summary-label">文本脱敏</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${byType.screenshot}</div>
      <div class="summary-label">截图脱敏</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${byType.log}</div>
      <div class="summary-label">日志脱敏</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${byType.yaml}</div>
      <div class="summary-label">YAML脱敏</div>
    </div>
  </div>

  <h3>按类别分布</h3>
  <table>
    <tr><th>类别</th><th>数量</th></tr>
    ${categoryRows || '<tr><td colspan="2">无分类数据</td></tr>'}
  </table>`;
  }

  /**
   * Export report to CSV
   */
  exportToCSV(report: Report): string {
    const lines: string[] = [];

    // Header
    lines.push(`"${report.title}"`);
    lines.push(
      `"生成时间","${new Date(report.generatedAt).toLocaleString('zh-CN')}"`,
    );
    lines.push('');

    // Summary
    lines.push('"执行摘要"');
    lines.push('"指标","值"');
    lines.push(`"总执行次数","${report.summary.totalExecutions}"`);
    lines.push(`"通过率","${report.summary.passRate}"`);
    lines.push(`"平均耗时","${report.summary.avgDuration}"`);
    lines.push(`"健康度","${report.summary.healthScore}"`);
    lines.push('');

    // Failure by type
    lines.push('"失败类型分布"');
    lines.push('"类型","数量"');
    for (const [type, count] of Object.entries(report.failureAnalysis.byType)) {
      if (count > 0) {
        lines.push(`"${FAILURE_TYPE_LABELS[type as FailureType]}","${count}"`);
      }
    }
    lines.push('');

    // Hotspots
    lines.push('"失败热点"');
    lines.push('"排名","描述","失败次数"');
    report.failureAnalysis.hotspots.forEach((h, i) => {
      lines.push(`"${i + 1}","${h.description}","${h.failureCount}"`);
    });
    lines.push('');

    // Case stats
    lines.push('"用例统计"');
    lines.push('"用例名称","通过率","平均耗时","稳定性","是否Flaky"');
    for (const c of report.caseStats) {
      lines.push(
        `"${c.caseName}","${c.passRate.toFixed(1)}%","${this.formatDuration(c.avgDuration)}","${c.stabilityScore}","${c.isFlaky ? '是' : '否'}"`,
      );
    }
    lines.push('');

    // Masking stats
    if (report.maskingStats?.enabled) {
      lines.push('"数据脱敏统计"');
      lines.push('"指标","值"');
      lines.push(`"脱敏总数","${report.maskingStats.totalMasked}"`);
      lines.push(`"文本脱敏","${report.maskingStats.byType.text}"`);
      lines.push(`"截图脱敏","${report.maskingStats.byType.screenshot}"`);
      lines.push(`"日志脱敏","${report.maskingStats.byType.log}"`);
      lines.push(`"YAML脱敏","${report.maskingStats.byType.yaml}"`);
    }

    return lines.join('\n');
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get recent reports
   */
  async getRecentReports(limit = 10): Promise<Report[]> {
    return analyticsStorage.getRecentReports(limit);
  }

  /**
   * Get report by ID
   */
  async getReport(id: string): Promise<Report | null> {
    return analyticsStorage.getReport(id);
  }
}

export const reportGenerator = new ReportGenerator();
