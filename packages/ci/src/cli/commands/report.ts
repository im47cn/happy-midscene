/**
 * Report Command
 *
 * Generates test reports in various formats:
 * - JUnit XML
 * - JSON
 * - HTML
 * - Markdown
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CIExecutionResult, ReportFormat } from '../../types/ci';
import { loadJSONFile, loadYAMLFile } from '../config-loader';
import { generateReport } from '../report-generator';

export interface ReportCommandOptions {
  input: string;
  format?: string;
  output?: string;
  title?: string;
  verbose?: boolean;
}

export const reportCommand = {
  command: 'report',
  describe: 'Generate test reports from results',
  builder: (yargs: any) =>
    yargs
      .option('input', {
        alias: 'i',
        type: 'string',
        description: 'Path to test results JSON file',
        demandOption: true,
        group: 'Input',
      })
      .option('format', {
        alias: 'f',
        type: 'string',
        description:
          'Report format(s) (comma-separated): junit, json, html, markdown',
        default: 'json',
        group: 'Output',
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output directory for reports',
        default: './reports',
        group: 'Output',
      })
      .option('title', {
        alias: 't',
        type: 'string',
        description: 'Report title',
        group: 'Output',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Verbose output',
        group: 'Configuration',
      }),
  handler: async (options: ReportCommandOptions) => {
    console.log('\n📊 Midscene CI Report Generator');
    console.log('='.repeat(40));

    const inputPath = join(process.cwd(), options.input);
    const outputDir = join(process.cwd(), options.output ?? './reports');

    // Parse report formats
    const formats = (options.format ?? 'json')
      .split(',')
      .map((s) => s.trim().toLowerCase() as ReportFormat);

    console.log(`Input: ${options.input}`);
    console.log(`Output: ${options.output}`);
    console.log(`Formats: ${formats.join(', ')}`);
    console.log('');

    // Load test results
    let testResults: CIExecutionResult;

    try {
      const resultsData = readFileSync(inputPath, 'utf-8');
      testResults = JSON.parse(resultsData) as CIExecutionResult;
      console.log(`✅ Loaded test results: ${testResults.totalTests} tests`);
    } catch (error) {
      console.error(`❌ Failed to load results: ${error}`);
      process.exit(1);
    }

    // Create output directory
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      console.error(`❌ Failed to create output directory: ${error}`);
      process.exit(1);
    }

    // Generate reports
    const reportFiles: string[] = [];

    for (const format of formats) {
      try {
        const reportPath = await generateReport(
          testResults,
          format,
          outputDir,
          options.title,
        );
        reportFiles.push(...reportPath);
        console.log(`✅ Generated ${format.toUpperCase()} report`);
        if (options.verbose) {
          reportPath.forEach((p) => console.log(`   ${p}`));
        }
      } catch (error) {
        console.error(`❌ Failed to generate ${format} report: ${error}`);
      }
    }

    console.log('');
    console.log(
      `Generated ${reportFiles.length} report file(s) in: ${options.output}`,
    );
    console.log('');

    process.exit(0);
  },
};
