/**
 * Test Command
 *
 * Runs tests in CI/CD environment with support for:
 * - Test suite selection
 * - Shard execution
 * - Parallel execution
 * - Multiple report formats
 * - Environment configuration
 */

import type { TestExecutionOptions } from '../../services/ci/interfaces';
import { runTests } from '../test-runner';

export interface TestCommandOptions {
  suite?: string;
  shard?: number;
  totalShards?: number;
  parallel?: number;
  report?: string;
  env?: string;
  config?: string;
  timeout?: number;
  verbose?: boolean;
  'retry-max'?: number;
  'retry-delay'?: number;
  'retry-only-failed'?: boolean;
}

export const testCommand = {
  command: 'test',
  describe: 'Run tests in CI/CD environment',
  builder: (yargs: any) =>
    yargs
      .option('suite', {
        alias: 's',
        type: 'string',
        description: 'Test suite name to run',
        group: 'Test Selection',
      })
      .option('shard', {
        type: 'number',
        description: 'Current shard index (1-based)',
        group: 'Parallel Execution',
      })
      .option('total-shards', {
        type: 'number',
        description: 'Total number of shards',
        group: 'Parallel Execution',
      })
      .option('parallel', {
        alias: 'p',
        type: 'number',
        description: 'Number of parallel workers',
        group: 'Parallel Execution',
      })
      .option('report', {
        alias: 'r',
        type: 'string',
        description: 'Report formats (comma-separated): junit, json, html, markdown',
        group: 'Reporting',
      })
      .option('env', {
        alias: 'e',
        type: 'string',
        description: 'Environment name (staging, production, etc.)',
        group: 'Environment',
      })
      .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to config file',
        group: 'Configuration',
      })
      .option('timeout', {
        alias: 't',
        type: 'number',
        description: 'Test timeout in milliseconds',
        group: 'Configuration',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Verbose output',
        group: 'Configuration',
      })
      .option('retry-max', {
        type: 'number',
        description: 'Maximum retry attempts',
        group: 'Retry',
      })
      .option('retry-delay', {
        type: 'number',
        description: 'Delay between retries in seconds',
        group: 'Retry',
      })
      .option('retry-only-failed', {
        type: 'boolean',
        description: 'Only retry failed tests',
        group: 'Retry',
      })
      .check((argv: any) => {
        // Validate shard options
        if (argv.shard && !argv.totalShards) {
          throw new Error('--total-shards is required when using --shard');
        }
        if (argv.totalShards && !argv.shard) {
          throw new Error('--shard is required when using --total-shards');
        }
        if (argv.shard && (argv.shard < 1 || argv.shard > argv.totalShards)) {
          throw new Error('--shard must be between 1 and --total-shards');
        }
        return true;
      }),
  handler: async (options: TestCommandOptions) => {
    const executionOptions: TestExecutionOptions = {};

    // Parse shard configuration
    if (options.shard && options.totalShards) {
      executionOptions.shard = {
        index: options.shard,
        total: options.totalShards,
      };
      console.log(`Running shard ${options.shard} of ${options.totalShards}`);
    }

    // Parse parallel configuration
    if (options.parallel) {
      executionOptions.workers = options.parallel;
      console.log(`Parallel workers: ${options.parallel}`);
    }

    // Parse timeout
    if (options.timeout) {
      executionOptions.timeout = options.timeout;
    }

    // Parse report formats
    const reportFormats: ('junit' | 'json' | 'html' | 'markdown')[] = options.report
      ? (options.report.split(',').map((s) => s.trim()) as ('junit' | 'json' | 'html' | 'markdown')[])
      : ['json'];

    console.log('\n🧪 Midscene CI Test Runner');
    console.log('='.repeat(40));

    if (options.suite) {
      console.log(`Suite: ${options.suite}`);
    }
    if (options.env) {
      console.log(`Environment: ${options.env}`);
    }
    console.log(`Report formats: ${reportFormats.join(', ')}`);
    console.log('');

    const startTime = Date.now();

    try {
      const result = await runTests({
        suite: options.suite,
        env: options.env,
        config: options.config,
        executionOptions,
        reportFormats,
        retryConfig: options['retry-max']
          ? {
              enabled: true,
              maxAttempts: options['retry-max'],
              delaySeconds: options['retry-delay'] || 30,
              onlyFailed: options['retry-only-failed'] ?? true,
              strategy: 'fixed',
            }
          : undefined,
        verbose: options.verbose ?? false,
      });

      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(2);

      console.log('');
      console.log('='.repeat(40));
      console.log('Test Results:');
      console.log(`  Total:   ${result.totalTests}`);
      console.log(`  Passed:  ${result.passed}`);
      console.log(`  Failed:  ${result.failed}`);
      console.log(`  Skipped: ${result.skipped}`);
      console.log(`  Flaky:   ${result.flaky}`);
      console.log(`  Pass Rate: ${result.passRate.toFixed(1)}%`);
      console.log(`  Duration: ${durationSec}s`);
      console.log('');

      // Handle quality gate result
      if (result.qualityGateResult) {
        if (result.qualityGateResult.passed) {
          console.log('✅ Quality Gate: PASSED');
        } else {
          console.log('❌ Quality Gate: FAILED');
          result.qualityGateResult.rules
            .filter((r) => !r.passed)
            .forEach((rule) => {
              console.log(`   - ${rule.ruleName}: ${rule.error || 'Failed'}`);
            });
          console.log('');
          process.exit(1);
        }
      }

      // Exit with error code if tests failed
      if (result.status === 'failed') {
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ Error after ${duration}s:`, error);
      process.exit(1);
    }
  },
};
