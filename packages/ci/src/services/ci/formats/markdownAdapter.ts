/**
 * Markdown Format Adapter
 *
 * Generates Markdown format test reports.
 */

import type { CIExecutionResult } from '../../../types/ci';
import type { ReportAdapter } from './types';

/**
 * Markdown report adapter
 */
export class MarkdownAdapter implements ReportAdapter {
  readonly format = 'markdown' as const;
  readonly extension = '.md';

  generate(results: CIExecutionResult, options?: { title?: string }): string {
    const title = options?.title || '# Midscene Test Report';
    const passRate = results.passRate.toFixed(1);
    const startTime = results.startedAt
      ? new Date(results.startedAt).getTime()
      : Date.now() - results.duration;
    const endTime = results.finishedAt
      ? new Date(results.finishedAt).getTime()
      : startTime + results.duration;
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    const tests = results.tests || results.testCases || [];

    const testResults = tests
      .map((test) => {
        const icon =
          test.status === 'passed'
            ? '✅'
            : test.status === 'failed'
              ? '❌'
              : test.status === 'flaky'
                ? '⚠️'
                : '⏭️';
        const errorLine = test.error ? `* **Error:** \`${test.error}\`\n` : '';
        return `### ${icon} ${test.name}

* **Suite:** ${test.suite || 'Midscene'}
* **Status:** ${test.status}
* **Duration:** ${(test.duration / 1000).toFixed(2)}s
${errorLine}`;
      })
      .join('\n');

    return `${title}

**Generated:** ${new Date().toLocaleString()}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${results.totalTests} |
| Passed | ✅ ${results.passed} |
| Failed | ❌ ${results.failed} |
| Skipped | ⏭️ ${results.skipped} |
| Flaky | ⚠️ ${results.flaky || 0} |
| Pass Rate | ${passRate}% |
| Duration | ${duration}s |

## Test Results

${testResults || 'No test results available.'}
`;
  }
}
