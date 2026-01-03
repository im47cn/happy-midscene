/**
 * Correlation Finder
 * Discovers relationships between test cases based on execution patterns
 */

import type {
  CaseCorrelation,
  CorrelationType,
  CorrelationGraph,
  CorrelationNode,
  CorrelationEdge,
  CorrelationCluster,
  CorrelationEvidence,
} from '../../types/recommendation';
import type { ExecutionRecord } from '../../types/analytics';
import { analyticsStorage } from '../analytics/analyticsStorage';

/**
 * Minimum correlation strength to consider significant
 */
const MIN_CORRELATION_STRENGTH = 0.3;

/**
 * Correlation Finder class
 */
export class CorrelationFinder {
  private correlations: Map<string, CaseCorrelation[]> = new Map();
  private lastRefresh: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Find correlations for a specific case
   */
  async findCorrelations(caseId: string): Promise<CaseCorrelation[]> {
    await this.ensureFreshCorrelations();
    return this.correlations.get(caseId) ?? [];
  }

  /**
   * Get related cases with optional depth
   */
  async getRelatedCases(caseId: string, depth = 1): Promise<string[]> {
    await this.ensureFreshCorrelations();

    const visited = new Set<string>([caseId]);
    const currentLevel = new Set<string>([caseId]);
    let currentDepth = 0;

    while (currentDepth < depth && currentLevel.size > 0) {
      const nextLevel = new Set<string>();

      for (const id of currentLevel) {
        const correlations = this.correlations.get(id) ?? [];
        for (const corr of correlations) {
          const otherId = corr.caseId1 === id ? corr.caseId2 : corr.caseId1;
          if (!visited.has(otherId) && corr.strength >= MIN_CORRELATION_STRENGTH) {
            visited.add(otherId);
            nextLevel.add(otherId);
          }
        }
      }

      currentLevel.clear();
      nextLevel.forEach((id) => currentLevel.add(id));
      currentDepth++;
    }

    visited.delete(caseId); // Remove the original case
    return Array.from(visited);
  }

  /**
   * Get the full correlation graph
   */
  async getCorrelationGraph(): Promise<CorrelationGraph> {
    await this.ensureFreshCorrelations();

    const nodes = new Map<string, CorrelationNode>();
    const edges: CorrelationEdge[] = [];

    // Build nodes
    for (const [caseId, correlations] of this.correlations) {
      if (!nodes.has(caseId)) {
        nodes.set(caseId, {
          caseId,
          caseName: correlations[0]?.evidence[0]?.description ?? caseId,
          connections: correlations.length,
          riskLevel: this.calculateRiskLevel(correlations),
        });
      }

      for (const corr of correlations) {
        const otherId = corr.caseId1 === caseId ? corr.caseId2 : corr.caseId1;
        if (!nodes.has(otherId)) {
          nodes.set(otherId, {
            caseId: otherId,
            caseName: otherId,
            connections: 0,
            riskLevel: 'low',
          });
        }
      }
    }

    // Build edges
    const edgeKeys = new Set<string>();
    for (const correlations of this.correlations.values()) {
      for (const corr of correlations) {
        const key = [corr.caseId1, corr.caseId2].sort().join('-');
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({
            source: corr.caseId1,
            target: corr.caseId2,
            type: corr.correlationType,
            strength: corr.strength,
          });
        }
      }
    }

    // Find clusters
    const clusters = this.findClusters(Array.from(nodes.values()), edges);

