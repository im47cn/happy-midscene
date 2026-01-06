/**
 * Collaborative Report Generator
 * Generates comprehensive reports for multi-device test execution
 */

import type {
  CollaborativeExecutionResult,
  DeviceExecutionResult,
  SyncPointTiming,
} from '../../types/multiDevice';
import {
  type AggregatedResult,
  type AggregatedStats,
  type DeviceComparison,
  type FailureCorrelation,
  ResultAggregator,
} from './resultAggregator';

/**
 * Report format options
 */
export type ReportFormat = 'html' | 'json' | 'markdown';

/**
 * Report options
 */
export interface ReportOptions {
  /** Report format */
  format: ReportFormat;
  /** Include screenshots */
  includeScreenshots?: boolean;
  /** Include timeline visualization */
  includeTimeline?: boolean;
  /** Include shared data history */
  includeDataHistory?: boolean;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
}

/**
 * Generated report
 */
export interface GeneratedReport {
  /** Report format */
  format: ReportFormat;
  /** Report content */
  content: string;
  /** Report filename suggestion */
  filename: string;
  /** Generated at timestamp */
  generatedAt: number;
}

/**
 * Collaborative Report Generator class
 */
export class CollaborativeReportGenerator {
  private aggregator: ResultAggregator;

  constructor() {
    this.aggregator = new ResultAggregator();
  }

  /**
   * Generate report from execution result
   */
  generate(
    result: CollaborativeExecutionResult,
    options: ReportOptions,
  ): GeneratedReport {
    const aggregated = this.aggregator.aggregate(result);
    const timestamp = Date.now();

    let content: string;
    let extension: string;

    switch (options.format) {
      case 'html':
        content = this.generateHTML(aggregated, options);
        extension = 'html';
        break;
      case 'json':
        content = this.generateJSON(aggregated, options);
        extension = 'json';
        break;
      case 'markdown':
        content = this.generateMarkdown(aggregated, options);
        extension = 'md';
        break;
    }

    return {
      format: options.format,
      content,
      filename: `collaborative-report-${new Date(timestamp).toISOString().slice(0, 10)}.${extension}`,
      generatedAt: timestamp,
    };
  }

