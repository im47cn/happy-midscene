/**
 * Adaptive Execution Engine
 * 自适应执行引擎 - 集成流程控制与现有执行引擎
 */

import type {
  AdaptiveTestCase,
  AdaptiveStep,
  ExecutionContext as AdaptiveExecutionContext,
  StepResult,
} from '../../types/adaptive';
import { DEFAULT_ADAPTIVE_CONFIG } from '../../types/adaptive';
import {
  ControlFlowExecutor,
  type ControlFlowOptions,
  type ExtendedStepResult,
} from './controlFlowExecutor';
import {
  VariableStore,
  getVariableStore,
  type VariableChangeEvent,
} from './variableStore';
import type { ExecutionEngine, ExecutionContext, ExecutionCallbacks, ExecutionResult } from '../executionEngine';

/**
 * AI Agent 接口 (Midscene)
 */
interface AIAgent {
  aiAct?(prompt: string): Promise<void>;
  aiLocate?(prompt: string, options?: { deepThink?: boolean }): Promise<any>;
  describeElementAtPoint?(center: { x: number; y: number }, options?: any): Promise<any>;
  dump?: { executions?: any[] };
  page?: {
    goto?(url: string): Promise<void>;
    evaluate?<T>(fn: () => T): Promise<T>;
  };
}

/**
 * 自适应执行回调接口
 */
export interface AdaptiveExecutionCallbacks extends ExecutionCallbacks {
  // 步骤生命周期
  onAdaptiveStepStart?: (step: AdaptiveStep, depth: number) => void;
  onAdaptiveStepComplete?: (step: AdaptiveStep, result: ExtendedStepResult) => void;
  onAdaptiveStepFailed?: (step: AdaptiveStep, error: Error) => void;

  // 流程控制事件
  onConditionEvaluated?: (stepId: string, expression: string, result: boolean) => void;
  onLoopIteration?: (stepId: string, iteration: number, total: number) => void;
  onVariableChanged?: (event: VariableChangeEvent) => void;

  // 路径事件
  onBranchTaken?: (stepId: string, branch: 'then' | 'else') => void;
  onPathChanged?: (path: string[]) => void;

  // 进度事件
  onDepthChanged?: (currentDepth: number, maxDepth: number) => void;
}

/**
 * 自适应执行结果
 */
export interface AdaptiveExecutionResult {
  success: boolean;
  results: ExtendedStepResult[];
  executionStats: {
    totalSteps: number;
    executedBranches: number;
    loopIterations: number;
    maxDepth: number;
    totalDuration: number;
  };
  finalContext: Partial<AdaptiveExecutionContext>;
  pathHistory: string[];
  yamlContent: string;
}

/**
 * 自适应执行选项
 */
export interface AdaptiveExecutionOptions {
  // 超时配置
  totalTimeout?: number;
  stepTimeout?: number;

  // 调试配置
  debug?: boolean;
  verbose?: boolean;

  // 恢复配置
  checkpointEnabled?: boolean;
  checkpointInterval?: number;
}

/**
 * 步骤执行上下文
 */
interface StepExecutionContext {
  testCase: AdaptiveTestCase;
  context: AdaptiveExecutionContext;
  results: ExtendedStepResult[];
  options: AdaptiveExecutionOptions;
  startTime: number;
}

/**
 * 自适应执行引擎类
 * 集成 ControlFlowExecutor 与 ExecutionEngine
 */
export class AdaptiveExecutionEngine {
  private executionEngine: ExecutionEngine | null = null;
  private agent: AIAgent | null = null;
  private controlFlowExecutor: ControlFlowExecutor;
  private variableStore: VariableStore;
  private callbacks: AdaptiveExecutionCallbacks = {};
  private options: AdaptiveExecutionOptions;
  private config: typeof DEFAULT_ADAPTIVE_CONFIG;
  private currentDepth = 0;
  private pathHistory: string[] = [];
  private executionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private variableChangeUnsubscriber: (() => void) | null = null;

