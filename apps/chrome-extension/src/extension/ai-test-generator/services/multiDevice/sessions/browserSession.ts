/**
 * Browser Session Implementation
 * Wraps Midscene Web Agent for multi-device collaborative testing
 */

import type {
  DeviceConfig,
  DeviceStatus,
  StepResult,
} from '../../../types/multiDevice';
import {
  BaseDeviceSession,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type TestStep,
  withRetry,
} from '../deviceSession';

/**
 * Browser-specific configuration
 */
export interface BrowserSessionConfig extends DeviceConfig {
  type: 'browser';
  /** Browser viewport settings */
  viewport?: { width: number; height: number };
  /** Starting URL */
  startUrl?: string;
  /** Device scale factor */
  deviceScaleFactor?: number;
  /** Enable mobile mode */
  isMobile?: boolean;
  /** Enable touch events */
  hasTouch?: boolean;
  /** Custom user agent */
  userAgent?: string;
}

/**
 * Browser Session using Midscene Web Agent
 */
export class BrowserSession extends BaseDeviceSession {
  private agent: any = null;
  private page: any = null;
  private getAgentFn: (() => any) | null = null;
  private retryConfig: RetryConfig;

  constructor(
    config: BrowserSessionConfig,
    getAgent?: () => any,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config);
    this.getAgentFn = getAgent || null;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Set agent getter function
   */
  setAgentGetter(getAgent: () => any): void {
    this.getAgentFn = getAgent;
  }

  /**
   * Connect to browser
   */
  async connect(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }

    this.setStatus('connecting');

    try {
      if (!this.getAgentFn) {
        throw new Error('Agent getter function not set');
      }

      // Get agent instance
      this.agent = this.getAgentFn();
      this.page = this.agent?.page;

      if (!this.page) {
        throw new Error('Failed to get page from agent');
      }

      // Apply viewport settings
      const browserConfig = this.config as BrowserSessionConfig;
      if (browserConfig.viewport) {
        await this.applyViewport(browserConfig);
      }

      // Navigate to start URL
      if (browserConfig.startUrl) {
        await this.page.goto(browserConfig.startUrl);
      }

      this.setStatus('ready');
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : String(error);
      this.setStatus('error');
      this.emit('error', { error: this.lastError });
      throw error;
    }
  }

  /**
   * Apply viewport settings via CDP
   */
  private async applyViewport(config: BrowserSessionConfig): Promise<void> {
    if (!this.page || !config.viewport) return;

    try {
      // Check if page has CDP access
      if (typeof this.page.sendCommandToDebugger === 'function') {
        await this.page.sendCommandToDebugger(
          'Emulation.setDeviceMetricsOverride',
          {
            width: config.viewport.width,
            height: config.viewport.height,
            deviceScaleFactor: config.deviceScaleFactor || 1,
            mobile: config.isMobile || false,
          },
        );

        if (config.userAgent) {
          await this.page.sendCommandToDebugger(
            'Emulation.setUserAgentOverride',
            {
              userAgent: config.userAgent,
            },
          );
        }

        if (config.hasTouch) {
          await this.page.sendCommandToDebugger(
            'Emulation.setTouchEmulationEnabled',
            {
              enabled: true,
              maxTouchPoints: 5,
            },
          );
        }
      }
    } catch (error) {
      console.warn('Failed to apply viewport settings:', error);
    }
  }

  /**
   * Disconnect from browser
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    try {
      // Clear device emulation
      if (this.page && typeof this.page.sendCommandToDebugger === 'function') {
        await this.page.sendCommandToDebugger(
          'Emulation.clearDeviceMetricsOverride',
          {},
        );
      }

      // Destroy page if possible
      if (this.page?.destroy) {
        await this.page.destroy();
      }

      this.agent = null;
      this.page = null;
      this.setStatus('disconnected');
    } catch (error) {
      console.warn('Error during disconnect:', error);
      this.setStatus('disconnected');
    }
  }

  /**
   * Reconnect to browser
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    await withRetry(() => this.connect(), this.retryConfig);
  }

  /**
   * Execute a test step
   */
  async executeStep(step: TestStep): Promise<StepResult> {
    if (this.status !== 'ready') {
      return {
        success: false,
        error: `Session not ready: ${this.status}`,
        duration: 0,
      };
    }

    const startTime = Date.now();
    this.setStatus('busy');
    this.emit('step_start', { step });

    try {
      // Handle different step types
      if (step.navigate) {
        await this.page.goto(this.interpolate(step.navigate));
      } else if (step.waitFor) {
        await this.agent.aiWaitFor(this.interpolate(step.waitFor));
      } else if (step.assert) {
        await this.agent.aiAssert(this.interpolate(step.assert));
      } else if (step.instruction) {
        await this.agent.aiAct(this.interpolate(step.instruction));
      }

      // Handle data export
      let exportedData: Record<string, any> | undefined;
      if (step.export) {
        exportedData = {};
        for (const [key, query] of Object.entries(step.export)) {
          const value = await this.extractData(this.interpolate(query));
          exportedData[key] = value;
        }
      }

      // Capture screenshot
      const screenshot = await this.captureScreenshot();
      this.lastScreenshot = screenshot;

      const result: StepResult = {
        success: true,
        screenshot,
        duration: Date.now() - startTime,
        exportedData,
      };

      this.setStatus('ready');
      this.emit('step_complete', { step, result });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;

      // Try to capture screenshot even on failure
      let screenshot: string | undefined;
      try {
        screenshot = await this.captureScreenshot();
        this.lastScreenshot = screenshot;
      } catch (screenshotError) {
        console.warn('Failed to capture error screenshot:', screenshotError);
      }

      const result: StepResult = {
        success: false,
        error: errorMessage,
        screenshot,
        duration: Date.now() - startTime,
      };

      this.setStatus('ready');
      this.emit('step_complete', { step, result });
      this.emit('error', { error: errorMessage, step });

      return result;
    }
  }

  /**
   * Extract data using AI query
   */
  async extractData(query: string): Promise<any> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }

    try {
      const result = await this.agent.aiQuery(query);
      return result;
    } catch (error) {
      console.warn('Failed to extract data:', error);
      return null;
    }
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(): Promise<string | undefined> {
    if (!this.page) {
      return undefined;
    }

    try {
      const screenshot = await this.page.screenshot({
        type: 'png',
        encoding: 'base64',
      });
      return screenshot;
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
      return undefined;
    }
  }

  /**
   * Get underlying page object
   */
  getPage(): any {
    return this.page;
  }

  /**
   * Get underlying agent object
   */
  getAgent(): any {
    return this.agent;
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate<T>(fn: () => T): Promise<T>;
  async evaluate<T, Args extends any[]>(
    fn: (...args: Args) => T,
    ...args: Args
  ): Promise<T>;
  async evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    return await this.page.evaluate(fn, ...args);
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(options?: {
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.waitForNavigation(options);
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    return await this.page.url();
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.goBack();
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.goForward();
  }

  /**
   * Reload page
   */
  async reload(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    await this.page.reload();
  }
}

/**
 * Create a browser session from config
 */
export function createBrowserSession(
  config: BrowserSessionConfig,
  getAgent?: () => any,
): BrowserSession {
  return new BrowserSession(config, getAgent);
}
