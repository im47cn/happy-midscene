/**
 * input: Anomaly events, health scores, root cause analysis
 * output: Alerts with deduplication, convergence, and notification
 * pos: Alert integration layer for anomaly notification system
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Anomaly,
  AnomalyAlert,
  AlertLevel,
  AnomalyType,
  Severity,
  RootCause,
  HealthScore,
} from '../../types/anomaly';
import { anomalyStorage } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface AlertConfig {
  enabled: boolean;
  minSeverity: Severity;
  deduplicationWindow: number; // ms - window for deduplication
  convergenceWindow: number; // ms - window for alert convergence
  maxAlertsPerWindow: number; // max alerts before convergence
  cooldownPeriod: number; // ms - cooldown after convergence
}

export interface AlertTemplate {
  type: AnomalyType;
  titleTemplate: string;
  messageTemplate: string;
  levelMapping: Record<Severity, AlertLevel>;
  includeRootCause: boolean;
  includeSuggestions: boolean;
}

export interface AlertNotification {
  alert: AnomalyAlert;
  shouldNotify: boolean;
  reason?: string;
  convergedCount?: number;
}

export interface AlertStats {
  total: number;
  byLevel: Record<AlertLevel, number>;
  byType: Record<string, number>;
  acknowledged: number;
  pending: number;
  recentConverged: number;
}

export interface ConvergenceGroup {
  key: string;
  alerts: AnomalyAlert[];
  firstSeen: number;
  lastSeen: number;
  count: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  minSeverity: 'warning',
  deduplicationWindow: 5 * 60 * 1000, // 5 minutes
  convergenceWindow: 15 * 60 * 1000, // 15 minutes
  maxAlertsPerWindow: 5,
  cooldownPeriod: 30 * 60 * 1000, // 30 minutes
};

const SEVERITY_TO_LEVEL: Record<Severity, AlertLevel> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical',
  emergency: 'emergency',
};

const SEVERITY_PRIORITY: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
};

// ============================================================================
// Alert Templates
// ============================================================================

const ALERT_TEMPLATES: Record<AnomalyType, AlertTemplate> = {
  pass_rate_drop: {
    type: 'pass_rate_drop',
    titleTemplate: 'Pass Rate Drop Detected',
    messageTemplate: 'Pass rate dropped to {value}% (baseline: {baseline}%). {deviation}% below normal.',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    },
    includeRootCause: true,
    includeSuggestions: true,
  },
  duration_spike: {
    type: 'duration_spike',
    titleTemplate: 'Duration Spike Detected',
    messageTemplate: 'Execution time spiked to {value}ms (baseline: {baseline}ms). {deviation}% above normal.',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    },
    includeRootCause: true,
    includeSuggestions: true,
  },
  consecutive_failures: {
    type: 'consecutive_failures',
    titleTemplate: 'Consecutive Failures Alert',
    messageTemplate: '{value} consecutive test failures detected. Immediate attention required.',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    },
    includeRootCause: true,
    includeSuggestions: true,
  },
  flaky_detected: {
    type: 'flaky_detected',
    titleTemplate: 'Flaky Test Detected',
    messageTemplate: 'Test "{caseName}" shows flaky behavior. Pass rate: {value}%.',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'warning',
      emergency: 'critical',
    },
    includeRootCause: false,
    includeSuggestions: true,
  },
  resource_anomaly: {
    type: 'resource_anomaly',
    titleTemplate: 'Resource Anomaly Detected',
    messageTemplate: 'Unusual resource consumption: {metricName} at {value} ({deviation}% deviation).',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    },
    includeRootCause: true,
    includeSuggestions: true,
  },
  pattern_break: {
    type: 'pattern_break',
    titleTemplate: 'Pattern Break Detected',
    messageTemplate: 'Established pattern broken for {metricName}. Current: {value}, Expected: {baseline}.',
    levelMapping: {
      info: 'info',
      warning: 'warning',
      critical: 'critical',
      emergency: 'emergency',
    },
    includeRootCause: true,
    includeSuggestions: true,
  },
};

// ============================================================================
// Alert Trigger Class
// ============================================================================

class AlertTrigger {
  private config: AlertConfig;
  private recentAlerts: Map<string, AnomalyAlert[]> = new Map();
  private convergenceGroups: Map<string, ConvergenceGroup> = new Map();
  private cooldownUntil: Map<string, number> = new Map();
  private idCounter = 0;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
  }

  /**
   * Trigger alert from anomaly
   */
  async triggerFromAnomaly(anomaly: Anomaly): Promise<AlertNotification> {
    if (!this.config.enabled) {
      return {
        alert: this.createAlert(anomaly),
        shouldNotify: false,
        reason: 'Alerts disabled',
      };
    }

    // Check minimum severity
    if (SEVERITY_PRIORITY[anomaly.severity] < SEVERITY_PRIORITY[this.config.minSeverity]) {
      return {
        alert: this.createAlert(anomaly),
        shouldNotify: false,
        reason: `Severity ${anomaly.severity} below threshold ${this.config.minSeverity}`,
      };
    }

    const alert = this.createAlert(anomaly);

    // Check deduplication
    const dedupResult = this.checkDeduplication(alert);
    if (dedupResult.isDuplicate) {
      return {
        alert,
        shouldNotify: false,
        reason: `Duplicate alert (${dedupResult.reason})`,
      };
    }

    // Check convergence
    const convergenceResult = this.checkConvergence(alert);
    if (convergenceResult.shouldConverge) {
      return {
        alert,
        shouldNotify: false,
        reason: 'Alert converged',
        convergedCount: convergenceResult.count,
      };
    }

    // Check cooldown
    const cooldownResult = this.checkCooldown(alert);
    if (cooldownResult.inCooldown) {
      return {
        alert,
        shouldNotify: false,
        reason: `In cooldown (${cooldownResult.remainingMs}ms remaining)`,
      };
    }

    // Track alert
    this.trackAlert(alert);

    return {
      alert,
      shouldNotify: true,
    };
  }

  /**
   * Trigger alert from health score drop
   */
  async triggerFromHealthScore(
    current: HealthScore,
    previous: HealthScore | null
  ): Promise<AlertNotification | null> {
    if (!this.config.enabled || !previous) {
      return null;
    }

    const drop = previous.overall - current.overall;
    if (drop < 10) {
      return null; // Not significant enough
    }

    // Create synthetic anomaly for health score drop
    const alert: AnomalyAlert = {
      id: this.generateId(),
      anomalyId: `health-score-${current.calculatedAt}`,
      level: drop >= 20 ? 'critical' : 'warning',
      title: 'Health Score Dropped',
      message: `Overall health score dropped from ${previous.overall} to ${current.overall} (${drop.toFixed(1)}% decrease). ${current.recommendations[0] || ''}`,
      createdAt: Date.now(),
      acknowledged: false,
    };

    // Apply deduplication and convergence
    const dedupResult = this.checkDeduplication(alert);
    if (dedupResult.isDuplicate) {
      return { alert, shouldNotify: false, reason: 'Duplicate' };
    }

    this.trackAlert(alert);
    return { alert, shouldNotify: true };
  }

  /**
   * Get pending alerts (not acknowledged)
   */
  async getPendingAlerts(): Promise<AnomalyAlert[]> {
    const allAlerts: AnomalyAlert[] = [];
    for (const alerts of this.recentAlerts.values()) {
      allAlerts.push(...alerts.filter((a) => !a.acknowledged));
    }
    return allAlerts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    for (const alerts of this.recentAlerts.values()) {
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        return true;
      }
    }
    return false;
  }

  /**
   * Acknowledge all pending alerts
   */
  async acknowledgeAll(): Promise<number> {
    let count = 0;
    for (const alerts of this.recentAlerts.values()) {
      for (const alert of alerts) {
        if (!alert.acknowledged) {
          alert.acknowledged = true;
          alert.acknowledgedAt = Date.now();
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Get alert statistics
   */
  getStats(): AlertStats {
    const stats: AlertStats = {
      total: 0,
      byLevel: { info: 0, warning: 0, critical: 0, emergency: 0 },
      byType: {},
      acknowledged: 0,
      pending: 0,
      recentConverged: 0,
    };

    for (const alerts of this.recentAlerts.values()) {
      stats.total += alerts.length;
      for (const alert of alerts) {
        stats.byLevel[alert.level]++;
        const type = alert.title.split(' ')[0]; // Extract type from title
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        if (alert.acknowledged) {
          stats.acknowledged++;
        } else {
          stats.pending++;
        }
      }
    }

    for (const group of this.convergenceGroups.values()) {
      if (group.count > 1) {
        stats.recentConverged += group.count - 1;
      }
    }

    return stats;
  }

  /**
   * Get convergence summary
   */
  getConvergenceSummary(): ConvergenceGroup[] {
    return Array.from(this.convergenceGroups.values())
      .filter((g) => g.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Clear old alerts and reset state
   */
  cleanup(): void {
    const now = Date.now();

    // Clear old alerts
    for (const [key, alerts] of this.recentAlerts.entries()) {
      const recent = alerts.filter(
        (a) => now - a.createdAt < this.config.deduplicationWindow * 2
      );
      if (recent.length === 0) {
        this.recentAlerts.delete(key);
      } else {
        this.recentAlerts.set(key, recent);
      }
    }

    // Clear old convergence groups
    for (const [key, group] of this.convergenceGroups.entries()) {
      if (now - group.lastSeen > this.config.convergenceWindow) {
        this.convergenceGroups.delete(key);
      }
    }

    // Clear expired cooldowns
    for (const [key, until] of this.cooldownUntil.entries()) {
      if (now > until) {
        this.cooldownUntil.delete(key);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createAlert(anomaly: Anomaly): AnomalyAlert {
    const template = ALERT_TEMPLATES[anomaly.type];
    const level = template.levelMapping[anomaly.severity];

    let message = this.formatMessage(template.messageTemplate, anomaly);

    // Add root cause summary if available
    if (template.includeRootCause && anomaly.rootCauses.length > 0) {
      const rootCauseSummary = this.formatRootCauses(anomaly.rootCauses);
      message += `\n\nRoot Causes:\n${rootCauseSummary}`;
    }

    // Add suggestions
    if (template.includeSuggestions && anomaly.rootCauses.length > 0) {
      const suggestions = this.formatSuggestions(anomaly.rootCauses);
      if (suggestions) {
        message += `\n\nSuggested Actions:\n${suggestions}`;
      }
    }

    return {
      id: this.generateId(),
      anomalyId: anomaly.id,
      level,
      title: template.titleTemplate,
      message,
      createdAt: Date.now(),
      acknowledged: false,
    };
  }

  private formatMessage(template: string, anomaly: Anomaly): string {
    return template
      .replace('{value}', anomaly.metric.currentValue.toFixed(2))
      .replace('{baseline}', anomaly.baseline.mean.toFixed(2))
      .replace('{deviation}', anomaly.deviation.percentageDeviation.toFixed(1))
      .replace('{metricName}', anomaly.metric.name)
      .replace('{caseName}', anomaly.impact.affectedCases[0] || 'Unknown');
  }

  private formatRootCauses(rootCauses: RootCause[]): string {
    return rootCauses
      .slice(0, 3) // Top 3
      .map((rc, i) => `${i + 1}. [${rc.category}] ${rc.description} (${(rc.confidence * 100).toFixed(0)}% confidence)`)
      .join('\n');
  }

  private formatSuggestions(rootCauses: RootCause[]): string {
    const allSuggestions = rootCauses.flatMap((rc) => rc.suggestions);
    const unique = [...new Set(allSuggestions.map((s) => s.action))];
    return unique.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n');
  }

  private getDeduplicationKey(alert: AnomalyAlert): string {
    // Create key from title and anomaly ID prefix
    const anomalyPrefix = alert.anomalyId.split('-').slice(0, 2).join('-');
    return `${alert.title}:${anomalyPrefix}`;
  }

  private getConvergenceKey(alert: AnomalyAlert): string {
    // Group by title/type
    return alert.title;
  }

  private checkDeduplication(alert: AnomalyAlert): { isDuplicate: boolean; reason?: string } {
    const key = this.getDeduplicationKey(alert);
    const existing = this.recentAlerts.get(key) || [];
    const now = Date.now();

    // Check for recent duplicate
    const recent = existing.find(
      (a) => now - a.createdAt < this.config.deduplicationWindow
    );

    if (recent) {
      return {
        isDuplicate: true,
        reason: `Same alert within ${this.config.deduplicationWindow / 1000}s`,
      };
    }

    return { isDuplicate: false };
  }

  private checkConvergence(alert: AnomalyAlert): { shouldConverge: boolean; count: number } {
    const key = this.getConvergenceKey(alert);
    const now = Date.now();

    let group = this.convergenceGroups.get(key);
    if (!group || now - group.lastSeen > this.config.convergenceWindow) {
      // Start new group
      group = {
        key,
        alerts: [alert],
        firstSeen: now,
        lastSeen: now,
        count: 1,
      };
      this.convergenceGroups.set(key, group);
      return { shouldConverge: false, count: 1 };
    }

    // Update existing group
    group.alerts.push(alert);
    group.lastSeen = now;
    group.count++;

    if (group.count > this.config.maxAlertsPerWindow) {
      // Start cooldown
      this.cooldownUntil.set(key, now + this.config.cooldownPeriod);
      return { shouldConverge: true, count: group.count };
    }

    return { shouldConverge: false, count: group.count };
  }

  private checkCooldown(alert: AnomalyAlert): { inCooldown: boolean; remainingMs: number } {
    const key = this.getConvergenceKey(alert);
    const cooldownEnd = this.cooldownUntil.get(key);
    const now = Date.now();

    if (cooldownEnd && now < cooldownEnd) {
      return { inCooldown: true, remainingMs: cooldownEnd - now };
    }

    return { inCooldown: false, remainingMs: 0 };
  }

  private trackAlert(alert: AnomalyAlert): void {
    const key = this.getDeduplicationKey(alert);
    const existing = this.recentAlerts.get(key) || [];
    existing.push(alert);
    this.recentAlerts.set(key, existing);
  }

  private generateId(): string {
    return `alert-${Date.now()}-${++this.idCounter}`;
  }
}

// ============================================================================
// Factory and Singleton
// ============================================================================

let alertTriggerInstance: AlertTrigger | null = null;

export function getAlertTrigger(config?: Partial<AlertConfig>): AlertTrigger {
  if (!alertTriggerInstance) {
    alertTriggerInstance = new AlertTrigger(config);
  } else if (config) {
    alertTriggerInstance.updateConfig(config);
  }
  return alertTriggerInstance;
}

// Export singleton instance with default config
export const alertTrigger = getAlertTrigger();

// Export template access
export function getAlertTemplate(type: AnomalyType): AlertTemplate {
  return { ...ALERT_TEMPLATES[type] };
}

export function getAllAlertTemplates(): Record<AnomalyType, AlertTemplate> {
  return { ...ALERT_TEMPLATES };
}
