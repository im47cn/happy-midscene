/**
 * CI Executor
 *
 * Main test execution engine for CI/CD integration.
 */

import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { getDebug } from '@midscene/shared/logger';
import { parseYamlScript, type ScriptPlayer } from '@midscene/core/yaml';
import type {
  CIConfig,
  CIExecutionResult,
  CIPlatform,
  TestCaseResult,
  TestStatus,
} from '../../types/ci';
import type {
  CIExecutorOptions,
  ICIExecutor,
  IShardManager,
  IParallelRunner,
} from '../ci/interfaces';

const debug = getDebug('ci:executor');

/**
 * Test execution time tracker for sharding
 */
interface TestExecutionTime {
  file: string;
  averageTime: number;
}

/**
 * CI Executor implementation
 */
export class CIExecutor implements ICIExecutor {
  private readonly cwd: string;
  private readonly env: Record<string, string>;
  private readonly verbose: boolean;
  private shardManager: IShardManager;
  private parallelRunner: IParallelRunner;
  private executionTimes: Map<string, number> = new Map();
  private cancelled = false;
  private currentPlayers: ScriptPlayer<any>[] = [];

  constructor(
    shardManager: IShardManager,
    parallelRunner: IParallelRunner,
    options?: CIExecutorOptions,
  ) {
    this.cwd = options?.cwd || process.cwd();
    this.env = options?.env || {};
    this.verbose = options?.verbose || false;
    this.shardManager = shardManager;
    this.parallelRunner = parallelRunner;
  }

  async initialize(): Promise<void> {
    debug('Initializing CI executor');
    // Load execution time history if available
    await this.loadExecutionHistory();
  }

  async execute(
    config: CIConfig,
    options?: {
      shard?: { index: number; total: number };
      workers?: number;
    },
  ): Promise<CIExecutionResult> {
    const executionId = randomUUID();
    const startTime = Date.now();

    debug(`Starting execution ${executionId}`);

    // Discover test files
    const testFiles = await this.discoverTestFiles(config);
    debug(`Found ${testFiles.length} test files`);

    if (testFiles.length === 0) {
      return this.createEmptyResult(executionId, config, startTime);
    }

    // Apply sharding if configured
    let filesToRun = testFiles;
    if (options?.shard) {
      const shardIndex = options.shard.index - 1; // Convert to 0-based
      const shards = await this.shardManager.createShardPlan(
        testFiles,
        options.shard.total,
        config.sharding?.strategy || 'count-based',
      );
      filesToRun = shards[shardIndex] || [];
      debug(`Shard ${options.shard.index}/${options.shard.total}: ${filesToRun.length} files`);
    }

    // Execute tests
    const testCases: TestCaseResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of filesToRun) {
      if (this.cancelled) {
        debug('Execution cancelled');
        break;
      }

      const fileResult = await this.executeTestFile(file, config);
      testCases.push(...fileResult.cases);

      for (const tc of fileResult.cases) {
        if (tc.status === 'passed') passed++;
        else if (tc.status === 'failed') failed++;
        else if (tc.status === 'skipped') skipped++;
      }

      // Update execution time for this file
      if (fileResult.duration > 0) {
        this.executionTimes.set(file, fileResult.duration);
      }
    }

    const endTime = Date.now();
    const totalTests = testCases.length;
    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;
    const status: TestStatus = failed === 0 ? 'passed' : 'failed';

    const result: CIExecutionResult = {
      executionId,
      platform: this.detectPlatform(),
      status,
      suiteName: config.suiteName,
      totalTests,
      passed,
      failed,
      skipped,
      passRate,
      duration: endTime - startTime,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date(endTime).toISOString(),
      testCases,
      sharding: options?.shard
        ? {
            index: options.shard.index,
            total: options.shard.total,
          }
        : undefined,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    debug(`Execution ${executionId} completed: ${status}`);

    return result;
  }

  async cancel(): Promise<void> {
    debug('Cancelling execution');
    this.cancelled = true;

    // Stop all running players
    for (const player of this.currentPlayers) {
      if (player && typeof (player as any).stop === 'function') {
        try {
          await (player as any).stop();
        } catch (e) {
          debug(`Error stopping player: ${e}`);
        }
      }
    }

    this.currentPlayers = [];
  }

  async cleanup(): Promise<void> {
    debug('Cleaning up executor');
    await this.cancel();
    await this.saveExecutionHistory();
  }

  /**
   * Discover test files based on configuration
   */
  private async discoverTestFiles(config: CIConfig): Promise<string[]> {
    const patterns = config.include.map((p) => join(this.cwd, p));
    const excludePatterns = config.exclude?.map((p) => join(this.cwd, p)) || [];

    const files = await glob(patterns, {
      cwd: this.cwd,
      ignore: excludePatterns,
      absolute: true,
      nodir: true,
    });

    // Filter to YAML files
    return files.filter((f) =>
      /\.(ya?ml|yaml)$/i.test(f),
    );
  }

  /**
   * Execute a single test file
   */
  private async executeTestFile(
    file: string,
    config: CIConfig,
  ): Promise<{
    cases: TestCaseResult[];
    duration: number;
  }> {
    const startTime = Date.now();
    const cases: TestCaseResult[] = [];

    try {
      if (this.verbose) {
        debug(`Executing: ${file}`);
      }

      // Parse the YAML script
      const script = parseYamlScript(file);
      if (!script) {
        throw new Error(`Failed to parse script: ${file}`);
      }

      // Note: Actual test execution requires a player setup
      // This is a placeholder that will be enhanced with proper integration
      const taskCount = script.tasks?.length || 0;

      for (let i = 0; i < taskCount; i++) {
        const task = script.tasks![i];
        cases.push({
          id: `${file}#${i}`,
          name: task.name || `Task ${i + 1}`,
          file,
          status: 'passed', // Placeholder
          duration: 0,
        });
      }
    } catch (error) {
      // If file fails to parse or execute, mark as failed
      cases.push({
        id: `${file}#error`,
        name: 'File Execution',
        file,
        status: 'failed',
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      cases,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Detect the current CI platform
   */
  private detectPlatform(): CIPlatform {
    if (process.env.GITHUB_ACTIONS) return 'github';
    if (process.env.GITLAB_CI) return 'gitlab';
    if (process.env.JENKINS_URL) return 'jenkins';
    if (process.env.TF_BUILD) return 'azure';
    if (process.env.CIRCLECI) return 'circleci';
    return 'local';
  }

  /**
   * Create an empty result when no tests are found
   */
  private createEmptyResult(
    executionId: string,
    config: CIConfig,
    startTime: number,
  ): CIExecutionResult {
    return {
      executionId,
      platform: this.detectPlatform(),
      status: 'skipped',
      suiteName: config.suiteName,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 100,
      duration: Date.now() - startTime,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
      testCases: [],
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  /**
   * Load execution history for time-based sharding
   */
  private async loadExecutionHistory(): Promise<void> {
    // TODO: Load from cache file
    // This enables time-based sharding by remembering how long each test takes
  }

  /**
   * Save execution history for future sharding
   */
  private async saveExecutionHistory(): Promise<void> {
    // TODO: Save to cache file
  }
}

/**
 * Create CI Executor with default dependencies
 */
export function createCIExecutor(options?: CIExecutorOptions): CIExecutor {
  // Lazy import to avoid circular dependencies
  const { ShardManager } = require('./shardManager');
  const { ParallelRunner } = require('./parallelRunner');

  return new CIExecutor(
    new ShardManager(options),
    new ParallelRunner(options),
    options,
  );
}
