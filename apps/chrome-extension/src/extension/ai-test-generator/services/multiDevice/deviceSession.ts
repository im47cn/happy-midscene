/**
 * Device Session Abstraction
 * Base interface and implementation for multi-device testing
 */

import type {
  DeviceConfig,
  DeviceInfo,
  DeviceStatus,
  DeviceType,
  StepResult,
} from '../../types/multiDevice';

/**
 * Test step for execution
 */
export interface TestStep {
  /** AI instruction */
  instruction: string;
  /** Assertion condition */
  assert?: string;
  /** Wait for condition */
  waitFor?: string;
  /** Navigate to URL */
  navigate?: string;
  /** Data export queries */
  export?: Record<string, string>;
}

/**
 * Session event types
 */
export type SessionEventType =
  | 'status_change'
  | 'step_start'
  | 'step_complete'
  | 'error'
  | 'screenshot';

/**
 * Session event payload
 */
export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: number;
  data?: any;
}

/**
 * Session event listener
 */
export type SessionEventListener = (event: SessionEvent) => void;

/**
 * Abstract Device Session interface
 */
export interface DeviceSession {
  /** Unique session ID */
  readonly id: string;

  /** Human-readable alias */
  readonly alias: string;

  /** Device type */
  readonly type: DeviceType;

  /** Current connection status */
  status: DeviceStatus;

  /** Connect to device */
  connect(): Promise<void>;

  /** Disconnect from device */
  disconnect(): Promise<void>;

  /** Attempt reconnection */
  reconnect(): Promise<void>;

  /** Execute a test step */
  executeStep(step: TestStep): Promise<StepResult>;

  /** Extract data using AI query */
  extractData(query: string): Promise<any>;

  /** Inject data into session context */
  injectData(data: Record<string, any>): void;

  /** Capture screenshot */
  captureScreenshot(): Promise<string | undefined>;

  /** Get session info */
  getInfo(): DeviceInfo;

  /** Add event listener */
  addEventListener(listener: SessionEventListener): void;

  /** Remove event listener */
  removeEventListener(listener: SessionEventListener): void;
}

/**
 * Base class for device sessions with common functionality
 */
export abstract class BaseDeviceSession implements DeviceSession {
  readonly id: string;
  readonly alias: string;
  readonly type: DeviceType;
  status: DeviceStatus = 'disconnected';

  protected config: DeviceConfig;
  protected injectedData: Record<string, any> = {};
  protected listeners: Set<SessionEventListener> = new Set();
  protected currentStep = 0;
  protected totalSteps = 0;
  protected lastError?: string;
  protected lastScreenshot?: string;

  constructor(config: DeviceConfig) {
    this.id = config.id;
    this.alias = config.alias;
    this.type = config.type;
    this.config = config;
  }

  /**
   * Emit an event to all listeners
   */
  protected emit(type: SessionEventType, data?: any): void {
    const event: SessionEvent = {
      type,
      sessionId: this.id,
      timestamp: Date.now(),
      data,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Session event listener error:', error);
      }
    }
  }

  /**
   * Update status and emit event
   */
  protected setStatus(status: DeviceStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('status_change', { status });
    }
  }

  /**
   * Get session info
   */
  getInfo(): DeviceInfo {
    return {
      id: this.id,
      alias: this.alias,
      type: this.type,
      status: this.status,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      lastError: this.lastError,
      lastScreenshot: this.lastScreenshot,
    };
  }

  /**
   * Inject data into session context
   */
  injectData(data: Record<string, any>): void {
    Object.assign(this.injectedData, data);
  }

  /**
   * Get injected data
   */
  protected getInjectedData(): Record<string, any> {
    return { ...this.injectedData };
  }

  /**
   * Interpolate variables in string
   */
  protected interpolate(template: string): string {
    return template.replace(
      /\$\{(\w+)(?:\s*\|\s*(\w+)(?::'([^']*)')?)?\}/g,
      (match, key, transformer, arg) => {
        let value = this.injectedData[key];

        if (value === undefined) {
          return match;
        }

        if (transformer) {
          value = this.transform(value, transformer, arg);
        }

        return String(value);
      },
    );
  }

  /**
   * Transform value
   */
  protected transform(value: any, transformer: string, arg?: string): any {
    switch (transformer) {
      case 'trim':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'format':
        return this.formatDate(value, arg);
      default:
        return value;
    }
  }

  /**
   * Format date value
   */
  protected formatDate(value: any, format?: string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    if (!format) {
      return date.toISOString();
    }

    // Simple date formatting
    return format
      .replace('YYYY', String(date.getFullYear()))
      .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(date.getDate()).padStart(2, '0'))
      .replace('HH', String(date.getHours()).padStart(2, '0'))
      .replace('mm', String(date.getMinutes()).padStart(2, '0'))
      .replace('ss', String(date.getSeconds()).padStart(2, '0'));
  }

  /**
   * Add event listener
   */
  addEventListener(listener: SessionEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SessionEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract reconnect(): Promise<void>;
  abstract executeStep(step: TestStep): Promise<StepResult>;
  abstract extractData(query: string): Promise<any>;
  abstract captureScreenshot(): Promise<string | undefined>;
}

/**
 * Retry configuration for session operations
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
};

/**
 * Retry helper for session operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = config.delayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= config.backoffMultiplier;
      }
    }
  }

  throw lastError;
}
