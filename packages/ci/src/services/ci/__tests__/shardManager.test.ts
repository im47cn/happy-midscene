/**
 * Shard Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShardManager } from '../shardManager';
import type { ShardStrategy } from '../../types/ci';

describe('ShardManager', () => {
  const mockTests = [
    'test1.spec.ts',
    'test2.spec.ts',
    'test3.spec.ts',
    'test4.spec.ts',
    'test5.spec.ts',
    'test6.spec.ts',
    'test7.spec.ts',
    'test8.spec.ts',
    'test9.spec.ts',
    'test10.spec.ts',
  ];

  describe('createShardPlan', () => {
    it('should create equal shards with count-based strategy', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan(mockTests, 4, 'count-based');

      expect(plan).toHaveLength(4);

      // Check that all tests are distributed
      const totalTests = plan.reduce((sum, shard) => sum + shard.length, 0);
      expect(totalTests).toBe(10);
    });

    it('should create balanced shards with time-based strategy', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan(mockTests, 3, 'time-based');

      expect(plan).toHaveLength(3);

      // All tests should be distributed
      const totalTests = plan.reduce((sum, shard) => sum + shard.length, 0);
      expect(totalTests).toBe(10);
    });

    it('should create deterministic shards with hash-based strategy', async () => {
      const manager = new ShardManager();
      const plan1 = await manager.createShardPlan(mockTests, 3, 'hash-based');
      const plan2 = await manager.createShardPlan(mockTests, 3, 'hash-based');

      expect(plan1).toEqual(plan2);
    });

    it('should handle empty test list', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan([], 3, 'count-based');

      expect(plan).toHaveLength(3);
      plan.forEach((shard) => {
        expect(shard).toHaveLength(0);
      });
    });

    it('should handle single shard', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan(mockTests, 1, 'count-based');

      expect(plan).toHaveLength(1);
      expect(plan[0]).toHaveLength(10);
    });

    it('should handle more shards than tests', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan(mockTests.slice(0, 3), 10, 'count-based');

      expect(plan).toHaveLength(10);
      // Only 3 shards should have tests
      const nonEmptyShards = plan.filter((s) => s.length > 0);
      expect(nonEmptyShards).toHaveLength(3);
    });

    it('should fall back to count-based for custom strategy', async () => {
      const manager = new ShardManager();
      const plan = await manager.createShardPlan(mockTests, 3, 'custom');

      expect(plan).toHaveLength(3);
    });
  });

  describe('getShardFiles', () => {
    it('should throw error for out of range index', async () => {
      const manager = new ShardManager();

      await expect(manager.getShardFiles(0, 3)).rejects.toThrow();
      await expect(manager.getShardFiles(4, 3)).rejects.toThrow();
    });

    it('should return empty array for valid index (no test list)', async () => {
      const manager = new ShardManager();

      // Since getShardFiles doesn't have access to test list, it returns empty
      const result = await manager.getShardFiles(1, 3);
      expect(result).toEqual([]);
    });
  });

  describe('recordExecutionTime', () => {
    it('should record execution time for a file', () => {
      const manager = new ShardManager();

      manager.recordExecutionTime('test1.spec.ts', 1500);

      expect(manager.getEstimatedTime('test1.spec.ts')).toBe(1500);
    });

    it('should use exponential moving average for repeated recordings', () => {
      const manager = new ShardManager();

      manager.recordExecutionTime('test1.spec.ts', 1000);
      manager.recordExecutionTime('test1.spec.ts', 2000);

      // EMA with alpha=0.3: 0.3 * 2000 + 0.7 * 1000 = 600 + 700 = 1300
      const estimated = manager.getEstimatedTime('test1.spec.ts');
      expect(estimated).toBeGreaterThan(1000);
      expect(estimated).toBeLessThan(2000);
    });

    it('should return default time for unknown files', () => {
      const manager = new ShardManager();

      expect(manager.getEstimatedTime('unknown.spec.ts')).toBe(1000);
    });
  });

  describe('time-based sharding', () => {
    it('should distribute tests considering estimated time', async () => {
      const manager = new ShardManager();

      // Record some execution times
      manager.recordExecutionTime('slow1.spec.ts', 5000);
      manager.recordExecutionTime('fast1.spec.ts', 100);
      manager.recordExecutionTime('fast2.spec.ts', 100);
      manager.recordExecutionTime('slow2.spec.ts', 4000);

      const tests = ['slow1.spec.ts', 'fast1.spec.ts', 'fast2.spec.ts', 'slow2.spec.ts'];
      const plan = await manager.createShardPlan(tests, 2, 'time-based');

      expect(plan).toHaveLength(2);

      // Each shard should have at least one test
      expect(plan[0].length).toBeGreaterThan(0);
      expect(plan[1].length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should throw error for zero shards', async () => {
      const manager = new ShardManager();

      await expect(manager.createShardPlan(mockTests, 0, 'count-based')).rejects.toThrow(
        'shardCount must be greater than 0',
      );
    });

    it('should throw error for negative shards', async () => {
      const manager = new ShardManager();

      await expect(manager.createShardPlan(mockTests, -1, 'count-based')).rejects.toThrow(
        'shardCount must be greater than 0',
      );
    });
  });

  describe('constructor options', () => {
    it('should use custom cwd', () => {
      const manager = new ShardManager({ cwd: '/custom/path' });

      expect(manager).toBeDefined();
    });

    it('should use custom history path', () => {
      const manager = new ShardManager({ historyPath: '/custom/history.json' });

      expect(manager).toBeDefined();
    });
  });
});
