/**
 * input: rootCauseAnalyzer service
 * output: Test results for root cause analysis functionality
 * pos: Unit tests for root cause analysis and evidence collection
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Anomaly, RootCause } from '../../types/anomaly';
import { causeMatcher } from '../causeMatcher';
import { evidenceCollector } from '../evidenceCollector';
import { rootCauseAnalyzer } from '../rootCauseAnalyzer';
import { anomalyStorage } from '../storage';

// Mock dependencies
vi.mock('../evidenceCollector', () => ({
  evidenceCollector: {
    collect: vi.fn().mockReturnValue({
      primary: [],
      secondary: [],
      timeline: [],
      environmentChanges: [],
      correlations: [],
    }),
    analyzeEvidence: vi.fn().mockResolvedValue([]),
    correlateChanges: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../causeMatcher', () => ({
  causeMatcher: {
    match: vi.fn().mockReturnValue([]),
    getSuggestions: vi.fn().mockReturnValue([]),
    getHistoricalPatterns: vi.fn().mockReturnValue([]),
    recordPattern: vi.fn(),
  },
}));

vi.mock('../storage', () => ({
  anomalyStorage: {
    getAnomaly: vi.fn().mockResolvedValue(null),
    saveAnomaly: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('RootCauseAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations after clearing
    vi.mocked(evidenceCollector.collect).mockReturnValue({
      primary: [],
      secondary: [],
      timeline: [],
      environmentChanges: [],
      correlations: [],
    });
    vi.mocked(causeMatcher.match).mockReturnValue([]);
    vi.mocked(causeMatcher.getHistoricalPatterns).mockReturnValue([]);
    vi.mocked(anomalyStorage.getAnomaly).mockResolvedValue(null);
    vi.mocked(anomalyStorage.saveAnomaly).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('analyze', () => {
    const mockAnomaly: Anomaly = {
      id: 'anomaly-1',
      type: 'success_rate_drop',
      severity: 'critical',
      detectedAt: Date.now(),
      status: 'active',
      metric: {
        name: 'passRate',
        currentValue: 70,
        unit: '%',
        timestamp: Date.now(),
      },
      baseline: {
        mean: 95,
        stdDev: 2,
        min: 90,
        max: 100,
        period: '7d',
        sampleCount: 100,
        lastUpdated: Date.now(),
      },
      deviation: {
        absoluteDeviation: -25,
        percentageDeviation: -26.3,
        zScore: -12.5,
      },
      impact: {
        affectedCases: ['test-1', 'test-2', 'test-3'],
        affectedFeatures: ['login', 'checkout'],
        estimatedScope: 'high',
      },
      rootCauses: [],
    };

    it('should analyze anomaly and return root causes', async () => {
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'code_change',
          description: 'Recent code deployment detected',
          confidence: 85,
          evidence: [],
          suggestions: [],
        },
      ]);

      const result = await rootCauseAnalyzer.analyze(mockAnomaly);

      expect(result).toBeDefined();
      expect(result.rootCauses.length).toBeGreaterThan(0);
      expect(evidenceCollector.collect).toHaveBeenCalled();
      expect(causeMatcher.match).toHaveBeenCalled();
    });

    it('should return empty array when no causes found', async () => {
      vi.mocked(causeMatcher.match).mockReturnValue([]);

      const result = await rootCauseAnalyzer.analyze(mockAnomaly);

      expect(result.rootCauses).toHaveLength(0);
    });

    it('should include suggestions for each root cause', async () => {
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'timing_issue',
          description: 'Element timing issue detected',
          confidence: 75,
          evidence: [],
          suggestions: [
            { action: 'Increase wait timeout', priority: 1, effort: 'low' },
            { action: 'Add explicit wait', priority: 2, effort: 'medium' },
          ],
        },
      ]);

      const result = await rootCauseAnalyzer.analyze(mockAnomaly);

      expect(result.rootCauses[0].suggestions.length).toBeGreaterThan(0);
    });

    it('should sort root causes by confidence', async () => {
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'data_issue',
          description: 'Data issue',
          confidence: 60,
          evidence: [],
          suggestions: [],
        },
        {
          id: 'cause-2',
          category: 'code_change',
          description: 'Code change',
          confidence: 90,
          evidence: [],
          suggestions: [],
        },
        {
          id: 'cause-3',
          category: 'timing_issue',
          description: 'Timing issue',
          confidence: 75,
          evidence: [],
          suggestions: [],
        },
      ]);

      const result = await rootCauseAnalyzer.analyze(mockAnomaly);

      expect(result.rootCauses[0].confidence).toBe(90);
      expect(result.rootCauses[1].confidence).toBe(75);
      expect(result.rootCauses[2].confidence).toBe(60);
    });
  });

  describe('analyzeFailure', () => {
    it('should analyze a specific test failure', async () => {
      vi.mocked(evidenceCollector.collect).mockReturnValue({
        logs: [
          {
            level: 'error',
            message: 'Element not found: #submit-btn',
            timestamp: Date.now(),
          },
        ],
        screenshots: [],
        networkRequests: [],
        environmentInfo: { browser: 'Chrome', version: '120' },
        timeline: [],
        changes: [],
      });
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'locator_change',
          description: 'Element selector changed',
          confidence: 90,
          evidence: [],
          suggestions: [],
        },
      ]);

      const result = await rootCauseAnalyzer.analyzeFailure(
        'test-1',
        'exec-1',
        {
          caseId: 'test-1',
          executionId: 'exec-1',
          status: 'failed',
          errorMessage: 'Element not found',
          stackTrace: 'Error at line 42...',
          startTime: Date.now() - 1000,
          endTime: Date.now(),
        },
      );

      expect(result).toBeDefined();
      expect(result.rootCauses.length).toBeGreaterThan(0);
      expect(result.rootCauses[0].category).toBe('locator_change');
    });

    it('should detect timing issues from error patterns', async () => {
      vi.mocked(evidenceCollector.collect).mockReturnValue({
        logs: [
          {
            level: 'error',
            message: 'Timeout waiting for element',
            timestamp: Date.now(),
          },
        ],
        screenshots: [],
        networkRequests: [],
        environmentInfo: {},
        timeline: [],
        changes: [],
      });
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'timing_issue',
          description: 'Element load timeout',
          confidence: 85,
          evidence: [],
          suggestions: [],
        },
      ]);

      const result = await rootCauseAnalyzer.analyzeFailure(
        'test-1',
        'exec-2',
        {
          caseId: 'test-1',
          executionId: 'exec-2',
          status: 'failed',
          errorMessage: 'Timeout waiting for element',
          stackTrace: '',
          startTime: Date.now() - 1000,
          endTime: Date.now(),
        },
      );

      expect(result.rootCauses[0].category).toBe('timing_issue');
    });

    it('should detect network issues', async () => {
      vi.mocked(evidenceCollector.collect).mockReturnValue({
        logs: [],
        screenshots: [],
        networkRequests: [
          {
            url: '/api/users',
            status: 500,
            duration: 5000,
            timestamp: Date.now(),
          },
        ],
        environmentInfo: {},
        timeline: [],
        changes: [],
      });
      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'network_issue',
          description: 'API server error',
          confidence: 80,
          evidence: [],
          suggestions: [],
        },
      ]);

      const result = await rootCauseAnalyzer.analyzeFailure(
        'test-1',
        'exec-3',
        {
          caseId: 'test-1',
          executionId: 'exec-3',
          status: 'failed',
          errorMessage: 'API request failed',
          stackTrace: '',
          startTime: Date.now() - 1000,
          endTime: Date.now(),
        },
      );

      expect(result.rootCauses[0].category).toBe('network_issue');
    });
  });

  describe('getSuggestions', () => {
    it('should generate actionable suggestions', () => {
      const rootCauses: RootCause[] = [
        {
          id: 'cause-1',
          category: 'locator_change',
          description: 'Element selector changed',
          confidence: 90,
          evidence: [],
          suggestions: [
            { action: 'Update element selector', priority: 1, effort: 'low' },
          ],
        },
      ];

      const suggestions = rootCauseAnalyzer.getSuggestions(rootCauses);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].action).toBeDefined();
    });

    it('should prioritize suggestions by impact', () => {
      const rootCauses: RootCause[] = [
        {
          id: 'cause-1',
          category: 'locator_change',
          description: 'Minor selector change',
          confidence: 60,
          evidence: [],
          suggestions: [
            { action: 'Update selector', priority: 3, effort: 'low' },
          ],
        },
        {
          id: 'cause-2',
          category: 'environment_change',
          description: 'Critical env change',
          confidence: 95,
          evidence: [],
          suggestions: [
            { action: 'Rollback environment', priority: 1, effort: 'high' },
          ],
        },
      ];

      const suggestions = rootCauseAnalyzer.getSuggestions(rootCauses);

      // Higher confidence cause should be prioritized
      expect(suggestions[0].action).toContain('Rollback');
    });
  });

  describe('analyzeBatch', () => {
    it('should analyze multiple anomalies', async () => {
      const anomalies: Anomaly[] = [
        {
          id: 'anomaly-1',
          type: 'success_rate_drop',
          severity: 'critical',
          detectedAt: Date.now(),
          status: 'active',
          metric: {
            name: 'passRate',
            currentValue: 70,
            unit: '%',
            timestamp: Date.now(),
          },
          baseline: {
            mean: 95,
            stdDev: 2,
            min: 90,
            max: 100,
            period: '7d',
            sampleCount: 100,
            lastUpdated: Date.now(),
          },
          deviation: {
            absoluteDeviation: -25,
            percentageDeviation: -26,
            zScore: -12.5,
          },
          impact: {
            affectedCases: ['test-1'],
            affectedFeatures: [],
            estimatedScope: 'medium',
          },
          rootCauses: [],
        },
        {
          id: 'anomaly-2',
          type: 'duration_spike',
          severity: 'warning',
          detectedAt: Date.now(),
          status: 'active',
          metric: {
            name: 'avgDuration',
            currentValue: 5000,
            unit: 'ms',
            timestamp: Date.now(),
          },
          baseline: {
            mean: 1000,
            stdDev: 100,
            min: 800,
            max: 1200,
            period: '7d',
            sampleCount: 100,
            lastUpdated: Date.now(),
          },
          deviation: {
            absoluteDeviation: 4000,
            percentageDeviation: 400,
            zScore: 40,
          },
          impact: {
            affectedCases: ['test-2'],
            affectedFeatures: [],
            estimatedScope: 'low',
          },
          rootCauses: [],
        },
      ];

      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'code_change',
          description: 'Code change',
          confidence: 80,
          evidence: [],
          suggestions: [],
        },
      ]);

      const batchResult = await rootCauseAnalyzer.analyzeBatch(anomalies);

      expect(batchResult.results).toHaveLength(2);
      batchResult.results.forEach((result) => {
        expect(result.anomalyId).toBeDefined();
        expect(result.rootCauses).toBeDefined();
      });
    });

    it('should identify common causes across anomalies', async () => {
      const anomalies: Anomaly[] = Array.from({ length: 5 }, (_, i) => ({
        id: `anomaly-${i}`,
        type: 'pass_rate_drop' as const,
        severity: 'critical' as const,
        detectedAt: Date.now(),
        status: 'active' as const,
        metric: {
          name: 'passRate',
          currentValue: 70,
          unit: '%',
          timestamp: Date.now(),
        },
        baseline: {
          mean: 95,
          stdDev: 2,
          min: 90,
          max: 100,
          period: '7d',
          sampleCount: 100,
          lastUpdated: Date.now(),
        },
        deviation: {
          absoluteDeviation: -25,
          percentageDeviation: -26,
          zScore: -12.5,
        },
        impact: {
          affectedCases: [`test-${i}`],
          affectedFeatures: ['login'],
          estimatedScope: 'high' as const,
        },
        rootCauses: [],
      }));

      vi.mocked(causeMatcher.match).mockReturnValue([
        {
          id: 'cause-1',
          category: 'environment_change',
          description: 'Environment configuration changed',
          confidence: 85,
          evidence: [],
          suggestions: [],
        },
      ]);

      const batchResult = await rootCauseAnalyzer.analyzeBatch(anomalies);

      expect(batchResult.commonCauses.length).toBeGreaterThan(0);
      expect(batchResult.commonCauses[0].category).toBe('environment_change');
      expect(batchResult.commonCauses[0].affectedAnomalies.length).toBe(5);
    });
  });
});
