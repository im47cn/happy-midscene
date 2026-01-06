/**
 * Azure DevOps Task for Midscene CI
 *
 * Run tests with sharding, parallel execution, and quality gates in Azure Pipelines.
 */

import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  CIExecutor,
  generateReports,
  evaluateQualityGate,
  createArtifactManager,
} from '../../services/ci';

interface TaskInputs {
  testPattern: string;
  shardStrategy: 'time-based' | 'count-based' | 'hash-based';
  shardCount: number;
  parallelWorkers: number;
  reportFormats: string[];
  outputDir: string;
  enableQualityGate: boolean;
  passRateThreshold: number;
  criticalTests: string[];
  uploadArtifacts: boolean;
  artifactPaths: string[];
  failOnFailure: boolean;
  packageManager: 'npm' | 'bun' | 'yarn' | 'pnpm';
}

async function runTask(): Promise<void> {
  try {
    // Parse inputs
    const inputs: TaskInputs = {
      testPattern: tl.getInput('testPattern', false) || '**/*.test.ts',
      shardStrategy: (tl.getInput('shardStrategy', false) || 'time-based') as TaskInputs['shardStrategy'],
      shardCount: parseInt(tl.getInput('shardCount', false) || '2', 10),
      parallelWorkers: parseInt(tl.getInput('parallelWorkers', false) || '4', 10),
      reportFormats: tl.getDelimitedInput('reportFormats', ',', false) || ['junit', 'json'],
      outputDir: tl.getInput('outputDir', false) || 'test-results',
      enableQualityGate: tl.getBoolInput('enableQualityGate', false),
      passRateThreshold: parseFloat(tl.getInput('passRateThreshold', false) || '80'),
      criticalTests: (tl.getInput('criticalTests', false) || '')
        .split(',')
        .filter((s) => s.length > 0),
      uploadArtifacts: tl.getBoolInput('uploadArtifacts', false),
      artifactPaths: (tl.getInput('artifactPaths', false) || 'test-results,screenshots,videos').split(','),
      failOnFailure: tl.getBoolInput('failOnFailure', false),
      packageManager: (tl.getInput('packageManager', false) || 'bun') as TaskInputs['packageManager'],
    };

    // Create output directory
    const resolvedOutputDir = path.join(process.cwd(), inputs.outputDir);
    mkdirSync(resolvedOutputDir, { recursive: true });

    tl.setResult(tl.TaskResult.Succeeded, 'Starting Midscene tests...');

    // Run tests
    tl.startGroup('Running Midscene Tests');

    const executor = new CIExecutor({
      testPattern: inputs.testPattern,
      shardStrategy: inputs.shardStrategy,
      shardCount: inputs.shardCount,
      parallelism: inputs.parallelWorkers,
      outputDir: resolvedOutputDir,
    });

    const result = await executor.execute();

    tl.endGroup();

    // Set output variables
    tl.setVariable('exitCode', result.status === 'passed' ? '0' : '1');
    tl.setVariable('passRate', result.passRate.toString());
    tl.setVariable('totalTests', result.totalTests.toString());
    tl.setVariable('passedTests', result.passed.toString());
    tl.setVariable('failedTests', result.failed.toString());
    tl.setVariable('reportPath', resolvedOutputDir);

    tl.logInfo(`
      Test Results:
      - Total: ${result.totalTests}
      - Passed: ${result.passed}
      - Failed: ${result.failed}
      - Skipped: ${result.skipped}
      - Pass Rate: ${result.passRate.toFixed(1)}%
      - Duration: ${(result.duration / 1000).toFixed(2)}s
    `);

    // Generate reports
    tl.startGroup('Generating Reports');

    const reportResult = generateReports(result, {
      outputDir: resolvedOutputDir,
      formats: inputs.reportFormats as any[],
      title: 'Midscene Test Report',
    });

    tl.endGroup();

    tl.logInfo(`Generated ${reportResult.totalFiles} report files`);

    // Publish test results
    if (inputs.reportFormats.includes('junit')) {
      tl.command('results.publish', {
        type: 'JUnit',
        mergeResults: true,
        failTaskOnFailedTests: false,
        testRunTitle: 'Midscene Tests',
        testResultsFiles: path.join(resolvedOutputDir, 'junit-*.xml'),
      }, undefined);
    }

    // Publish HTML report
    if (inputs.reportFormats.includes('html')) {
      const htmlFile = path.join(resolvedOutputDir, 'report-*.html');
      tl.command('codecoverage.publish', {
        codecovutile: 'Html',
        summaryfile: htmlFile,
        reportdirectory: resolvedOutputDir,
      }, undefined);
    }

    // Quality gate evaluation
    let gatePassed = true;

    if (inputs.enableQualityGate) {
      tl.startGroup('Evaluating Quality Gate');

      const gateResult = await evaluateQualityGate(result, {
        rules: [
          {
            id: 'pass-rate',
            type: 'pass-rate',
            threshold: inputs.passRateThreshold,
            blocking: true,
          },
          ...inputs.criticalTests.map((pattern) => ({
            id: `critical-${pattern}`,
            type: 'critical-tests',
            pattern,
            blocking: true,
          })),
        ],
      });

      gatePassed = gateResult.passed;

      // Output rule results
      for (const ruleResult of gateResult.ruleResults) {
        const status = ruleResult.passed ? '✅' : '❌';
        tl.logInfo(`${status} ${ruleResult.ruleName}: ${ruleResult.actual} (expected: ${ruleResult.expected})`);
      }

      if (!gatePassed) {
        const failedRules = gateResult.ruleResults
          .filter((r) => !r.passed)
          .map((r) => r.ruleName)
          .join(', ');

        tl.warning(`Quality gate failed: ${failedRules}`);
      }

      tl.endGroup();
    }

    // Upload artifacts
    if (inputs.uploadArtifacts) {
      tl.startGroup('Uploading Artifacts');

      const artifactManager = createArtifactManager({
        enabled: true,
        namePattern: 'midscene-artifacts-{timestamp}',
        includePaths: inputs.artifactPaths,
        excludePaths: ['node_modules', '.git'],
        retentionDays: 30,
      });

      const collection = await artifactManager.collect(process.cwd());
      await artifactManager.saveManifest(collection, resolvedOutputDir);

      tl.logInfo(`Collected ${collection.files.length} artifact files`);

      // Attach artifacts
      for (const artifactPath of inputs.artifactPaths) {
        tl.command('artifact.upload', {
          artifactname: path.basename(artifactPath),
          containerfolder: inputs.outputDir,
          localpath: artifactPath,
        }, undefined);
      }

      tl.endGroup();
    }

    // Publish build tag
    if (gatePassed) {
      tl.command('build.addtag', ['midscene-passed'], undefined);
    } else {
      tl.command('build.addtag', ['midscene-failed'], undefined);
    }

    // Set task result
    if (!gatePassed && inputs.failOnFailure) {
      tl.setResult(tl.TaskResult.Failed, 'Quality gate failed');
    } else if (result.status === 'failed' && inputs.failOnFailure) {
      tl.setResult(tl.TaskResult.Failed, 'Tests failed');
    } else {
      tl.setResult(tl.TaskResult.Succeeded, 'Tests completed successfully');
    }
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, `Task failed: ${error}`);
  }
}

// Run the task
runTask().catch((error) => {
  tl.setResult(tl.TaskResult.Failed, `Unhandled error: ${error}`);
});