  /**
   * Generate HTML report
   */
  private generateHTML(
    aggregated: AggregatedResult,
    options: ReportOptions,
  ): string {
    const { original, stats, deviceComparisons, failureCorrelations } =
      aggregated;
    const title = options.title || 'Multi-Device Test Report';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root {
      --success-color: #52c41a;
      --error-color: #ff4d4f;
      --warning-color: #faad14;
      --primary-color: #1890ff;
      --text-color: #333;
      --border-color: #e8e8e8;
      --bg-light: #fafafa;
    }

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text-color);
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      background: #fff;
    }

    h1, h2, h3 { margin-top: 0; }

    .header {
      border-bottom: 2px solid var(--primary-color);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 14px;
    }

    .status-success { background: var(--success-color); color: #fff; }
    .status-failed { background: var(--error-color); color: #fff; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-light);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }

    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      background: var(--bg-light);
      font-weight: 600;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    .progress-fill.success { background: var(--success-color); }
    .progress-fill.warning { background: var(--warning-color); }
    .progress-fill.error { background: var(--error-color); }

    .timeline-container {
      background: var(--bg-light);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      overflow-x: auto;
    }

    .device-lane {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }

    .device-label {
      width: 120px;
      flex-shrink: 0;
      font-weight: 500;
    }

    .timeline-track {
      flex: 1;
      height: 24px;
      background: #e0e0e0;
      border-radius: 4px;
      position: relative;
    }

    .timeline-block {
      position: absolute;
      height: 100%;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #fff;
      overflow: hidden;
    }

    .timeline-block.success { background: var(--success-color); }
    .timeline-block.failed { background: var(--error-color); }
    .timeline-block.sync { background: var(--warning-color); }

    .error-card {
      background: #fff2f0;
      border: 1px solid #ffccc7;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .error-pattern {
      font-family: monospace;
      font-size: 13px;
      background: #fff;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
      text-align: center;
      font-size: 12px;
      color: #999;
    }

    @media print {
      body { max-width: 100%; }
      .timeline-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(title)}</h1>
    ${options.description ? `<p>${this.escapeHtml(options.description)}</p>` : ''}
    <span class="status-badge ${original.success ? 'status-success' : 'status-failed'}">
      ${original.success ? 'PASSED' : 'FAILED'}
    </span>
    <span style="margin-left: 16px; color: #666;">
      ${new Date(original.startTime).toLocaleString()}
    </span>
  </div>

  <h2>Summary</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${this.formatDuration(stats.totalDuration)}</div>
      <div class="stat-label">Total Duration</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.successfulSteps}/${stats.totalSteps}</div>
      <div class="stat-label">Steps Passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${stats.successRate.toFixed(1)}%</div>
      <div class="stat-label">Success Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${original.devices.length}</div>
      <div class="stat-label">Devices</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${original.syncPoints.length}</div>
      <div class="stat-label">Sync Points</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${this.formatDuration(stats.totalSyncWaitTime)}</div>
      <div class="stat-label">Sync Overhead</div>
    </div>
  </div>

  <h2>Device Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Device</th>
        <th>Steps</th>
        <th>Passed</th>
        <th>Failed</th>
        <th>Success Rate</th>
        <th>Duration</th>
      </tr>
    </thead>
    <tbody>
      ${deviceComparisons
        .map(
          (d) => `
        <tr>
          <td><strong>${this.escapeHtml(d.deviceAlias)}</strong></td>
          <td>${d.totalSteps}</td>
          <td style="color: var(--success-color)">${d.successfulSteps}</td>
          <td style="color: var(--error-color)">${d.failedSteps}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill ${this.getProgressClass(d.successRate)}"
                   style="width: ${d.successRate}%"></div>
            </div>
            <span style="font-size: 12px">${d.successRate.toFixed(1)}%</span>
          </td>
          <td>${this.formatDuration(d.totalDuration)}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>

  ${
    options.includeTimeline !== false
      ? `
  <h2>Execution Timeline</h2>
  <div class="timeline-container">
    ${this.generateHTMLTimeline(original, stats.totalDuration)}
  </div>
  `
      : ''
  }

  ${
    failureCorrelations.length > 0
      ? `
  <h2>Failure Analysis</h2>
  ${failureCorrelations
    .slice(0, 5)
    .map(
      (f) => `
    <div class="error-card">
      <div class="error-pattern">${this.escapeHtml(f.errorPattern)}</div>
      <div>
        <strong>Occurrences:</strong> ${f.occurrences} |
        <strong>Devices:</strong> ${f.affectedDevices.join(', ')}
      </div>
      ${f.potentialCause ? `<div><strong>Potential Cause:</strong> ${this.escapeHtml(f.potentialCause)}</div>` : ''}
    </div>
  `,
    )
    .join('')}
  `
      : ''
  }

  ${
    Object.keys(original.sharedData).length > 0
      ? `
  <h2>Shared Data</h2>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(original.sharedData)
        .map(
          ([key, value]) => `
        <tr>
          <td><code>${this.escapeHtml(key)}</code></td>
          <td><code>${this.escapeHtml(JSON.stringify(value))}</code></td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <div class="footer">
    Generated by Midscene Multi-Device Testing | ${new Date().toLocaleString()}
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML timeline visualization
   */
  private generateHTMLTimeline(
    result: CollaborativeExecutionResult,
    totalDuration: number,
  ): string {
    const lines: string[] = [];

    for (const device of result.devices) {
      let currentOffset = 0;
      const blocks: string[] = [];

      for (const step of device.steps) {
        const left = (currentOffset / totalDuration) * 100;
        const width = (step.result.duration / totalDuration) * 100;

        blocks.push(`
          <div class="timeline-block ${step.result.success ? 'success' : 'failed'}"
               style="left: ${left}%; width: ${Math.max(width, 1)}%"
               title="${this.escapeHtml(step.instruction)} (${this.formatDuration(step.result.duration)})">
          </div>
        `);

        currentOffset += step.result.duration;
      }

      lines.push(`
        <div class="device-lane">
          <div class="device-label">${this.escapeHtml(device.deviceAlias)}</div>
          <div class="timeline-track">${blocks.join('')}</div>
        </div>
      `);
    }

    // Add sync points
    for (const sp of result.syncPoints) {
      const left = ((sp.startTime - result.startTime) / totalDuration) * 100;
      const width = (sp.duration / totalDuration) * 100;

      lines.push(`
        <div class="device-lane">
          <div class="device-label" style="color: var(--warning-color)">Sync: ${this.escapeHtml(sp.id)}</div>
          <div class="timeline-track">
            <div class="timeline-block sync"
                 style="left: ${left}%; width: ${Math.max(width, 1)}%"
                 title="${this.formatDuration(sp.duration)}">
            </div>
          </div>
        </div>
      `);
    }

    return lines.join('');
  }

  /**
   * Generate JSON report
   */
  private generateJSON(
    aggregated: AggregatedResult,
    options: ReportOptions,
  ): string {
    const report = {
      title: options.title || 'Multi-Device Test Report',
      description: options.description,
      generatedAt: new Date().toISOString(),
      success: aggregated.original.success,
      stats: aggregated.stats,
      deviceComparisons: aggregated.deviceComparisons,
      failureCorrelations: aggregated.failureCorrelations,
      summary: aggregated.summary,
      execution: {
        startTime: aggregated.original.startTime,
        endTime: aggregated.original.endTime,
        totalDuration: aggregated.original.totalDuration,
        devices: aggregated.original.devices.map((d) => ({
          deviceId: d.deviceId,
          deviceAlias: d.deviceAlias,
          steps: d.steps.map((s) => ({
            instruction: s.instruction,
            success: s.result.success,
            duration: s.result.duration,
            error: s.result.error,
          })),
          totalDuration: d.totalDuration,
        })),
        syncPoints: aggregated.original.syncPoints,
        sharedData: aggregated.original.sharedData,
        errors: aggregated.original.errors,
      },
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdown(
    aggregated: AggregatedResult,
    options: ReportOptions,
  ): string {
    const { original, stats, deviceComparisons, failureCorrelations } =
      aggregated;
    const title = options.title || 'Multi-Device Test Report';

    const lines: string[] = [];

    // Header
    lines.push(`# ${title}`);
    lines.push('');
    if (options.description) {
      lines.push(`> ${options.description}`);
      lines.push('');
    }
    lines.push(`**Status:** ${original.success ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push(`**Date:** ${new Date(original.startTime).toLocaleString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(
      `| Total Duration | ${this.formatDuration(stats.totalDuration)} |`,
    );
    lines.push(
      `| Steps Passed | ${stats.successfulSteps}/${stats.totalSteps} |`,
    );
    lines.push(`| Success Rate | ${stats.successRate.toFixed(1)}% |`);
    lines.push(`| Devices | ${original.devices.length} |`);
    lines.push(`| Sync Points | ${original.syncPoints.length} |`);
    lines.push(
      `| Sync Overhead | ${this.formatDuration(stats.totalSyncWaitTime)} (${stats.syncOverheadPercentage.toFixed(1)}%) |`,
    );
    lines.push('');

    // Device Comparison
    lines.push('## Device Comparison');
    lines.push('');
    lines.push(
      '| Device | Steps | Passed | Failed | Success Rate | Duration |',
    );
    lines.push(
      '|--------|-------|--------|--------|--------------|----------|',
    );
    for (const d of deviceComparisons) {
      lines.push(
        `| ${d.deviceAlias} | ${d.totalSteps} | ${d.successfulSteps} | ${d.failedSteps} | ${d.successRate.toFixed(1)}% | ${this.formatDuration(d.totalDuration)} |`,
      );
    }
    lines.push('');

    // Sync Points
    if (original.syncPoints.length > 0) {
      lines.push('## Sync Points');
      lines.push('');
      lines.push('| Sync Point | Duration | Waiting Devices |');
      lines.push('|------------|----------|-----------------|');
      for (const sp of original.syncPoints) {
        lines.push(
          `| ${sp.id} | ${this.formatDuration(sp.duration)} | ${sp.waitingDevices.join(', ')} |`,
        );
      }
      lines.push('');
    }

    // Failures
    if (failureCorrelations.length > 0) {
      lines.push('## Failure Analysis');
      lines.push('');
      for (const f of failureCorrelations.slice(0, 5)) {
        lines.push(`### Error Pattern`);
        lines.push('');
        lines.push('```');
        lines.push(f.errorPattern);
        lines.push('```');
        lines.push('');
        lines.push(`- **Occurrences:** ${f.occurrences}`);
        lines.push(`- **Affected Devices:** ${f.affectedDevices.join(', ')}`);
        if (f.potentialCause) {
          lines.push(`- **Potential Cause:** ${f.potentialCause}`);
        }
        lines.push('');
      }
    }

    // Shared Data
    if (Object.keys(original.sharedData).length > 0) {
      lines.push('## Shared Data');
      lines.push('');
      lines.push('| Key | Value |');
      lines.push('|-----|-------|');
      for (const [key, value] of Object.entries(original.sharedData)) {
        lines.push(`| \`${key}\` | \`${JSON.stringify(value)}\` |`);
      }
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(
      `*Generated by Midscene Multi-Device Testing | ${new Date().toLocaleString()}*`,
    );

    return lines.join('\n');
  }

  /**
   * Get progress bar CSS class
   */
  private getProgressClass(percentage: number): string {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'error';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}

/**
 * Create collaborative report generator instance
 */
export function createCollaborativeReportGenerator(): CollaborativeReportGenerator {
  return new CollaborativeReportGenerator();
}
