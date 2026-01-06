/**
 * Retry Manager
 *
 * Manages test retry logic with configurable strategies.
 */

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Retry strategy */
  strategy: 'fixed' | 'exponential' | 'linear';
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential strategy */
  multiplier?: number;
  /** Jitter to add to delay (0-1) */
  jitter?: number;
  /** Conditions for retry */
  retryIf?: RetryCondition;
  /** Callback before each retry */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry condition function
 */
export type RetryCondition = (error: Error, attempt?: number) => boolean;

/**
 * Retry result
 */
export interface RetryResult<T> {
  /** The result value */
  value: T | undefined;
  /** Whether the operation succeeded */
  success: boolean;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent retrying */
  totalDuration: number;
  /** Last error if failed */
  error?: Error;
}

/**
 * Retry Manager
 *
 * Executes operations with retry logic based on configured strategy.
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      strategy: 'fixed',
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
      jitter: 0.1,
      ...config,
    };
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const value = await operation();
        return {
          value,
          success: true,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        const shouldRetry =
          attempt < this.config.maxAttempts &&
          (!this.config.retryIf || this.config.retryIf(lastError, attempt));

        if (!shouldRetry) {
          break;
        }

        // Call onRetry callback
        if (this.config.onRetry) {
          this.config.onRetry(attempt, lastError);
        }

        // Wait before retry
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    return {
      value: undefined,
      success: false,
      attempts: this.config.maxAttempts,
      totalDuration: Date.now() - startTime,
      error: lastError,
    };
  }

  /**
   * Execute a synchronous operation with retry logic
   */
  executeSync<T>(operation: () => T): RetryResult<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const value = operation();
        return {
          value,
          success: true,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        const shouldRetry =
          attempt < this.config.maxAttempts &&
          (!this.config.retryIf || this.config.retryIf(lastError, attempt));

        if (!shouldRetry) {
          break;
        }

        // Sync operations can't actually wait, but we track the attempt
        if (this.config.onRetry) {
          this.config.onRetry(attempt, lastError);
        }
      }
    }

    return {
      value: undefined,
      success: false,
      attempts: this.config.maxAttempts,
      totalDuration: Date.now() - startTime,
      error: lastError,
    };
  }

  /**
   * Calculate delay for a given attempt
   */
  private calculateDelay(attempt: number): number {
    let delay: number;

    switch (this.config.strategy) {
      case 'fixed':
        delay = this.config.initialDelay;
        break;

      case 'linear':
        delay = this.config.initialDelay * attempt;
        break;

      case 'exponential':
        delay =
          this.config.initialDelay *
          Math.pow(this.config.multiplier || 2, attempt - 1);
        break;

      default:
        delay = this.config.initialDelay;
    }

    // Apply max delay cap
    if (this.config.maxDelay && delay > this.config.maxDelay) {
      delay = this.config.maxDelay;
    }

    // Add jitter
    if (this.config.jitter && this.config.jitter > 0) {
      const jitterAmount = delay * this.config.jitter;
      delay = delay - jitterAmount / 2 + Math.random() * jitterAmount;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a new retry manager with updated config
   */
  withConfig(config: Partial<RetryConfig>): RetryManager {
    return new RetryManager({ ...this.config, ...config });
  }
}

/**
 * Create a retry manager with config
 */
export function createRetryManager(
  config?: Partial<RetryConfig>,
): RetryManager {
  return new RetryManager(config);
}

/**
 * Execute with retry using default manager
 */
export async function retry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<T> {
  const manager = new RetryManager(config);
  const result = await manager.execute(operation);

  if (!result.success) {
    throw result.error || new Error('Operation failed after retries');
  }

  return result.value!;
}

/**
 * Common retry conditions
 */
export const RetryConditions = {
  /**
   * Retry on any error
   */
  always: (): RetryCondition => () => true,

  /**
   * Retry on specific error types
   */
  errorTypes:
    (...types: Array<{ new (...args: any[]): Error }>): RetryCondition =>
    (error) =>
      types.some((Type) => error instanceof Type),

  /**
   * Retry on error message pattern
   */
  messagePattern:
    (pattern: RegExp): RetryCondition =>
    (error) =>
      pattern.test(error.message),

  /**
   * Retry on network errors
   */
  network: (error: Error) =>
    /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(
      error.message,
    ),

  /**
   * Retry on timeout errors
   */
  timeout: (error: Error) => /timeout|timed out/i.test(error.message),

  /**
   * Retry on specific status codes (for HTTP errors)
   */
  statusCodes:
    (...codes: number[]): RetryCondition =>
    (error: any) =>
      codes.includes(error?.status || error?.statusCode),
};
