/**
 * Message Templates
 *
 * Pre-built notification templates for common CI/CD scenarios.
 */

import type {
  NotificationData,
  NotificationTemplate,
} from './notificationManager';

/**
 * Template context data
 */
export interface TemplateContext {
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
  /** Test results */
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  /** Failures */
  failures?: Array<{
    file: string;
    name: string;
    error: string;
  }>;
}

/**
 * Message template with format variants
 */
export interface MessageTemplate {
  /** Plain text format */
  text: (context: TemplateContext) => string;
  /** Markdown format */
  markdown: (context: TemplateContext) => string;
  /** HTML format */
  html: (context: TemplateContext) => string;
  /** Slack-specific format */
  slack?: (context: TemplateContext) => Record<string, unknown>;
}

/**
 * Build notification templates
 */
export const BuildTemplates = {
  /**
   * Build started notification
   */
  started: {
    text: (ctx: TemplateContext): string => {
      return `Build #${ctx.buildNumber || '?'} started for ${ctx.project}${ctx.branch ? ` on ${ctx.branch}` : ''}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## Build Started\n\n**Project:** ${ctx.project}\n**Build:** #${ctx.buildNumber || '?'}\n${ctx.branch ? `**Branch:** ${ctx.branch}\n` : ''}${ctx.commit ? `**Commit:** \`${ctx.commit.slice(0, 7)}\`\n` : ''}`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>Build Started</h2><p><strong>Project:</strong> ${ctx.project}</p><p><strong>Build:</strong> #${ctx.buildNumber || '?'}</p>${ctx.branch ? `<p><strong>Branch:</strong> ${ctx.branch}</p>` : ''}${ctx.commit ? `<p><strong>Commit:</strong> <code>${ctx.commit.slice(0, 7)}</code></p>` : ''}`;
    },
  } as MessageTemplate,

  /**
   * Build completed successfully
   */
  success: {
    text: (ctx: TemplateContext): string => {
      const lines: string[] = [
        `✅ Build #${ctx.buildNumber || '?'} passed for ${ctx.project}`,
      ];
      if (ctx.tests) {
        lines.push(
          `  Tests: ${ctx.tests.passed}/${ctx.tests.total} passed in ${(ctx.tests.duration / 1000).toFixed(1)}s`,
        );
      }
      return lines.join('\n');
    },
    markdown: (ctx: TemplateContext): string => {
      let md = `## ✅ Build Passed\n\n**Project:** ${ctx.project}\n**Build:** #${ctx.buildNumber || '?'}\n`;
      if (ctx.tests) {
        md += `\n### Test Results\n- Total: ${ctx.tests.total}\n- Passed: ${ctx.tests.passed}\n- Failed: ${ctx.tests.failed}\n- Skipped: ${ctx.tests.skipped}\n- Duration: ${(ctx.tests.duration / 1000).toFixed(1)}s\n`;
      }
      return md;
    },
    html: (ctx: TemplateContext): string => {
      let html = `<h2>✅ Build Passed</h2><p><strong>Project:</strong> ${ctx.project}</p><p><strong>Build:</strong> #${ctx.buildNumber || '?'}</p>`;
      if (ctx.tests) {
        html += `<h3>Test Results</h3><ul><li>Total: ${ctx.tests.total}</li><li>Passed: ${ctx.tests.passed}</li><li>Failed: ${ctx.tests.failed}</li><li>Skipped: ${ctx.tests.skipped}</li><li>Duration: ${(ctx.tests.duration / 1000).toFixed(1)}s</li></ul>`;
      }
      return html;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `✅ Build #${ctx.buildNumber || '?'} passed for ${ctx.project}`,
        attachments: [
          {
            color: 'good',
            fields: ctx.tests
              ? [
                  {
                    title: 'Total',
                    value: String(ctx.tests.total),
                    short: true,
                  },
                  {
                    title: 'Passed',
                    value: String(ctx.tests.passed),
                    short: true,
                  },
                  {
                    title: 'Duration',
                    value: `${(ctx.tests.duration / 1000).toFixed(1)}s`,
                    short: true,
                  },
                ]
              : [],
          },
        ],
      };
    },
  } as MessageTemplate,

  /**
   * Build failed
   */
  failed: {
    text: (ctx: TemplateContext): string => {
      const lines: string[] = [
        `❌ Build #${ctx.buildNumber || '?'} failed for ${ctx.project}`,
      ];
      if (ctx.tests) {
        lines.push(
          `  Tests: ${ctx.tests.passed}/${ctx.tests.total} passed, ${ctx.tests.failed} failed`,
        );
      }
      if (ctx.failures && ctx.failures.length > 0) {
        lines.push('\nFailures:');
        ctx.failures.slice(0, 5).forEach((f) => {
          lines.push(`  - ${f.name}: ${f.error}`);
        });
        if (ctx.failures.length > 5) {
          lines.push(`  ... and ${ctx.failures.length - 5} more`);
        }
      }
      return lines.join('\n');
    },
    markdown: (ctx: TemplateContext): string => {
      let md = `## ❌ Build Failed\n\n**Project:** ${ctx.project}\n**Build:** #${ctx.buildNumber || '?'}\n`;
      if (ctx.tests) {
        md += `\n### Test Results\n- Total: ${ctx.tests.total}\n- Passed: ${ctx.tests.passed}\n- Failed: ${ctx.tests.failed}\n`;
      }
      if (ctx.failures && ctx.failures.length > 0) {
        md += `\n### Failures\n\n`;
        ctx.failures.slice(0, 10).forEach((f) => {
          md += `#### ${f.name}\n\`\`\`\n${f.error}\n\`\`\`\n\n`;
        });
        if (ctx.failures.length > 10) {
          md += `_... and ${ctx.failures.length - 10} more_\n`;
        }
      }
      return md;
    },
    html: (ctx: TemplateContext): string => {
      let html = `<h2>❌ Build Failed</h2><p><strong>Project:</strong> ${ctx.project}</p><p><strong>Build:</strong> #${ctx.buildNumber || '?'}</p>`;
      if (ctx.tests) {
        html += `<h3>Test Results</h3><ul><li>Total: ${ctx.tests.total}</li><li>Passed: ${ctx.tests.passed}</li><li>Failed: ${ctx.tests.failed}</li></ul>`;
      }
      if (ctx.failures && ctx.failures.length > 0) {
        html += `<h3>Failures</h3><ul>`;
        ctx.failures.slice(0, 10).forEach((f) => {
          html += `<li><strong>${f.name}</strong><br><code>${f.error}</code></li>`;
        });
        if (ctx.failures.length > 10) {
          html += `<li>... and ${ctx.failures.length - 10} more</li>`;
        }
        html += '</ul>';
      }
      return html;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      const failureText =
        ctx.failures
          ?.slice(0, 5)
          .map((f) => {
            return `• *${f.name}*\n  \`${f.error}\``;
          })
          .join('\n') || '';

      return {
        text: `❌ Build #${ctx.buildNumber || '?'} failed for ${ctx.project}`,
        attachments: [
          {
            color: 'danger',
            fields: ctx.tests
              ? [
                  {
                    title: 'Total',
                    value: String(ctx.tests.total),
                    short: true,
                  },
                  {
                    title: 'Failed',
                    value: String(ctx.tests.failed),
                    short: true,
                  },
                ]
              : [],
            ...(failureText
              ? [
                  {
                    title: 'Failures',
                    value:
                      failureText +
                      (ctx.failures && ctx.failures.length > 5
                        ? `\n_... and ${ctx.failures.length - 5} more_`
                        : ''),
                    short: false,
                  },
                ]
              : []),
          },
        ],
      };
    },
  } as MessageTemplate,

  /**
   * Build fixed (previously failing, now passing)
   */
  fixed: {
    text: (ctx: TemplateContext): string => {
      return `🎉 Build #${ctx.buildNumber || '?'} fixed for ${ctx.project} - back to green!`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## 🎉 Build Fixed\n\n**Project:** ${ctx.project}\n**Build:** #${ctx.buildNumber || '?'}\n\nThe build is back to green!`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>🎉 Build Fixed</h2><p><strong>Project:</strong> ${ctx.project}</p><p><strong>Build:</strong> #${ctx.buildNumber || '?'}</p><p>The build is back to green!</p>`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `🎉 Build #${ctx.buildNumber || '?'} fixed for ${ctx.project} - back to green!`,
        attachments: [
          {
            color: 'good',
            text: 'The build is back to green!',
          },
        ],
      };
    },
  } as MessageTemplate,
};

