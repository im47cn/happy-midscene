/**
 * input: Anomaly data, execution logs, environment info
 * output: Collected evidence for root cause analysis
 * pos: Evidence gathering layer for root cause identification
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { Anomaly, Evidence, RootCauseCategory } from '../../types/anomaly';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionContext {
  caseId: string;
  executionId: string;
  startTime: number;
  endTime?: number;
  status: 'pass' | 'fail' | 'error' | 'timeout';
  errorMessage?: string;
  errorStack?: string;
  logs?: LogEntry[];
  screenshots?: Screenshot[];
  networkRequests?: NetworkRequest[];
  environmentInfo?: EnvironmentInfo;
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface Screenshot {
  timestamp: number;
  path: string;
  step?: string;
}

export interface NetworkRequest {
  timestamp: number;
  url: string;
  method: string;
  status?: number;
  duration?: number;
  error?: string;
}

export interface EnvironmentInfo {
  browser?: string;
  browserVersion?: string;
  os?: string;
  viewport?: { width: number; height: number };
  timezone?: string;
  locale?: string;
  userAgent?: string;
  timestamp: number;
}

export interface TimelineEvent {
  timestamp: number;
  type: 'action' | 'assertion' | 'navigation' | 'network' | 'error' | 'log';
  description: string;
  data?: Record<string, unknown>;
  severity?: 'info' | 'warning' | 'error';
}

export interface ChangeInfo {
  type: 'code' | 'config' | 'environment' | 'data';
  timestamp: number;
  description: string;
  affectedFiles?: string[];
  author?: string;
  commitId?: string;
}

export interface CollectedEvidence {
  primary: Evidence[];
  secondary: Evidence[];
  timeline: TimelineEvent[];
  environmentChanges: ChangeInfo[];
  summary: string;
}

// ============================================================================
// Evidence Patterns
// ============================================================================

interface EvidencePattern {
  category: RootCauseCategory;
  patterns: RegExp[];
  extractWeight: (match: string, context: ExecutionContext) => number;
  extractDescription: (match: string, context: ExecutionContext) => string;
}

const EVIDENCE_PATTERNS: EvidencePattern[] = [
  // Locator changes
  {
    category: 'locator_change',
    patterns: [
      /element not found/i,
      /no such element/i,
      /unable to locate/i,
      /selector.*not found/i,
      /xpath.*not found/i,
      /element.*is not attached/i,
      /stale element reference/i,
    ],
    extractWeight: () => 0.8,
    extractDescription: (match) => `Element locator issue: ${match}`,
  },
  // Timing issues
  {
    category: 'timing_issue',
    patterns: [
      /timeout/i,
      /timed out/i,
      /waiting.*exceeded/i,
      /navigation timeout/i,
      /script timeout/i,
      /promise.*rejected.*timeout/i,
    ],
    extractWeight: (_, ctx) => (ctx.status === 'timeout' ? 0.9 : 0.7),
    extractDescription: (match) => `Timing issue detected: ${match}`,
  },
  // Network issues
  {
    category: 'network_issue',
    patterns: [
      /network.*error/i,
      /fetch.*failed/i,
      /connection.*refused/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ERR_NETWORK/i,
      /status.*5\d{2}/i,
      /500|502|503|504/,
    ],
    extractWeight: () => 0.75,
    extractDescription: (match) => `Network issue: ${match}`,
  },
  // Data issues
  {
    category: 'data_issue',
    patterns: [
      /undefined.*not.*object/i,
      /null.*not.*object/i,
      /cannot read property/i,
      /assertion.*failed/i,
      /expected.*but.*received/i,
      /does not match/i,
      /validation.*error/i,
    ],
    extractWeight: () => 0.65,
    extractDescription: (match) => `Data validation issue: ${match}`,
  },
  // Environment changes
  {
    category: 'environment_change',
    patterns: [
      /browser.*version/i,
      /chrome.*update/i,
      /firefox.*update/i,
      /incompatible/i,
      /deprecated/i,
      /not supported/i,
    ],
    extractWeight: () => 0.6,
    extractDescription: (match) => `Environment issue: ${match}`,
  },
  // Resource constraints
  {
    category: 'resource_constraint',
    patterns: [
      /out of memory/i,
      /heap.*exceeded/i,
      /memory.*limit/i,
      /too many.*open/i,
      /quota.*exceeded/i,
      /rate.*limit/i,
    ],
    extractWeight: () => 0.7,
    extractDescription: (match) => `Resource constraint: ${match}`,
  },
];

// ============================================================================
// Evidence Collector Class
// ============================================================================

class EvidenceCollector {
  /**
   * Collect all evidence for an anomaly
   */
  collect(anomaly: Anomaly, context?: ExecutionContext): CollectedEvidence {
    const primary: Evidence[] = [];
    const secondary: Evidence[] = [];
    const timeline: TimelineEvent[] = [];
    const environmentChanges: ChangeInfo[] = [];

    // Extract evidence from anomaly description
    const descriptionEvidence = this.extractFromDescription(
      anomaly.description,
    );
    primary.push(...descriptionEvidence.filter((e) => e.weight >= 0.7));
    secondary.push(...descriptionEvidence.filter((e) => e.weight < 0.7));

    // Extract evidence from execution context
    if (context) {
      const contextEvidence = this.extractFromContext(context);
      primary.push(...contextEvidence.primary);
      secondary.push(...contextEvidence.secondary);

      // Build timeline
      timeline.push(...this.buildTimeline(context));

      // Detect environment changes
      if (context.environmentInfo) {
        environmentChanges.push(
          ...this.detectEnvironmentChanges(context.environmentInfo),
        );
      }
    }

    // Add deviation-based evidence
    const deviationEvidence = this.createDeviationEvidence(anomaly);
    if (deviationEvidence.weight >= 0.7) {
      primary.push(deviationEvidence);
    } else {
      secondary.push(deviationEvidence);
    }

    // Sort by weight
    primary.sort((a, b) => b.weight - a.weight);
    secondary.sort((a, b) => b.weight - a.weight);

    // Generate summary
    const summary = this.generateSummary(primary, secondary, timeline);

    return {
      primary,
      secondary,
      timeline,
      environmentChanges,
      summary,
    };
  }

  /**
   * Extract error information from execution context
   */
  extractErrorInfo(context: ExecutionContext): Evidence[] {
    const evidence: Evidence[] = [];

    if (context.errorMessage) {
      // Match against patterns
      for (const pattern of EVIDENCE_PATTERNS) {
        for (const regex of pattern.patterns) {
          const match = context.errorMessage.match(regex);
          if (match) {
            evidence.push({
              type: 'error_pattern',
              description: pattern.extractDescription(match[0], context),
              data: {
                category: pattern.category,
                matchedPattern: regex.source,
                fullMessage: context.errorMessage,
                stack: context.errorStack,
              },
              weight: pattern.extractWeight(match[0], context),
            });
          }
        }
      }

      // If no patterns matched, create generic error evidence
      if (evidence.length === 0) {
        evidence.push({
          type: 'error_generic',
          description: `Execution error: ${context.errorMessage.slice(0, 200)}`,
          data: {
            message: context.errorMessage,
            stack: context.errorStack,
          },
          weight: 0.5,
        });
      }
    }

    return evidence;
  }

  /**
   * Build execution timeline
   */
  buildTimeline(context: ExecutionContext): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Add start event
    events.push({
      timestamp: context.startTime,
      type: 'action',
      description: 'Test execution started',
      severity: 'info',
    });

    // Add log entries
    if (context.logs) {
      for (const log of context.logs) {
        events.push({
          timestamp: log.timestamp,
          type: 'log',
          description: log.message,
          data: { level: log.level, source: log.source },
          severity:
            log.level === 'error'
              ? 'error'
              : log.level === 'warn'
                ? 'warning'
                : 'info',
        });
      }
    }

    // Add network requests
    if (context.networkRequests) {
      for (const request of context.networkRequests) {
        const isError =
          request.error || (request.status && request.status >= 400);
        events.push({
          timestamp: request.timestamp,
          type: 'network',
          description: `${request.method} ${request.url} ${request.status || request.error || ''}`,
          data: request,
          severity: isError ? 'error' : 'info',
        });
      }
    }

    // Add error event if present
    if (context.errorMessage && context.endTime) {
      events.push({
        timestamp: context.endTime,
        type: 'error',
        description: context.errorMessage,
        data: { stack: context.errorStack },
        severity: 'error',
      });
    }

    // Add end event
    if (context.endTime) {
      events.push({
        timestamp: context.endTime,
        type: 'action',
        description: `Test execution ${context.status}`,
        severity: context.status === 'pass' ? 'info' : 'error',
      });
    }

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Collect environment information
   */
  collectEnvironmentInfo(): EnvironmentInfo {
    const info: EnvironmentInfo = {
      timestamp: Date.now(),
    };

    if (typeof navigator !== 'undefined') {
      info.userAgent = navigator.userAgent;
      info.locale = navigator.language;

      // Extract browser info from userAgent
      const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
      const firefoxMatch = navigator.userAgent.match(/Firefox\/(\d+)/);
      const safariMatch = navigator.userAgent.match(/Safari\/(\d+)/);

      if (chromeMatch) {
        info.browser = 'Chrome';
        info.browserVersion = chromeMatch[1];
      } else if (firefoxMatch) {
        info.browser = 'Firefox';
        info.browserVersion = firefoxMatch[1];
      } else if (safariMatch) {
        info.browser = 'Safari';
        info.browserVersion = safariMatch[1];
      }

      // Extract OS
      if (navigator.userAgent.includes('Windows')) {
        info.os = 'Windows';
      } else if (navigator.userAgent.includes('Mac')) {
        info.os = 'macOS';
      } else if (navigator.userAgent.includes('Linux')) {
        info.os = 'Linux';
      }
    }

    if (typeof window !== 'undefined') {
      info.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }

    if (typeof Intl !== 'undefined') {
      info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    return info;
  }

  /**
   * Correlate changes with anomaly timing
   */
  correlateChanges(
    anomalyTime: number,
    changes: ChangeInfo[],
    windowMs: number = 24 * 60 * 60 * 1000,
  ): ChangeInfo[] {
    return changes
      .filter((change) => Math.abs(change.timestamp - anomalyTime) <= windowMs)
      .sort(
        (a, b) =>
          Math.abs(a.timestamp - anomalyTime) -
          Math.abs(b.timestamp - anomalyTime),
      );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Extract evidence from anomaly description
   */
  private extractFromDescription(description: string): Evidence[] {
    const evidence: Evidence[] = [];

    for (const pattern of EVIDENCE_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(description)) {
          evidence.push({
            type: 'description_pattern',
            description: pattern.extractDescription(
              description,
              {} as ExecutionContext,
            ),
            data: {
              category: pattern.category,
              source: 'anomaly_description',
            },
            weight:
              pattern.extractWeight(description, {} as ExecutionContext) * 0.8, // Reduce weight for description-only
          });
          break; // Only one evidence per category from description
        }
      }
    }

    return evidence;
  }

  /**
   * Extract evidence from execution context
   */
  private extractFromContext(context: ExecutionContext): {
    primary: Evidence[];
    secondary: Evidence[];
  } {
    const primary: Evidence[] = [];
    const secondary: Evidence[] = [];

    // Error evidence
    const errorEvidence = this.extractErrorInfo(context);
    for (const e of errorEvidence) {
      if (e.weight >= 0.7) {
        primary.push(e);
      } else {
        secondary.push(e);
      }
    }

    // Network failure evidence
    if (context.networkRequests) {
      const failedRequests = context.networkRequests.filter(
        (r) => r.error || (r.status && r.status >= 400),
      );
      if (failedRequests.length > 0) {
        const evidence: Evidence = {
          type: 'network_failures',
          description: `${failedRequests.length} failed network request(s)`,
          data: {
            requests: failedRequests,
            category: 'network_issue',
          },
          weight: Math.min(0.8, 0.5 + failedRequests.length * 0.1),
        };
        if (evidence.weight >= 0.7) {
          primary.push(evidence);
        } else {
          secondary.push(evidence);
        }
      }
    }

    // Duration anomaly evidence
    if (context.startTime && context.endTime) {
      const duration = context.endTime - context.startTime;
      if (context.status === 'timeout' || duration > 30000) {
        primary.push({
          type: 'duration_anomaly',
          description: `Execution took ${(duration / 1000).toFixed(1)}s`,
          data: {
            duration,
            status: context.status,
            category: 'timing_issue',
          },
          weight: context.status === 'timeout' ? 0.85 : 0.6,
        });
      }
    }

    return { primary, secondary };
  }

  /**
   * Create evidence from deviation info
   */
  private createDeviationEvidence(anomaly: Anomaly): Evidence {
    const deviation = anomaly.deviation;
    const absDeviation = Math.abs(deviation);

    let category: RootCauseCategory;
    if (
      anomaly.type === 'duration_spike' ||
      anomaly.type === 'performance_degradation'
    ) {
      category = 'timing_issue';
    } else if (
      anomaly.type === 'failure_spike' ||
      anomaly.type === 'success_rate_drop'
    ) {
      category = 'code_change';
    } else if (anomaly.type === 'resource_anomaly') {
      category = 'resource_constraint';
    } else {
      category = 'data_issue';
    }

    return {
      type: 'statistical_deviation',
      description: `${absDeviation.toFixed(2)}σ deviation from baseline`,
      data: {
        deviation,
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        currentValue: anomaly.currentValue,
        expectedValue: anomaly.expectedValue,
        category,
      },
      weight: Math.min(0.9, 0.5 + absDeviation * 0.1),
    };
  }

  /**
   * Detect environment changes
   */
  private detectEnvironmentChanges(current: EnvironmentInfo): ChangeInfo[] {
    const changes: ChangeInfo[] = [];

    // In a real implementation, this would compare with stored previous environment
    // For now, we just return empty - actual comparison would be done with historical data

    return changes;
  }

  /**
   * Generate evidence summary
   */
  private generateSummary(
    primary: Evidence[],
    secondary: Evidence[],
    timeline: TimelineEvent[],
  ): string {
    const parts: string[] = [];

    if (primary.length > 0) {
      const topEvidence = primary[0];
      parts.push(`Primary evidence: ${topEvidence.description}`);
    }

    if (secondary.length > 0) {
      parts.push(`${secondary.length} supporting evidence item(s)`);
    }

    const errorEvents = timeline.filter((e) => e.severity === 'error');
    if (errorEvents.length > 0) {
      parts.push(`${errorEvents.length} error(s) in timeline`);
    }

    return parts.join('. ') || 'No significant evidence collected';
  }
}

// Export singleton instance
export const evidenceCollector = new EvidenceCollector();
