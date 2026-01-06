/**
 * CI/CD Integration Core Interfaces
 *
 * This file defines all core service interfaces for the CI/CD integration system.
 */

import type {
  ArtifactConfig,
  CIConfig,
  CIExecutionResult,
  CIPlatform,
  JSONReport,
  JUnitTestResults,
  NotificationChannel,
  NotificationConfig,
  PlatformMetadata,
  QualityGateConfig,
  QualityGateResult,
  ReportConfig,
  ReportFormat,
  RetryConfig,
  ShardResult,
  ShardStrategy,
  TestCaseResult,
} from '../../types/ci';

/**
 * CI Executor Options
 */
export interface CIExecutorOptions {
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Test execution options
 */
export interface TestExecutionOptions {
  /** Test files/globs to run */
  include?: string[];
  /** Test files/globs to exclude */
  exclude?: string[];
  /** Shard configuration */
  shard?: { index: number; total: number };
  /** Parallel workers */
  workers?: number;
  /** Test timeout (ms) */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
}

/**
 * CI Executor interface
 * Responsible for executing tests and collecting results
 */
export interface ICIExecutor {
  /**
   * Initialize the executor
   */
  initialize(): Promise<void>;

  /**
   * Execute tests with given configuration
   * @param config CI configuration
   * @param options Execution options
   * @returns Execution result
   */
  execute(
    config: CIConfig,
    options?: TestExecutionOptions,
  ): Promise<CIExecutionResult>;

  /**
   * Cancel ongoing execution
   */
  cancel(): Promise<void>;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

/**
 * Shard Manager interface
 * Responsible for splitting tests into shards for parallel execution
 */
export interface IShardManager {
  /**
   * Create a sharding plan
   * @param tests List of test files/patterns
   * @param shardCount Number of shards to create
   * @param strategy Sharding strategy
   * @returns Array of shard configurations
   */
  createShardPlan(
    tests: string[],
    shardCount: number,
    strategy?: ShardStrategy,
  ): Promise<string[][]>;

  /**
   * Get shard assignment for current execution
   * @param index Shard index (1-based)
   * @param total Total shards
   * @returns Files for this shard
   */
  getShardFiles(index: number, total: number): Promise<string[]>;
}

/**
 * Parallel Runner interface
 * Responsible for running tests in parallel processes
 */
export interface IParallelRunner {
  /**
   * Run tests in parallel
   * @param shards Test shards to run
   * @param config CI configuration
   * @returns Array of shard results
   */
  runParallel(shards: string[][], config: CIConfig): Promise<ShardResult[]>;

  /**
   * Get optimal parallel worker count
   * @returns Number of workers
   */
  getOptimalWorkerCount(): number;
}

/**
 * Quality Gate Rule interface
 * Individual rule for quality gate evaluation
 */
export interface IQualityGateRule {
  /** Rule identifier */
  readonly id: string;

  /** Rule name */
  readonly name: string;

  /** Rule description */
  readonly description: string;

  /**
   * Evaluate the rule against execution result
   * @param result Execution result
   * @returns Rule evaluation result
   */
  evaluate(result: CIExecutionResult): Promise<QualityGateRuleEvaluationResult>;
}

/**
 * Quality gate rule evaluation result
 */
export interface QualityGateRuleEvaluationResult {
  /** Rule ID */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Whether rule passed */
  passed: boolean;
  /** Actual value */
  actual: number | string;
  /** Expected threshold */
  expected: number | string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Quality Gate Evaluator interface
 * Responsible for evaluating quality gates against test results
 */
export interface IQualityGateEvaluator {
  /**
   * Register a custom rule
   * @param rule Quality gate rule
   */
  registerRule(rule: IQualityGateRule): void;

  /**
   * Unregister a rule
   * @param ruleId Rule ID
   */
  unregisterRule(ruleId: string): void;

  /**
   * Get all registered rules
   * @returns Array of rules
   */
  getRules(): IQualityGateRule[];

  /**
   * Evaluate quality gate
   * @param result Execution result
   * @param config Quality gate configuration
   * @returns Quality gate result
   */
  evaluate(
    result: CIExecutionResult,
    config: QualityGateConfig,
  ): Promise<QualityGateResult>;
}

/**
 * Report Generator interface
 * Responsible for generating test reports in various formats
 */
export interface IReportGenerator {
  /**
   * Generate report in specified format
   * @param result Execution result
   * @param format Report format
   * @param config Report configuration
   * @returns Generated file path(s)
   */
  generate(
    result: CIExecutionResult,
    format: ReportFormat,
    config: ReportConfig,
  ): Promise<string>;

  /**
   * Generate JUnit XML report
   * @param result Execution result
   * @returns JUnit XML structure
   */
  generateJUnit(result: CIExecutionResult): Promise<JUnitTestResults>;

  /**
   * Generate JSON report
   * @param result Execution result
   * @returns JSON report structure
   */
  generateJSON(result: CIExecutionResult): Promise<JSONReport>;

  /**
   * Generate HTML report
   * @param result Execution result
   * @param config Report configuration
   * @returns HTML file path
   */
  generateHTML(
    result: CIExecutionResult,
    config: ReportConfig,
  ): Promise<string>;

  /**
   * Generate Markdown report
   * @param result Execution result
   * @param config Report configuration
   * @returns Markdown file path
   */
  generateMarkdown(
    result: CIExecutionResult,
    config: ReportConfig,
  ): Promise<string>;
}

/**
 * Report Format Adapter interface
 * For handling specific report format generation
 */
export interface IReportFormatAdapter {
  /** Format name */
  readonly format: ReportFormat;

