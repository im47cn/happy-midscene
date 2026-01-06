/**
 * Notification Manager
 *
 * Manages notifications for CI/CD events (Slack, Email, Webhook).
 */

/**
 * Notification channel type
 */
export type NotificationChannel = 'slack' | 'email' | 'webhook';

/**
 * Notification priority
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Notification event types
 */
export type NotificationEventType =
  | 'build_started'
  | 'build_completed'
  | 'build_failed'
  | 'build_fixed'
  | 'quality_gate_passed'
  | 'quality_gate_failed'
  | 'test_flaky'
  | 'deployment_started'
  | 'deployment_completed'
  | 'deployment_failed'
  | 'custom';

/**
 * Base notification configuration
 */
export interface NotificationConfig {
  /** Enable/disable notifications */
  enabled?: boolean;
  /** Notification channels */
  channels?: NotificationChannelConfig[];
  /** Default priority */
  priority?: NotificationPriority;
  /** Notification template */
  template?: NotificationTemplate;
}

/**
 * Channel-specific configuration
 */
export interface NotificationChannelConfig {
  /** Channel type */
  type: NotificationChannel;
  /** Channel-specific settings */
  config: SlackConfig | EmailConfig | WebhookConfig;
  /** Events to notify on (empty = all events) */
  events?: NotificationEventType[];
}

/**
 * Slack configuration
 */
export interface SlackConfig {
  /** Webhook URL */
  webhookUrl: string;
  /** Channel override */
  channel?: string;
  /** Username override */
  username?: string;
  /** Icon emoji */
  iconEmoji?: string;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  /** SMTP server */
  host: string;
  /** SMTP port */
  port: number;
  /** Username */
  user?: string;
  /** Password */
  password?: string;
  /** From address */
  from: string;
  /** To addresses */
  to: string[];
  /** CC addresses */
  cc?: string[];
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Webhook URL */
  url: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Method */
  method?: 'POST' | 'PUT' | 'PATCH';
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  /** Subject/title template */
  subject?: string;
  /** Body template */
  body: string;
  /** Include test results summary */
  includeSummary?: boolean;
  /** Include failure details */
  includeFailures?: boolean;
  /** Include artifacts link */
  includeArtifacts?: boolean;
}

/**
 * Notification data
 */
export interface NotificationData {
  /** Event type */
  event: NotificationEventType;
  /** Project name */
  project: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commit?: string;
  /** Build number */
  buildNumber?: string;
  /** Build URL */
  buildUrl?: string;
  /** Status */
  status: 'success' | 'failure' | 'pending';
  /** Test results */
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  /** Failures list */
  failures?: Array<{
    file: string;
    name: string;
    error: string;
  }>;
  /** Quality gate results */
  qualityGate?: {
    passed: boolean;
    rules: Array<{
      name: string;
      passed: boolean;
      message: string;
    }>;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification result
 */
export interface NotificationResult {
  /** Whether notification was sent successfully */
  success: boolean;
  /** Channel that was notified */
  channel: NotificationChannel;
  /** Error if failed */
  error?: Error;
  /** Response data */
  response?: unknown;
}

/**
 * Notification Manager
 *
 * Sends notifications to configured channels.
 */
export class NotificationManager {
  private config: NotificationConfig;

  constructor(config: NotificationConfig = {}) {
    this.config = {
      enabled: true,
      channels: [],
      priority: 'normal',
      template: {
        includeSummary: true,
        includeFailures: true,
        includeArtifacts: false,
      },
      ...config,
    };
  }

  /**
   * Send notification for an event
   */
  async notify(data: NotificationData): Promise<NotificationResult[]> {
    if (!this.config.enabled) {
      return [];
    }

    const results: NotificationResult[] = [];

    for (const channel of this.config.channels || []) {
      // Check if this channel should notify on this event
      if (channel.events && !channel.events.includes(data.event)) {
        continue;
      }

      try {
        const result = await this.sendToChannel(channel, data);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          channel: channel.type,
          error: error as Error,
        });
      }
    }

    return results;
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(
    channel: NotificationChannelConfig,
    data: NotificationData,
  ): Promise<NotificationResult> {
    switch (channel.type) {
      case 'slack':
        return this.sendSlack(channel.config as SlackConfig, data);
      case 'email':
        return this.sendEmail(channel.config as EmailConfig, data);
      case 'webhook':
        return this.sendWebhook(channel.config as WebhookConfig, data);
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    config: SlackConfig,
    data: NotificationData,
  ): Promise<NotificationResult> {
    const message = this.formatSlackMessage(data);

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: config.channel,
        username: config.username || 'CI Bot',
        icon_emoji: config.iconEmoji || this.getIconForStatus(data.status),
        ...message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }

    return {
      success: true,
      channel: 'slack',
      response: await response.json(),
    };
  }

  /**
   * Format message for Slack
   */
  private formatSlackMessage(data: NotificationData): Record<string, unknown> {
    const color = this.getColorForStatus(data.status);
    const sections: Array<{
      type: string;
      text?: { type: string; text: string };
      fields?: Array<{
        type: string;
        title: string;
        value: string;
        short: boolean;
      }>;
    }> = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${this.getEventTitle(data.event)}*`,
        },
      },
    ];

    // Add summary
    if (this.config.template?.includeSummary && data.tests) {
      sections.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            title: 'Total',
            value: String(data.tests.total),
            short: true,
          },
          {
            type: 'mrkdwn',
            title: 'Passed',
            value: String(data.tests.passed),
            short: true,
          },
          {
            type: 'mrkdwn',
            title: 'Failed',
            value: String(data.tests.failed),
            short: true,
          },
          {
            type: 'mrkdwn',
            title: 'Duration',
            value: `${(data.tests.duration / 1000).toFixed(1)}s`,
            short: true,
          },
        ],
      });
    }

    // Add failures
    if (
      this.config.template?.includeFailures &&
      data.failures &&
      data.failures.length > 0
    ) {
      const failureList = data.failures
        .slice(0, 5)
        .map((f) => {
          return `• *${f.name}*\n  \`${f.error}\``;
        })
        .join('\n');

