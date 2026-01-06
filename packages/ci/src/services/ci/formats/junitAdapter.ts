/**
 * JUnit XML Format Adapter
 *
 * Generates JUnit XML format test reports.
 */

import type { CIExecutionResult } from '../../../types/ci';
import type { ReportAdapter } from './types';

/**
 * JUnit XML report adapter
 */
export class JUnitAdapter implements ReportAdapter {
  readonly format = 'junit' as const;
  readonly extension = '.xml';

  generate(results: CIExecutionResult, options?: { title?: string }): string {
    const now = new Date().toISOString();
    const startTime = results.startedAt
      ? new Date(results.startedAt).getTime()
      : Date.now() - results.duration;
    const endTime = results.finishedAt
      ? new Date(results.finishedAt).getTime()
      : startTime + results.duration;
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);

    const tests = results.tests || results.testCases || [];
    const suiteName = options?.title || results.suiteName || 'Midscene Tests';

    // Build test cases XML
    const testCasesXml = tests
      .map((test) => {
        const duration = (test.duration / 1000).toFixed(2);
        const className = test.suite || 'Midscene';
        const name = this.escapeXml(test.name);

        let testCaseXml = `    <testcase name="${name}" classname="${className}" time="${duration}"`;

        if (test.status === 'skipped') {
          const message = this.escapeXml(test.error || 'Test skipped');
          testCaseXml += `>\n      <skipped message="${message}"/>\n    </testcase>`;
        } else if (test.status === 'failed') {
          const errorMessage = this.escapeXml(test.error || 'Test failed');
          const errorText = this.escapeXml(
            test.stackTrace || test.error || 'Test failed',
          );
          testCaseXml += `>\n      <failure message="${errorMessage}" type="AssertionError">${errorText}</failure>\n    </testcase>`;
        } else {
          testCaseXml += ' />';
        }

        return testCaseXml;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${this.escapeXml(suiteName)}" tests="${results.totalTests}" failures="${results.failed}" skipped="${results.skipped}" errors="${results.failed}" time="${durationSec}" timestamp="${now}">
  <testsuite name="${this.escapeXml(suiteName)}" tests="${results.totalTests}" failures="${results.failed}" skipped="${results.skipped}" errors="${results.failed}" time="${durationSec}" timestamp="${now}">
${testCasesXml}
  </testsuite>
</testsuites>`;
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
