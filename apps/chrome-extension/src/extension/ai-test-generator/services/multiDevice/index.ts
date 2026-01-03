/**
 * Multi-Device Collaborative Testing Module
 *
 * Provides orchestration and session management for cross-device E2E testing.
 * Supports Web (browser), Android, iOS, and remote devices.
 */

// Core types
export type {
  CollaborativeExecutionResult,
  CollaborativeScript,
  DeviceConfig,
  DeviceExecutionResult,
  DeviceInfo,
  DeviceStatus,
  DeviceType,
  FlowStep,
  OrchestratorCallbacks,
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorStatus,
  StepResult,
  TimelineEvent,
} from '../../types/multiDevice';
export { DEFAULT_ORCHESTRATOR_CONFIG } from '../../types/multiDevice';

// Device Session
export {
  BaseDeviceSession,
  DEFAULT_RETRY_CONFIG,
  type DeviceSession,
  type RetryConfig,
  type SessionEvent,
  type SessionEventListener,
  type SessionEventType,
  type TestStep,
  withRetry,
} from './deviceSession';

// Sessions
export {
  BrowserSession,
  type BrowserSessionConfig,
  createBrowserSession,
  AndroidSession,
  type AndroidSessionConfig,
  createAndroidSession,
  iOSSession,
  type iOSSessionConfig,
  createiOSSession,
} from './sessions';

// Orchestrator
export {
  createOrchestrator,
  Orchestrator,
  type SessionFactory,
} from './orchestrator';

// Sync Manager
export {
  createSyncManager,
  SyncManager,
  type SyncEvent,
  type SyncEventListener,
  type SyncEventType,
  type SyncPointState,
} from './syncManager';

// Data Channel
export {
  createDataChannel,
  DataChannel,
  type DataChangeEvent,
  type DataChangeListener,
  type KeySubscription,
} from './dataChannel';

// Script Parser
export {
  createScriptParser,
  type ParseError,
  type ParseResult,
  ScriptParser,
} from './scriptParser';

// Result Aggregator
export {
  createResultAggregator,
  ResultAggregator,
  type AggregatedResult,
  type AggregatedStats,
  type DeviceComparison,
  type FailureCorrelation,
  type TimelineSegment,
} from './resultAggregator';

// Report Generator
export {
  CollaborativeReportGenerator,
  createCollaborativeReportGenerator,
  type GeneratedReport,
  type ReportFormat,
  type ReportOptions,
} from './collaborativeReportGenerator';

// Device Presets
export {
  allPresets,
  createConfigFromPreset,
  createConfigsFromScenario,
  desktopPresets,
  getPresetById,
  getPresetsByCategory,
  getPresetsByType,
  getScenarioById,
  mobilePresets,
  tabletPresets,
  testScenarios,
  type DevicePreset,
  type TestScenario,
} from './devicePresets';

// Performance Utilities
export {
  createScreenshotCompressor,
  createMessageBatcher,
  createMemoryPool,
  createPerformanceMonitor,
  ScreenshotCompressor,
  MessageBatcher,
  MemoryPool,
  PerformanceMonitor,
  type CompressionConfig,
  type CompressionResult,
  type BatchConfig,
  type MemoryStats,
  DEFAULT_COMPRESSION_CONFIG,
} from './performance';