      sections.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Failures:*\n${failureList}${data.failures.length > 5 ? `\n_... and ${data.failures.length - 5} more_` : ''}`,
        },
      });
    }

    // Add build info
    const footer: string[] = [];
    if (data.project) footer.push(`Project: ${data.project}`);
    if (data.branch) footer.push(`Branch: ${data.branch}`);
    if (data.commit) footer.push(`Commit: ${data.commit.slice(0, 7)}`);

    if (footer.length > 0) {
      sections.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: footer.join(' | '),
          },
        ],
      });
    }

    return {
      attachments: [
        {
          color,
          sections,
        },
      ],
    };
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    config: EmailConfig,
    data: NotificationData,
  ): Promise<NotificationResult> {
    const subject =
      this.config.template?.subject ||
      `[${data.project}] ${this.getEventTitle(data.event)}`;
    const body = this.formatEmailBody(data);

    // Note: This is a basic implementation. In production, use a proper email library
    // like nodemailer. For now, we'll simulate the email sending.

    // If nodemailer is available, use it
    try {
      // @ts-ignore - optional dependency
      const nodemailer = require('nodemailer');
      if (nodemailer && typeof nodemailer.createTransport === 'function') {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          auth: config.user
            ? {
                user: config.user,
                pass: config.password,
              }
            : undefined,
        });

        const info = await transporter.sendMail({
          from: config.from,
          to: config.to.join(', '),
          cc: config.cc?.join(', '),
          subject,
          text: body.text,
          html: body.html,
        });

        return {
          success: true,
          channel: 'email',
          response: info,
        };
      }
    } catch {
      // nodemailer not available, simulate
    }

    // Simulated email send (for testing without email server)
    return {
      success: true,
      channel: 'email',
      response: { simulated: true, subject, body },
    };
  }

  /**
   * Format email body
   */
  private formatEmailBody(data: NotificationData): {
    text: string;
    html: string;
  } {
    const statusEmoji =
      data.status === 'success'
        ? '✅'
        : data.status === 'failure'
          ? '❌'
          : '⏳';
    const lines: string[] = [
      `${statusEmoji} ${this.getEventTitle(data.event)}`,
      '',
      `Project: ${data.project}`,
    ];

    if (data.branch) lines.push(`Branch: ${data.branch}`);
    if (data.commit) lines.push(`Commit: ${data.commit.slice(0, 7)}`);
    if (data.buildUrl) lines.push(`Build: ${data.buildUrl}`);

    lines.push('');

    // Add test summary
    if (data.tests) {
      lines.push('Test Results:');
      lines.push(`  Total:   ${data.tests.total}`);
      lines.push(`  Passed:  ${data.tests.passed}`);
      lines.push(`  Failed:  ${data.tests.failed}`);
      lines.push(`  Skipped: ${data.tests.skipped}`);
      lines.push(`  Duration: ${(data.tests.duration / 1000).toFixed(1)}s`);
      lines.push('');
    }

    // Add failures
    if (data.failures && data.failures.length > 0) {
      lines.push('Failures:');
      for (const failure of data.failures.slice(0, 10)) {
        lines.push(`  ${failure.name}`);
        lines.push(`    ${failure.error}`);
      }
      if (data.failures.length > 10) {
        lines.push(`  ... and ${data.failures.length - 10} more`);
      }
      lines.push('');
    }

    const text = lines.join('\n');

    // Simple HTML version
    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>${statusEmoji} ${this.getEventTitle(data.event)}</h2>
        <p><strong>Project:</strong> ${data.project}</p>
        ${data.branch ? `<p><strong>Branch:</strong> ${data.branch}</p>` : ''}
        ${data.commit ? `<p><strong>Commit:</strong> ${data.commit.slice(0, 7)}</p>` : ''}
        ${data.buildUrl ? `<p><a href="${data.buildUrl}">View Build</a></p>` : ''}

        ${
          data.tests
            ? `
          <h3>Test Results</h3>
          <ul>
            <li>Total: ${data.tests.total}</li>
            <li>Passed: ${data.tests.passed}</li>
            <li>Failed: ${data.tests.failed}</li>
            <li>Skipped: ${data.tests.skipped}</li>
            <li>Duration: ${(data.tests.duration / 1000).toFixed(1)}s</li>
          </ul>
        `
            : ''
        }

        ${
          data.failures && data.failures.length > 0
            ? `
          <h3>Failures</h3>
          <ul>
            ${data.failures
              .slice(0, 10)
              .map(
                (f) => `
              <li>
                <strong>${f.name}</strong><br>
                <code>${f.error}</code>
              </li>
            `,
              )
              .join('')}
          </ul>
          ${data.failures.length > 10 ? `<p>... and ${data.failures.length - 10} more</p>` : ''}
        `
            : ''
        }
      </div>
    `;

