/**
 * Report Adapter Types
 *
 * Shared types for report format adapters.
 */

import type { CIExecutionResult, ReportFormat } from '../../../types/ci';

/**
 * Report adapter interface
 */
export interface ReportAdapter {
  /** Format identifier */
  readonly format: ReportFormat;
  /** File extension for this format */
  readonly extension: string;

  /**
   * Generate report in this format
   */
  generate(results: CIExecutionResult, options?: { title?: string }): string;
}