/**
 * Quality gate notification templates
 */
export const QualityGateTemplates = {
  /**
   * Quality gate passed
   */
  passed: {
    text: (ctx: TemplateContext): string => {
      return `✅ Quality gate passed for ${ctx.project}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## ✅ Quality Gate Passed\n\n**Project:** ${ctx.project}\n\nAll quality checks passed.`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>✅ Quality Gate Passed</h2><p><strong>Project:</strong> ${ctx.project}</p><p>All quality checks passed.</p>`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `✅ Quality gate passed for ${ctx.project}`,
        attachments: [
          {
            color: 'good',
            text: 'All quality checks passed.',
          },
        ],
      };
    },
  } as MessageTemplate,

  /**
   * Quality gate failed
   */
  failed: {
    text: (ctx: TemplateContext): string => {
      return `❌ Quality gate failed for ${ctx.project}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## ❌ Quality Gate Failed\n\n**Project:** ${ctx.project}\n\nOne or more quality checks failed.`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>❌ Quality Gate Failed</h2><p><strong>Project:</strong> ${ctx.project}</p><p>One or more quality checks failed.</p>`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `❌ Quality gate failed for ${ctx.project}`,
        attachments: [
          {
            color: 'danger',
            text: 'One or more quality checks failed.',
          },
        ],
      };
    },
  } as MessageTemplate,
};

