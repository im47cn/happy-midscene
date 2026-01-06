/**
 * GitHub Action for Midscene CI
 *
 * Runs tests with sharding, parallel execution, and quality gates.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  exportVariable,
  getInput,
  getOutput,
  setFailed,
  setOutput,
} from '@actions/core';
import { core, exec } from '@actions/exec';
import { context, getOctokit } from '@actions/github';
import {
  CIExecutor,
  createArtifactManager,
  evaluateQualityGate,
  generateReports,
} from '../services/ci';

interface ActionInputs {
  testPattern: string;
  shardStrategy: 'time-based' | 'count-based' | 'hash-based';
  shardCount: number;
  parallel: number;
  reportFormats: string[];
  qualityGate: boolean;
  passRateThreshold: number;
  criticalTests: string[];
  uploadArtifacts: boolean;
  artifactPaths: string[];
  prComment: boolean;
  failOnFailure: boolean;
}

async function parseInputs(): Promise<ActionInputs> {
  return {
    testPattern:
      getInput('test-pattern', { required: false }) || '**/*.test.ts',
    shardStrategy: (getInput('shard-strategy') ||
      'time-based') as ActionInputs['shardStrategy'],
    shardCount: Number.parseInt(getInput('shard-count') || '2', 10),
    parallel: Number.parseInt(getInput('parallel') || '4', 10),
    reportFormats: (getInput('report-formats') || 'junit,json')
      .split(',')
      .map((s) => s.trim()),
    qualityGate: getInput('quality-gate') !== 'false',
    passRateThreshold: Number.parseFloat(
      getInput('pass-rate-threshold') || '80',
    ),
    criticalTests: (getInput('critical-tests') || '')
      .split(',')
      .filter((s) => s.length > 0),
    uploadArtifacts: getInput('upload-artifacts') !== 'false',
    artifactPaths: (
      getInput('artifact-paths') || 'test-results,screenshots,videos'
    ).split(','),
    prComment: getInput('pr-comment') !== 'false',
    failOnFailure: getInput('fail-on-failure') !== 'false',
  };
}

async function runAction(): Promise<void> {
  try {
    const inputs = await parseInputs();

    // Create output directory
    const outputDir = join(process.cwd(), 'midscene-results');
    mkdirSync(outputDir, { recursive: true });

    // Run tests
    core.startGroup('Running Midscene Tests');

    const executor = new CIExecutor({
      testPattern: inputs.testPattern,
      shardStrategy: inputs.shardStrategy,
      shardCount: inputs.shardCount,
      parallelism: inputs.parallel,
      outputDir,
    });

    const result = await executor.execute();

    core.endGroup();

    // Set outputs
    setOutput('exit-code', result.status === 'passed' ? '0' : '1');
    setOutput('pass-rate', result.passRate.toString());
    setOutput('total-tests', result.totalTests.toString());
    setOutput('passed-tests', result.passed.toString());
    setOutput('failed-tests', result.failed.toString());

    // Generate reports
    core.startGroup('Generating Reports');

    const reportResult = generateReports(result, {
      outputDir,
      formats: inputs.reportFormats as any[],
      title: 'Midscene Test Report',
    });

    core.endGroup();

    setOutput('report-path', outputDir);
    core.info(`Generated ${reportResult.totalFiles} report files`);

    // Quality gate evaluation
    let gatePassed = true;

    if (inputs.qualityGate) {
      core.startGroup('Evaluating Quality Gate');

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
        core.info(
          `${status} ${ruleResult.ruleName}: ${ruleResult.actual} (expected: ${ruleResult.expected})`,
        );
      }

      if (!gatePassed) {
        core.error('Quality gate failed!');
      }

      core.endGroup();
    }

    // Upload artifacts
    if (inputs.uploadArtifacts) {
      core.startGroup('Collecting Artifacts');

      const artifactManager = createArtifactManager({
        enabled: true,
        namePattern: 'midscene-artifacts-{timestamp}',
        includePaths: inputs.artifactPaths,
        excludePaths: ['node_modules', '.git'],
        retentionDays: 30,
      });

      const collection = await artifactManager.collect(process.cwd());
      await artifactManager.saveManifest(collection, outputDir);

      core.info(`Collected ${collection.files.length} artifact files`);
      core.endGroup();
    }

    // PR comment
    if (inputs.prComment && context.eventName === 'pull_request') {
      await postPRComment(result, gatePassed);
    }

    // Fail if needed
    if (!gatePassed && inputs.failOnFailure) {
      setFailed('Tests failed quality gate');
    } else if (result.status === 'failed' && inputs.failOnFailure) {
      setFailed('Tests failed');
    } else {
      core.info('✅ Action completed successfully');
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

async function postPRComment(result: any, gatePassed: boolean): Promise<void> {
  try {
    const token = getInput('github-token', { required: false });
    if (!token) {
      core.warning('No github-token provided, skipping PR comment');
      return;
    }

    const octokit = getOctokit(token);
    const { repo, owner, number: prNumber } = context.issue;

    const comment = generatePRComment(result, gatePassed);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment,
    });

    core.info('Posted test results as PR comment');
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error}`);
  }
}

function generatePRComment(result: any, gatePassed: boolean): string {
  const status = gatePassed ? '✅' : '❌';
  const color = gatePassed ? '28a745' : 'dc3545';

  return `
## ${status} Midscene Test Results

| Metric | Value |
|--------|-------|
| **Total Tests** | ${result.totalTests} |
| **Passed** | ✅ ${result.passed} |
| **Failed** | ❌ ${result.failed} |
| **Skipped** | ⏭️ ${result.skipped} |
| **Pass Rate** | ${result.passRate.toFixed(1)}% |
| **Duration** | ${(result.duration / 1000).toFixed(2)}s |

**Quality Gate**: ${gatePassed ? '✅ Passed' : '❌ Failed'}

<details>
<summary>View Failed Tests</summary>

${
  result.tests
    ?.filter((t: any) => t.status === 'failed')
    .map((t: any) => `- ❌ ${t.name}: ${t.error || 'Unknown error'}`)
    .join('\n') || 'No failed tests'
}

</details>

*Generated by [Midscene CI](https://github.com/midscenejs/midscene)*
`.trim();
}

// Run the action
runAction().catch((error) => {
  core.setFailed(`Unhandled error: ${error}`);
});
