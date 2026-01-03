/**
 * Android Session Implementation
 * Wraps Midscene Android Agent for multi-device collaborative testing
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
 * Android-specific configuration
 */
export interface AndroidSessionConfig extends DeviceConfig {
  type: 'android';
  /** Android device ID (from adb devices) */
  deviceId?: string;
  /** App package name */
  package?: string;
  /** Activity name */
  activity?: string;
  /** ADB server host */
  adbHost?: string;
  /** ADB server port */
  adbPort?: number;
  /** Screen capture quality (0-1) */
  screenshotQuality?: number;
  /** Enable screen mirroring */
  enableMirroring?: boolean;
}

/**
 * Touch action coordinates
 */
export interface TouchPoint {
  x: number;
  y: number;
}

/**
 * Swipe action
 */
export interface SwipeAction {
  start: TouchPoint;
  end: TouchPoint;
  duration?: number;
}

/**
 * Android Session using Midscene Android Agent
 */
export class AndroidSession extends BaseDeviceSession {
  private agent: any = null;
  private getAgentFn: (() => any) | null = null;
  private retryConfig: RetryConfig;
  private androidConfig: AndroidSessionConfig;
  private isConnected = false;
  private currentPackage?: string;
  private screenStream?: ReadableStream;

  constructor(
    config: AndroidSessionConfig,
    getAgent?: () => any,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config);
    this.getAgentFn = getAgent || null;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    this.androidConfig = config;
  }

  /**
   * Set agent getter function
   */
  setAgentGetter(getAgent: () => any): void {
    this.getAgentFn = getAgent;
  }

  /**
   * Connect to Android device
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

      // Initialize ADB connection
      await this.initializeAdb();

      // Launch app if package specified
      if (this.androidConfig.package) {
        await this.launchApp(
          this.androidConfig.package,
          this.androidConfig.activity,
        );
      }

      // Enable screen mirroring if configured
      if (this.androidConfig.enableMirroring && this.agent?.startScreenMirroring) {
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
   * Initialize ADB connection
   */
  private async initializeAdb(): Promise<void> {
    try {
      // Check if agent has ADB methods
      if (this.agent?.initializeAdb) {
        await this.agent.initializeAdb({
          deviceId: this.androidConfig.deviceId,
          host: this.androidConfig.adbHost || 'localhost',
          port: this.androidConfig.adbPort || 5037,
        });
      }

      // Verify device connection
      const devices = await this.getConnectedDevices();
      if (devices.length === 0) {
        throw new Error('No Android devices connected via ADB');
      }

      // Use first device if none specified
      if (!this.androidConfig.deviceId) {
        this.androidConfig.deviceId = devices[0];
      }
    } catch (error) {
      throw new Error(`ADB initialization failed: ${error}`);
    }
  }

  /**
   * Get list of connected Android devices
   */
  private async getConnectedDevices(): Promise<string[]> {
    if (this.agent?.getConnectedDevices) {
      return await this.agent.getConnectedDevices();
    }
    // Fallback: would need actual ADB command execution
    return [];
  }

  /**
   * Launch Android app
   */
  private async launchApp(
    packageName: string,
    activityName?: string,
  ): Promise<void> {
    if (this.agent?.launchApp) {
      await this.agent.launchApp(packageName, activityName);
      this.currentPackage = packageName;
    }
  }

  /**
   * Start screen mirroring
   */
  private startScreenMirroring(): void {
    if (this.agent?.startScreenMirroring) {
      this.screenStream = this.agent.startScreenMirroring({
        quality: this.androidConfig.screenshotQuality || 0.8,
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
   * Disconnect from Android device
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    try {
      // Stop screen mirroring
      this.stopScreenMirroring();

      // Close app if we launched it
      if (this.currentPackage && this.agent?.closeApp) {
        await this.agent.closeApp(this.currentPackage);
      }

      // Disconnect ADB
      if (this.agent?.disconnectAdb) {
        await this.agent.disconnectAdb();
      }

      this.agent = null;
      this.isConnected = false;
      this.currentPackage = undefined;
      this.setStatus('disconnected');
    } catch (error) {
      console.warn('Error during disconnect:', error);
      this.isConnected = false;
      this.setStatus('disconnected');
    }
  }

  /**
   * Reconnect to Android device
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
          quality: this.androidConfig.screenshotQuality || 0.8,
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
  async touch(x: number, y: number): Promise<void> {
    if (this.agent?.touch) {
      await this.agent.touch(x, y);
    }
  }

  /**
   * Perform swipe action
   */
  async swipe(action: SwipeAction): Promise<void> {
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
   * Press back button
   */
  async pressBack(): Promise<void> {
    if (this.agent?.pressBack) {
      await this.agent.pressBack();
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
   * Press enter key
   */
  async pressEnter(): Promise<void> {
    if (this.agent?.pressEnter) {
      await this.agent.pressEnter();
    }
  }

  /**
   * Get current activity
   */
  async getCurrentActivity(): Promise<string | null> {
    if (this.agent?.getCurrentActivity) {
      return await this.agent.getCurrentActivity();
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
   * Check if app is installed
   */
  async isAppInstalled(packageName: string): Promise<boolean> {
    if (this.agent?.isAppInstalled) {
      return await this.agent.isAppInstalled(packageName);
    }
    return false;
  }

  /**
   * Install app
   */
  async installApp(apkPath: string): Promise<void> {
    if (this.agent?.installApp) {
      await this.agent.installApp(apkPath);
    }
  }

  /**
   * Uninstall app
   */
  async uninstallApp(packageName: string): Promise<void> {
    if (this.agent?.uninstallApp) {
      await this.agent.uninstallApp(packageName);
    }
  }

  /**
   * Clear app data
   */
  async clearAppData(packageName: string): Promise<void> {
    if (this.agent?.clearAppData) {
      await this.agent.clearAppData(packageName);
    }
  }

  /**
   * Grant runtime permission
   */
  async grantPermission(
    packageName: string,
    permission: string,
  ): Promise<void> {
    if (this.agent?.grantPermission) {
      await this.agent.grantPermission(packageName, permission);
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
}

/**
 * Create an Android session from config
 */
export function createAndroidSession(
  config: AndroidSessionConfig,
  getAgent?: () => any,
): AndroidSession {
  return new AndroidSession(config, getAgent);
}