  /**
   * Generate report
   * @param result Execution result
   * @param config Report configuration
   * @returns Generated file path(s)
   */
  generate(
    result: CIExecutionResult,
    config: ReportConfig,
  ): Promise<string | string[]>;
}

/**
 * Artifact Manager interface
 * Responsible for managing test artifacts (screenshots, logs, etc.)
 */
export interface IArtifactManager {
  /**
   * Upload artifacts to CI platform
   * @param files File paths to upload
   * @param config Artifact configuration
   * @returns Upload result with URLs
   */
  upload(
    files: string[],
    config: ArtifactConfig,
  ): Promise<ArtifactUploadResult>;

  /**
   * Clean up old artifacts
   * @param retentionDays Number of days to retain
   * @returns Number of artifacts cleaned up
   */
  cleanup(retentionDays: number): Promise<number>;
}

/**
 * Artifact upload result
 */
export interface ArtifactUploadResult {
  /** Uploaded file paths */
  files: string[];
  /** Artifact URLs */
  urls: string[];
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Environment Manager interface
 * Responsible for managing environment configurations
 */
export interface IEnvManager {
  /**
   * Load environment configuration
   * @param name Environment name
   * @returns Environment configuration
   */
  loadEnvironment(name: string): Promise<EnvironmentConfig>;

  /**
   * Get current environment name
   * @returns Environment name
   */
  getCurrentEnvironment(): string;

  /**
   * Set current environment
   * @param name Environment name
   */
  setCurrentEnvironment(name: string): void;

  /**
   * Get environment variable value
   * @param key Variable key
   * @returns Variable value
   */
  getVariable(key: string): string | undefined;

  /**
   * Set environment variable
   * @param key Variable key
   * @param value Variable value
   */
  setVariable(key: string, value: string): void;

  /**
   * Resolve variable with interpolation
   * @param value Value with potential variable references
   * @returns Resolved value
   */
  resolveValue(value: string): string;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: string;
  baseUrl: string;
  variables: Record<string, string>;
}

/**
 * Config Loader interface
 * Responsible for loading and parsing CI configuration
 */
export interface IConfigLoader {
  /**
   * Load configuration from file
   * @param filePath Path to config file
   * @returns Parsed configuration
   */
  load(filePath: string): Promise<CIConfig>;

  /**
   * Load configuration from object
   * @param config Config object
   * @returns Validated configuration
   */
  parse(config: unknown): Promise<CIConfig>;

  /**
   * Validate configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  validate(config: CIConfig): Promise<ConfigValidationResult>;

  /**
   * Merge configurations
   * @param base Base configuration
   * @param override Override configuration
   * @returns Merged configuration
   */
  merge(base: CIConfig, override: Partial<CIConfig>): CIConfig;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: ConfigValidationError[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /** Error path (dot notation) */
  path: string;
  /** Error message */
  message: string;
  /** Error code */
  code?: string;
}

/**
 * Retry Manager interface
 * Responsible for retrying failed tests
 */
export interface IRetryManager {
  /**
   * Execute with retry
   * @param fn Function to execute
   * @param config Retry configuration
   * @returns Function result
   */
  executeWithRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>;

  /**
   * Retry failed test cases
   * @param tests Failed test cases
   * @param config Retry configuration
   * @returns Retry results
   */
  retryTests(
    tests: TestCaseResult[],
    config: RetryConfig,
  ): Promise<TestCaseResult[]>;

  /**
   * Get retry status for a test
   * @param testId Test ID
   * @returns Number of retries attempted
   */
  getRetryCount(testId: string): number;
}

/**
 * Notification Manager interface
 * Responsible for sending notifications
 */
export interface INotificationManager {
  /**
   * Register a notification channel
   * @param channel Channel type
   * @param config Channel-specific configuration
   */
  registerChannel(
    channel: NotificationChannel,
    config: Record<string, unknown>,
  ): void;

  /**
   * Send notification
   * @param result Execution result
   * @param config Notification configuration
   */
  send(
    result: CIExecutionResult,
    config: NotificationConfig,
  ): Promise<NotificationResult[]>;

  /**
   * Send success notification
   * @param result Execution result
   * @param config Notification configuration
   */
  sendSuccess(
    result: CIExecutionResult,
    config: NotificationConfig,
  ): Promise<NotificationResult[]>;

  /**
   * Send failure notification
   * @param result Execution result
   * @param config Notification configuration
   */
  sendFailure(
    result: CIExecutionResult,
    config: NotificationConfig,
  ): Promise<NotificationResult[]>;
}

/**
 * Notification result
 */
export interface NotificationResult {
  /** Channel type */
  channel: NotificationChannel;
  /** Whether notification was sent successfully */
  sent: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Notification ID/URL */
  id?: string;
}

/**
 * Platform Adapter interface
 * For platform-specific CI/CD integrations
 */
export interface IPlatformAdapter {
  /** Platform name */
  readonly platform: CIPlatform;

  /**
   * Detect if running on this platform
   * @returns Whether running on this platform
   */
  detect(): boolean;

  /**
   * Extract platform metadata
   * @returns Platform metadata
   */
  getMetadata(): PlatformMetadata;

  /**
   * Upload artifact to platform
   * @param filePath File path
   * @param name Artifact name
   * @returns Artifact URL
   */
  uploadArtifact(filePath: string, name: string): Promise<string>;

  /**
   * Post comment on PR
   * @param body Comment body
   * @returns Comment URL
   */
  postPRComment(body: string): Promise<string>;

  /**
   * Update build status
   * @param status Build status
   * @param description Status description
   */
  updateBuildStatus(
    status: 'pending' | 'success' | 'failure' | 'error',
    description?: string,
  ): Promise<void>;

  /**
   * Get platform-specific environment variables
   * @returns Environment variables
   */
  getEnvVars(): Record<string, string>;
}