/**
 * Deployment notification templates
 */
export const DeploymentTemplates = {
  /**
   * Deployment started
   */
  started: {
    text: (ctx: TemplateContext): string => {
      return `🚀 Deployment started for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## 🚀 Deployment Started\n\n**Project:** ${ctx.project}\n${ctx.branch ? `**Environment:** ${ctx.branch}\n` : ''}`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>🚀 Deployment Started</h2><p><strong>Project:</strong> ${ctx.project}</p>${ctx.branch ? `<p><strong>Environment:</strong> ${ctx.branch}</p>` : ''}`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `🚀 Deployment started for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`,
        attachments: [
          {
            color: 'warning',
            text: 'Deployment in progress...',
          },
        ],
      };
    },
  } as MessageTemplate,

  /**
   * Deployment completed
   */
  completed: {
    text: (ctx: TemplateContext): string => {
      return `✅ Deployment completed for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## ✅ Deployment Completed\n\n**Project:** ${ctx.project}\n${ctx.branch ? `**Environment:** ${ctx.branch}\n` : ''}`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>✅ Deployment Completed</h2><p><strong>Project:</strong> ${ctx.project}</p>${ctx.branch ? `<p><strong>Environment:</strong> ${ctx.branch}</p>` : ''}`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `✅ Deployment completed for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`,
        attachments: [
          {
            color: 'good',
            text: 'Deployment successful!',
          },
        ],
      };
    },
  } as MessageTemplate,

  /**
   * Deployment failed
   */
  failed: {
    text: (ctx: TemplateContext): string => {
      return `❌ Deployment failed for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`;
    },
    markdown: (ctx: TemplateContext): string => {
      return `## ❌ Deployment Failed\n\n**Project:** ${ctx.project}\n${ctx.branch ? `**Environment:** ${ctx.branch}\n` : ''}`;
    },
    html: (ctx: TemplateContext): string => {
      return `<h2>❌ Deployment Failed</h2><p><strong>Project:</strong> ${ctx.project}</p>${ctx.branch ? `<p><strong>Environment:</strong> ${ctx.branch}</p>` : ''}`;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      return {
        text: `❌ Deployment failed for ${ctx.project}${ctx.branch ? ` to ${ctx.branch}` : ''}`,
        attachments: [
          {
            color: 'danger',
            text: 'Deployment failed!',
          },
        ],
      };
    },
  } as MessageTemplate,
};

