/**
 * Adaptive Path Analyzer Component Tests
 * Tests for path statistics calculation and core functions
 */

import { describe, expect, it } from 'vitest';
import {
  calculatePathStatistics,
  type PathEntry,
  type PathStatistics,
  type ExecutionResult,
} from '../AdaptivePathAnalyzer';

describe('calculatePathStatistics', () => {
  it('should handle empty path entries', () => {
    const stats = calculatePathStatistics([]);
    expect(stats.totalPaths).toBe(0);
    expect(stats.executedPaths).toBe(0);
    expect(stats.branchCoverage).toBe(0);
  });

  it('should count total paths', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000 },
      { stepId: 'step-2', timestamp: 2000 },
      { stepId: 'step-3', timestamp: 3000 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.totalPaths).toBe(3);
  });

  it('should count unique paths', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000 },
      { stepId: 'step-1', timestamp: 2000 },
      { stepId: 'step-2', timestamp: 3000 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.executedPaths).toBe(2);
  });

  it('should calculate branch coverage from execution results', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
      { stepId: 'step-2', timestamp: 2000, branch: 'else' },
    ];
    const results: ExecutionResult[] = [
      { stepId: 'step-1', success: true, branch: 'then' },
      { stepId: 'step-2', success: true, branch: 'else' },
    ];
    const stats = calculatePathStatistics(entries, results);
    expect(stats.branchCoverage).toBe(100);
  });

  it('should count loop iterations', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, iteration: 1 },
      { stepId: 'step-1', timestamp: 2000, iteration: 2 },
      { stepId: 'step-1', timestamp: 3000, iteration: 3 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.loopIterations).toBe(6);
  });

  it('should calculate max depth', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, depth: 0 },
      { stepId: 'step-2', timestamp: 2000, depth: 2 },
      { stepId: 'step-3', timestamp: 3000, depth: 1 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.maxDepth).toBe(2);
  });

  it('should return unique paths array', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
      { stepId: 'step-2', timestamp: 2000, branch: 'else' },
      { stepId: 'step-1', timestamp: 3000, branch: 'then' },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.uniquePaths).toEqual(['step-1:then', 'step-2:else']);
  });

  it('should find critical path', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000 },
      { stepId: 'step-2', timestamp: 2000, branch: 'then' },
      { stepId: 'step-3', timestamp: 3000 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.criticalPath).toBeDefined();
    expect(stats.criticalPath!.length).toBeGreaterThan(0);
  });

  it('should handle entries without branches', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000 },
      { stepId: 'step-2', timestamp: 2000 },
      { stepId: 'step-3', timestamp: 3000 },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.uniquePaths).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('should handle zero execution results for branch coverage', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
    ];
    const stats = calculatePathStatistics(entries, []);
    expect(stats.branchCoverage).toBe(0);
  });

  it('should calculate branch coverage correctly', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
      { stepId: 'step-1', timestamp: 1500, branch: 'else' },
    ];
    const results: ExecutionResult[] = [
      { stepId: 'step-1', success: true, branch: 'then' },
      { stepId: 'step-1', success: true, branch: 'else' },
    ];
    const stats = calculatePathStatistics(entries, results);
    // Both then and else branches covered
    expect(stats.branchCoverage).toBe(100);
  });

  it('should calculate partial branch coverage', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
    ];
    const results: ExecutionResult[] = [
      { stepId: 'step-1', success: true, branch: 'then' },
      { stepId: 'step-2', success: true }, // No branch
    ];
    const stats = calculatePathStatistics(entries, results);
    // Only then branch covered
    expect(stats.branchCoverage).toBeGreaterThan(0);
    expect(stats.branchCoverage).toBeLessThan(100);
  });

  it('should handle entries with conditions', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then', condition: '${x} === true' },
      { stepId: 'step-2', timestamp: 2000, branch: 'else', condition: '${x} === false' },
    ];
    const stats = calculatePathStatistics(entries);
    expect(stats.totalPaths).toBe(2);
    expect(stats.uniquePaths).toContain('step-1:then');
    expect(stats.uniquePaths).toContain('step-2:else');
  });
});

