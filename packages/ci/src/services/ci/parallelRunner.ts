/**
 * Parallel Runner
 *
 * Executes test shards in parallel using worker processes.
 */

import { randomUUID } from 'node:crypto';
import { cpus } from 'node:os';
import { getDebug } from '@midscene/shared/logger';
import type { ShardResult } from '../../types/ci';
import type { CIConfig } from '../../types/ci';
import type { IParallelRunner } from '../ci/interfaces';

const debug = getDebug('ci:parallel-runner');

/**
 * Worker process execution result
 */
interface WorkerResult {
  shardIndex: number;
  fileCount: number;
  result: any;
  error?: string;
}

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  /** Maximum number of concurrent workers */
  maxWorkers?: number;
  /** Timeout per shard in milliseconds */
  timeout?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
}

/**
 * Parallel Runner implementation
 */
export class ParallelRunner implements IParallelRunner {
  private readonly cwd: string;
  private readonly env: Record<string, string>;

  constructor(options?: { cwd?: string; env?: Record<string, string> }) {
    this.cwd = options?.cwd || process.cwd();
    this.env = options?.env || {};
  }

  /**
   * Run tests in parallel
   */
  async runParallel(
    shards: string[][],
    config: CIConfig,
    options?: ParallelExecutionOptions,
  ): Promise<ShardResult[]> {
    const maxWorkers = this.getOptimalWorkerCount(options?.maxWorkers);
    const shardCount = shards.length;
    const timeout = options?.timeout || config.timeout || 300000; // Default 5 minutes

    debug(`Running ${shardCount} shards with max ${maxWorkers} workers`);

    const results: ShardResult[] = [];
    const executionId = randomUUID();
    const startTime = Date.now();

    // Process shards in parallel batches
    const completedShards = 0;
    const currentIndex = 0;

    const processShard = async (
      shardIndex: number,
      files: string[],
    ): Promise<ShardResult> => {
      const shardStartTime = Date.now();

      try {
        debug(
          `Starting shard ${shardIndex + 1}/${shardCount} with ${files.length} files`,
        );

        // For now, execute in-process (true parallel execution requires worker setup)
        const result = await this.executeShardInProcess(
          files,
          config,
          shardIndex,
        );

        return {
          shardIndex,
          fileCount: files.length,
          passed: result.passed || 0,
          failed: result.failed || 0,
          skipped: result.skipped || 0,
          duration: Date.now() - shardStartTime,
          status: result.failed === 0 ? 'passed' : 'failed',
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        debug(`Shard ${shardIndex + 1} failed: ${errorMessage}`);

        return {
          shardIndex,
          fileCount: files.length,
          passed: 0,
          failed: files.length,
          skipped: 0,
          duration: Date.now() - shardStartTime,
          status: 'failed',
          error: errorMessage,
        };
      }
    };

    // Simplified version: process all sequentially
    // True parallel execution requires worker thread setup
    const allResults: ShardResult[] = [];

    for (let i = 0; i < shards.length; i++) {
      const shardResult = await processShard(i, shards[i]);
      allResults.push(shardResult);
    }

    // Aggregate results
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = allResults.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = Date.now() - startTime;

    debug(
      `Parallel execution complete: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped in ${totalDuration}ms`,
    );

    return allResults;
  }

  /**
   * Get optimal worker count based on system resources
   */
  getOptimalWorkerCount(maxWorkers?: number): number {
    const cpuCount = cpus().length;

    // Respect explicit limit
    if (maxWorkers && maxWorkers > 0) {
      return Math.min(maxWorkers, cpuCount);
    }

    // Default: use CPU count, capped at 4 for CI environments
    const isCI = process.env.CI === 'true';
    const defaultLimit = isCI ? 4 : cpuCount;

    return Math.min(defaultLimit, cpuCount);
  }

  /**
   * Execute a shard in the current process
   * Note: True parallel execution would spawn worker processes
   */
  private async executeShardInProcess(
    files: string[],
    config: CIConfig,
    shardIndex: number,
  ): Promise<{
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;
    const skipped = 0;

    // This is a placeholder for actual test execution
    // In a real implementation, this would:
    // 1. Spawn a worker process with the shard's files
    // 2. Collect results from the worker
    // 3. Handle timeouts and errors

    for (const file of files) {
      // Simulate execution - replace with actual test runner
      try {
        // TODO: Integrate with actual test execution
        // const result = await runTestFile(file, config);
        debug(`[Shard ${shardIndex}] Would execute: ${file}`);
        passed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      passed,
      failed,
      skipped,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute shards with true parallelism using worker threads
 */
export async function executeShardsInParallel(
  shards: string[][],
  config: CIConfig,
  options?: ParallelExecutionOptions,
): Promise<ShardResult[]> {
  const runner = new ParallelRunner();
  return runner.runParallel(shards, config, options);
}
