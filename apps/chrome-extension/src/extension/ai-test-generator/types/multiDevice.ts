/**
 * Multi-Device Collaborative Testing Types
 */

/**
 * Device types supported by the system
 */
export type DeviceType = 'browser' | 'android' | 'ios' | 'remote';

/**
 * Device connection status
 */
export type DeviceStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'busy'
  | 'error';

/**
 * Orchestrator execution state
 */
export type OrchestratorState =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/**
 * Device configuration
 */
export interface DeviceConfig {
  /** Unique device identifier */
  id: string;
  /** Human-readable alias for the device */
  alias: string;
  /** Device type */
  type: DeviceType;
  /** Browser viewport settings (for browser type) */
  viewport?: { width: number; height: number };
  /** Starting URL (for browser type) */
  startUrl?: string;
  /** Android device ID (for android type) */
  deviceId?: string;
  /** App package name (for android type) */
  package?: string;
  /** WebDriverAgent host (for ios type) */
  wdaHost?: string;
  /** WebDriverAgent port (for ios type) */
  wdaPort?: number;
  /** WebSocket URL (for remote type) */
  wsUrl?: string;
}

/**
 * Device session info
 */
export interface DeviceInfo {
  id: string;
  alias: string;
  type: DeviceType;
  status: DeviceStatus;
  currentStep?: number;
  totalSteps?: number;
  lastError?: string;
  lastScreenshot?: string;
}

/**
 * Step types in a collaborative flow
 */
export type FlowStepType = 'device' | 'sync' | 'parallel';

/**
 * A single action step
 */
export interface ActionStep {
  /** AI instruction */
  ai?: string;
  /** Assertion */
  assert?: string;
  /** Data export */
  export?: Record<string, string>;
  /** Wait for condition */
  waitFor?: string;
  /** Navigate to URL */
  navigate?: string;
}

/**
 * Device execution block in the flow
 */
export interface DeviceFlowStep {
  type: 'device';
  /** Step name for display */
  name?: string;
  /** Target device alias */
  device: string;
  /** Whether this step runs in parallel with the previous */
  parallel?: boolean;
  /** Action steps to execute */
  steps: ActionStep[];
}

/**
 * Sync point in the flow
 */
export interface SyncFlowStep {
  type: 'sync';
  /** Sync point identifier */
  id: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Parallel execution block
 */
export interface ParallelFlowStep {
  type: 'parallel';
  /** Blocks to execute in parallel */
  blocks: DeviceFlowStep[];
}

/**
 * Union type for all flow steps
 */
export type FlowStep = DeviceFlowStep | SyncFlowStep | ParallelFlowStep;

/**
 * Collaborative script definition
 */
export interface CollaborativeScript {
  /** Script name */
  name: string;
  /** Script description */
  description?: string;
  /** Device configurations */
  devices: Record<string, Omit<DeviceConfig, 'id' | 'alias'>>;
  /** Initial variables */
  variables?: Record<string, string>;
  /** Execution flow */
  flow: FlowStep[];
}

/**
 * Step execution result
 */
export interface StepResult {
  success: boolean;
  error?: string;
  screenshot?: string;
  duration: number;
  exportedData?: Record<string, any>;
}

/**
 * Device execution result
 */
export interface DeviceExecutionResult {
  deviceId: string;
  deviceAlias: string;
  steps: Array<{
    instruction: string;
    result: StepResult;
  }>;
  totalDuration: number;
}

/**
 * Sync point timing
 */
export interface SyncPointTiming {
  id: string;
  startTime: number;
  endTime: number;
  waitingDevices: string[];
  duration: number;
}

/**
 * Overall execution result
 */
export interface CollaborativeExecutionResult {
  success: boolean;
  startTime: number;
  endTime: number;
  totalDuration: number;
  devices: DeviceExecutionResult[];
  syncPoints: SyncPointTiming[];
  sharedData: Record<string, any>;
  errors: Array<{
    deviceId: string;
    step: number;
    error: string;
  }>;
}

/**
 * Timeline event for monitoring
 */
export interface TimelineEvent {
  timestamp: number;
  type: 'step_start' | 'step_end' | 'sync_wait' | 'sync_release' | 'error';
  deviceId?: string;
  stepIndex?: number;
  syncPointId?: string;
  message?: string;
}

/**
 * Orchestrator status
 */
export interface OrchestratorStatus {
  state: OrchestratorState;
  devices: DeviceInfo[];
  currentSyncPoint?: string;
  sharedData: Record<string, any>;
  timeline: TimelineEvent[];
  progress: {
    completedSteps: number;
    totalSteps: number;
    percentage: number;
  };
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Default sync point timeout in ms */
  syncTimeout: number;
  /** Whether to stop all devices on failure */
  stopOnFailure: boolean;
  /** Maximum concurrent devices */
  maxDevices: number;
  /** Screenshot capture interval in ms (0 = disabled) */
  screenshotInterval: number;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  syncTimeout: 60000,
  stopOnFailure: true,
  maxDevices: 5,
  screenshotInterval: 0,
};

/**
 * Data transformation functions
 */
export type DataTransformer = 'trim' | 'number' | 'format' | 'uppercase' | 'lowercase';

/**
 * Variable reference with optional transformation
 */
export interface VariableRef {
  key: string;
  transformer?: DataTransformer;
  transformerArg?: string;
}

/**
 * Callbacks for orchestrator events
 */
export interface OrchestratorCallbacks {
  onDeviceStatusChange?: (deviceId: string, status: DeviceStatus) => void;
  onStepStart?: (deviceId: string, stepIndex: number, instruction: string) => void;
  onStepComplete?: (deviceId: string, stepIndex: number, result: StepResult) => void;
  onSyncWait?: (syncPointId: string, waitingDevices: string[]) => void;
  onSyncRelease?: (syncPointId: string) => void;
  onDataExport?: (key: string, value: any, deviceId: string) => void;
  onError?: (deviceId: string, error: Error) => void;
  onProgress?: (status: OrchestratorStatus) => void;
}
