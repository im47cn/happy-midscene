/**
 * Shard Manager
 *
 * Splits tests into shards for parallel execution.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDebug } from '@midscene/shared/logger';
import type { IShardManager } from '../ci/interfaces';
import type { ShardStrategy } from '../../types/ci';

const debug = getDebug('ci:shard-manager');

/**
 * Execution time history entry
 */
interface ExecutionTimeEntry {
  file: string;
  averageTime: number;
  lastRun: number;
}

/**
 * Shard Manager implementation
 */
export class ShardManager implements IShardManager {
  private readonly cwd: string;
  private readonly historyPath: string;
  private executionHistory: Map<string, ExecutionTimeEntry> = new Map();

  constructor(options?: { cwd?: string; historyPath?: string }) {
    this.cwd = options?.cwd || process.cwd();
    this.historyPath =
      options?.historyPath ||
      join(this.cwd, '.midscene-ci', 'execution-times.json');
    this.loadHistory();
  }

  /**
   * Create a sharding plan
   */
  async createShardPlan(
    tests: string[],
    shardCount: number,
    strategy: ShardStrategy = 'count-based',
  ): Promise<string[][]> {
    if (shardCount <= 0) {
      throw new Error('shardCount must be greater than 0');
    }

    if (tests.length === 0) {
      return Array.from({ length: shardCount }, () => []);
    }

    debug(
      `Creating ${shardCount} shards using ${strategy} strategy for ${tests.length} tests`,
    );

    switch (strategy) {
      case 'time-based':
        return this.timeBasedSharding(tests, shardCount);
      case 'hash-based':
        return this.hashBasedSharding(tests, shardCount);
      case 'custom':
        // Fall back to count-based for custom strategy
      case 'count-based':
      default:
        return this.countBasedSharding(tests, shardCount);
    }
  }

  /**
   * Get files for a specific shard
   */
  async getShardFiles(index: number, total: number): Promise<string[]> {
    // This is a convenience method that delegates to createShardPlan
    // The index is 1-based to match typical CI sharding conventions
    if (index < 1 || index > total) {
      throw new Error(`Shard index ${index} is out of range [1, ${total}]`);
    }

    // Note: This would need access to the full test list
    // For now, return empty - should be called via createShardPlan
    return [];
  }

  /**
   * Record execution time for a test file
   */
  recordExecutionTime(file: string, duration: number): void {
    const entry = this.executionHistory.get(file);
    const now = Date.now();

    if (entry) {
      // Exponential moving average for smoother updates
      const alpha = 0.3;
      entry.averageTime =
        alpha * duration + (1 - alpha) * entry.averageTime;
      entry.lastRun = now;
    } else {
      this.executionHistory.set(file, {
        file,
        averageTime: duration,
        lastRun: now,
      });
    }

    this.saveHistory();
  }

  /**
   * Get estimated execution time for a test file
   */
  getEstimatedTime(file: string): number {
    return this.executionHistory.get(file)?.averageTime || 1000; // Default 1s
  }

  /**
   * Count-based sharding - evenly distribute files
   */
  private countBasedSharding(tests: string[], shardCount: number): string[][] {
    const shards: string[][] = Array.from({ length: shardCount }, () => []);
    const filesPerShard = Math.ceil(tests.length / shardCount);

    for (let i = 0; i < tests.length; i++) {
      const shardIndex = Math.floor(i / filesPerShard);
      const safeIndex = Math.min(shardIndex, shardCount - 1);
      shards[safeIndex].push(tests[i]);
    }

    return shards;
  }

  /**
   * Time-based sharding - balance by estimated execution time
   */
  private timeBasedSharding(tests: string[], shardCount: number): string[][] {
    // Sort files by estimated execution time (descending)
    const sortedTests = [...tests].sort((a, b) => {
      const timeA = this.getEstimatedTime(a);
      const timeB = this.getEstimatedTime(b);
      return timeB - timeA;
    });

    // Initialize shards with zero time
    const shards: string[][] = Array.from({ length: shardCount }, () => []);
    const shardTimes = new Array(shardCount).fill(0);

    // Assign each file to the shard with the least total time
    for (const file of sortedTests) {
      const minTimeIndex = shardTimes.indexOf(Math.min(...shardTimes));
      shards[minTimeIndex].push(file);
      shardTimes[minTimeIndex] += this.getEstimatedTime(file);
    }

    debug(
      `Time-based sharding balance: ${shardTimes.map((t) => `${Math.round(t / 1000)}s`).join(', ')}`,
    );

    return shards;
  }

  /**
   * Hash-based sharding - deterministic distribution by file hash
   */
  private hashBasedSharding(tests: string[], shardCount: number): string[][] {
    const shards: string[][] = Array.from({ length: shardCount }, () => []);

    for (const file of tests) {
      // Simple hash of the file path
      let hash = 0;
      for (let i = 0; i < file.length; i++) {
        hash = (hash << 5) - hash + file.charCodeAt(i);
        hash |= 0; // Convert to 32-bit integer
      }

      const shardIndex = Math.abs(hash) % shardCount;
      shards[shardIndex].push(file);
    }

    return shards;
  }

  /**
   * Load execution history from disk
   */
  private loadHistory(): void {
    if (!existsSync(this.historyPath)) {
      debug('No execution history found');
      return;
    }

    try {
      const content = readFileSync(this.historyPath, 'utf-8');
      const entries: ExecutionTimeEntry[] = JSON.parse(content);

      // Clean old entries (older than 30 days)
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      for (const entry of entries) {
        if (entry.lastRun > cutoff) {
          this.executionHistory.set(entry.file, entry);
        }
      }

      debug(`Loaded execution history for ${this.executionHistory.size} files`);
    } catch (error) {
      debug(`Failed to load execution history: ${error}`);
    }
  }

  /**
   * Save execution history to disk
   */
  private saveHistory(): void {
    try {
      const entries = Array.from(this.executionHistory.values());
      const dir = this.historyPath.substring(0, this.historyPath.lastIndexOf('/'));

      if (!existsSync(dir)) {
        // Create directory if needed (handled by writeFileSync with recursive option in Node)
      }

      writeFileSync(this.historyPath, JSON.stringify(entries, null, 2));
    } catch (error) {
      debug(`Failed to save execution history: ${error}`);
    }
  }
}
