/**
 * HTML Format Adapter
 *
 * Generates HTML format test reports.
 */

import type { CIExecutionResult } from '../../../types/ci';
import type { ReportAdapter } from './types';

/**
 * HTML report adapter
 */
export class HTMLAdapter implements ReportAdapter {
  readonly format = 'html' as const;
  readonly extension = '.html';

  generate(results: CIExecutionResult, options?: { title?: string }): string {
    const title = options?.title || 'Midscene Test Report';
    const passRate = results.passRate.toFixed(1);
    const startTime = results.startedAt
      ? new Date(results.startedAt).getTime()
      : Date.now() - results.duration;
    const endTime = results.finishedAt
      ? new Date(results.finishedAt).getTime()
      : startTime + results.duration;
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const tests = results.tests || results.testCases || [];

    const testResultsHtml =
      tests.length > 0
        ? `<div class="tests">
      <h2 style="margin-top: 0;">Test Results</h2>
      ${tests
        .map(
          (test) => `
        <div class="test ${test.status}">
          <div class="test-name">${this.escapeHtml(test.suite || 'Midscene')}: ${this.escapeHtml(test.name)}</div>
          ${test.error ? `<div class="test-error">${this.escapeHtml(test.error)}</div>` : ''}
          <div style="font-size: 12px; color: #999;">${(test.duration / 1000).toFixed(2)}s</div>
        </div>`,
        )
        .join('')}
    </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { padding: 20px; border-bottom: 1px solid #e0e0e0; }
    .header h1 { margin: 0; color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 20px; }
    .metric { text-align: center; padding: 15px; border-radius: 6px; background: #f9f9f9; }
    .metric.passed { background: #f6ffed; border: 1px solid #b7eb8f; }
    .metric.failed { background: #fff2f0; border: 1px solid #ffccc7; }
    .metric-value { font-size: 32px; font-weight: bold; }
    .metric-label { font-size: 14px; color: #666; margin-top: 5px; }
    .tests { padding: 20px; }
    .test { padding: 10px; border-bottom: 1px solid #e0e0e0; }
    .test:last-child { border-bottom: none; }
    .test-name { font-weight: 500; }
    .test.passed { border-left: 3px solid #52c41a; }
    .test.failed { border-left: 3px solid #ff4d4f; }
    .test.skipped { border-left: 3px solid #faad14; }
    .test.flaky { border-left: 3px solid #faad14; }
    .test-error { color: #ff4d4f; font-size: 14px; margin-top: 5px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.escapeHtml(title)}</h1>
      <p style="color: #666; margin-top: 5px;">Generated: ${new Date().toLocaleString()}</p>
    </div>
    <div class="summary">
      <div class="metric">
        <div class="metric-value">${results.totalTests}</div>
        <div class="metric-label">Total Tests</div>
      </div>
      <div class="metric ${results.passed > 0 ? 'passed' : ''}">
        <div class="metric-value" style="color: #52c41a;">${results.passed}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric ${results.failed > 0 ? 'failed' : ''}">
        <div class="metric-value" style="color: #ff4d4f;">${results.failed}</div>
        <div class="metric-label">Failed</div>
      </div>
      <div class="metric">
        <div class="metric-value">${results.skipped}</div>
        <div class="metric-label">Skipped</div>
      </div>
      <div class="metric">
        <div class="metric-value">${passRate}%</div>
        <div class="metric-label">Pass Rate</div>
      </div>
      <div class="metric">
        <div class="metric-value">${duration}s</div>
        <div class="metric-label">Duration</div>
      </div>
    </div>
    ${testResultsHtml}
  </div>
</body>
</html>`;
  }

  /**
   * Escape special HTML characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
