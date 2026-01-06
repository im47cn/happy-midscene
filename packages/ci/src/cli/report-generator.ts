/**
 * Report Generator CLI
 *
 * CLI wrapper for the report generation service.
 */

import {
  generateReportString,
  generateReports,
  getSupportedFormats,
} from '../services/ci';
import type { CIExecutionResult, ReportFormat } from '../types/ci';

/**
 * Generate report in specified format and save to file
 *
 * @deprecated Use generateReports from services/ci directly for multiple formats
 */
export async function generateReport(
  results: CIExecutionResult,
  format: ReportFormat,
  outputDir: string,
  title?: string,
): Promise<string[]> {
  const result = generateReports(results, {
    outputDir,
    formats: [format],
    title,
  });

  return result.files[format] || [];
}

/**
 * Generate report as string (no file output)
 */
export function generateReportAsString(
  results: CIExecutionResult,
  format: ReportFormat,
  title?: string,
): string {
  return generateReportString(results, format, title);
}

/**
 * Get list of supported report formats
 */
export function getAvailableFormats(): ReportFormat[] {
  return getSupportedFormats();
}

/**
 * Generate reports in multiple formats
 */
export function generateMultipleReports(
  results: CIExecutionResult,
  formats: ReportFormat[],
  outputDir: string,
  title?: string,
): Record<string, string[]> {
  const result = generateReports(results, {
    outputDir,
    formats,
    title,
  });

  return result.files;
}
