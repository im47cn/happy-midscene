/**
 * iOS Session Implementation
 * Wraps Midscene iOS Agent for multi-device collaborative testing
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
 * iOS-specific configuration
 */
export interface iOSSessionConfig extends DeviceConfig {
  type: 'ios';
  /** WebDriverAgent host */
  wdaHost?: string;
  /** WebDriverAgent port */
  wdaPort?: number;
  /** Bundle ID for iOS app */
  bundleId?: string;
  /** Device UDID */
  udid?: string;
  /** Use simulator instead of real device */
  useSimulator?: boolean;
  /** Simulator device type (e.g., 'iPhone 14 Pro') */
  simulatorDevice?: string;
  /** OS version for simulator */
  simulatorOS?: string;
  /** Screen capture quality (0-1) */
  screenshotQuality?: number;
  /** Enable screen mirroring */
  enableMirroring?: boolean;
}

/**
 * Touch action coordinates
 */
export interface IOSTouchPoint {
  x: number;
  y: number;
}

/**
 * iOS Swipe action
 */
export interface IOSSwipeAction {
  start: IOSTouchPoint;
  end: IOSTouchPoint;
  duration?: number;
}

/**
 * iOS Session using Midscene iOS Agent
 */
export class iOSSession extends BaseDeviceSession {
  private agent: any = null;
  private getAgentFn: (() => any) | null = null;
  private retryConfig: RetryConfig;
  private iosConfig: iOSSessionConfig;
  private isConnected = false;
  private currentBundleId?: string;
  private wdaProcess?: any;
  private screenStream?: ReadableStream;

