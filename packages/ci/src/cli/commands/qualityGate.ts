/**
 * Quality Gate Command
 *
 * Evaluates quality gates against test results.
 * Can block deployment based on configured rules.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QualityGateConfig, CIExecutionResult } from '../../types/ci';
import {
  evaluateQualityGate,
  formatQualityGateResult,
  getExitCode,
} from '../../services/ci/qualityGate';
import { loadJSONFile, loadYAMLFile } from '../config-loader';

export interface QualityGateCommandOptions {
  config?: string;
  results?: string;
  'pass-rate'?: number;
  'critical-tests'?: boolean;
  'max-new-failures'?: number;
  'max-flaky'?: number;
  verbose?: boolean;
}

export const qualityGateCommand = {
  command: 'quality-gate',
  describe: 'Evaluate quality gate against test results',
  builder: (yargs: any) =>
    yargs
      .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to config file with quality gate settings',
        group: 'Configuration',
      })
      .option('results', {
        alias: 'r',
        type: 'string',
        description: 'Path to test results JSON file',
        group: 'Configuration',
      })
      .option('pass-rate', {
        type: 'number',
        description: 'Minimum pass rate threshold (0-100)',
        group: 'Rules',
      })
      .option('critical-tests', {
        type: 'boolean',
        description: 'Whether critical tests must 100% pass',
        group: 'Rules',
      })
      .option('max-new-failures', {
        type: 'number',
        description: 'Maximum allowed new failures',
        group: 'Rules',
      })
      .option('max-flaky', {
        type: 'number',
        description: 'Maximum allowed flaky tests',
        group: 'Rules',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Verbose output',
        group: 'Configuration',
      }),
  handler: async (options: QualityGateCommandOptions) => {
    console.log('\n🚦 Midscene CI Quality Gate');
    console.log('='.repeat(40));

    let qualityGateConfig: QualityGateConfig;
    let testResults: CIExecutionResult | null = null;

    // Load configuration
    if (options.config) {
      const configPath = join(process.cwd(), options.config);
      const ext = configPath.split('.').pop();

      try {
        if (ext === 'json') {
          const config = loadJSONFile(configPath) as Record<string, unknown>;
          qualityGateConfig = (config.qualityGate as QualityGateConfig) || {};
        } else {
          const config = loadYAMLFile(configPath) as Record<string, unknown>;
          qualityGateConfig = (config.qualityGate as QualityGateConfig) || {};
        }
        console.log(`Config loaded from: ${options.config}`);
      } catch (error) {
        console.error(`Failed to load config: ${error}`);
        process.exit(1);
      }
    } else {
      // Use CLI options or defaults
      qualityGateConfig = {
        enabled: true,
        passRateThreshold: options['pass-rate'] ?? 95,
        criticalTestsMustPass: options['critical-tests'] ?? true,
        maxNewFailures: options['max-new-failures'] ?? 0,
        maxFlakyTests: options['max-flaky'] ?? 5,
      };
    }

    // Load test results if provided
    if (options.results) {
      const resultsPath = join(process.cwd(), options.results);
      try {
        const resultsData = readFileSync(resultsPath, 'utf-8');
        testResults = JSON.parse(resultsData) as CIExecutionResult;
        console.log(`Results loaded from: ${options.results}`);
      } catch (error) {
        console.error(`Failed to load results: ${error}`);
        process.exit(1);
      }
    }

    // Display configuration
    console.log('');
    console.log('Quality Gate Configuration:');
    console.log(`  Pass Rate Threshold: ${qualityGateConfig.passRateThreshold}%`);
    console.log(
      `  Critical Tests Must Pass: ${qualityGateConfig.criticalTestsMustPass}`,
    );
    console.log(`  Max New Failures: ${qualityGateConfig.maxNewFailures}`);
    console.log(`  Max Flaky Tests: ${qualityGateConfig.maxFlakyTests}`);
    console.log('');

    if (testResults && options.verbose) {
      console.log('Test Results Summary:');
      console.log(`  Total: ${testResults.totalTests}`);
      console.log(`  Passed: ${testResults.passed}`);
      console.log(`  Failed: ${testResults.failed}`);
      console.log(`  Skipped: ${testResults.skipped}`);
      console.log(`  Flaky: ${testResults.flaky}`);
      console.log(`  Pass Rate: ${testResults.passRate.toFixed(1)}%`);
      console.log('');
    }

    // Evaluate quality gate
    const result = await evaluateQualityGate(testResults, qualityGateConfig);

    // Display formatted result
    console.log(formatQualityGateResult(result));
    console.log('');

    if (result.passed) {
      console.log('✅ Quality Gate: PASSED');
      process.exit(0);
    } else {
      console.log('❌ Quality Gate: FAILED');
      console.log('');
      console.log('Deployment blocked by quality gate.');
      console.log('Fix the failing rules or update the configuration.');
      process.exit(1);
    }
  },
};
