/**
 * Redundancy Detector
 * Detects redundant and duplicate test cases
 */

import type { ExecutionRecord, StepRecord } from '../../types/analytics';
import type {
  DuplicateStep,
  MergeRecommendation,
  RedundancyReport,
  RedundantGroup,
  StepDiff,
  StepInfo,
  StepOccurrence,
} from '../../types/optimization';
import type { IRedundancyDetector } from './interfaces';
import { analyticsStorage } from '../analytics/analyticsStorage';
import { similarityCalculator } from './similarityCalculator';

// Similarity threshold for considering cases as redundant
const REDUNDANCY_THRESHOLD = 0.7;
const HIGH_SIMILARITY_THRESHOLD = 0.85;
const DUPLICATE_STEP_MIN_OCCURRENCES = 3;

class RedundancyDetector implements IRedundancyDetector {
  /**
   * Run full redundancy detection
   */
  async detect(): Promise<RedundancyReport> {
    const [redundantGroups, duplicateSteps] = await Promise.all([
      this.findSimilarCases(REDUNDANCY_THRESHOLD),
      this.findDuplicateSteps(),
    ]);

    // Calculate overlap score
    const overlapScore = this.calculateOverlapScore(
      redundantGroups,
      duplicateSteps,
    );

    // Estimate potential savings
    const potentialSavings = this.estimateSavings(redundantGroups);

    return {
      redundantGroups,
      duplicateSteps,
      overlapScore,
      potentialSavings,
    };
  }

  /**
   * Find similar test cases
   */
  async findSimilarCases(threshold = REDUNDANCY_THRESHOLD): Promise<RedundantGroup[]> {
    const caseStats = await analyticsStorage.getAllCaseStats();
    const executions = await analyticsStorage.getRecentExecutions(1000);

    if (caseStats.length < 2) {
      return [];
    }

    // Group executions by case ID
    const caseExecutions = new Map<string, ExecutionRecord[]>();
    for (const exec of executions) {
      const existing = caseExecutions.get(exec.caseId);
      if (existing) {
        existing.push(exec);
      } else {
        caseExecutions.set(exec.caseId, [exec]);
      }
    }

    // Extract typical steps for each case
    const caseSteps = new Map<string, string[]>();
    for (const [caseId, execs] of caseExecutions) {
      const steps = this.extractTypicalSteps(execs);
      caseSteps.set(caseId, steps);
    }

    // Compare all pairs
    const caseIds = [...caseSteps.keys()];
    const similarities: { pair: [string, string]; score: number }[] = [];

    for (let i = 0; i < caseIds.length; i++) {
      for (let j = i + 1; j < caseIds.length; j++) {
        const steps1 = caseSteps.get(caseIds[i]) || [];
        const steps2 = caseSteps.get(caseIds[j]) || [];

        const similarity = similarityCalculator.calculateStepSimilarity(
          steps1,
          steps2,
        );

        if (similarity >= threshold) {
          similarities.push({
            pair: [caseIds[i], caseIds[j]],
            score: similarity,
          });
        }
      }
    }

    // Cluster similar cases into groups
    const groups = this.clusterSimilarCases(similarities, caseSteps);

    return groups;
  }

  /**
   * Find duplicate steps across cases
   */
  async findDuplicateSteps(): Promise<DuplicateStep[]> {
    const executions = await analyticsStorage.getRecentExecutions(500);

    // Count step occurrences
    const stepOccurrences = new Map<string, StepOccurrence[]>();

    for (const exec of executions) {
      for (const step of exec.steps) {
        const normalizedStep = similarityCalculator.normalizeStep(
          step.description,
        );
        const existing = stepOccurrences.get(normalizedStep);
        const occurrence: StepOccurrence = {
          caseId: exec.caseId,
          caseName: exec.caseName,
          stepIndex: step.index,
        };

        if (existing) {
          // Avoid duplicate entries for same case
          if (!existing.some((o) => o.caseId === exec.caseId)) {
            existing.push(occurrence);
          }
        } else {
          stepOccurrences.set(normalizedStep, [occurrence]);
        }
      }
    }

    // Filter to steps that appear in multiple cases
    const duplicateSteps: DuplicateStep[] = [];

    for (const [step, occurrences] of stepOccurrences) {
      if (occurrences.length >= DUPLICATE_STEP_MIN_OCCURRENCES) {
        duplicateSteps.push({
          step,
          occurrences,
          extractionRecommendation: this.getExtractionRecommendation(
            step,
            occurrences.length,
          ),
        });
      }
    }

    // Sort by occurrence count descending
    return duplicateSteps.sort(
      (a, b) => b.occurrences.length - a.occurrences.length,
    );
  }

