/**
 * Report Generator Service
 *
 * Generates test reports in various formats using pluggable adapters.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CIExecutionResult, ReportFormat } from '../../types/ci';
import type { ReportAdapter } from './formats/types';
import { JUnitAdapter } from './formats/junitAdapter';
import { JSONAdapter } from './formats/jsonAdapter';
import { HTMLAdapter } from './formats/htmlAdapter';
import { MarkdownAdapter } from './formats/markdownAdapter';

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Report title */
  title?: string;
  /** Output directory */
  outputDir: string;
  /** Formats to generate */
  formats: ReportFormat[];
  /** Filename prefix (default: 'report') */
  prefix?: string;
  /** Use timestamp in filename */
  timestamp?: boolean;
}

/**
 * Report generation result
 */
export interface ReportResult {
  /** Generated files by format */
  files: Record<ReportFormat, string[]>;
  /** Total files generated */
  totalFiles: number;
  /** Output directory */
  outputDir: string;
}

/**
 * Format adapter registry
 */
const ADAPTERS: Record<ReportFormat, ReportAdapter> = {
  junit: new JUnitAdapter(),
  json: new JSONAdapter(),
  html: new HTMLAdapter(),
  markdown: new MarkdownAdapter(),
};

/**
 * Generate report in specified format
 */
export function generateReport(
  results: CIExecutionResult,
  format: ReportFormat,
  outputPath: string,
  title?: string,
): string {
  const adapter = ADAPTERS[format];

  if (!adapter) {
    throw new Error(`Unsupported report format: ${format}`);
  }

  const content = adapter.generate(results, { title });
  writeFileSync(outputPath, content, 'utf-8');

  return outputPath;
}

/**
 * Generate reports in multiple formats
 */
export function generateReports(
  results: CIExecutionResult,
  options: ReportOptions,
): ReportResult {
  const { outputDir, formats, title, prefix = 'report', timestamp = true } = options;

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  const files: Record<ReportFormat, string[]> = {
    junit: [],
    json: [],
    html: [],
    markdown: [],
  };

  let totalFiles = 0;

  for (const format of formats) {
    const adapter = ADAPTERS[format];

    if (!adapter) {
      console.warn(`Skipping unsupported format: ${format}`);
      continue;
    }

    // Generate filename
    const timestampSuffix = timestamp
      ? `-${new Date().toISOString().replace(/[:.]/g, '-')}`
      : '';
    const filename = `${prefix}${timestampSuffix}${adapter.extension}`;
    const outputPath = join(outputDir, filename);

    // Generate report
    try {
      const content = adapter.generate(results, { title });
      writeFileSync(outputPath, content, 'utf-8');
      files[format].push(outputPath);
      totalFiles++;
    } catch (error) {
      console.error(`Failed to generate ${format} report:`, error);
    }
  }

  return {
    files,
    totalFiles,
    outputDir,
  };
}

/**
 * Generate report as string (no file output)
 */
export function generateReportString(
  results: CIExecutionResult,
  format: ReportFormat,
  title?: string,
): string {
  const adapter = ADAPTERS[format];

  if (!adapter) {
    throw new Error(`Unsupported report format: ${format}`);
  }

  return adapter.generate(results, { title });
}

/**
 * Get adapter for format
 */
export function getAdapter(format: ReportFormat): ReportAdapter | undefined {
  return ADAPTERS[format];
}

/**
 * Get all supported formats
 */
export function getSupportedFormats(): ReportFormat[] {
  return Object.keys(ADAPTERS) as ReportFormat[];
}

/**
 * Get file extension for format
 */
export function getFormatExtension(format: ReportFormat): string {
  const adapter = ADAPTERS[format];
  return adapter?.extension || '';
}
