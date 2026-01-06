/**
 * CI Services
 *
 * Exports all CI-related services.
 */

// Core services
export { CIExecutor } from './executor';
export { ShardManager } from './shardManager';
export { ParallelRunner } from './parallelRunner';

// Quality gate
export {
  evaluateQualityGate,
  evaluateQualityGateWithBaseline,
  getExitCode,
  formatQualityGateResult,
} from './qualityGate';
export { RuleEngine, getRuleEngine, resetRuleEngine } from './ruleEngine';

// Rules
export {
  PassRateRule,
  CriticalTestsRule,
  NewFailuresRule,
  FlakyTestsRule,
} from './rules';
export type { QualityRule, RuleEvaluationResult } from './rules/types';

// Report generation
export {
  generateReport,
  generateReports,
  generateReportString,
  getAdapter,
  getSupportedFormats,
  getFormatExtension,
} from './reportGenerator';
export type { ReportOptions, ReportResult } from './reportGenerator';

// Format adapters
export { JUnitAdapter } from './formats/junitAdapter';
export { JSONAdapter } from './formats/jsonAdapter';
export { HTMLAdapter } from './formats/htmlAdapter';
export { MarkdownAdapter } from './formats/markdownAdapter';
export type { ReportAdapter } from './formats/types';

// Artifact management
export {
  ArtifactManager,
  createArtifactManager,
} from './artifactManager';
export type { ArtifactMetadata, ArtifactCollection } from './artifactManager';

// Environment management
export {
  EnvManager,
  createEnvManager,
  getEnvManager,
} from './envManager';
export type { EnvSource, EnvValue, EnvConfig } from './envManager';

// Configuration loading
export {
  ConfigLoader,
  loadConfig,
  loadConfigWithValidation,
} from './configLoader';
export type {
  ConfigFormat,
  ConfigLoadOptions,
  ConfigMetadata,
  ConfigLoadResult,
  ConfigSchema,
} from './configLoader';

// Retry mechanism
export {
  RetryManager,
  createRetryManager,
  retry,
  RetryConditions,
} from './retryManager';
export type { RetryConfig, RetryResult, RetryCondition } from './retryManager';

export {
  RetryStrategies,
  getStrategy,
  TestRetryConditions,
  TestRetryStrategies,
  retryOnErrorTypes,
  retryOnMessagePattern,
  anyRetryCondition,
  allRetryConditions,
  createRetryStrategy,
  mergeStrategy,
} from './retryStrategies';
export type { StrategyPreset } from './retryStrategies';

// Notifications
export {
  NotificationManager,
  createNotificationManager,
  sendNotification,
} from './notificationManager';
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationEventType,
  NotificationConfig,
  NotificationChannelConfig,
  SlackConfig,
  EmailConfig,
  WebhookConfig,
  NotificationTemplate,
  NotificationData,
  NotificationResult,
} from './notificationManager';

export {
  BuildTemplates,
  QualityGateTemplates,
  DeploymentTemplates,
  FlakyTestTemplates,
  formatTemplate,
  createNotificationData,
  getTemplateForEvent,
} from './messageTemplates';
export type {
  TemplateContext,
  MessageTemplate,
} from './messageTemplates';

// Interfaces
export type {
  ICIExecutor,
  IShardManager,
  IParallelRunner,
  IReportGenerator,
  IQualityGateEvaluator,
} from './interfaces';
