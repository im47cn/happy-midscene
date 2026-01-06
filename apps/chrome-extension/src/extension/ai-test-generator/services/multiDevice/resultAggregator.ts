/**
 * Result Aggregator
 * Merges multi-device execution results with sync timing and failure analysis
 */

import type {
  CollaborativeExecutionResult,
  DeviceExecutionResult,
  StepResult,
  SyncPointTiming,
} from '../../types/multiDevice';

/**
 * Aggregated statistics
 */
export interface AggregatedStats {
  /** Total execution time */
  totalDuration: number;
  /** Total steps across all devices */
  totalSteps: number;
  /** Successful steps */
  successfulSteps: number;
  /** Failed steps */
  failedSteps: number;
  /** Success rate (0-100) */
  successRate: number;
  /** Average step duration */
  averageStepDuration: number;
  /** Total sync wait time */
  totalSyncWaitTime: number;
  /** Sync overhead percentage */
  syncOverheadPercentage: number;
  /** Device with most failures */
  mostFailingDevice?: string;
  /** Slowest device */
  slowestDevice?: string;
  /** Fastest device */
  fastestDevice?: string;
}

/**
 * Failure correlation analysis
 */
export interface FailureCorrelation {
  /** Error message pattern */
  errorPattern: string;
  /** Affected devices */
  affectedDevices: string[];
  /** Number of occurrences */
  occurrences: number;
  /** Potential root cause */
  potentialCause?: string;
  /** Step indices where failure occurred */
  failedStepIndices: number[];
}

/**
 * Device comparison
 */
export interface DeviceComparison {
  deviceId: string;
  deviceAlias: string;
  totalSteps: number;
  successfulSteps: number;
  failedSteps: number;
  totalDuration: number;
  averageStepDuration: number;
  successRate: number;
}

/**
 * Timeline segment for visualization
 */
export interface TimelineSegment {
  type: 'step' | 'sync' | 'idle';
  deviceId: string;
  startTime: number;
  endTime: number;
  duration: number;
  label: string;
  success?: boolean;
  error?: string;
}

/**
 * Aggregated result
 */
export interface AggregatedResult {
  /** Original execution result */
  original: CollaborativeExecutionResult;
  /** Aggregated statistics */
  stats: AggregatedStats;
  /** Device comparisons */
  deviceComparisons: DeviceComparison[];
  /** Failure correlations */
  failureCorrelations: FailureCorrelation[];
  /** Timeline segments for visualization */
  timeline: TimelineSegment[];
  /** Summary text */
  summary: string;
}

/**
 * Result Aggregator class
 */
export class ResultAggregator {
  /**
   * Aggregate execution results
   */
  aggregate(result: CollaborativeExecutionResult): AggregatedResult {
    const stats = this.calculateStats(result);
    const deviceComparisons = this.compareDevices(result);
    const failureCorrelations = this.analyzeFailures(result);
    const timeline = this.buildTimeline(result);
    const summary = this.generateSummary(result, stats, failureCorrelations);

    return {
      original: result,
      stats,
      deviceComparisons,
      failureCorrelations,
      timeline,
      summary,
    };
  }

  /**
   * Calculate aggregated statistics
   */
  private calculateStats(
    result: CollaborativeExecutionResult,
  ): AggregatedStats {
    let totalSteps = 0;
    let successfulSteps = 0;
    let failedSteps = 0;
    let totalStepDuration = 0;
    let mostFailures = 0;
    let mostFailingDevice: string | undefined;
    let slowestDuration = 0;
    let slowestDevice: string | undefined;
    let fastestDuration = Number.POSITIVE_INFINITY;
    let fastestDevice: string | undefined;

    for (const device of result.devices) {
      let deviceFailures = 0;

      for (const step of device.steps) {
        totalSteps++;
        totalStepDuration += step.result.duration;

        if (step.result.success) {
          successfulSteps++;
        } else {
          failedSteps++;
          deviceFailures++;
        }
      }

      // Track most failing device
      if (deviceFailures > mostFailures) {
        mostFailures = deviceFailures;
        mostFailingDevice = device.deviceAlias;
      }

      // Track slowest/fastest device
      if (device.totalDuration > slowestDuration) {
        slowestDuration = device.totalDuration;
        slowestDevice = device.deviceAlias;
      }
      if (device.totalDuration < fastestDuration) {
        fastestDuration = device.totalDuration;
        fastestDevice = device.deviceAlias;
      }
    }

    // Calculate sync overhead
    const totalSyncWaitTime = result.syncPoints.reduce(
      (sum, sp) => sum + sp.duration,
      0,
    );
    const syncOverheadPercentage =
      result.totalDuration > 0
        ? (totalSyncWaitTime / result.totalDuration) * 100
        : 0;

    return {
      totalDuration: result.totalDuration,
      totalSteps,
      successfulSteps,
      failedSteps,
      successRate: totalSteps > 0 ? (successfulSteps / totalSteps) * 100 : 0,
      averageStepDuration: totalSteps > 0 ? totalStepDuration / totalSteps : 0,
      totalSyncWaitTime,
      syncOverheadPercentage,
      mostFailingDevice: mostFailures > 0 ? mostFailingDevice : undefined,
      slowestDevice,
      fastestDevice,
    };
  }

