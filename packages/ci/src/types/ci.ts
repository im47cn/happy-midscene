/**
 * CI/CD Integration Type Definitions
 *
 * This file contains all core type definitions for the CI/CD integration system,
 * including configuration, execution results, and report formats.
 */

/**
 * Supported CI/CD platforms
 */
export type CIPlatform =
  | 'github'
  | 'gitlab'
  | 'jenkins'
  | 'azure'
  | 'circleci'
  | 'generic'
  | 'local';

/**
 * Test execution status
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky' | 'running';

/**
 * Report format types
 */
export type ReportFormat = 'junit' | 'json' | 'html' | 'markdown';

/**
 * Sharding strategy types
 */
export type ShardStrategy =
  | 'time-based'
  | 'count-based'
  | 'hash-based'
  | 'custom';

/**
 * Retry strategy types
 */
export type RetryStrategy = 'fixed' | 'exponential' | 'linear';

/**
 * Quality gate operator types
 */
export type QualityGateOperator =
  | 'eq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'percentage';

/**
 * Notification channel types
 */
export type NotificationChannel = 'slack' | 'email' | 'webhook' | 'github';

/**
 * Environment configuration for test execution
 */
export interface EnvironmentConfig {
  /** Environment name (e.g., staging, production) */
  name: string;
  /** Base URL for the environment */
  baseUrl: string;
  /** Environment variables */
  variables?: Record<string, string>;
  /** Secret references */
  secrets?: Record<string, string>;
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  /** Enable parallel execution */
  enabled: boolean;
  /** Number of parallel workers */
  workers?: number;
  /** Shard configuration */
  shards?: {
    /** Current shard index (1-based) */
    current: number;
    /** Total number of shards */
    total: number;
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Enable retry mechanism */
  enabled: boolean;
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Only retry failed tests */
  onlyFailed: boolean;
  /** Delay between retries in seconds */
  delaySeconds: number;
  /** Retry strategy */
  strategy: RetryStrategy;
}

/**
 * Quality gate rule configuration
 */
export interface QualityGateRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Metric to evaluate */
  metric:
    | 'pass-rate'
    | 'critical-tests'
    | 'new-failures'
    | 'flaky-tests'
    | 'duration';
  /** Comparison operator */
  operator: QualityGateOperator;
  /** Threshold value */
  threshold: number | string;
  /** Whether failing this rule blocks deployment */
  blocking: boolean;
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  /** Enable quality gate evaluation */
  enabled: boolean;
  /** Minimum pass rate percentage (0-100) */
  passRateThreshold: number;
  /** Whether critical tests must 100% pass */
  criticalTestsMustPass: boolean;
  /** Maximum allowed new failures */
  maxNewFailures: number;
  /** Maximum allowed flaky tests */
  maxFlakyTests: number;
  /** Maximum test duration in milliseconds */
  maxDuration?: number;
  /** Custom rules */
  customRules?: QualityGateRule[];
}

/**
 * Report generation configuration
 */
export interface ReportConfig {
  /** Report formats to generate */
  formats: ReportFormat[];
  /** Output directory for reports */
  outputDir: string;
  /** Include screenshots in report */
  includeScreenshots: boolean;
  /** Include execution logs in report */
  includeLogs: boolean;
  /** Include coverage information */
  includeCoverage: boolean;
  /** Custom report title */
  title?: string;
  /** Upload artifacts to CI platform */
  uploadArtifacts: boolean;
  /** Post report as PR comment */
  commentOnPR: boolean;
}

/**
 * Artifact configuration
 */
export interface ArtifactConfig {
  /** Upload artifacts */
  enabled: boolean;
  /** Artifact name pattern */
  namePattern: string;
  /** Paths to include */
  includePaths: string[];
  /** Paths to exclude */
  excludePaths: string[];
  /** Retention days */
  retentionDays: number;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  /** Enable notifications */
  enabled: boolean;
  /** Notification channels */
  channels: NotificationChannel[];
  /** Notify on success */
  notifyOnSuccess: boolean;
  /** Notify on failure */
  notifyOnFailure: boolean;
  /** Notify on quality gate failure */
  notifyOnQualityGateFailure: boolean;
  /** Slack webhook URL */
  slackWebhookUrl?: string;
  /** Email recipients */
  emailRecipients?: string[];
  /** Generic webhook URLs */
  webhookUrls?: string[];
}

/**
 * Individual test case result
 */