    return {
      nodes: Array.from(nodes.values()),
      edges,
      clusters,
    };
  }

  /**
   * Refresh correlation data
   */
  async refreshCorrelations(): Promise<void> {
    const executions = await analyticsStorage.getRecentExecutions(500);
    this.correlations = await this.calculateCorrelations(executions);
    this.lastRefresh = Date.now();
  }

  /**
   * Clear cached correlations
   */
  clearCache(): void {
    this.correlations.clear();
    this.lastRefresh = 0;
  }

  /**
   * Calculate correlations from execution records
   */
  private async calculateCorrelations(executions: ExecutionRecord[]): Promise<Map<string, CaseCorrelation[]>> {
    const correlations = new Map<string, CaseCorrelation[]>();
    const caseIds = Array.from(new Set(executions.map((e) => e.caseId)));

    // Group executions by case
    const executionsByCase = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = executionsByCase.get(exec.caseId) ?? [];
      existing.push(exec);
      executionsByCase.set(exec.caseId, existing);
    }

    // Calculate pairwise correlations
    for (let i = 0; i < caseIds.length; i++) {
      for (let j = i + 1; j < caseIds.length; j++) {
        const case1 = caseIds[i];
        const case2 = caseIds[j];

        const correlation = await this.calculatePairwiseCorrelation(
          case1,
          case2,
          executionsByCase.get(case1) ?? [],
          executionsByCase.get(case2) ?? [],
        );

        if (correlation && correlation.strength >= MIN_CORRELATION_STRENGTH) {
          // Store for case1
          const corr1 = correlations.get(case1) ?? [];
          corr1.push(correlation);
          correlations.set(case1, corr1);

          // Store for case2
          const corr2 = correlations.get(case2) ?? [];
          corr2.push(correlation);
          correlations.set(case2, corr2);
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate correlation between two cases
   */
  private async calculatePairwiseCorrelation(
    caseId1: string,
    caseId2: string,
    execs1: ExecutionRecord[],
    execs2: ExecutionRecord[],
  ): Promise<CaseCorrelation | null> {
    const evidence: CorrelationEvidence[] = [];
    let totalStrength = 0;
    let maxType: CorrelationType = 'similar_pattern';

    // Check for co-failure pattern
    const coFailure = this.checkCoFailurePattern(execs1, execs2);
    if (coFailure.strength > 0) {
      totalStrength += coFailure.strength * 0.4;
      evidence.push(coFailure.evidence);
      maxType = 'co_failure';
    }

    // Check for same feature (name similarity)
    const sameFeature = this.checkSameFeature(caseId1, caseId2);
    if (sameFeature.strength > 0) {
      totalStrength += sameFeature.strength * 0.3;
      evidence.push(sameFeature.evidence);
      if (sameFeature.strength > coFailure.strength) {
        maxType = 'same_feature';
      }
    }

    // Check for execution sequence
    const sequence = this.checkExecutionSequence(execs1, execs2);
    if (sequence.strength > 0) {
      totalStrength += sequence.strength * 0.2;
      evidence.push(sequence.evidence);
      if (sequence.strength > Math.max(coFailure.strength, sameFeature.strength)) {
        maxType = 'execution_sequence';
      }
    }

    // Check for shared precondition (similar starting steps)
    const precondition = this.checkSharedPrecondition(execs1, execs2);
    if (precondition.strength > 0) {
      totalStrength += precondition.strength * 0.1;
      evidence.push(precondition.evidence);
    }

    if (totalStrength < MIN_CORRELATION_STRENGTH || evidence.length === 0) {
      return null;
    }

    return {
      caseId1,
      caseId2,
      correlationType: maxType,
      strength: Math.min(1, totalStrength),
      evidence,
    };
  }

  /**
   * Check if two cases tend to fail together
   */
  private checkCoFailurePattern(
    execs1: ExecutionRecord[],
    execs2: ExecutionRecord[],
  ): { strength: number; evidence: CorrelationEvidence } {
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    let coFailures = 0;
    let totalFailures1 = 0;
    let totalFailures2 = 0;

    for (const e1 of execs1) {
      if (e1.status !== 'failed') continue;
      totalFailures1++;

      for (const e2 of execs2) {
        if (e2.status !== 'failed') continue;
        totalFailures2++;

        if (Math.abs(e1.startTime - e2.startTime) < timeWindow) {
          coFailures++;
        }
      }
    }

    const strength =
      totalFailures1 > 0 && totalFailures2 > 0
        ? (coFailures / Math.max(totalFailures1, totalFailures2)) * 2
        : 0;

    return {
      strength: Math.min(1, strength),
      evidence: {
        type: 'co_failure',
        description: `共同失败次数: ${coFailures}`,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Check if cases are for the same feature
   */
  private checkSameFeature(caseId1: string, caseId2: string): { strength: number; evidence: CorrelationEvidence } {
    const name1 = caseId1.toLowerCase();
    const name2 = caseId2.toLowerCase();

    // Extract common parts
    const words1 = name1.split(/[-_\s]/).filter(Boolean);
    const words2 = name2.split(/[-_\s]/).filter(Boolean);

    const commonWords = words1.filter((w) => words2.includes(w) && w.length > 2);
    const strength = commonWords.length / Math.max(words1.length, words2.length);

    return {
      strength,
      evidence: {
        type: 'same_feature',
        description: commonWords.length > 0 ? `共同关键词: ${commonWords.join(', ')}` : '',
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Check for execution sequence dependency
   */
  private checkExecutionSequence(
    execs1: ExecutionRecord[],
    execs2: ExecutionRecord[],
  ): { strength: number; evidence: CorrelationEvidence } {
    const sequenceWindow = 60 * 1000; // 1 minute
    let sequenceCount = 0;
    let reverseSequenceCount = 0;

    for (const e1 of execs1) {
      for (const e2 of execs2) {
        if (0 < e2.startTime - e1.startTime && e2.startTime - e1.startTime < sequenceWindow) {
          sequenceCount++;
        } else if (
          0 < e1.startTime - e2.startTime &&
          e1.startTime - e2.startTime < sequenceWindow
        ) {
          reverseSequenceCount++;
        }
      }
    }

    const strength = Math.max(sequenceCount, reverseSequenceCount) / Math.max(execs1.length, execs2.length);

    return {
      strength,
      evidence: {
        type: 'execution_sequence',
        description: `顺序执行模式: ${Math.max(sequenceCount, reverseSequenceCount)} 次`,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Check for shared preconditions
   */
  private checkSharedPrecondition(
    execs1: ExecutionRecord[],
    execs2: ExecutionRecord[],
  ): { strength: number; evidence: CorrelationEvidence } {
    // Compare first steps of executions
    const firstSteps1 = new Set<string>();
    const firstSteps2 = new Set<string>();

    for (const exec of execs1) {
      if (exec.steps.length > 0) {
        firstSteps1.add(exec.steps[0].description.toLowerCase());
      }
    }

    for (const exec of execs2) {
      if (exec.steps.length > 0) {
        firstSteps2.add(exec.steps[0].description.toLowerCase());
      }
    }

    const intersection = new Set<string>();
    for (const step of firstSteps1) {
      if (firstSteps2.has(step)) {
        intersection.add(step);
      }
    }

    const strength =
      firstSteps1.size > 0 && firstSteps2.size > 0
        ? intersection.size / Math.min(firstSteps1.size, firstSteps2.size)
        : 0;

    return {
      strength,
      evidence: {
        type: 'shared_precondition',
        description: `共享前置步骤: ${intersection.size}`,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Calculate risk level based on correlations
   */
  private calculateRiskLevel(correlations: CaseCorrelation[]): CorrelationNode['riskLevel'] {
    if (correlations.length === 0) return 'low';

    const avgStrength =
      correlations.reduce((sum, c) => sum + c.strength, 0) / correlations.length;
    const coFailureCount = correlations.filter((c) => c.correlationType === 'co_failure').length;

    if (avgStrength > 0.7 || coFailureCount > 2) return 'high';
    if (avgStrength > 0.4 || coFailureCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Find clusters in the correlation graph
   */
  private findClusters(nodes: CorrelationNode[], edges: CorrelationEdge[]): CorrelationCluster[] {
    const clusters: CorrelationCluster[] = [];
    const visited = new Set<string>();

    // Simple connected components algorithm
    for (const node of nodes) {
      if (visited.has(node.caseId)) continue;

      const cluster = this.bfsCluster(node, edges, visited);
      if (cluster.cases.length > 1) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * BFS to find a cluster
   */
  private bfsCluster(
    startNode: CorrelationNode,
    edges: CorrelationEdge[],
    visited: Set<string>,
  ): CorrelationCluster {
    const cases: string[] = [];
    const queue = [startNode.caseId];
    let totalStrength = 0;

    while (queue.length > 0) {
      const caseId = queue.shift()!;
      if (visited.has(caseId)) continue;

      visited.add(caseId);
      cases.push(caseId);

      // Find connected nodes
      for (const edge of edges) {
        if (edge.source === caseId && !visited.has(edge.target)) {
          queue.push(edge.target);
          totalStrength += edge.strength;
        } else if (edge.target === caseId && !visited.has(edge.source)) {
          queue.push(edge.source);
          totalStrength += edge.strength;
        }
      }
    }

    return {
      id: `cluster-${startNode.caseId}`,
      cases,
      centerCase: startNode.caseId,
      avgStrength: totalStrength / Math.max(cases.length - 1, 1),
    };
  }

  /**
   * Ensure correlations are fresh
   */
  private async ensureFreshCorrelations(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefresh > this.CACHE_DURATION || this.correlations.size === 0) {
      await this.refreshCorrelations();
    }
  }
}

// Export singleton instance
export const correlationFinder = new CorrelationFinder();