  constructor(
    private getAgent: (forceSameTabNavigation?: boolean) => AIAgent,
    options: AdaptiveExecutionOptions = {},
    config?: Partial<typeof DEFAULT_ADAPTIVE_CONFIG>
  ) {
    this.options = {
      totalTimeout: 300000,
      stepTimeout: 30000,
      debug: false,
      verbose: false,
      checkpointEnabled: false,
      checkpointInterval: 5000,
      ...options,
    };

    this.config = {
      ...DEFAULT_ADAPTIVE_CONFIG,
      ...config,
    };

    // Initialize control flow executor
    this.controlFlowExecutor = new ControlFlowExecutor({
      agent: this.agent || undefined,
      debug: this.options.debug,
      onStepStart: this.handleControlFlowStepStart.bind(this),
      onStepComplete: this.handleControlFlowStepComplete.bind(this),
    });

    // Initialize variable store
    this.variableStore = getVariableStore();

    // Note: Variable change listener will be set up when callbacks are registered
    // because we need access to the callbacks object which is set via setCallbacks
  }

  /**
   * Set the execution engine for standard test execution
   */
  setExecutionEngine(engine: ExecutionEngine): void {
    this.executionEngine = engine;
  }

  /**
   * Set AI agent
   */
  setAgent(agent: AIAgent): void {
    this.agent = agent;
    this.controlFlowExecutor.setAgent(agent);
  }