describe('PathEntry edge cases', () => {
  it('should handle entry with all optional fields', () => {
    const entry: PathEntry = {
      stepId: 'step-1',
      timestamp: 1000,
      branch: 'then',
      condition: '${x} === true',
      iteration: 1,
      depth: 2,
    };

    const stats = calculatePathStatistics([entry]);
    expect(stats.totalPaths).toBe(1);
    expect(stats.loopIterations).toBe(1);
    expect(stats.maxDepth).toBe(2);
  });

  it('should handle entry with no optional fields', () => {
    const entry: PathEntry = {
      stepId: 'step-1',
      timestamp: 1000,
    };

    const stats = calculatePathStatistics([entry]);
    expect(stats.totalPaths).toBe(1);
    expect(stats.loopIterations).toBe(0);
    expect(stats.maxDepth).toBe(0);
  });

  it('should handle all branch types', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then' },
      { stepId: 'step-2', timestamp: 2000, branch: 'else' },
      { stepId: 'step-3', timestamp: 3000, branch: 'loop' },
    ];

    const stats = calculatePathStatistics(entries);
    expect(stats.totalPaths).toBe(3);
    expect(stats.uniquePaths).toEqual(['step-1:then', 'step-2:else', 'step-3:loop']);
  });

  it('should handle negative depth values (edge case)', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, depth: -1 },
      { stepId: 'step-2', timestamp: 2000, depth: 0 },
    ];

    const stats = calculatePathStatistics(entries);
    expect(stats.maxDepth).toBe(0);
  });

  it('should handle large iteration counts', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, iteration: 1000 },
      { stepId: 'step-1', timestamp: 2000, iteration: 2000 },
    ];

    const stats = calculatePathStatistics(entries);
    expect(stats.loopIterations).toBe(3000);
  });

  it('should handle mixed branch and loop entries', () => {
    const entries: PathEntry[] = [
      { stepId: 'step-1', timestamp: 1000, branch: 'then', iteration: 1 },
      { stepId: 'step-2', timestamp: 2000, branch: 'else', iteration: 2 },
      { stepId: 'step-3', timestamp: 3000, branch: 'loop', iteration: 3 },
    ];

    const stats = calculatePathStatistics(entries);
    expect(stats.totalPaths).toBe(3);
    expect(stats.loopIterations).toBe(6);
  });
});

describe('PathStatistics structure', () => {
  it('should create valid statistics object', () => {
    const stats: PathStatistics = {
      totalPaths: 10,
      executedPaths: 5,
      branchCoverage: 80,
      loopIterations: 3,
      maxDepth: 2,
      uniquePaths: ['step-1', 'step-2'],
      criticalPath: ['step-1', 'step-2', 'step-3'],
    };

    expect(stats.totalPaths).toBe(10);
    expect(stats.executedPaths).toBe(5);
    expect(stats.branchCoverage).toBe(80);
    expect(stats.loopIterations).toBe(3);
    expect(stats.maxDepth).toBe(2);
    expect(stats.uniquePaths).toHaveLength(2);
    expect(stats.criticalPath).toHaveLength(3);
  });

  it('should allow undefined critical path', () => {
    const stats: PathStatistics = {
      totalPaths: 0,
      executedPaths: 0,
      branchCoverage: 0,
      loopIterations: 0,
      maxDepth: 0,
      uniquePaths: [],
    };

    expect(stats.criticalPath).toBeUndefined();
  });
});

describe('ExecutionResult structure', () => {
  it('should create valid execution result', () => {
    const result: ExecutionResult = {
      stepId: 'step-1',
      success: true,
      branch: 'then',
      iterations: 3,
      duration: 1500,
    };

    expect(result.stepId).toBe('step-1');
    expect(result.success).toBe(true);
    expect(result.branch).toBe('then');
    expect(result.iterations).toBe(3);
    expect(result.duration).toBe(1500);
  });

  it('should create minimal execution result', () => {
    const result: ExecutionResult = {
      stepId: 'step-1',
      success: true,
    };

    expect(result.stepId).toBe('step-1');
    expect(result.success).toBe(true);
    expect(result.branch).toBeUndefined();
    expect(result.iterations).toBeUndefined();
    expect(result.duration).toBeUndefined();
  });
});
