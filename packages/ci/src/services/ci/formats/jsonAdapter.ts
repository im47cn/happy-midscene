/**
 * JSON Format Adapter
 *
 * Generates JSON format test reports.
 */

import type { CIExecutionResult, JSONReport } from '../../../types/ci';
import type { ReportAdapter } from './types';

/**
 * JSON report adapter
 */
export class JSONAdapter implements ReportAdapter {
  readonly format = 'json' as const;
  readonly extension = '.json';

  generate(results: CIExecutionResult, options?: { title?: string }): string {
    const startTime = results.startedAt
      ? new Date(results.startedAt).getTime()
      : Date.now() - results.duration;
    const endTime = results.finishedAt
      ? new Date(results.finishedAt).getTime()
      : startTime + results.duration;
    const tests = results.tests || results.testCases || [];

    const report: JSONReport = {
      meta: {
        generatedAt: new Date().toISOString(),
        generator: '@midscene/ci',
        version: '1.1.0',
      },
      summary: {
        total: results.totalTests,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        flaky: results.flaky || 0,
        duration: endTime - startTime,
        passRate: results.passRate,
      },
      suites: [
        {
          name: options?.title || results.suiteName || 'Midscene Tests',
          duration: endTime - startTime,
          tests,
        },
      ],
    };

    return JSON.stringify(report, null, 2);
  }
}
