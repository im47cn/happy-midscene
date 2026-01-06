/**
 * Quality Gate Evaluator CLI
 *
 * CLI integration for quality gate evaluation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CIExecutionResult,
  QualityGateConfig,
  QualityGateResult,
} from '../types/ci';
import { evaluateQualityGate, formatQualityGateResult, getExitCode } from '../services/ci/qualityGate';

/**
 * Evaluate quality gate from CLI
 */
export async function evaluateQualityGateFromCLI(options: {
  resultsPath: string;
  configPath?: string;
  config?: QualityGateConfig;
}): Promise<QualityGateResult> {
  // Load test results
  const resultsPath = join(process.cwd(), options.resultsPath);
  let results: CIExecutionResult | null = null;

  try {
    const resultsData = readFileSync(resultsPath, 'utf-8');
    results = JSON.parse(resultsData) as CIExecutionResult;
  } catch (error) {
    console.error(`❌ Failed to load results from ${options.resultsPath}: ${error}`);
    process.exit(1);
  }

  // Load or use provided config
  let config: QualityGateConfig;

  if (options.config) {
    config = options.config;
  } else if (options.configPath) {
    config = await loadConfig(options.configPath);
  } else {
    // Use default config
    config = {
      enabled: true,
      passRateThreshold: 80,
      criticalTestsMustPass: false,
      maxNewFailures: 10,
      maxFlakyTests: 5,
    };
  }

  // Evaluate quality gate
  const result = await evaluateQualityGate(results, config);

  return result;
}

/**
 * Load quality gate config from file
 */
async function loadConfig(configPath: string): Promise<QualityGateConfig> {
  const fullPath = join(process.cwd(), configPath);
  const ext = configPath.split('.').pop();

  try {
    const content = readFileSync(fullPath, 'utf-8');

    if (ext === 'json') {
      const config = JSON.parse(content) as Record<string, unknown>;
      return (config.qualityGate as QualityGateConfig) || {};
    }

    if (ext === 'yml' || ext === 'yaml') {
      const { loadYAMLFile } = await import('./config-loader');
      const config = loadYAMLFile(fullPath) as Record<string, unknown>;
      return (config.qualityGate as QualityGateConfig) || {};
    }

    throw new Error(`Unsupported config format: ${ext}`);
  } catch (error) {
    console.error(`❌ Failed to load config from ${configPath}: ${error}`);
    process.exit(1);
  }
}

/**
 * Display quality gate result and exit with appropriate code
 */
export function displayQualityGateResult(result: QualityGateResult): void {
  console.log('');
  console.log(formatQualityGateResult(result));
  console.log('');

  const exitCode = getExitCode(result);
  if (exitCode !== 0) {
    console.log('Quality gate failed. Exiting with error code 1.');
  }

  process.exit(exitCode);
}