  /**
   * Set execution callbacks
   */
  setCallbacks(callbacks: AdaptiveExecutionCallbacks): void {
    this.callbacks = callbacks;

    // Clean up previous variable change listener
    if (this.variableChangeUnsubscriber) {
      this.variableChangeUnsubscriber();
      this.variableChangeUnsubscriber = null;
    }

    // Set up new variable change listener
    if (callbacks.onVariableChanged) {
      this.variableChangeUnsubscriber = this.variableStore.onChange((event) => {
        callbacks.onVariableChanged?.(event);
      });
    }

    // Forward standard callbacks to execution engine
    if (this.executionEngine) {
      this.executionEngine.setCallbacks({
        onStepStart: callbacks.onStepStart,
        onStepComplete: callbacks.onStepComplete,
        onStepFailed: callbacks.onStepFailed,
        onHighlight: callbacks.onHighlight,
        onProgress: callbacks.onProgress,
        onHealingAttempt: callbacks.onHealingAttempt,
        onHealingConfirmRequest: callbacks.onHealingConfirmRequest,
      });
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<typeof DEFAULT_ADAPTIVE_CONFIG>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): typeof DEFAULT_ADAPTIVE_CONFIG {
    return { ...this.config };
  }

  /**
   * Execute adaptive test case
   */
  async executeAdaptiveTestCase(
    testCase: AdaptiveTestCase,
    context?: ExecutionContext
  ): Promise<AdaptiveExecutionResult> {
    const startTime = Date.now();

    // Initialize agent
    if (!this.agent) {
      this.agent = this.getAgent(true);
      this.controlFlowExecutor.setAgent(this.agent);
    }

    // Build adaptive execution context
    const adaptiveContext = this.buildAdaptiveContext(testCase, context);

    // Reset state
    this.currentDepth = 0;
    this.pathHistory = [];
    this.variableStore.clear();

    // Initialize variables from test case
    for (const [name, value] of Object.entries(testCase.variables)) {
      this.variableStore.set(name, value);
    }

    // Set up total timeout
    this.setupTotalTimeout(this.config.totalTimeout);

    const stepContext: StepExecutionContext = {
      testCase,
      context: adaptiveContext,
      results: [],
      options: this.options,
      startTime,
    };

    try {
      // Navigate to URL if provided
      if (context?.url && this.agent?.page?.goto) {
        await this.agent.page.goto(context.url);
      }

      // Execute all steps with flow control
      const results = await this.executeStepsWithFlowControl(
        testCase.steps,
        stepContext
      );

      // Clear timeout
      this.clearTotalTimeout();

      // Calculate execution statistics
      const stats = this.controlFlowExecutor.getExecutionStats(adaptiveContext);
      const totalDuration = Date.now() - startTime;

      // Generate YAML content
      const yamlContent = this.generateYaml(testCase, results);

      return {
        success: results.every((r) => r.success),
        results,
        executionStats: {
          ...stats,
          totalDuration,
        },
        finalContext: {
          variables: adaptiveContext.variables,
          currentDepth: adaptiveContext.currentDepth,
        },
        pathHistory: this.pathHistory,
        yamlContent,
      };
    } catch (error) {
      this.clearTotalTimeout();

      const failureResult: AdaptiveExecutionResult = {
        success: false,
        results: stepContext.results,
        executionStats: {
          totalSteps: stepContext.results.length,
          executedBranches: 0,
          loopIterations: 0,
          maxDepth: this.currentDepth,
          totalDuration: Date.now() - startTime,
        },
        finalContext: {
          variables: adaptiveContext.variables,
          currentDepth: adaptiveContext.currentDepth,
        },
        pathHistory: this.pathHistory,
        yamlContent: '',
      };

      // Propagate error
      throw error;
    } finally {
      // Cleanup
      this.variableStore.clear();
    }
  }

  /**
   * Execute steps with flow control
   */
  private async executeStepsWithFlowControl(
    steps: AdaptiveStep[],
    stepContext: StepExecutionContext
  ): Promise<ExtendedStepResult[]> {
    const results: ExtendedStepResult[] = [];

    for (const step of steps) {
      // Check if should stop
      if (this.controlFlowExecutor.shouldStop(stepContext.context)) {
        if (this.options.verbose) {
          console.warn('[AdaptiveExecution] Execution stopped due to safety limits');
        }
        break;
      }

      // Execute step with flow control
      const result = await this.controlFlowExecutor.executeStep(
        step,
        stepContext.context,
        async (s) => this.executeBaseAction(s, stepContext)
      );

      results.push(result);

      // Update path history
      if (result.branch) {
        this.pathHistory.push(`${step.id}:${result.branch}`);
        this.callbacks.onBranchTaken?.(step.id, result.branch as 'then' | 'else');
      }

      // Track depth
      if (result.contextSnapshot?.currentDepth !== undefined) {
        this.currentDepth = result.contextSnapshot.currentDepth;
        this.callbacks.onDepthChanged?.(
          this.currentDepth,
          this.config.maxNestedDepth
        );
      }

      // Notify step completion
      this.callbacks.onAdaptiveStepComplete?.(step, result);

      // Stop on failure
      if (!result.success && result.error) {
        this.callbacks.onAdaptiveStepFailed?.(step, result.error);
        break;
      }

      // Update context from snapshot
      if (result.contextSnapshot) {
        if (result.contextSnapshot.variables) {
          stepContext.context.variables = result.contextSnapshot.variables;
        }
      }
    }

    return results;
  }

  /**
   * Execute base action step
   */
  private async executeBaseAction(
    step: AdaptiveStep,
    stepContext: StepExecutionContext
  ): Promise<void> {
    if (!step.action) {
      return;
    }

    // Replace variable references in description
    const processedDescription = this.variableStore.replaceVariables(
      step.description
    );

    // Execute using the underlying agent
    const agent = this.agent;
    if (agent?.aiAct) {
      await agent.aiAct(processedDescription);
    }

    // Handle variable extraction if specified
    if (step.variable?.operation === 'extract' && step.variable.source) {
      await this.extractVariable(step.variable.name, step.variable.source);
    }
  }

  /**
   * Extract variable from page
   * Uses aiLocate to find the element and extract its value
   */
  private async extractVariable(
    varName: string,
    selector: string
  ): Promise<void> {
    const agent = this.agent;
    if (!agent?.aiLocate) {
      return;
    }

    try {
      // Use aiLocate to find the element
      const locateResult = await agent.aiLocate(selector);

      // Extract value from locate result
      let value: any = null;

      if (locateResult?.text !== undefined) {
        value = locateResult.text;
      } else if (locateResult?.value !== undefined) {
        value = locateResult.value;
      } else if (locateResult?.element !== undefined) {
        // Element was found but no specific value
        value = true;
      }

      if (value !== null) {
        this.variableStore.set(varName, value);
      }
    } catch (error) {
      if (this.options.debug) {
        console.warn(`[AdaptiveExecution] Failed to extract variable ${varName}:`, error);
      }
    }
  }

  /**
   * Build adaptive execution context
   */
  private buildAdaptiveContext(
    testCase: AdaptiveTestCase,
    context?: ExecutionContext
  ): AdaptiveExecutionContext {
    return {
      variables: new Map(Object.entries(testCase.variables)),
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: 0,
    };
  }

  /**
   * Setup total execution timeout
   */
  private setupTotalTimeout(timeout: number): void {
    this.clearTotalTimeout();

    this.executionTimeoutId = setTimeout(() => {
      throw new Error(`Adaptive test execution timeout (${timeout}ms)`);
    }, timeout);
  }

  /**
   * Clear total execution timeout
   */
  private clearTotalTimeout(): void {
    if (this.executionTimeoutId) {
      clearTimeout(this.executionTimeoutId);
      this.executionTimeoutId = null;
    }
  }

  /**
   * Handle control flow step start callback
   */
  private handleControlFlowStepStart(step: AdaptiveStep): void {
    this.callbacks.onAdaptiveStepStart?.(step, this.currentDepth);
  }

  /**
   * Handle control flow step complete callback
   */
  private handleControlFlowStepComplete(
    step: AdaptiveStep,
    result: ExtendedStepResult
  ): void {
    // Notify condition evaluation
    if (result.branch && step.condition?.expression) {
      this.callbacks.onConditionEvaluated?.(
        step.id,
        step.condition.expression,
        result.branch === 'then'
      );
    }

    // Notify loop iteration
    if (result.branch === 'loop' && result.iterations !== undefined) {
      this.callbacks.onLoopIteration?.(
        step.id,
        result.iterations,
        result.iterations
      );
    }
  }

  /**
   * Generate YAML from adaptive test case
   */
  private generateYaml(
    testCase: AdaptiveTestCase,
    results: ExtendedStepResult[]
  ): string {
    const lines: string[] = [
      '# Adaptive Test Case',
      `# Generated: ${new Date().toISOString()}`,
      '',
      `name: "${testCase.name}"`,
    ];

    if (testCase.description) {
      lines.push(`description: "${testCase.description}"`);
    }

    lines.push('');
    lines.push('variables:');

    for (const [name, value] of Object.entries(testCase.variables)) {
      lines.push(`  ${name}: ${JSON.stringify(value)}`);
    }

    lines.push('');
    lines.push('steps:');

    for (const step of testCase.steps) {
      const result = results.find((r) => r.stepId === step.id);
      const status = result?.success ? '✓' : '✗';
      lines.push(`  - ${status} ${step.description}`);
    }

    return lines.join('\n');
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.executionEngine) {
      this.executionEngine.pause();
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.executionEngine) {
      this.executionEngine.resume();
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.clearTotalTimeout();

    if (this.executionEngine) {
      this.executionEngine.stop();
    }
  }

  /**
   * Get current variable values
   */
  getVariables(): Record<string, any> {
    return this.variableStore.getAll();
  }

  /**
   * Get current path history
   */
  getPathHistory(): string[] {
    return [...this.pathHistory];
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalSteps: number;
    executedBranches: number;
    loopIterations: number;
    maxDepth: number;
  } {
    return this.controlFlowExecutor.getExecutionStats({
      variables: new Map(),
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: this.currentDepth,
    });
  }
}

/**
 * 默认自适应执行引擎实例
 */
let defaultEngine: AdaptiveExecutionEngine | null = null;

/**
 * 获取默认自适应执行引擎
 */
export function getAdaptiveExecutionEngine(
  getAgent: (forceSameTabNavigation?: boolean) => AIAgent,
  options?: AdaptiveExecutionOptions,
  config?: Partial<typeof DEFAULT_ADAPTIVE_CONFIG>
): AdaptiveExecutionEngine {
  if (!defaultEngine) {
    defaultEngine = new AdaptiveExecutionEngine(getAgent, options, config);
  }
  return defaultEngine;
}

/**
 * 快捷执行函数
 */
export async function executeAdaptiveTest(
  testCase: AdaptiveTestCase,
  getAgent: (forceSameTabNavigation?: boolean) => AIAgent,
  context?: ExecutionContext,
  options?: AdaptiveExecutionOptions
): Promise<AdaptiveExecutionResult> {
  const engine = getAdaptiveExecutionEngine(getAgent, options);
  return engine.executeAdaptiveTestCase(testCase, context);
}