  /**
   * Suggest merge strategy for redundant cases
   */
  async suggestMerge(caseIds: string[]): Promise<MergeRecommendation> {
    if (caseIds.length < 2) {
      return {
        action: 'keep',
        reason: 'Need at least 2 cases to merge',
      };
    }

    const executions = await analyticsStorage.getRecentExecutions(500);
    const caseExecutions = caseIds.map((id) =>
      executions.filter((e) => e.caseId === id),
    );

    // Get typical steps for each case
    const caseSteps = caseExecutions.map((execs) =>
      this.extractTypicalSteps(execs),
    );

    // Find common and different steps
    const commonSteps = this.findCommonSteps(caseSteps);
    const differences = this.findStepDifferences(caseSteps);

    // Determine merge strategy
    if (differences.length === 0) {
      return {
        action: 'merge',
        reason: 'All steps are identical - merge into single case',
        mergedCase: {
          name: `Merged: ${caseIds[0]}`,
          steps: commonSteps,
        },
      };
    }

    if (this.canParameterize(differences)) {
      return {
        action: 'parameterize',
        reason: 'Differences can be parameterized using data-driven approach',
        mergedCase: {
          name: `Parameterized: ${caseIds[0]}`,
          steps: commonSteps,
          dataVariations: this.extractDataVariations(differences),
        },
      };
    }

    return {
      action: 'keep',
      reason: 'Cases have significant structural differences',
    };
  }

  /**
   * Extract typical steps from executions
   */
  private extractTypicalSteps(executions: ExecutionRecord[]): string[] {
    if (executions.length === 0) return [];

    // Use the most recent successful execution's steps
    const successfulExec = executions.find((e) => e.status === 'passed');
    const exec = successfulExec || executions[0];

    return exec.steps.map((s) => s.description);
  }

  /**
   * Cluster similar cases into groups
   */
  private clusterSimilarCases(
    similarities: { pair: [string, string]; score: number }[],
    caseSteps: Map<string, string[]>,
  ): RedundantGroup[] {
    // Use simple union-find clustering
    const parent = new Map<string, string>();

    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      if (parent.get(x) !== x) {
        parent.set(x, find(parent.get(x)!));
      }
      return parent.get(x)!;
    };