export interface TestCaseResult {
  /** Test case ID */
  id: string;
  /** Test case name */
  name: string;
  /** Test suite name */
  suite?: string;
  /** Source file path */
  file?: string;
  /** Execution status */
  status: TestStatus;
  /** Execution duration in milliseconds */
  duration: number;
  /** Error message (if failed) */
  error?: string;
  /** Stack trace (if failed) */
  stackTrace?: string;
  /** Screenshot file path */
  screenshot?: string;
  /** Number of retries */
  retryCount?: number;
  /** Whether this is a critical test */
  critical?: boolean;
  /** Test metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Shard execution result
 */
export interface ShardResult {
  /** Shard index */
  shardIndex: number;
  /** Total shards */
  totalShards?: number;
  /** Number of files in shard */
  fileCount?: number;
  /** Number of tests in shard */
  testCount?: number;
  /** Number of passed tests */
  passed: number;
  /** Number of failed tests */
  failed: number;
  /** Number of skipped tests */
  skipped: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Execution status */
  status?: TestStatus;
  /** Error message (if shard failed) */
  error?: string;
  /** Individual test results */
  tests?: TestCaseResult[];
}

/**
 * CI execution result
 */
export interface CIExecutionResult {
  /** Execution ID */
  executionId: string;
  /** Platform that triggered execution */
  platform: CIPlatform;
  /** Pipeline/Job identifier */
  pipelineId?: string;
  /** Build number */
  buildNumber?: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Pull request number */
  prNumber?: number;
  /** Test suite name */
  suiteName?: string;
  /** Execution start timestamp (ISO string or number) */
  startTime?: number;
  startedAt?: string;
  /** Execution end timestamp (ISO string or number) */
  endTime?: number;
  finishedAt?: string;
  /** Overall execution status */
  status: TestStatus;
  /** Total test count */
  totalTests: number;
  /** Passed tests count */
  passed: number;
  /** Failed tests count */
  failed: number;
  /** Skipped tests count */
  skipped: number;
  /** Flaky tests count */
  flaky?: number;
  /** Overall pass rate percentage */
  passRate: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Quality gate evaluation result */
  qualityGateResult?: QualityGateResult;
  /** Shard results (if parallel execution) */
  shards?: ShardResult[];
  /** Sharding info */
  sharding?: {
    index: number;
    total: number;
  };
  /** Individual test results */
  tests?: TestCaseResult[];
  /** Individual test case results (alias) */
  testCases?: TestCaseResult[];
  /** Generated report paths */
  reports?: string[];
  /** Execution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Quality gate evaluation result
 */
export interface QualityGateResult {
  /** Overall quality gate status */
  passed: boolean;
  /** Individual rule results */
  rules: QualityGateRuleResult[];
}

/**
 * Individual quality gate rule result
 */
export interface QualityGateRuleResult {
  /** Rule identifier */
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
  /** Whether this rule blocks deployment */
  blocking?: boolean;
}

/**
 * Sharding configuration
 */
export interface ShardingConfig {
  /** Enable test sharding */
  enabled: boolean;
  /** Number of shards to create */
  shardCount?: number;
  /** Sharding strategy */
  strategy?: ShardStrategy;
}

/**
 * Main CI configuration
 */
export interface CIConfig {
  /** Configuration version */
  version: string;
  /** Test suite name */
  suiteName?: string;
  /** Test files/globs to include */
  include: string[];
  /** Test files/globs to exclude */
  exclude?: string[];
  /** Base URL for tests */
  baseUrl?: string;
  /** Timeout for individual tests (ms) */
  timeout?: number;
  /** Environment configurations */
  environments?: Record<string, EnvironmentConfig>;
  /** Default environment name */
  defaultEnvironment?: string;
  /** Parallel execution configuration */
  parallel?: ParallelConfig;
  /** Sharding configuration */
  sharding?: ShardingConfig;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Quality gate configuration */
  qualityGate?: QualityGateConfig;
  /** Report configuration */
  report?: ReportConfig;
  /** Artifact configuration */
  artifacts?: ArtifactConfig;
  /** Notification configuration */
  notifications?: NotificationConfig;
}

/**
 * JUnit XML test case
 */
export interface JUnitTestCase {
  _name: string;
  _classname?: string;
  _time?: string;
  failure?: JUnitFailure;
  skipped?: JUnitSkipped;
  'system-out'?: string;
  'system-err'?: string;
}

/**
 * JUnit XML failure element
 */
export interface JUnitFailure {
  _message: string;
  _type: string;
  __text: string;
}

/**
 * JUnit XML skipped element
 */
export interface JUnitSkipped {
  _message?: string;
}

/**
 * JUnit XML test suite
 */
export interface JUnitTestSuite {
  _name: string;
  _tests: number;
  _failures: number;
  _skipped: number;
  _errors: number;
  _time: string;
  _timestamp?: string;
  testcase?: JUnitTestCase[];
}

/**
 * JUnit XML test result
 */
export interface JUnitTestResults {
  testsuite?: JUnitTestSuite[];
  testsuites?: {
    testsuite?: JUnitTestSuite[];
  };
}

/**
 * JSON report format
 */
export interface JSONReport {
  /** Report metadata */
  meta: {
    generatedAt: string;
    generator: string;
    version: string;
  };
  /** Test summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
    duration: number;
    passRate: number;
  };
  /** Test suites */
  suites: JSONTestSuite[];
}

/**
 * JSON test suite
 */
export interface JSONTestSuite {
  name: string;
  duration: number;
  tests: TestCaseResult[];
}

/**
 * Platform-specific metadata extracted from CI environment
 */
export interface PlatformMetadata {
  /** Platform name */
  platform: CIPlatform;
  /** Pipeline/Job ID */
  pipelineId?: string;
  /** Build number */
  buildNumber?: string;
  /** Build URL */
  buildUrl?: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Commit message */
  commitMessage?: string;
  /** Author */
  author?: string;
  /** Pull request number */
  prNumber?: string;
  /** Pull request URL */
  prUrl?: string;
  /** Repository URL */
  repoUrl?: string;
  /** Environment variables */
  envVars?: Record<string, string>;
}
