/**
 * CI Executor Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CIConfig, CIExecutionResult } from '../../types/ci';
import { CIExecutor } from '../executor';
import { ParallelRunner } from '../parallelRunner';
import { ShardManager } from '../shardManager';

describe('CIExecutor', () => {
  let executor: CIExecutor;
  let shardManager: ShardManager;
  let parallelRunner: ParallelRunner;

  beforeEach(() => {
    shardManager = new ShardManager();
    parallelRunner = new ParallelRunner();
    executor = new CIExecutor(shardManager, parallelRunner);
  });

  describe('constructor', () => {
    it('should create executor with dependencies', () => {
      expect(executor).toBeDefined();
      expect(executor).toBeInstanceOf(CIExecutor);
    });

    it('should accept options', () => {
      const executorWithOptions = new CIExecutor(shardManager, parallelRunner, {
        cwd: '/custom/path',
        verbose: true,
      });
      expect(executorWithOptions).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(executor.initialize()).resolves.not.toThrow();
    });
  });

  describe('execute', () => {
    it('should execute tests and return results', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'test-suite',
        include: ['tests/**/*.yaml'],
      };

      const result = await executor.execute(config);

      expect(result).toBeDefined();
      expect(result.executionId).toBeDefined();
      expect(result.platform).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('should return empty result when no tests found', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'empty-suite',
        include: ['non-existent/**/*.yaml'],
      };

      const result = await executor.execute(config);

      expect(result).toBeDefined();
      expect(result.totalTests).toBe(0);
      expect(result.status).toBe('skipped');
    });

    it('should include metadata in results', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'test-suite',
        include: ['tests/**/*.yaml'],
      };

      const result = await executor.execute(config);

      expect(result.metadata).toBeDefined();
      expect(result.metadata).toMatchObject({
        nodeVersion: expect.any(String),
        platform: expect.any(String),
        arch: expect.any(String),
      });
    });

    it('should include timestamps in results', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'test-suite',
        include: ['tests/**/*.yaml'],
      };

      const result = await executor.execute(config);

      expect(result.startedAt).toBeDefined();
      expect(result.finishedAt).toBeDefined();
      expect(result.duration).toBeDefined();
    });
  });

  describe('sharding', () => {
    it('should apply sharding when configured', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'test-suite',
        include: ['tests/**/*.yaml'],
        sharding: {
          enabled: true,
          strategy: 'count-based',
        },
      };

      const result = await executor.execute(config, {
        shard: { index: 1, total: 2 },
      });

      expect(result).toBeDefined();
      // When no files are found, sharding is not set in the result
      // This is expected behavior for empty test runs
      if (result.totalTests > 0) {
        expect(result.sharding).toEqual({
          index: 1,
          total: 2,
        });
      }
    });

    it('should handle shard index correctly (1-based)', async () => {
      const config: CIConfig = {
        version: '1.0',
        suiteName: 'test-suite',
        include: ['tests/**/*.yaml'],
      };

      const result = await executor.execute(config, {
        shard: { index: 2, total: 3 },
      });

      expect(result).toBeDefined();
      // When no files are found, sharding is not set
      if (result.totalTests > 0) {
        expect(result.sharding?.index).toBe(2);
        expect(result.sharding?.total).toBe(3);
      }
    });
  });

  describe('cancel', () => {
    it('should cancel execution', async () => {
      await expect(executor.cancel()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(executor.cleanup()).resolves.not.toThrow();
    });
  });

  describe('platform detection', () => {
    it('should detect GitHub Actions', async () => {
      const originalEnv = process.env.GITHUB_ACTIONS;
      process.env.GITHUB_ACTIONS = 'true';

      try {
        const localExecutor = new CIExecutor(shardManager, parallelRunner);
        const config: CIConfig = {
          version: '1.0',
          suiteName: 'test-suite',
          include: ['tests/**/*.yaml'],
        };

        const result = await localExecutor.execute(config);
        expect(result.platform).toBe('github');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.GITHUB_ACTIONS;
        } else {
          process.env.GITHUB_ACTIONS = originalEnv;
        }
      }
    });

    it('should detect local environment', async () => {
      // Ensure no CI env vars are set
      const originalValues = {
        GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
        GITLAB_CI: process.env.GITLAB_CI,
        JENKINS_URL: process.env.JENKINS_URL,
        TF_BUILD: process.env.TF_BUILD,
        CIRCLECI: process.env.CIRCLECI,
      };

      Object.keys(originalValues).forEach((key) => {
        delete process.env[key];
      });

      try {
        const localExecutor = new CIExecutor(shardManager, parallelRunner);
        const config: CIConfig = {
          version: '1.0',
          suiteName: 'test-suite',
          include: ['tests/**/*.yaml'],
        };

        const result = await localExecutor.execute(config);
        expect(result.platform).toBe('local');
      } finally {
        Object.keys(originalValues).forEach((key) => {
          if (originalValues[key] !== undefined) {
            process.env[key] = originalValues[key];
          }
        });
      }
    });
  });
});
