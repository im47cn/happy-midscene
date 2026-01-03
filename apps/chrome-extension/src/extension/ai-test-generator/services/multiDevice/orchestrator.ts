/**
 * Multi-Device Orchestrator
 * Coordinates execution across multiple device sessions
 */

import type {
  CollaborativeExecutionResult,
  CollaborativeScript,
  DeviceConfig,
  DeviceExecutionResult,
  DeviceFlowStep,
  DeviceInfo,
  DeviceStatus,
  FlowStep,
  OrchestratorCallbacks,
  OrchestratorConfig,
  OrchestratorState,
  OrchestratorStatus,
  ParallelFlowStep,
  StepResult,
  SyncFlowStep,
  SyncPointTiming,
  TimelineEvent,
} from '../../types/multiDevice';
import { DEFAULT_ORCHESTRATOR_CONFIG } from '../../types/multiDevice';
import type { DeviceSession, TestStep } from './deviceSession';
import { BrowserSession, type BrowserSessionConfig } from './sessions';

/**
 * Session factory type
 */
export type SessionFactory = (config: DeviceConfig) => DeviceSession;

/**
 * Multi-Device Orchestrator
 */
export class Orchestrator {
  private state: OrchestratorState = 'idle';
  private config: OrchestratorConfig;
  private sessions: Map<string, DeviceSession> = new Map();
  private sharedData: Map<string, any> = new Map();
  private timeline: TimelineEvent[] = [];
  private syncWaiters: Map<string, Set<string>> = new Map();
  private syncResolvers: Map<string, Map<string, () => void>> = new Map();
  private callbacks: OrchestratorCallbacks;
  private sessionFactory: SessionFactory | null = null;
  private getAgentFn: (() => any) | null = null;
  private executionStartTime = 0;
  private completedSteps = 0;
  private totalSteps = 0;
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;

