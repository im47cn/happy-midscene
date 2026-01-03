/**
 * RecommendEngine Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendEngine } from '../recommendEngine';
import type {
  EfficiencyAnalysis,
  RedundancyReport,
  StabilityAnalysis,
} from '../../../types/optimization';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('RecommendEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage mock
    localStorageMock.clear();
  });

  const createEfficiencyAnalysis = (
    overrides: Partial<EfficiencyAnalysis> = {},
  ): EfficiencyAnalysis => ({
    totalDuration: 300000,
    averageDuration: 30000,
    slowestCases: [
      {
        caseId: 'case-1',
        caseName: 'Slow Test',
        averageDuration: 60000,
        percentile: 95,
        slowSteps: [
          {
            order: 1,
            description: 'Wait for element',
            duration: 30000,
            averageDuration: 30000,
          },
        ],
      },
    ],
    bottlenecks: [
      {
        type: 'excessive_waiting',
        description: 'Too much waiting',
        affectedCases: ['case-1'],
        suggestion: 'Use smart waits',
      },
    ],
    parallelizationOpportunity: {
      currentParallel: 1,
      recommendedParallel: 4,
      estimatedSaving: 40,
      independentGroups: [],
    },
    resourceUtilization: {
      screenshotSize: 1024000,
      logSize: 10240,
      browserInstances: 1,
    },
    ...overrides,
  });

  const createRedundancyReport = (
    overrides: Partial<RedundancyReport> = {},
  ): RedundancyReport => ({
    redundantGroups: [
      {
        groupId: 'group-1',
        cases: ['case-1', 'case-2'],
        similarityScore: 0.9,
        commonSteps: [{ index: 0, description: 'Common step' }],
        differences: [],
        mergeRecommendation: {
          action: 'merge',
          reason: 'High similarity',
        },
      },
    ],
    duplicateSteps: [],
    overlapScore: 50,
    potentialSavings: 60000,
    ...overrides,
  });

  const createStabilityAnalysis = (
    overrides: Partial<StabilityAnalysis> = {},
  ): StabilityAnalysis => ({
    overallScore: 70,
    flakyTests: [
      {
        caseId: 'case-1',
        caseName: 'Flaky Test',
        flakyRate: 0.3,
        totalRuns: 10,
        passCount: 7,
        failCount: 3,
        rootCauses: [
          {
            type: 'timing',
            description: 'Timing issues',
            confidence: 0.8,
          },
        ],
        recommendations: ['Add waits'],
      },
    ],
    failurePatterns: [],
    environmentIssues: [],
    ...overrides,
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations from efficiency analysis', async () => {
      const analysis = { efficiency: createEfficiencyAnalysis() };

      const recommendations = await recommendEngine.generateRecommendations(
        analysis,
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some((r) => r.type === 'efficiency'),
      ).toBe(true);
    });

    it('should generate recommendations from redundancy report', async () => {
      const analysis = { redundancy: createRedundancyReport() };

      const recommendations = await recommendEngine.generateRecommendations(
        analysis,
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some((r) => r.type === 'redundancy'),
      ).toBe(true);
    });

    it('should generate recommendations from stability analysis', async () => {
      const analysis = { stability: createStabilityAnalysis() };

      const recommendations = await recommendEngine.generateRecommendations(
        analysis,
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(
        recommendations.some((r) => r.type === 'stability'),
      ).toBe(true);
    });

    it('should generate recommendations from multiple analyses', async () => {
      const analysis = {
        efficiency: createEfficiencyAnalysis(),
        redundancy: createRedundancyReport(),
        stability: createStabilityAnalysis(),
      };

      const recommendations = await recommendEngine.generateRecommendations(
        analysis,
      );

      expect(recommendations.length).toBeGreaterThan(3);
    });
  });

  describe('prioritizeRecommendations', () => {
    it('should sort by priority first', () => {
      const recommendations = [
        {
          id: '1',
          priority: 'low' as const,
          type: 'efficiency' as const,
          title: 'Low',
          description: '',
          impact: { description: '' },
          effort: 'low' as const,
          actionItems: [],
          relatedCases: [],
          evidence: [],
          createdAt: Date.now(),
        },
        {
          id: '2',
          priority: 'critical' as const,
          type: 'stability' as const,
          title: 'Critical',
          description: '',
          impact: { description: '' },
          effort: 'high' as const,
          actionItems: [],
          relatedCases: [],
          evidence: [],
          createdAt: Date.now(),
        },
        {
          id: '3',
          priority: 'high' as const,
          type: 'redundancy' as const,
          title: 'High',
          description: '',
          impact: { description: '' },
          effort: 'medium' as const,
          actionItems: [],
          relatedCases: [],
          evidence: [],
          createdAt: Date.now(),
        },
      ];

      const sorted = recommendEngine.prioritizeRecommendations(recommendations);

      expect(sorted[0].priority).toBe('critical');
      expect(sorted[1].priority).toBe('high');
      expect(sorted[2].priority).toBe('low');
    });
  });

  describe('estimateImpact', () => {
    it('should return Impact object', () => {
      const recommendation = {
        id: '1',
        priority: 'medium' as const,
        type: 'efficiency' as const,
        title: 'Test',
        description: '',
        impact: { description: '' },
        effort: 'medium' as const,
        actionItems: [],
        relatedCases: ['case-1'],
        evidence: [],
        createdAt: Date.now(),
      };

      const impact = recommendEngine.estimateImpact(recommendation);

      expect(impact).toHaveProperty('description');
    });
  });

  describe('trackAdoption', () => {
    it('should store adoption status', async () => {
      await recommendEngine.trackAdoption('rec-1', true, 'Worked well');

      const stored = localStorage.getItem('optimization-adoptions');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed['rec-1']).toEqual({
        adopted: true,
        adoptedAt: expect.any(Number),
        notes: 'Worked well',
      });
    });

    it('should update existing adoption', async () => {
      await recommendEngine.trackAdoption('rec-1', true);
      await recommendEngine.trackAdoption('rec-1', false);

      const stored = localStorage.getItem('optimization-adoptions');
      const parsed = JSON.parse(stored!);
      expect(parsed['rec-1'].adopted).toBe(false);
    });
  });
});
