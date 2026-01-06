/**
 * ResultAggregator Unit Tests
 */

import { describe, expect, it } from 'vitest';
import type { CollaborativeExecutionResult } from '../../../types/multiDevice';
import { ResultAggregator, createResultAggregator } from '../resultAggregator';

describe('ResultAggregator', () => {
  const createMockResult = (
    overrides: Partial<CollaborativeExecutionResult> = {},
  ): CollaborativeExecutionResult => ({
    success: true,
    startTime: 1000,
    endTime: 5000,
    totalDuration: 4000,
    devices: [
      {
        deviceId: 'device1',
        deviceAlias: 'Browser',
        steps: [
          {
            instruction: 'Click login',
            result: { success: true, duration: 500 },
          },
          {
            instruction: 'Enter username',
            result: { success: true, duration: 300 },
          },
        ],
        totalDuration: 800,
      },
      {
        deviceId: 'device2',
        deviceAlias: 'Mobile',
        steps: [
          {
            instruction: 'Open app',
            result: { success: true, duration: 600 },
          },
          {
            instruction: 'Navigate to profile',
            result: {
              success: false,
              duration: 200,
              error: 'Element not found',
            },
          },
        ],
        totalDuration: 800,
      },
    ],
    syncPoints: [
      {
        id: 'sync1',
        startTime: 1500,
        endTime: 1800,
        waitingDevices: ['device1', 'device2'],
        duration: 300,
      },
    ],
    sharedData: { userId: '123' },
    errors: [{ deviceId: 'device2', step: 1, error: 'Element not found' }],
    ...overrides,
  });

  describe('aggregate', () => {
    it('should aggregate execution results', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.original).toBe(result);
      expect(aggregated.stats).toBeDefined();
      expect(aggregated.deviceComparisons).toHaveLength(2);
      expect(aggregated.timeline).toBeDefined();
      expect(aggregated.summary).toBeDefined();
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.stats.totalDuration).toBe(4000);
      expect(aggregated.stats.totalSteps).toBe(4);
      expect(aggregated.stats.successfulSteps).toBe(3);
      expect(aggregated.stats.failedSteps).toBe(1);
      expect(aggregated.stats.successRate).toBe(75);
    });

    it('should calculate sync overhead', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.stats.totalSyncWaitTime).toBe(300);
      expect(aggregated.stats.syncOverheadPercentage).toBe(7.5);
    });

    it('should identify slowest device', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({
        devices: [
          {
            deviceId: 'device1',
            deviceAlias: 'Fast',
            steps: [
              { instruction: 'Step', result: { success: true, duration: 100 } },
            ],
            totalDuration: 100,
          },
          {
            deviceId: 'device2',
            deviceAlias: 'Slow',
            steps: [
              { instruction: 'Step', result: { success: true, duration: 500 } },
            ],
            totalDuration: 500,
          },
        ],
      });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.stats.slowestDevice).toBe('Slow');
      expect(aggregated.stats.fastestDevice).toBe('Fast');
    });

    it('should identify most failing device', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({
        devices: [
          {
            deviceId: 'device1',
            deviceAlias: 'Stable',
            steps: [
              {
                instruction: 'Step 1',
                result: { success: true, duration: 100 },
              },
              {
                instruction: 'Step 2',
                result: { success: true, duration: 100 },
              },
            ],
            totalDuration: 200,
          },
          {
            deviceId: 'device2',
            deviceAlias: 'Unstable',
            steps: [
              {
                instruction: 'Step 1',
                result: { success: false, duration: 100, error: 'Error 1' },
              },
              {
                instruction: 'Step 2',
                result: { success: false, duration: 100, error: 'Error 2' },
              },
            ],
            totalDuration: 200,
          },
        ],
      });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.stats.mostFailingDevice).toBe('Unstable');
    });
  });

  describe('compareDevices', () => {
    it('should compare device performance', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      const browser = aggregated.deviceComparisons.find(
        (d) => d.deviceAlias === 'Browser',
      );
      const mobile = aggregated.deviceComparisons.find(
        (d) => d.deviceAlias === 'Mobile',
      );

      expect(browser).toBeDefined();
      expect(browser?.successRate).toBe(100);
      expect(browser?.failedSteps).toBe(0);

      expect(mobile).toBeDefined();
      expect(mobile?.successRate).toBe(50);
      expect(mobile?.failedSteps).toBe(1);
    });
  });

  describe('analyzeFailures', () => {
    it('should correlate failures across devices', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({
        devices: [
          {
            deviceId: 'device1',
            deviceAlias: 'Browser',
            steps: [
              {
                instruction: 'Step',
                result: {
                  success: false,
                  duration: 100,
                  error: 'Timeout waiting for element',
                },
              },
            ],
            totalDuration: 100,
          },
          {
            deviceId: 'device2',
            deviceAlias: 'Mobile',
            steps: [
              {
                instruction: 'Step',
                result: {
                  success: false,
                  duration: 100,
                  error: 'Timeout waiting for element',
                },
              },
            ],
            totalDuration: 100,
          },
        ],
      });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.failureCorrelations).toHaveLength(1);
      expect(aggregated.failureCorrelations[0].occurrences).toBe(2);
      expect(aggregated.failureCorrelations[0].affectedDevices).toContain(
        'Browser',
      );
      expect(aggregated.failureCorrelations[0].affectedDevices).toContain(
        'Mobile',
      );
    });

    it('should infer potential causes', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({
        devices: [
          {
            deviceId: 'device1',
            deviceAlias: 'Browser',
            steps: [
              {
                instruction: 'Step',
                result: {
                  success: false,
                  duration: 100,
                  error: 'Network request failed',
                },
              },
            ],
            totalDuration: 100,
          },
        ],
      });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.failureCorrelations[0].potentialCause).toBe(
        'Network connectivity issue',
      );
    });
  });

  describe('buildTimeline', () => {
    it('should build timeline segments', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      // Should have step segments + sync segments
      expect(aggregated.timeline.length).toBeGreaterThan(0);

      const stepSegments = aggregated.timeline.filter((s) => s.type === 'step');
      const syncSegments = aggregated.timeline.filter((s) => s.type === 'sync');

      expect(stepSegments.length).toBe(4);
      expect(syncSegments.length).toBe(1);
    });

    it('should sort timeline by start time', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      for (let i = 1; i < aggregated.timeline.length; i++) {
        expect(aggregated.timeline[i].startTime).toBeGreaterThanOrEqual(
          aggregated.timeline[i - 1].startTime,
        );
      }
    });
  });

  describe('generateSummary', () => {
    it('should generate summary for successful execution', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({ success: true });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.summary).toContain('✅');
      expect(aggregated.summary).toContain('75');
    });

    it('should generate summary for failed execution', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult({ success: false });
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.summary).toContain('❌');
    });

    it('should include failure patterns in summary', () => {
      const aggregator = createResultAggregator();
      const result = createMockResult();
      const aggregated = aggregator.aggregate(result);

      expect(aggregated.summary).toContain('Failure patterns');
    });
  });

  describe('createResultAggregator', () => {
    it('should create a ResultAggregator instance', () => {
      const aggregator = createResultAggregator();
      expect(aggregator).toBeInstanceOf(ResultAggregator);
    });
  });
});