    const union = (x: string, y: string) => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent.set(px, py);
      }
    };

    // Union similar cases
    for (const { pair } of similarities) {
      union(pair[0], pair[1]);
    }

    // Group by cluster
    const clusters = new Map<string, string[]>();
    for (const [caseId] of caseSteps) {
      const root = find(caseId);
      const existing = clusters.get(root);
      if (existing) {
        existing.push(caseId);
      } else {
        clusters.set(root, [caseId]);
      }
    }

    // Convert to RedundantGroup format
    const groups: RedundantGroup[] = [];
    let groupIndex = 0;

    for (const [_, cases] of clusters) {
      if (cases.length < 2) continue;

      // Calculate group similarity
      const groupSteps = cases.map((id) => caseSteps.get(id) || []);
      const avgSimilarity = this.calculateGroupSimilarity(groupSteps);

      // Find common steps
      const commonSteps = this.findCommonSteps(groupSteps).map(
        (step, idx) => ({
          index: idx,
          description: step,
        }),
      );

      // Find differences
      const differences = this.findStepDifferences(groupSteps);

      groups.push({
        groupId: `redundant-${groupIndex++}`,
        cases,
        similarityScore: avgSimilarity,
        commonSteps,
        differences,
        mergeRecommendation: {
          action: avgSimilarity > HIGH_SIMILARITY_THRESHOLD ? 'merge' : 'parameterize',
          reason:
            avgSimilarity > HIGH_SIMILARITY_THRESHOLD
              ? 'High similarity - consider merging'
              : 'Consider parameterizing differences',
        },
      });
    }

    return groups.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Calculate average similarity within a group
   */
  private calculateGroupSimilarity(stepArrays: string[][]): number {
    if (stepArrays.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < stepArrays.length; i++) {
      for (let j = i + 1; j < stepArrays.length; j++) {
        totalSimilarity += similarityCalculator.calculateStepSimilarity(
          stepArrays[i],
          stepArrays[j],
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }

  /**
   * Find common steps across all cases
   */
  private findCommonSteps(stepArrays: string[][]): string[] {
    if (stepArrays.length === 0) return [];
    if (stepArrays.length === 1) return stepArrays[0];

    const normalized = stepArrays.map((steps) =>
      steps.map((s) => similarityCalculator.normalizeStep(s)),
    );

    // Find steps that appear in all arrays
    const firstNormalized = new Set(normalized[0]);
    const common = normalized[0].filter((step) => {
      return normalized.every((arr) =>
        arr.some(
          (s) =>
            similarityCalculator.normalizeStep(s) ===
            similarityCalculator.normalizeStep(step),
        ),
      );
    });

    return common;
  }

  /**
   * Find differences between step sequences
   */
  private findStepDifferences(stepArrays: string[][]): StepDiff[] {
    if (stepArrays.length < 2) return [];

    const differences: StepDiff[] = [];
    const maxLength = Math.max(...stepArrays.map((a) => a.length));

    for (let i = 0; i < maxLength; i++) {
      const stepsAtIndex = stepArrays.map((arr) => arr[i] || '');
      const normalizedSteps = stepsAtIndex.map((s) =>
        similarityCalculator.normalizeStep(s),
      );

      // Check if all are the same
      const uniqueNormalized = new Set(normalizedSteps);
      if (uniqueNormalized.size > 1) {
        differences.push({
          stepIndex: i,
          case1Value: stepsAtIndex[0],
          case2Value: stepsAtIndex[1] || '',
          type: this.inferDiffType(stepsAtIndex[0], stepsAtIndex[1] || ''),
        });
      }
    }

    return differences;
  }

  /**
   * Infer the type of difference between two steps
   */
  private inferDiffType(
    step1: string,
    step2: string,
  ): 'action' | 'target' | 'assertion' {
    const action1 = similarityCalculator.extractActionType(step1);
    const action2 = similarityCalculator.extractActionType(step2);

    if (action1 !== action2) return 'action';
    if (step1.includes('assert') || step1.includes('verify')) return 'assertion';
    return 'target';
  }

  /**
   * Check if differences can be parameterized
   */
  private canParameterize(differences: StepDiff[]): boolean {
    // Can parameterize if differences are only in data values, not structure
    return differences.every((diff) => diff.type === 'target');
  }

  /**
   * Extract data variations from differences
   */
  private extractDataVariations(
    differences: StepDiff[],
  ): Record<string, string[]> {
    const variations: Record<string, string[]> = {};

    for (let i = 0; i < differences.length; i++) {
      const key = `param_${i}`;
      variations[key] = [differences[i].case1Value, differences[i].case2Value];
    }

    return variations;
  }

  /**
   * Get extraction recommendation for duplicate step
   */
  private getExtractionRecommendation(
    step: string,
    occurrenceCount: number,
  ): string {
    const action = similarityCalculator.extractActionType(step);

    if (action === 'verify' || action === 'assert') {
      return `Extract as shared assertion helper (used in ${occurrenceCount} cases)`;
    }
    if (action === 'click' || action === 'type' || action === 'input') {
      return `Consider extracting as page object method (used in ${occurrenceCount} cases)`;
    }
    if (action === 'navigate') {
      return `Extract as navigation utility (used in ${occurrenceCount} cases)`;
    }

    return `Consider extracting as reusable step (used in ${occurrenceCount} cases)`;
  }

  /**
   * Calculate overall overlap score
   */
  private calculateOverlapScore(
    redundantGroups: RedundantGroup[],
    duplicateSteps: DuplicateStep[],
  ): number {
    if (redundantGroups.length === 0 && duplicateSteps.length === 0) {
      return 0;
    }

    const groupScore =
      redundantGroups.reduce((sum, g) => sum + g.similarityScore * g.cases.length, 0) /
      Math.max(1, redundantGroups.reduce((sum, g) => sum + g.cases.length, 0));

    const duplicateScore =
      duplicateSteps.length > 0
        ? Math.min(
            100,
            (duplicateSteps.reduce(
              (sum, d) => sum + d.occurrences.length,
              0,
            ) /
              duplicateSteps.length) *
              10,
          )
        : 0;

    return Math.round(groupScore * 50 + (duplicateScore / 100) * 50);
  }

  /**
   * Estimate potential time savings
   */
  private estimateSavings(redundantGroups: RedundantGroup[]): number {
    // Rough estimate: 30 seconds average per redundant case
    const avgCaseDuration = 30000;
    const redundantCasesCount = redundantGroups.reduce(
      (sum, g) => sum + Math.max(0, g.cases.length - 1),
      0,
    );

    return redundantCasesCount * avgCaseDuration;
  }
}

export const redundancyDetector = new RedundancyDetector();