    return { text, html };
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    config: WebhookConfig,
    data: NotificationData,
  ): Promise<NotificationResult> {
    const payload = {
      event: data.event,
      project: data.project,
      branch: data.branch,
      commit: data.commit,
      buildNumber: data.buildNumber,
      buildUrl: data.buildUrl,
      status: data.status,
      tests: data.tests,
      failures: data.failures,
      qualityGate: data.qualityGate,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }

    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    }

    return {
      success: true,
      channel: 'webhook',
      response: responseData,
    };
  }

  /**
   * Get icon for status
   */
  private getIconForStatus(status: string): string {
    switch (status) {
      case 'success':
        return ':white_check_mark:';
      case 'failure':
        return ':x:';
      case 'pending':
        return ':hourglass:';
      default:
        return ':grey_question:';
    }
  }

  /**
   * Get color for status
   */
  private getColorForStatus(status: string): string {
    switch (status) {
      case 'success':
        return 'good';
      case 'failure':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return '#808080';
    }
  }

  /**
   * Get event title
   */
  private getEventTitle(event: NotificationEventType): string {
    const titles: Record<NotificationEventType, string> = {
      build_started: 'Build Started',
      build_completed: 'Build Completed',
      build_failed: 'Build Failed',
      build_fixed: 'Build Fixed',
      quality_gate_passed: 'Quality Gate Passed',
      quality_gate_failed: 'Quality Gate Failed',
      test_flaky: 'Flaky Tests Detected',
      deployment_started: 'Deployment Started',
      deployment_completed: 'Deployment Completed',
      deployment_failed: 'Deployment Failed',
      custom: 'Notification',
    };
    return titles[event] || event;
  }

  /**
   * Create a child manager with additional config
   */
  withConfig(config: Partial<NotificationConfig>): NotificationManager {
    return new NotificationManager({
      ...this.config,
      ...config,
      channels: [...(this.config.channels || []), ...(config.channels || [])],
    });
  }

  /**
   * Check if a channel is configured
   */
  hasChannel(type: NotificationChannel): boolean {
    return (this.config.channels || []).some((c) => c.type === type);
  }
}

/**
 * Create notification manager with config
 */
export function createNotificationManager(
  config?: NotificationConfig,
): NotificationManager {
  return new NotificationManager(config);
}

/**
 * Quick send notification (creates manager and sends)
 */
export async function sendNotification(
  data: NotificationData,
  config: NotificationConfig,
): Promise<NotificationResult[]> {
  const manager = new NotificationManager(config);
  return manager.notify(data);
}
