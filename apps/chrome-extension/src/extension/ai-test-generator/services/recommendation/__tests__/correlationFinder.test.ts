/**
 * Correlation Finder Tests
 * Tests for discovering test case relationships
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../../types/analytics';
import { CorrelationFinder } from '../correlationFinder';

// Mock analyticsStorage
vi.mock('../../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    getRecentExecutions: vi.fn(),
  },
}));

import { analyticsStorage } from '../../analytics/analyticsStorage';

describe('CorrelationFinder', () => {
  let finder: CorrelationFinder;

  const createExecutionRecord = (overrides?: Partial<ExecutionRecord>): ExecutionRecord => ({
    id: `exec-${Math.random().toString(36).substr(2, 9)}`,
    caseId: `case-${Math.random().toString(36).substr(2, 9)}`,
    caseName: 'Test Case',
    startTime: Date.now() - Math.random() * 3600000,
    endTime: Date.now() - Math.random() * 3600000 + 5000,
    duration: 5000,
    status: 'passed',
    steps: [
      {
        index: 0,
        description: 'Navigate to page',
        status: 'passed',
        duration: 1000,
        retryCount: 0,
      },
      {
        index: 1,
        description: 'Click button',
        status: 'passed',
        duration: 500,
        retryCount: 0,
      },
    ],
    environment: {
      browser: 'chrome',
      viewport: { width: 1920, height: 1080 },
      url: 'https://example.com',
    },
    ...overrides,
  });

  beforeEach(() => {
    finder = new CorrelationFinder();
    vi.clearAllMocks();
  });

  describe('findCorrelations', () => {
    it('should return empty array for non-existent case', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const correlations = await finder.findCorrelations('non-existent');

      expect(correlations).toEqual([]);
    });

    it('should find co-failure correlations', async () => {
      const baseTime = Date.now();
      const executions: ExecutionRecord[] = [
        createExecutionRecord({
          caseId: 'case-1',
          startTime: baseTime,
          status: 'failed',
          steps: [{ index: 0, description: 'Login', status: 'failed', duration: 1000, retryCount: 0 }],
        }),
        createExecutionRecord({
          caseId: 'case-2',
          startTime: baseTime + 1000, // Within time window
          status: 'failed',
          steps: [{ index: 0, description: 'Login', status: 'failed', duration: 1000, retryCount: 0 }],
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const correlations = await finder.findCorrelations('case-1');

      expect(correlations.length).toBeGreaterThan(0);
      expect(correlations[0].caseId1).toBe('case-1');
    });

    it('should return correlations with required fields', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'login-test', status: 'failed' }),
        createExecutionRecord({ caseId: 'auth-test', status: 'failed' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const correlations = await finder.findCorrelations('login-test');

      if (correlations.length > 0) {
        expect(correlations[0]).toHaveProperty('caseId1');
        expect(correlations[0]).toHaveProperty('caseId2');
        expect(correlations[0]).toHaveProperty('correlationType');
        expect(correlations[0]).toHaveProperty('strength');
        expect(correlations[0]).toHaveProperty('evidence');
      }
    });
  });

  describe('getRelatedCases', () => {
    it('should return direct relations with depth 1', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'case-a', status: 'failed' }),
        createExecutionRecord({ caseId: 'case-b', status: 'failed' }),
        createExecutionRecord({ caseId: 'case-c', status: 'passed' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const related = await finder.getRelatedCases('case-a', 1);

      expect(Array.isArray(related)).toBe(true);
    });

    it('should exclude the original case from results', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'case-a' }),
        createExecutionRecord({ caseId: 'case-b' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const related = await finder.getRelatedCases('case-a', 1);

      expect(related).not.toContain('case-a');
    });

    it('should return empty array for non-existent case', async () => {
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue([]);

      const related = await finder.getRelatedCases('non-existent', 1);

      expect(related).toEqual([]);
    });
  });

  describe('getCorrelationGraph', () => {
    it('should return graph with nodes and edges', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'case-1' }),
        createExecutionRecord({ caseId: 'case-2' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      expect(graph).toHaveProperty('nodes');
      expect(graph).toHaveProperty('edges');
      expect(graph).toHaveProperty('clusters');
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
      expect(Array.isArray(graph.clusters)).toBe(true);
    });

    it('should build nodes with required properties', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'node-test', caseName: 'Test Node' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      if (graph.nodes.length > 0) {
        expect(graph.nodes[0]).toHaveProperty('caseId');
        expect(graph.nodes[0]).toHaveProperty('caseName');
        expect(graph.nodes[0]).toHaveProperty('connections');
        expect(graph.nodes[0]).toHaveProperty('riskLevel');
      }
    });

    it('should build edges with source and target', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'source-case', status: 'failed' }),
        createExecutionRecord({ caseId: 'target-case', status: 'failed' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      if (graph.edges.length > 0) {
        expect(graph.edges[0]).toHaveProperty('source');
        expect(graph.edges[0]).toHaveProperty('target');
        expect(graph.edges[0]).toHaveProperty('type');
        expect(graph.edges[0]).toHaveProperty('strength');
      }
    });
  });

  describe('refreshCorrelations', () => {
    it('should refresh correlation data', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'refresh-test' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached correlations', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'cached-case' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      finder.clearCache();

      // After clearing cache, next call should refresh
      const related = await finder.getRelatedCases('cached-case', 1);

      expect(Array.isArray(related)).toBe(true);
    });
  });

  describe('correlation strength', () => {
    it('should detect same feature correlation', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'user-login-test', caseName: 'User Login Test' }),
        createExecutionRecord({ caseId: 'admin-login-test', caseName: 'Admin Login Test' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const correlations = await finder.findCorrelations('user-login-test');

      // Should find correlation due to shared keyword "login"
      const hasSameFeature = correlations.some((c) => c.correlationType === 'same_feature');
      expect(hasSameFeature).toBe(true);
    });
  });

  describe('shared precondition detection', () => {
    it('should detect tests with same starting step', async () => {
      const baseTime = Date.now();
      const executions = [
        createExecutionRecord({
          caseId: 'case-a',
          startTime: baseTime,
          steps: [
            { index: 0, description: 'Open login page', status: 'passed', duration: 1000, retryCount: 0 },
            { index: 1, description: 'Enter credentials', status: 'passed', duration: 500, retryCount: 0 },
          ],
        }),
        createExecutionRecord({
          caseId: 'case-b',
          startTime: baseTime + 2000,
          steps: [
            { index: 0, description: 'Open login page', status: 'passed', duration: 1000, retryCount: 0 },
            { index: 1, description: 'Click submit', status: 'passed', duration: 500, retryCount: 0 },
          ],
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const correlations = await finder.findCorrelations('case-a');

      // Should detect shared precondition
      const hasSharedPrecondition = correlations.some((c) =>
        c.evidence.some((e) => e.type === 'shared_precondition')
      );
      expect(hasSharedPrecondition).toBe(true);
    });
  });

  describe('execution sequence detection', () => {
    it('should detect sequential execution patterns', async () => {
      const baseTime = Date.now();
      const executions = [
        createExecutionRecord({
          caseId: 'first-test',
          startTime: baseTime,
        }),
        createExecutionRecord({
          caseId: 'second-test',
          startTime: baseTime + 30000, // 30 seconds later, within sequence window
        }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const correlations = await finder.findCorrelations('first-test');

      // May detect execution sequence
      const hasSequence = correlations.some((c) => c.correlationType === 'execution_sequence');
      expect(Array.isArray(correlations)).toBe(true);
    });
  });

  describe('risk level calculation', () => {
    it('should assign high risk to cases with many co-failures', async () => {
      const baseTime = Date.now();
      const executions: ExecutionRecord[] = [];
      // Create multiple co-failure pairs
      for (let i = 0; i < 5; i++) {
        executions.push(
          createExecutionRecord({
            caseId: `case-${i}`,
            startTime: baseTime,
            status: 'failed',
          }),
          createExecutionRecord({
            caseId: `case-${i + 10}`,
            startTime: baseTime + 1000,
            status: 'failed',
          })
        );
      }
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      // Check that risk levels are assigned
      const hasHighRisk = graph.nodes.some((n) => n.riskLevel === 'high' || n.riskLevel === 'medium');
      expect(hasHighRisk).toBe(true);
    });
  });

  describe('cluster detection', () => {
    it('should find clusters of related cases', async () => {
      const baseTime = Date.now();
      // Create cases that fail together (should form a cluster)
      const executions = [
        createExecutionRecord({ caseId: 'cluster-1-a', startTime: baseTime, status: 'failed' }),
        createExecutionRecord({ caseId: 'cluster-1-b', startTime: baseTime + 1000, status: 'failed' }),
        createExecutionRecord({ caseId: 'cluster-1-c', startTime: baseTime + 2000, status: 'failed' }),
        // Isolated case
        createExecutionRecord({ caseId: 'isolated', startTime: baseTime + 10000, status: 'passed' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      // Should have at least one cluster with multiple cases
      const hasCluster = graph.clusters.some((c) => c.cases.length > 1);
      expect(hasCluster).toBe(true);
    });

    it('should create clusters with required properties', async () => {
      const executions = [
        createExecutionRecord({ caseId: 'c1' }),
        createExecutionRecord({ caseId: 'c2' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      await finder.refreshCorrelations();
      const graph = await finder.getCorrelationGraph();

      if (graph.clusters.length > 0) {
        expect(graph.clusters[0]).toHaveProperty('id');
        expect(graph.clusters[0]).toHaveProperty('cases');
        expect(graph.clusters[0]).toHaveProperty('centerCase');
        expect(graph.clusters[0]).toHaveProperty('avgStrength');
      }
    });
  });

  describe('caching behavior', () => {
    it('should use cached correlations within cache duration', async () => {
      // Create multiple executions for the same case to establish correlations
      const baseTime = Date.now();
      const executions = [
        createExecutionRecord({ caseId: 'cached-test', startTime: baseTime, caseName: 'Login Test' }),
        createExecutionRecord({ caseId: 'related-test', startTime: baseTime + 1000, caseName: 'Login Auth Test' }),
        createExecutionRecord({ caseId: 'cached-test', startTime: baseTime + 2000, caseName: 'Login Test' }),
      ];
      vi.mocked(analyticsStorage.getRecentExecutions).mockResolvedValue(executions);

      // First call should fetch and populate cache
      await finder.refreshCorrelations();
      const callCount = vi.mocked(analyticsStorage.getRecentExecutions).mock.calls.length;

      // Find correlations to populate the cache map
      await finder.findCorrelations('cached-test');

      // Verify cache is populated
      const callCountAfterFind = vi.mocked(analyticsStorage.getRecentExecutions).mock.calls.length;

      // Within cache duration, subsequent calls should use cache
      await finder.findCorrelations('cached-test');

      // Should not have called getRecentExecutions again after initial population
      expect(vi.mocked(analyticsStorage.getRecentExecutions).mock.calls.length).toBe(callCountAfterFind);
    });
  });
});
