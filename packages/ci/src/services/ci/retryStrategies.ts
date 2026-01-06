/**
 * Retry Strategies
 *
 * Predefined retry strategies for common scenarios.
 */

import type { RetryCondition, RetryConfig } from './retryManager';
import { RetryConditions } from './retryManager';

/**
 * Strategy presets
 */
export type StrategyPreset =
  | 'conservative'
  | 'balanced'
  | 'aggressive'
  | 'test-flaky'
  | 'network'
  | 'quick-fail';

/**
 * Predefined retry strategy configurations
 */
export const RetryStrategies: Record<StrategyPreset, Partial<RetryConfig>> = {
  /**
   * Conservative strategy - minimal retries, long delays
   * Use for: Critical operations where failures are rare
   */
  conservative: {
    maxAttempts: 2,
    strategy: 'fixed',
    initialDelay: 2000,
    maxDelay: 5000,
    jitter: 0.2,
  },

  /**
   * Balanced strategy - moderate retries, exponential backoff
   * Use for: General purpose retries
   */
  balanced: {
    maxAttempts: 3,
    strategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    jitter: 0.1,
  },

  /**
   * Aggressive strategy - many retries with backoff
   * Use for: Unreliable operations that may need many attempts
   */
  aggressive: {
    maxAttempts: 5,
    strategy: 'exponential',
    initialDelay: 500,
    maxDelay: 15000,
    multiplier: 2,
    jitter: 0.15,
  },

  /**
   * Flaky test strategy - optimized for test retries
   * Use for: Tests that occasionally fail due to timing issues
   */
  'test-flaky': {
    maxAttempts: 3,
    strategy: 'exponential',
    initialDelay: 100,
    maxDelay: 1000,
    multiplier: 1.5,
    jitter: 0.1,
    retryIf: RetryConditions.always(),
  },

  /**
   * Network strategy - handles network failures
   * Use for: API calls, network requests
   */
  network: {
    maxAttempts: 4,
    strategy: 'exponential',
    initialDelay: 500,
    maxDelay: 20000,
    multiplier: 2,
    jitter: 0.2,
    retryIf: RetryConditions.network,
  },

  /**
   * Quick fail strategy - fail fast
   * Use for: Operations where retries are unlikely to help
   */
  'quick-fail': {
    maxAttempts: 1,
    strategy: 'fixed',
    initialDelay: 0,
  },
};

/**
 * Get strategy preset by name
 */
export function getStrategy(name: StrategyPreset): Partial<RetryConfig> {
  return RetryStrategies[name] || RetryStrategies.balanced;
}

/**
 * Test-specific retry conditions
 */
export const TestRetryConditions = {
  /**
   * Retry on assertion errors
   */
  assertion: RetryConditions.messagePattern(/AssertionError|assert/i),

  /**
   * Retry on timeout errors
   */
  timeout: RetryConditions.timeout,

  /**
   * Retry on DOM/element not found errors
   */
  elementNotFound: RetryConditions.messagePattern(
    /element.*not found|not visible|detached/i,
  ),

  /**
   * Retry on race condition errors
   */
  raceCondition: RetryConditions.messagePattern(
    /race|concurrent|locking|deadlock/i,
  ),

  /**
   * Retry on flaky test indicators
   */
  flaky: RetryConditions.messagePattern(
    /flaky|intermittent|occasional|sometimes/i,
  ),
};

/**
 * Test-specific retry strategies
 */
export const TestRetryStrategies: Record<
  'e2e' | 'unit' | 'integration' | 'visual',
  Partial<RetryConfig>
> = {
  /**
   * E2E test retry strategy
   * E2E tests are prone to flakiness due to network, timing, and browser issues
   */
  e2e: {
    maxAttempts: 3,
    strategy: 'exponential',
    initialDelay: 2000,
    maxDelay: 8000,
    multiplier: 1.5,
    jitter: 0.2,
    retryIf: (error) =>
      TestRetryConditions.timeout(error) ||
      TestRetryConditions.elementNotFound(error) ||
      TestRetryConditions.raceCondition(error),
  },

  /**
   * Unit test retry strategy
   * Unit tests should generally be stable, minimal retries
   */
  unit: {
    maxAttempts: 2,
    strategy: 'fixed',
    initialDelay: 100,
    maxDelay: 500,
    retryIf: (error) => TestRetryConditions.raceCondition(error),
  },

  /**
   * Integration test retry strategy
   * Integration tests may fail due to external dependencies
   */
  integration: {
    maxAttempts: 3,
    strategy: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    jitter: 0.15,
    retryIf: (error) =>
      TestRetryConditions.timeout(error) || RetryConditions.network(error),
  },

  /**
   * Visual regression test retry strategy
   * Visual tests may fail due to rendering inconsistencies
   */
  visual: {
    maxAttempts: 2,
    strategy: 'fixed',
    initialDelay: 500,
    retryIf: (error) => TestRetryConditions.elementNotFound(error),
  },
};

/**
 * Create retry condition from error classes
 */
export function retryOnErrorTypes(
  ...errorTypes: Array<{ new (...args: any[]): Error }>
): RetryCondition {
  return RetryConditions.errorTypes(...errorTypes);
}

/**
 * Create retry condition from error message pattern
 */
export function retryOnMessagePattern(pattern: RegExp): RetryCondition {
  return RetryConditions.messagePattern(pattern);
}

/**
 * Combine multiple retry conditions (OR logic)
 */
export function anyRetryCondition(
  ...conditions: RetryCondition[]
): RetryCondition {
  return (error, attempt) => conditions.some((c) => c(error, attempt));
}

/**
 * Combine multiple retry conditions (AND logic)
 */
export function allRetryConditions(
  ...conditions: RetryCondition[]
): RetryCondition {
  return (error, attempt) => conditions.every((c) => c(error, attempt));
}

/**
 * Create a custom retry strategy
 */
export function createRetryStrategy(
  config: Partial<RetryConfig>,
): Partial<RetryConfig> {
  return config;
}

/**
 * Merge strategy preset with custom overrides
 */
export function mergeStrategy(
  preset: StrategyPreset,
  overrides: Partial<RetryConfig>,
): Partial<RetryConfig> {
  return {
    ...RetryStrategies[preset],
    ...overrides,
  };
}
