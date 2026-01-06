/**
 * @midscene/ci
 *
 * CI/CD integration for Midscene test automation.
 * Provides support for GitHub Actions, GitLab CI, Jenkins, Azure DevOps, and CircleCI.
 */

// Type exports
export type {
  // Basic types
  CIPlatform,
  TestStatus,
  ReportFormat,
  ShardStrategy,
  RetryStrategy,
  QualityGateOperator,
  NotificationChannel,

  // Configuration types
  CIConfig,
  EnvironmentConfig,
  ParallelConfig,
  RetryConfig,
  QualityGateConfig,
  QualityGateRule,
  ReportConfig,
  ArtifactConfig,
  NotificationConfig,

  // Result types
  TestCaseResult,
  ShardResult,
  CIExecutionResult,
  QualityGateResult,
  QualityGateRuleResult,

  // Report format types
  JUnitTestCase,
  JUnitFailure,
  JUnitSkipped,
  JUnitTestSuite,
  JUnitTestResults,
  JSONReport,
  JSONTestSuite,

  // Platform metadata
  PlatformMetadata,
} from './types/ci';

// Interface exports
export type {
  // Executor interfaces
  ICIExecutor,
  CIExecutorOptions,
  TestExecutionOptions,

  // Shard and parallel interfaces
  IShardManager,
  IParallelRunner,

  // Quality gate interfaces
  IQualityGateRule,
  IQualityGateEvaluator,
  QualityGateRuleEvaluationResult,

  // Report interfaces
  IReportGenerator,
  IReportFormatAdapter,

  // Artifact interfaces
  IArtifactManager,
  ArtifactUploadResult,

  // Environment interfaces
  IEnvManager,
  EnvironmentConfig as IEnvironmentConfig,

  // Config interfaces
  IConfigLoader,
  ConfigValidationResult,
  ConfigValidationError,

  // Retry interfaces
  IRetryManager,

  // Notification interfaces
  INotificationManager,
  NotificationResult,

  // Platform adapter interfaces
  IPlatformAdapter,
} from './services/ci/interfaces';

// Types export for convenience
export * from './types/ci';