  /**
   * Compare device performance
   */
  private compareDevices(
    result: CollaborativeExecutionResult,
  ): DeviceComparison[] {
    return result.devices.map((device) => {
      const successfulSteps = device.steps.filter(
        (s) => s.result.success,
      ).length;
      const failedSteps = device.steps.length - successfulSteps;
      const totalDuration = device.steps.reduce(
        (sum, s) => sum + s.result.duration,
        0,
      );

      return {
        deviceId: device.deviceId,
        deviceAlias: device.deviceAlias,
        totalSteps: device.steps.length,
        successfulSteps,
        failedSteps,
        totalDuration,
        averageStepDuration:
          device.steps.length > 0 ? totalDuration / device.steps.length : 0,
        successRate:
          device.steps.length > 0
            ? (successfulSteps / device.steps.length) * 100
            : 0,
      };
    });
  }

  /**
   * Analyze failure correlations
   */
  private analyzeFailures(
    result: CollaborativeExecutionResult,
  ): FailureCorrelation[] {
    const errorMap = new Map<
      string,
      {
        devices: Set<string>;
        indices: number[];
        count: number;
      }
    >();

    // Collect errors by pattern
    for (const device of result.devices) {
      device.steps.forEach((step, index) => {
        if (!step.result.success && step.result.error) {
          const pattern = this.normalizeErrorPattern(step.result.error);

          if (!errorMap.has(pattern)) {
            errorMap.set(pattern, {
              devices: new Set(),
              indices: [],
              count: 0,
            });
          }

          const entry = errorMap.get(pattern)!;
          entry.devices.add(device.deviceAlias);
          entry.indices.push(index);
          entry.count++;
        }
      });
    }

    // Convert to correlations
    const correlations: FailureCorrelation[] = [];

    for (const [pattern, data] of errorMap) {
      correlations.push({
        errorPattern: pattern,
        affectedDevices: Array.from(data.devices),
        occurrences: data.count,
        potentialCause: this.inferCause(pattern, data.devices.size),
        failedStepIndices: data.indices,
      });
    }

    // Sort by occurrences
    return correlations.sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Normalize error message to pattern
   */
  private normalizeErrorPattern(error: string): string {
    // Remove variable parts like numbers, timestamps, IDs
    return error
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<timestamp>')
      .replace(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
        '<uuid>',
      )
      .replace(/\b\d+\b/g, '<number>')
      .replace(/['"][^'"]+['"]/g, '<string>')
      .trim()
      .slice(0, 100);
  }

  /**
   * Infer potential cause from error pattern
   */
  private inferCause(
    pattern: string,
    affectedCount: number,
  ): string | undefined {
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern.includes('timeout')) {
      return 'Network or element timeout';
    }
    if (
      lowerPattern.includes('not found') ||
      lowerPattern.includes('no such element')
    ) {
      return 'Element not found on page';
    }
    if (lowerPattern.includes('network') || lowerPattern.includes('fetch')) {
      return 'Network connectivity issue';
    }
    if (
      lowerPattern.includes('permission') ||
      lowerPattern.includes('denied')
    ) {
      return 'Permission or access denied';
    }
    if (affectedCount > 1) {
      return 'Cross-device issue (affects multiple devices)';
    }

    return undefined;
  }

  /**
   * Build timeline segments for visualization
   */
  private buildTimeline(
    result: CollaborativeExecutionResult,
  ): TimelineSegment[] {
    const segments: TimelineSegment[] = [];

    // Add step segments
    for (const device of result.devices) {
      let currentTime = result.startTime;

      for (const step of device.steps) {
        segments.push({
          type: 'step',
          deviceId: device.deviceId,
          startTime: currentTime,
          endTime: currentTime + step.result.duration,
          duration: step.result.duration,
          label: step.instruction,
          success: step.result.success,
          error: step.result.error,
        });

        currentTime += step.result.duration;
      }
    }

    // Add sync point segments
    for (const syncPoint of result.syncPoints) {
      segments.push({
        type: 'sync',
        deviceId: 'sync',
        startTime: syncPoint.startTime,
        endTime: syncPoint.endTime,
        duration: syncPoint.duration,
        label: `Sync: ${syncPoint.id}`,
      });
    }

    // Sort by start time
    return segments.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    result: CollaborativeExecutionResult,
    stats: AggregatedStats,
    correlations: FailureCorrelation[],
  ): string {
    const lines: string[] = [];

    // Overall status
    if (result.success) {
      lines.push('✅ Execution completed successfully');
    } else {
      lines.push('❌ Execution failed');
    }

    // Duration
    lines.push(`⏱️ Total duration: ${this.formatDuration(stats.totalDuration)}`);

    // Steps
    lines.push(
      `📊 Steps: ${stats.successfulSteps}/${stats.totalSteps} passed (${stats.successRate.toFixed(1)}%)`,
    );

    // Devices
    lines.push(`📱 Devices: ${result.devices.length}`);

    // Sync overhead
    if (stats.totalSyncWaitTime > 0) {
      lines.push(
        `🔄 Sync overhead: ${this.formatDuration(stats.totalSyncWaitTime)} (${stats.syncOverheadPercentage.toFixed(1)}%)`,
      );
    }

    // Slowest device
    if (stats.slowestDevice) {
      lines.push(`🐢 Slowest device: ${stats.slowestDevice}`);
    }

    // Failure summary
    if (correlations.length > 0) {
      lines.push('');
      lines.push('🚨 Failure patterns:');
      for (const corr of correlations.slice(0, 3)) {
        lines.push(
          `  - ${corr.errorPattern.slice(0, 50)}... (${corr.occurrences}x)`,
        );
        if (corr.potentialCause) {
          lines.push(`    Cause: ${corr.potentialCause}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format duration in ms to readable string
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }
}

/**
 * Create result aggregator instance
 */
export function createResultAggregator(): ResultAggregator {
  return new ResultAggregator();
}