  constructor(
    config?: Partial<OrchestratorConfig>,
    callbacks?: OrchestratorCallbacks,
  ) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.callbacks = callbacks || {};
  }

  /**
   * Set agent getter function for browser sessions
   */
  setAgentGetter(getAgent: () => any): void {
    this.getAgentFn = getAgent;
  }

  /**
   * Set custom session factory
   */
  setSessionFactory(factory: SessionFactory): void {
    this.sessionFactory = factory;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: OrchestratorCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return this.state;
  }

  /**
   * Get status
   */
  getStatus(): OrchestratorStatus {
    const devices: DeviceInfo[] = [];
    for (const session of this.sessions.values()) {
      devices.push(session.getInfo());
    }

    return {
      state: this.state,
      devices,
      sharedData: Object.fromEntries(this.sharedData),
      timeline: [...this.timeline],
      progress: {
        completedSteps: this.completedSteps,
        totalSteps: this.totalSteps,
        percentage:
          this.totalSteps > 0
            ? Math.round((this.completedSteps / this.totalSteps) * 100)
            : 0,
      },
    };
  }

  /**
   * Initialize device sessions from script
   */
  async initializeSessions(
    devices: Record<string, Omit<DeviceConfig, 'id' | 'alias'>>,
  ): Promise<void> {
    this.state = 'initializing';
    this.sessions.clear();

    for (const [alias, deviceConfig] of Object.entries(devices)) {
      const fullConfig: DeviceConfig = {
        id: `device-${alias}-${Date.now()}`,
        alias,
        ...deviceConfig,
      } as DeviceConfig;

      const session = this.createSession(fullConfig);
      this.sessions.set(alias, session);

      // Add status change listener
      session.addEventListener((event) => {
        if (event.type === 'status_change') {
          this.callbacks.onDeviceStatusChange?.(
            event.sessionId,
            event.data.status,
          );
          this.emitProgress();
        }
      });

      // Connect session
      try {
        await session.connect();
        this.addTimelineEvent('step_start', {
          deviceId: alias,
          message: `Device ${alias} connected`,
        });
      } catch (error) {
        this.addTimelineEvent('error', {
          deviceId: alias,
          message: `Failed to connect device ${alias}: ${error}`,
        });
        throw error;
      }
    }
  }

  /**
   * Create a session based on device config
   */
  private createSession(config: DeviceConfig): DeviceSession {
    // Use custom factory if provided
    if (this.sessionFactory) {
      return this.sessionFactory(config);
    }

    // Default factory
    switch (config.type) {
      case 'browser':
        const browserSession = new BrowserSession(
          config as BrowserSessionConfig,
        );
        if (this.getAgentFn) {
          browserSession.setAgentGetter(this.getAgentFn);
        }
        return browserSession;

      case 'android':
      case 'ios':
      case 'remote':
        // Placeholder for future implementations
        throw new Error(`Device type ${config.type} not yet implemented`);

      default:
        throw new Error(`Unknown device type: ${config.type}`);
    }
  }

  /**
   * Execute a collaborative script
   */
  async execute(
    script: CollaborativeScript,
  ): Promise<CollaborativeExecutionResult> {
    this.executionStartTime = Date.now();
    this.completedSteps = 0;
    this.timeline = [];
    this.sharedData.clear();

    // Initialize variables
    if (script.variables) {
      for (const [key, value] of Object.entries(script.variables)) {
        this.sharedData.set(key, value);
      }
    }

    // Initialize sessions
    await this.initializeSessions(script.devices);

    // Count total steps
    this.totalSteps = this.countTotalSteps(script.flow);

    // Execute flow
    this.state = 'running';
    const errors: Array<{ deviceId: string; step: number; error: string }> = [];
    const deviceResults: Map<string, DeviceExecutionResult> = new Map();
    const syncTimings: SyncPointTiming[] = [];

    // Initialize device results
    for (const alias of this.sessions.keys()) {
      deviceResults.set(alias, {
        deviceId: alias,
        deviceAlias: alias,
        steps: [],
        totalDuration: 0,
      });
    }

    try {
      for (let i = 0; i < script.flow.length; i++) {
        // Check pause
        if (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.resumeResolve = resolve;
          });
        }

        // Check stop - use getState() to avoid type narrowing
        if (this.getState() === 'idle') {
          break;
        }

        const flowStep = script.flow[i];

        if (flowStep.type === 'device') {
          await this.executeDeviceBlock(flowStep, deviceResults, errors);
        } else if (flowStep.type === 'sync') {
          await this.executeSyncPoint(flowStep, syncTimings);
        } else if (flowStep.type === 'parallel') {
          await this.executeParallelBlock(flowStep, deviceResults, errors);
        }

        if (this.config.stopOnFailure && errors.length > 0) {
          break;
        }
      }

      const success = errors.length === 0;
      this.state = success ? 'completed' : 'failed';

      return {
        success,
        startTime: this.executionStartTime,
        endTime: Date.now(),
        totalDuration: Date.now() - this.executionStartTime,
        devices: Array.from(deviceResults.values()),
        syncPoints: syncTimings,
        sharedData: Object.fromEntries(this.sharedData),
        errors,
      };
    } catch (error) {
      this.state = 'failed';
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      errors.push({
        deviceId: 'orchestrator',
        step: -1,
        error: errorMessage,
      });

      return {
        success: false,
        startTime: this.executionStartTime,
        endTime: Date.now(),
        totalDuration: Date.now() - this.executionStartTime,
        devices: Array.from(deviceResults.values()),
        syncPoints: syncTimings,
        sharedData: Object.fromEntries(this.sharedData),
        errors,
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute a device block
   */
  private async executeDeviceBlock(
    block: DeviceFlowStep,
    results: Map<string, DeviceExecutionResult>,
    errors: Array<{ deviceId: string; step: number; error: string }>,
  ): Promise<void> {
    const session = this.sessions.get(block.device);
    if (!session) {
      throw new Error(`Device not found: ${block.device}`);
    }

    const deviceResult = results.get(block.device)!;
    const blockStartTime = Date.now();

    // Inject shared data
    session.injectData(Object.fromEntries(this.sharedData));

    for (let i = 0; i < block.steps.length; i++) {
      const actionStep = block.steps[i];
      const stepIndex = deviceResult.steps.length;

      // Build test step
      const testStep: TestStep = {
        instruction: actionStep.ai || '',
        assert: actionStep.assert,
        waitFor: actionStep.waitFor,
        navigate: actionStep.navigate,
        export: actionStep.export,
      };

      // Emit step start
      this.callbacks.onStepStart?.(
        block.device,
        stepIndex,
        testStep.instruction || testStep.assert || testStep.navigate || '',
      );
      this.addTimelineEvent('step_start', {
        deviceId: block.device,
        stepIndex,
        message: testStep.instruction,
      });

      // Execute step
      const result = await session.executeStep(testStep);

      // Store result
      deviceResult.steps.push({
        instruction:
          testStep.instruction || testStep.assert || testStep.navigate || '',
        result,
      });

      // Handle exported data
      if (result.exportedData) {
        for (const [key, value] of Object.entries(result.exportedData)) {
          this.sharedData.set(key, value);
          this.callbacks.onDataExport?.(key, value, block.device);
        }
      }

      // Emit step complete
      this.callbacks.onStepComplete?.(block.device, stepIndex, result);
      this.addTimelineEvent('step_end', {
        deviceId: block.device,
        stepIndex,
        message: result.success ? 'Success' : result.error,
      });

      this.completedSteps++;
      this.emitProgress();

      // Handle errors
      if (!result.success) {
        errors.push({
          deviceId: block.device,
          step: stepIndex,
          error: result.error || 'Unknown error',
        });

        this.callbacks.onError?.(
          block.device,
          new Error(result.error || 'Unknown error'),
        );

        if (this.config.stopOnFailure) {
          break;
        }
      }
    }

    deviceResult.totalDuration += Date.now() - blockStartTime;
  }

  /**
   * Execute a sync point
   */
  private async executeSyncPoint(
    syncStep: SyncFlowStep,
    timings: SyncPointTiming[],
  ): Promise<void> {
    const startTime = Date.now();
    const timeout = syncStep.timeout || this.config.syncTimeout;
    const activeDevices = Array.from(this.sessions.keys());

    this.addTimelineEvent('sync_wait', {
      syncPointId: syncStep.id,
      message: `Sync point: ${syncStep.id}`,
    });

    // Simple sync - all devices have reached this point in sequence
    // In a real parallel scenario, we would need to track which devices
    // have reached the sync point

    this.callbacks.onSyncWait?.(syncStep.id, activeDevices);

    // For sequential execution, sync is immediate
    // For parallel execution, we would need to wait for all devices

    this.callbacks.onSyncRelease?.(syncStep.id);
    this.addTimelineEvent('sync_release', {
      syncPointId: syncStep.id,
    });

    timings.push({
      id: syncStep.id,
      startTime,
      endTime: Date.now(),
      waitingDevices: activeDevices,
      duration: Date.now() - startTime,
    });
  }

  /**
   * Execute parallel blocks
   */
  private async executeParallelBlock(
    parallel: ParallelFlowStep,
    results: Map<string, DeviceExecutionResult>,
    errors: Array<{ deviceId: string; step: number; error: string }>,
  ): Promise<void> {
    const promises = parallel.blocks.map((block) =>
      this.executeDeviceBlock(block, results, errors),
    );

    await Promise.all(promises);
  }

  /**
   * Count total steps in flow
   */
  private countTotalSteps(flow: FlowStep[]): number {
    let count = 0;

    for (const step of flow) {
      if (step.type === 'device') {
        count += step.steps.length;
      } else if (step.type === 'parallel') {
        for (const block of step.blocks) {
          count += block.steps.length;
        }
      }
    }

    return count;
  }

  /**
   * Add timeline event
   */
  private addTimelineEvent(
    type: TimelineEvent['type'],
    data: Partial<TimelineEvent>,
  ): void {
    this.timeline.push({
      timestamp: Date.now(),
      type,
      ...data,
    });
  }

  /**
   * Emit progress update
   */
  private emitProgress(): void {
    this.callbacks.onProgress?.(this.getStatus());
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      this.isPaused = true;
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.state === 'paused' && this.resumeResolve) {
      this.state = 'running';
      this.isPaused = false;
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.state = 'idle';
    this.isPaused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Cleanup sessions
   */
  private async cleanup(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const session of this.sessions.values()) {
      disconnectPromises.push(session.disconnect());
    }

    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Get shared data value
   */
  getSharedData(key: string): any {
    return this.sharedData.get(key);
  }

  /**
   * Set shared data value
   */
  setSharedData(key: string, value: any): void {
    this.sharedData.set(key, value);
    this.callbacks.onDataExport?.(key, value, 'orchestrator');
  }

  /**
   * Get session by alias
   */
  getSession(alias: string): DeviceSession | undefined {
    return this.sessions.get(alias);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): Map<string, DeviceSession> {
    return new Map(this.sessions);
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(
  config?: Partial<OrchestratorConfig>,
  callbacks?: OrchestratorCallbacks,
): Orchestrator {
  return new Orchestrator(config, callbacks);
}