/**
 * Flaky test notification templates
 */
export const FlakyTestTemplates = {
  /**
   * Flaky tests detected
   */
  detected: {
    text: (ctx: TemplateContext): string => {
      const lines: string[] = [`⚠️ Flaky tests detected in ${ctx.project}`];
      if (ctx.failures && ctx.failures.length > 0) {
        lines.push('\nFlaky tests:');
        ctx.failures.slice(0, 10).forEach((f) => {
          lines.push(`  - ${f.name}`);
        });
        if (ctx.failures.length > 10) {
          lines.push(`  ... and ${ctx.failures.length - 10} more`);
        }
      }
      return lines.join('\n');
    },
    markdown: (ctx: TemplateContext): string => {
      let md = `## ⚠️ Flaky Tests Detected\n\n**Project:** ${ctx.project}\n\n`;
      if (ctx.failures && ctx.failures.length > 0) {
        md += `### Flaky Tests\n\n`;
        ctx.failures.forEach((f) => {
          md += `- ${f.name}\n`;
        });
      }
      return md;
    },
    html: (ctx: TemplateContext): string => {
      let html = `<h2>⚠️ Flaky Tests Detected</h2><p><strong>Project:</strong> ${ctx.project}</p>`;
      if (ctx.failures && ctx.failures.length > 0) {
        html += `<h3>Flaky Tests</h3><ul>`;
        ctx.failures.forEach((f) => {
          html += `<li>${f.name}</li>`;
        });
        html += '</ul>';
      }
      return html;
    },
    slack: (ctx: TemplateContext): Record<string, unknown> => {
      const testList = ctx.failures?.map((f) => `• ${f.name}`).join('\n') || '';

      return {
        text: `⚠️ Flaky tests detected in ${ctx.project}`,
        attachments: [
          {
            color: 'warning',
            title: 'Flaky Tests',
            text: testList || 'No specific tests identified',
          },
        ],
      };
    },
  } as MessageTemplate,
};

/**
 * Format a template with context
 */
export function formatTemplate(
  template: MessageTemplate,
  context: TemplateContext,
  format: 'text' | 'markdown' | 'html' | 'slack' = 'text',
): string | Record<string, unknown> {
  switch (format) {
    case 'text':
      return template.text(context);
    case 'markdown':
      return template.markdown(context);
    case 'html':
      return template.html(context);
    case 'slack':
      return template.slack?.(context) || template.text(context);
    default:
      return template.text(context);
  }
}

/**
 * Create notification data from template context
 */
export function createNotificationData(
  context: TemplateContext,
  event: NotificationData['event'],
  status: NotificationData['status'],
): NotificationData {
  return {
    event,
    project: context.project,
    branch: context.branch,
    commit: context.commit,
    buildNumber: context.buildNumber,
    tests: context.tests,
    failures: context.failures,
    status,
  };
}

/**
 * Get template by event type
 */
export function getTemplateForEvent(
  event: NotificationData['event'],
): MessageTemplate | undefined {
  switch (event) {
    case 'build_started':
      return BuildTemplates.started;
    case 'build_completed':
      return BuildTemplates.success;
    case 'build_failed':
      return BuildTemplates.failed;
    case 'build_fixed':
      return BuildTemplates.fixed;
    case 'quality_gate_passed':
      return QualityGateTemplates.passed;
    case 'quality_gate_failed':
      return QualityGateTemplates.failed;
    case 'deployment_started':
      return DeploymentTemplates.started;
    case 'deployment_completed':
      return DeploymentTemplates.completed;
    case 'deployment_failed':
      return DeploymentTemplates.failed;
    case 'test_flaky':
      return FlakyTestTemplates.detected;
    default:
      return undefined;
  }
}