  constructor(
    config: iOSSessionConfig,
    getAgent?: () => any,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config);
    this.getAgentFn = getAgent || null;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.iosConfig = config;
  }

  /**
   * Set agent getter function
   */
  setAgentGetter(getAgent: () => any): void {
    this.getAgentFn = getAgent;
  }

  /**
   * Connect to iOS device
   */
  async connect(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }

    this.setStatus('connecting');

    try {
      // Get agent instance
      if (this.getAgentFn) {
        this.agent = this.getAgentFn();
      }

      // Start WebDriverAgent if needed
      await this.startWebDriverAgent();

      // Initialize WDA connection
      await this.initializeWDAConnection();

      // Launch app if bundle ID specified
      if (this.iosConfig.bundleId) {
        await this.launchApp(this.iosConfig.bundleId);
      }

      // Enable screen mirroring if configured
      if (this.iosConfig.enableMirroring && this.agent?.startScreenMirroring) {
        this.startScreenMirroring();
      }

      this.isConnected = true;
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
   * Start WebDriverAgent
   */
  private async startWebDriverAgent(): Promise<void> {
    try {
      if (this.agent?.startWDA) {
        this.wdaProcess = await this.agent.startWDA({
          host: this.iosConfig.wdaHost || 'localhost',
          port: this.iosConfig.wdaPort || 8100,
          udid: this.iosConfig.udid,
          useSimulator: this.iosConfig.useSimulator || false,
          simulatorDevice: this.iosConfig.simulatorDevice,
          simulatorOS: this.iosConfig.simulatorOS,
        });
      }
    } catch (error) {
      throw new Error(`WebDriverAgent start failed: ${error}`);
    }
  }

  /**
   * Initialize WDA connection
   */
  private async initializeWDAConnection(): Promise<void> {
    try {
      if (this.agent?.initializeWDA) {
        await this.agent.initializeWDA({
          host: this.iosConfig.wdaHost || 'localhost',
          port: this.iosConfig.wdaPort || 8100,
          udid: this.iosConfig.udid,
        });
      }

      // Verify connection
      const status = await this.getWDAStatus();
      if (!status?.ready) {
        throw new Error('WebDriverAgent not ready');
      }
    } catch (error) {
      throw new Error(`WDA connection failed: ${error}`);
    }
  }

  /**
   * Get WebDriverAgent status
   */
  private async getWDAStatus(): Promise<{ ready: boolean } | null> {
    if (this.agent?.getWDAStatus) {
      return await this.agent.getWDAStatus();
    }
    return null;
  }

  /**
   * Launch iOS app
   */
  private async launchApp(bundleId: string): Promise<void> {
    if (this.agent?.launchApp) {
      await this.agent.launchApp(bundleId);
      this.currentBundleId = bundleId;
    }
  }

  /**
   * Start screen mirroring
   */
  private startScreenMirroring(): void {
    if (this.agent?.startScreenMirroring) {
      this.screenStream = this.agent.startScreenMirroring({
        quality: this.iosConfig.screenshotQuality || 0.8,
      });
    }
  }

  /**
   * Stop screen mirroring
   */
  private stopScreenMirroring(): void {
    if (this.screenStream) {
      this.screenStream.cancel();
      this.screenStream = undefined;
    }
    if (this.agent?.stopScreenMirroring) {
      this.agent.stopScreenMirroring();
    }
  }

  /**
   * Disconnect from iOS device
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    try {
      // Stop screen mirroring
      this.stopScreenMirroring();

      // Close app if we launched it
      if (this.currentBundleId && this.agent?.closeApp) {
        await this.agent.closeApp(this.currentBundleId);
      }

      // Stop WebDriverAgent if we started it
      if (this.wdaProcess && this.agent?.stopWDA) {
        await this.agent.stopWDA(this.wdaProcess);
        this.wdaProcess = undefined;
      }

      this.agent = null;
      this.isConnected = false;
      this.currentBundleId = undefined;
      this.setStatus('disconnected');
    } catch (error) {
      console.warn('Error during disconnect:', error);
      this.isConnected = false;
      this.setStatus('disconnected');
    }
  }

  /**
   * Reconnect to iOS device
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    await withRetry(() => this.connect(), this.retryConfig);
  }

  /**
   * Execute a test step
   */
  async executeStep(step: TestStep): Promise<StepResult> {
    if (this.status !== 'ready' || !this.isConnected) {
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
      if (step.waitFor) {
        await this.agent?.aiWaitFor?.(this.interpolate(step.waitFor));
      } else if (step.assert) {
        await this.agent?.aiAssert?.(this.interpolate(step.assert));
      } else if (step.instruction) {
        await this.agent?.aiAct?.(this.interpolate(step.instruction));
      }

      // Handle data export
      let exportedData: Record<string, any> | undefined;
      if (step.export && this.agent?.aiQuery) {
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
    if (!this.agent || !this.isConnected) {
      throw new Error('Agent not initialized or not connected');
    }

    try {
      if (this.agent?.aiQuery) {
        return await this.agent.aiQuery(query);
      }
      return null;
    } catch (error) {
      console.warn('Failed to extract data:', error);
      return null;
    }
  }

  /**
   * Capture screenshot
   */
  async captureScreenshot(): Promise<string | undefined> {
    if (!this.agent || !this.isConnected) {
      return undefined;
    }

    try {
      if (this.agent?.captureScreenshot) {
        const screenshot = await this.agent.captureScreenshot({
          quality: this.iosConfig.screenshotQuality || 0.8,
        });
        return screenshot;
      }
      return undefined;
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
      return undefined;
    }
  }

  /**
   * Perform touch action at coordinates
   */
  async tap(x: number, y: number): Promise<void> {
    if (this.agent?.tap) {
      await this.agent.tap(x, y);
    }
  }

  /**
   * Perform swipe action
   */
  async swipe(action: IOSSwipeAction): Promise<void> {
    if (this.agent?.swipe) {
      await this.agent.swipe({
        fromX: action.start.x,
        fromY: action.start.y,
        toX: action.end.x,
        toY: action.end.y,
        duration: action.duration || 300,
      });
    }
  }

  /**
   * Type text
   */
  async typeText(text: string): Promise<void> {
    const interpolated = this.interpolate(text);
    if (this.agent?.typeText) {
      await this.agent.typeText(interpolated);
    }
  }

  /**
   * Press home button
   */
  async pressHome(): Promise<void> {
    if (this.agent?.pressHome) {
      await this.agent.pressHome();
    }
  }

  /**
   * Double tap at coordinates
   */
  async doubleTap(x: number, y: number): Promise<void> {
    if (this.agent?.doubleTap) {
      await this.agent.doubleTap(x, y);
    }
  }

  /**
   * Long press at coordinates
   */
  async longPress(x: number, y: number, duration?: number): Promise<void> {
    if (this.agent?.longPress) {
      await this.agent.longPress(x, y, duration || 1000);
    }
  }

  /**
   * Pinch to zoom
   */
  async pinch(
    scale: number,
    x: number,
    y: number,
    duration?: number,
  ): Promise<void> {
    if (this.agent?.pinch) {
      await this.agent.pinch(scale, x, y, duration || 500);
    }
  }

  /**
   * Get current app
   */
  async getCurrentApp(): Promise<string | null> {
    if (this.agent?.getCurrentApp) {
      return await this.agent.getCurrentApp();
    }
    return null;
  }

  /**
   * Get device info
   */
  async getDeviceInfo(): Promise<Record<string, string> | null> {
    if (this.agent?.getDeviceInfo) {
      return await this.agent.getDeviceInfo();
    }
    return null;
  }

  /**
   * Get screen size
   */
  async getScreenSize(): Promise<{ width: number; height: number } | null> {
    if (this.agent?.getScreenSize) {
      return await this.agent.getScreenSize();
    }
    return null;
  }

  /**
   * Get battery info
   */
  async getBatteryInfo(): Promise<{
    level: number;
    state: string;
  } | null> {
    if (this.agent?.getBatteryInfo) {
      return await this.agent.getBatteryInfo();
    }
    return null;
  }

  /**
   * Activate app
   */
  async activateApp(bundleId: string): Promise<void> {
    if (this.agent?.activateApp) {
      await this.agent.activateApp(bundleId);
    }
  }

  /**
   * Terminate app
   */
  async terminateApp(bundleId: string): Promise<void> {
    if (this.agent?.terminateApp) {
      await this.agent.terminateApp(bundleId);
    }
  }

  /**
   * Is app installed
   */
  async isAppInstalled(bundleId: string): Promise<boolean> {
    if (this.agent?.isAppInstalled) {
      return await this.agent.isAppInstalled(bundleId);
    }
    return false;
  }

  /**
   * Set orientation
   */
  async setOrientation(
    orientation: 'PORTRAIT' | 'PORTRAIT_UPSIDEDOWN' | 'LANDSCAPE' | 'LANDSCAPE_RIGHT',
  ): Promise<void> {
    if (this.agent?.setOrientation) {
      await this.agent.setOrientation(orientation);
    }
  }

  /**
   * Get orientation
   */
  async getOrientation(): Promise<string | null> {
    if (this.agent?.getOrientation) {
      return await this.agent.getOrientation();
    }
    return null;
  }

  /**
   * Shake device
   */
  async shake(): Promise<void> {
    if (this.agent?.shake) {
      await this.agent.shake();
    }
  }

  /**
   * Toggle airplane mode
   */
  async toggleAirplaneMode(): Promise<void> {
    if (this.agent?.toggleAirplaneMode) {
      await this.agent.toggleAirplaneMode();
    }
  }

  /**
   * Start screen recording
   */
  async startScreenRecording(path?: string): Promise<void> {
    if (this.agent?.startScreenRecording) {
      await this.agent.startScreenRecording(path);
    }
  }

  /**
   * Stop screen recording
   */
  async stopScreenRecording(): Promise<string | null> {
    if (this.agent?.stopScreenRecording) {
      return await this.agent.stopScreenRecording();
    }
    return null;
  }

  /**
   * Get source (XML hierarchy)
   */
  async getSource(): Promise<string | null> {
    if (this.agent?.getSource) {
      return await this.agent.getSource();
    }
    return null;
  }

  /**
   * Find element by accessibility id
   */
  async findByAccessibilityId(id: string): Promise<any> {
    if (this.agent?.findByAccessibilityId) {
      return await this.agent.findByAccessibilityId(id);
    }
    return null;
  }

  /**
   * Get underlying agent object
   */
  getAgent(): any {
    return this.agent;
  }

  /**
   * Check if device is connected
   */
  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Check if using simulator
   */
  isSimulator(): boolean {
    return this.iosConfig.useSimulator || false;
  }
}

/**
 * Create an iOS session from config
 */
export function createiOSSession(
  config: iOSSessionConfig,
  getAgent?: () => any,
): iOSSession {
  return new iOSSession(config, getAgent);
}
