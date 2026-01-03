/**
 * Alert Manager Service
 * Manages alert rules and notifications
 */

import type {
  AlertCondition,
  AlertConditionType,
  AlertEvent,
  AlertRule,
  ExecutionRecord,
  NotificationChannel,
} from '../../types/analytics';
import { analyticsStorage } from './analyticsStorage';

/**
 * Default alert rules
 */
const DEFAULT_RULES: Omit<AlertRule, 'id' | 'createdAt'>[] = [
  {
    name: '通过率低于阈值',
    enabled: true,
    condition: {
      type: 'pass_rate',
      threshold: 70,
      timeWindow: 60, // Last hour
    },
    notification: {
      channels: ['browser'],
    },
  },
  {
    name: '连续失败预警',
    enabled: true,
    condition: {
      type: 'consecutive_failures',
      threshold: 3,
    },
    notification: {
      channels: ['browser'],
    },
  },
];

class AlertManager {
  private initialized = false;

  /**
   * Initialize alert manager with default rules
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const existingRules = await analyticsStorage.getAllAlertRules();
    if (existingRules.length === 0) {
      // Create default rules
      for (const rule of DEFAULT_RULES) {
        await this.createRule(rule);
      }
    }

    this.initialized = true;
  }

  /**
   * Create a new alert rule
   */
  async createRule(
    rule: Omit<AlertRule, 'id' | 'createdAt'>,
  ): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };

    await analyticsStorage.saveAlertRule(newRule);
    return newRule;
  }

  /**
   * Update an existing rule
   */
  async updateRule(rule: AlertRule): Promise<void> {
    await analyticsStorage.saveAlertRule(rule);
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    await analyticsStorage.deleteAlertRule(ruleId);
  }

  /**
   * Get all rules
   */
  async getAllRules(): Promise<AlertRule[]> {
    return analyticsStorage.getAllAlertRules();
  }

  /**
   * Get enabled rules
   */
  async getEnabledRules(): Promise<AlertRule[]> {
    return analyticsStorage.getEnabledAlertRules();
  }

  /**
   * Check alerts after execution
   */
  async checkAlerts(record: ExecutionRecord): Promise<AlertEvent[]> {
    const rules = await this.getEnabledRules();
    const triggeredEvents: AlertEvent[] = [];

    for (const rule of rules) {
      const result = await this.evaluateCondition(rule.condition, record);
      if (result.triggered) {
        const event = await this.createAlertEvent(rule, result.currentValue);
        triggeredEvents.push(event);

        // Send notifications
        await this.sendNotifications(rule, event);

        // Update rule's lastTriggered
        rule.lastTriggered = Date.now();
        await this.updateRule(rule);
      }
    }

    return triggeredEvents;
  }

  /**
   * Evaluate alert condition
   */
  private async evaluateCondition(
    condition: AlertCondition,
    record: ExecutionRecord,
  ): Promise<{ triggered: boolean; currentValue: number }> {
    switch (condition.type) {
      case 'pass_rate':
        return this.evaluatePassRate(condition);

      case 'consecutive_failures':
        return this.evaluateConsecutiveFailures(condition, record);

      case 'duration':
        return this.evaluateDuration(condition, record);

      case 'flaky_detected':
        return this.evaluateFlakyDetected(condition, record);

      default:
        return { triggered: false, currentValue: 0 };
    }
  }

  /**
   * Evaluate pass rate condition
   */
  private async evaluatePassRate(
    condition: AlertCondition,
  ): Promise<{ triggered: boolean; currentValue: number }> {
    const timeWindow = condition.timeWindow || 60;
    const startTime = Date.now() - timeWindow * 60 * 1000;
    const endTime = Date.now();

    const executions = await analyticsStorage.getExecutionsByTimeRange(
      startTime,
      endTime,
    );

    if (executions.length === 0) {
      return { triggered: false, currentValue: 100 };
    }

    const passed = executions.filter((e) => e.status === 'passed').length;
    const passRate = (passed / executions.length) * 100;

    return {
      triggered: passRate < condition.threshold,
      currentValue: passRate,
    };
  }

  /**
   * Evaluate consecutive failures condition
   */
  private async evaluateConsecutiveFailures(
    condition: AlertCondition,
    record: ExecutionRecord,
  ): Promise<{ triggered: boolean; currentValue: number }> {
    if (record.status === 'passed') {
      return { triggered: false, currentValue: 0 };
    }

    const caseExecutions = await analyticsStorage.getExecutionsByCaseId(
      record.caseId,
    );

    // Count consecutive failures from most recent
    let consecutiveFailures = 0;
    for (const exec of caseExecutions) {
      if (exec.status === 'failed' || exec.status === 'error') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    return {
      triggered: consecutiveFailures >= condition.threshold,
      currentValue: consecutiveFailures,
    };
  }

  /**
   * Evaluate duration condition
   */
  private async evaluateDuration(
    condition: AlertCondition,
    record: ExecutionRecord,
  ): Promise<{ triggered: boolean; currentValue: number }> {
    const caseStats = await analyticsStorage.getCaseStats(record.caseId);

    if (!caseStats || caseStats.totalRuns < 5) {
      return { triggered: false, currentValue: record.duration };
    }

    // Check if duration exceeds average by threshold percentage
    const avgDuration = caseStats.avgDuration;
    const thresholdMs = avgDuration * (1 + condition.threshold / 100);

    return {
      triggered: record.duration > thresholdMs,
      currentValue: record.duration,
    };
  }

  /**
   * Evaluate flaky detected condition
   */
  private async evaluateFlakyDetected(
    condition: AlertCondition,
    record: ExecutionRecord,
  ): Promise<{ triggered: boolean; currentValue: number }> {
    const caseStats = await analyticsStorage.getCaseStats(record.caseId);

    if (!caseStats) {
      return { triggered: false, currentValue: 0 };
    }

    // Check if case is newly flaky (wasn't flaky before but is now)
    const wasFlaky = caseStats.isFlaky;

    // Recalculate flakiness
    const results = caseStats.recentResults;
    if (results.length < 5) {
      return { triggered: false, currentValue: 0 };
    }

    const failCount = results.filter((r) => r === 'failed').length;
    const failRate = failCount / results.length;
    const isFlaky = failRate > 0.2 && failRate < 0.8;

    return {
      triggered: isFlaky && !wasFlaky,
      currentValue: failRate * 100,
    };
  }

  /**
   * Create alert event
   */
  private async createAlertEvent(
    rule: AlertRule,
    currentValue: number,
  ): Promise<AlertEvent> {
    const message = this.generateAlertMessage(rule, currentValue);

    const event: AlertEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      triggeredAt: Date.now(),
      condition: rule.condition,
      currentValue,
      message,
      acknowledged: false,
    };

    await analyticsStorage.addAlertEvent(event);
    return event;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, currentValue: number): string {
    switch (rule.condition.type) {
      case 'pass_rate':
        return `通过率 (${currentValue.toFixed(1)}%) 低于阈值 ${rule.condition.threshold}%`;

      case 'consecutive_failures':
        return `连续失败 ${currentValue} 次，超过阈值 ${rule.condition.threshold} 次`;

      case 'duration':
        return `执行时长 ${this.formatDuration(currentValue)} 超过预期`;

      case 'flaky_detected':
        return `检测到新的 Flaky 测试，失败率 ${currentValue.toFixed(1)}%`;

      default:
        return `告警规则 "${rule.name}" 被触发`;
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    rule: AlertRule,
    event: AlertEvent,
  ): Promise<void> {
    const { channels } = rule.notification;

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'browser':
            await this.sendBrowserNotification(event);
            break;

          case 'webhook':
            if (rule.notification.webhookUrl) {
              await this.sendWebhookNotification(
                rule.notification.webhookUrl,
                event,
              );
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel}:`, error);
      }
    }
  }

  /**
   * Send browser notification
   */
  private async sendBrowserNotification(event: AlertEvent): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('测试告警', {
        body: event.message,
        icon: '/icons/icon48.png',
        tag: event.id,
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('测试告警', {
          body: event.message,
          icon: '/icons/icon48.png',
          tag: event.id,
        });
      }
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    url: string,
    event: AlertEvent,
  ): Promise<void> {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'test_alert',
          event: {
            id: event.id,
            ruleName: event.ruleName,
            message: event.message,
            triggeredAt: event.triggeredAt,
            condition: event.condition,
            currentValue: event.currentValue,
          },
        }),
      });
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }

  /**
   * Get recent alert events
   */
  async getRecentEvents(limit = 20): Promise<AlertEvent[]> {
    return analyticsStorage.getRecentAlertEvents(limit);
  }

  /**
   * Acknowledge an alert event
   */
  async acknowledgeEvent(eventId: string): Promise<void> {
    await analyticsStorage.acknowledgeAlertEvent(eventId);
  }

  /**
   * Get unacknowledged events count
   */
  async getUnacknowledgedCount(): Promise<number> {
    const events = await analyticsStorage.getRecentAlertEvents(100);
    return events.filter((e) => !e.acknowledged).length;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}

export const alertManager = new AlertManager();
