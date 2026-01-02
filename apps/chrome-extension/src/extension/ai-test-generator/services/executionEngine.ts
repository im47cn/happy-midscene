/**
 * Execution Engine for AI Test Generator
 * Orchestrates Midscene.js to execute test steps on the host page
 */

import type { TaskStep, TestCase } from './markdownParser';
import type { HealingResult, SelfHealingConfig } from '../types/healing';
import { healingEngine } from './healing';
import { DEFAULT_SELF_HEALING_CONFIG } from '../types/healing';
import { dataCollector, alertManager } from './analytics';
import type { StepRecord, ExecutionRecord } from '../types/analytics';

export interface DeviceEmulationConfig {
  deviceId: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  isMobile: boolean;
  hasTouch: boolean;
}

export interface ExecutionContext {
  url: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceEmulation?: DeviceEmulationConfig;
}

export interface ExecutionError {
  message: string;
  type: 'element_not_found' | 'timeout' | 'action_failed' | 'navigation_failed' | 'assertion_failed' | 'unknown';
  details?: string;
  suggestion?: string;
  elementInfo?: {
    selector?: string;
    description?: string;
    candidates?: string[];
  };
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  generatedAction?: string;
  screenshot?: string;
  error?: string;
  errorDetails?: ExecutionError;
  duration: number;
  // Self-healing info
  healingResult?: HealingResult;
  healedByAI?: boolean;
}

export interface ExecutionCallbacks {
  onStepStart?: (step: TaskStep, index: number) => void;
  onStepComplete?: (step: TaskStep, result: ExecutionResult) => void;
  onStepFailed?: (step: TaskStep, error: string, errorDetails?: ExecutionError) => void;
  onHighlight?: (element: { x: number; y: number; width: number; height: number }) => void;
  onProgress?: (current: number, total: number) => void;
  // Self-healing callbacks
  onHealingAttempt?: (step: TaskStep, healingResult: HealingResult) => void;
  onHealingConfirmRequest?: (step: TaskStep, healingResult: HealingResult) => Promise<boolean>;
}

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Convert natural language step to Midscene action
 * Maps common Chinese/English phrases to action types
 */
function inferActionType(text: string): 'click' | 'type' | 'scroll' | 'wait' | 'assert' | 'navigate' | 'ai' {
  const lowerText = text.toLowerCase();

  // Navigation
  if (/^(打开|访问|跳转|go to|navigate|open|visit)\s/i.test(text)) {
    return 'navigate';
  }

  // Click actions
  if (/点击|单击|按下|click|tap|press|选择|select/i.test(text)) {
    return 'click';
  }

  // Type/Input actions
  if (/输入|填写|键入|type|input|enter|fill/i.test(text)) {
    return 'type';
  }

  // Scroll actions
  if (/滚动|滑动|scroll|swipe/i.test(text)) {
    return 'scroll';
  }

  // Wait actions
  if (/等待|wait|sleep|delay/i.test(text)) {
    return 'wait';
  }

  // Assert/Verify actions
  if (/验证|确认|检查|断言|verify|assert|check|should|expect/i.test(text)) {
    return 'assert';
  }

  // Default to AI action for complex descriptions
  return 'ai';
}

/**
 * Generate YAML action from step
 */
function generateYamlAction(step: TaskStep): string {
  const actionType = inferActionType(step.originalText);

  switch (actionType) {
    case 'navigate':
      // Extract URL if present
      const urlMatch = step.originalText.match(/https?:\/\/[^\s"']+/);
      if (urlMatch) {
        return `- goto: "${urlMatch[0]}"`;
      }
      return `- ai: "${step.originalText}"`;

    case 'wait':
      // Extract duration if present
      const durationMatch = step.originalText.match(/(\d+)\s*(秒|毫秒|ms|s|second)/i);
      if (durationMatch) {
        const value = Number.parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const ms = unit === '秒' || unit === 's' || unit === 'second' ? value * 1000 : value;
        return `- sleep: ${ms}`;
      }
      return `- aiWaitFor: "${step.originalText}"`;

    case 'assert':
      return `- aiAssert: "${step.originalText}"`;

    default:
      // Use ai action for most cases - let Midscene handle the complexity
      return `- ai: "${step.originalText}"`;
  }
}

/**
 * Parse error to extract detailed information
 */
function parseErrorDetails(error: unknown, stepText: string): ExecutionError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Element not found
  if (lowerMessage.includes('element not found') ||
      lowerMessage.includes('cannot find') ||
      lowerMessage.includes('no element') ||
      lowerMessage.includes('unable to locate') ||
      lowerMessage.includes('找不到') ||
      lowerMessage.includes('未找到')) {
    return {
      message,
      type: 'element_not_found',
      details: '无法在页面上找到匹配的元素',
      suggestion: '请尝试：1. 使用更具体的描述 2. 检查元素是否可见 3. 等待页面完全加载',
      elementInfo: {
        description: stepText,
      },
    };
  }

  // Timeout
  if (lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out') ||
      lowerMessage.includes('超时')) {
    return {
      message,
      type: 'timeout',
      details: '操作执行超时',
      suggestion: '请检查：1. 网络连接是否正常 2. 页面是否正在加载 3. 目标元素是否需要更长时间才能出现',
    };
  }

  // Navigation failed
  if (lowerMessage.includes('navigation') ||
      lowerMessage.includes('navigate') ||
      lowerMessage.includes('goto') ||
      lowerMessage.includes('跳转')) {
    return {
      message,
      type: 'navigation_failed',
      details: '页面导航失败',
      suggestion: '请检查：1. URL 是否正确 2. 网络连接是否正常 3. 页面是否需要身份验证',
    };
  }

  // Assertion failed
  if (lowerMessage.includes('assert') ||
      lowerMessage.includes('expect') ||
      lowerMessage.includes('verify') ||
      lowerMessage.includes('验证失败') ||
      lowerMessage.includes('断言')) {
    return {
      message,
      type: 'assertion_failed',
      details: '页面状态验证失败',
      suggestion: '请检查：1. 验证条件是否正确 2. 页面内容是否符合预期 3. 是否需要等待某些元素加载',
    };
  }

  // Action failed
  if (lowerMessage.includes('click') ||
      lowerMessage.includes('type') ||
      lowerMessage.includes('input') ||
      lowerMessage.includes('scroll') ||
      lowerMessage.includes('点击') ||
      lowerMessage.includes('输入')) {
    return {
      message,
      type: 'action_failed',
      details: '操作执行失败',
      suggestion: '请检查：1. 元素是否可点击/可交互 2. 是否被其他元素遮挡 3. 页面是否完全加载',
    };
  }

  // Unknown error
  return {
    message,
    type: 'unknown',
    details: '发生未知错误',
    suggestion: '请尝试：1. 刷新页面 2. 修改操作描述 3. 检查控制台日志获取更多信息',
  };
}

export class ExecutionEngine {
  private status: ExecutionStatus = 'idle';
  private currentStepIndex = 0;
  private executionResults: ExecutionResult[] = [];
  private agent: any = null;
  private callbacks: ExecutionCallbacks = {};
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;
  private selfHealingConfig: SelfHealingConfig;

  constructor(private getAgent: (forceSameTabNavigation?: boolean) => any, selfHealingConfig?: Partial<SelfHealingConfig>) {
    this.selfHealingConfig = { ...DEFAULT_SELF_HEALING_CONFIG, ...selfHealingConfig };
  }

  /**
   * Update self-healing configuration
   */
  setSelfHealingConfig(config: Partial<SelfHealingConfig>): void {
    this.selfHealingConfig = { ...this.selfHealingConfig, ...config };
    healingEngine.updateConfig(config);
  }

  /**
   * Get self-healing configuration
   */
  getSelfHealingConfig(): SelfHealingConfig {
    return { ...this.selfHealingConfig };
  }

  /**
   * Set execution callbacks
   */
  setCallbacks(callbacks: ExecutionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current execution status
   */
  getStatus(): ExecutionStatus {
    return this.status;
  }

  /**
   * Get execution results
   */
  getResults(): ExecutionResult[] {
    return this.executionResults;
  }

  /**
   * Initialize agent for execution
   */
  private async initAgent(): Promise<void> {
    if (!this.agent) {
      this.agent = this.getAgent(true);
    }
  }

  /**
   * Apply device emulation settings via CDP
   */
  private async applyDeviceEmulation(config: DeviceEmulationConfig): Promise<void> {
    if (!this.agent?.page) return;

    try {
      // Use CDP to set device metrics override
      const page = this.agent.page;

      // Check if the page has sendCommandToDebugger method (ChromeExtensionProxyPage)
      if (typeof page.sendCommandToDebugger === 'function') {
        // Set device metrics override
        await page.sendCommandToDebugger('Emulation.setDeviceMetricsOverride', {
          width: config.width,
          height: config.height,
          deviceScaleFactor: config.deviceScaleFactor,
          mobile: config.isMobile,
        });

        // Set user agent if specified
        if (config.userAgent) {
          await page.sendCommandToDebugger('Emulation.setUserAgentOverride', {
            userAgent: config.userAgent,
          });
        }

        // Enable touch events if needed
        if (config.hasTouch) {
          await page.sendCommandToDebugger('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 5,
          });
        }
      }
    } catch (error) {
      console.warn('Failed to apply device emulation:', error);
    }
  }

  /**
   * Clear device emulation settings
   */
  private async clearDeviceEmulation(): Promise<void> {
    if (!this.agent?.page) return;

    try {
      const page = this.agent.page;
      if (typeof page.sendCommandToDebugger === 'function') {
        await page.sendCommandToDebugger('Emulation.clearDeviceMetricsOverride', {});
        await page.sendCommandToDebugger('Emulation.setTouchEmulationEnabled', {
          enabled: false,
        });
      }
    } catch (error) {
      console.warn('Failed to clear device emulation:', error);
    }
  }

  /**
   * Destroy agent after execution
   */
  private async destroyAgent(): Promise<void> {
    // Clear device emulation before destroying
    await this.clearDeviceEmulation();

    if (this.agent?.page?.destroy) {
      await this.agent.page.destroy();
    }
    this.agent = null;
  }

  /**
   * Extract element info from agent dump after successful aiAct
   */
  private extractElementFromDump(): { center: [number, number]; rect: any } | null {
    try {
      const executions = this.agent?.dump?.executions;
      if (!executions || executions.length === 0) return null;

      const lastExecution = executions[executions.length - 1];
      const locateTasks = lastExecution.tasks?.filter(
        (t: any) => t.type === 'Planning' && t.subType === 'Locate'
      );

      if (!locateTasks || locateTasks.length === 0) return null;

      const lastLocate = locateTasks[locateTasks.length - 1];
      const element = lastLocate?.output?.element;

      if (element?.center && element?.rect) {
        return {
          center: element.center,
          rect: element.rect,
        };
      }
      return null;
    } catch (error) {
      console.debug('Failed to extract element from dump:', error);
      return null;
    }
  }

  /**
   * Execute a single step with self-healing support
   */
  private async executeStep(step: TaskStep): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Use Midscene's AI action
      await this.agent.aiAct(step.originalText);

      // Success: try to collect fingerprint for future healing
      if (this.selfHealingConfig.enabled) {
        const elementInfo = this.extractElementFromDump();
        if (elementInfo) {
          try {
            healingEngine.setAgent(this.agent);
            await healingEngine.collectFingerprint(
              step.id,
              elementInfo.center,
              elementInfo.rect
            );
          } catch (fpError) {
            console.debug('Failed to collect fingerprint:', fpError);
          }
        }
      }

      const result: ExecutionResult = {
        stepId: step.id,
        success: true,
        generatedAction: generateYamlAction(step),
        duration: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      const errorDetails = parseErrorDetails(error, step.originalText);

      // Try self-healing if enabled and error is element_not_found
      if (
        this.selfHealingConfig.enabled &&
        errorDetails.type === 'element_not_found'
      ) {
        const healingResult = await this.tryHealing(step, errorDetails);
        if (healingResult) {
          return healingResult;
        }
      }

      return {
        stepId: step.id,
        success: false,
        error: errorDetails.message,
        errorDetails,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Attempt self-healing for a failed step
   */
  private async tryHealing(
    step: TaskStep,
    originalError: ExecutionError
  ): Promise<ExecutionResult | null> {
    try {
      healingEngine.setAgent(this.agent);
      const healResult = await healingEngine.heal(step.id, step.originalText);

      // Notify about healing attempt
      this.callbacks.onHealingAttempt?.(step, healResult);

      if (!healResult.success) {
        return null;
      }

      const action = healingEngine.determineAction(healResult);

      if (action === 'reject') {
        return null;
      }

      // For auto_accept or request_confirmation
      let accepted = action === 'auto_accept';

      if (action === 'request_confirmation' && this.callbacks.onHealingConfirmRequest) {
        // Ask user for confirmation
        accepted = await this.callbacks.onHealingConfirmRequest(step, healResult);
      }

      if (accepted && healResult.element) {
        // Confirm healing and update fingerprint
        await healingEngine.confirmHealing(healResult.healingId, true);

        // Re-execute the step using the healed element location
        // For now, we'll use aiAct again as Midscene should find the element now
        try {
          await this.agent.aiAct(step.originalText);

          return {
            stepId: step.id,
            success: true,
            generatedAction: generateYamlAction(step),
            duration: healResult.timeCost,
            healingResult: healResult,
            healedByAI: true,
          };
        } catch (retryError) {
          console.debug('Retry after healing failed:', retryError);
          return null;
        }
      }

      return null;
    } catch (healError) {
      console.debug('Self-healing failed:', healError);
      return null;
    }
  }

  /**
   * Execute all steps in a test case
   */
  async executeTestCase(
    testCase: TestCase,
    context?: ExecutionContext
  ): Promise<{ success: boolean; results: ExecutionResult[]; yamlContent: string }> {
    this.status = 'running';
    this.currentStepIndex = 0;
    this.executionResults = [];
    this.isPaused = false;

    const executionStartTime = Date.now();

    try {
      await this.initAgent();

      // Apply device emulation if configured
      if (context?.deviceEmulation) {
        await this.applyDeviceEmulation(context.deviceEmulation);
      }

      // Navigate to URL if provided
      if (context?.url) {
        await this.agent.page.goto(context.url);
      }

      const totalSteps = testCase.steps.length;

      for (let i = 0; i < testCase.steps.length; i++) {
        // Check if paused
        if (this.isPaused) {
          await new Promise<void>((resolve) => {
            this.resumeResolve = resolve;
          });
        }

        // Check if stopped (status may change during async wait)
        if ((this.status as ExecutionStatus) === 'idle') {
          break;
        }

        const step = testCase.steps[i];
        this.currentStepIndex = i;

        // Notify step start
        this.callbacks.onStepStart?.(step, i);
        this.callbacks.onProgress?.(i + 1, totalSteps);

        // Execute step
        const result = await this.executeStep(step);
        this.executionResults.push(result);

        // Update step status
        step.status = result.success ? 'success' : 'failed';
        step.generatedAction = result.generatedAction;

        if (result.success) {
          this.callbacks.onStepComplete?.(step, result);
        } else {
          step.error = result.error;
          this.callbacks.onStepFailed?.(step, result.error || 'Unknown error', result.errorDetails);

          // Pause on failure for human intervention
          this.status = 'paused';
          this.isPaused = true;

          // Wait for resume or stop
          await new Promise<void>((resolve) => {
            this.resumeResolve = resolve;
          });

          // If stopped during pause, break (status may change during async wait)
          if ((this.status as ExecutionStatus) === 'idle') {
            break;
          }
        }
      }

      const allSuccess = this.executionResults.every((r) => r.success);
      this.status = allSuccess ? 'completed' : 'failed';

      // Generate YAML content
      const yamlContent = this.generateYaml(testCase, context);

      // Record execution for analytics
      await this.recordExecutionAnalytics(testCase, context, executionStartTime);

      return {
        success: allSuccess,
        results: this.executionResults,
        yamlContent,
      };
    } catch (error) {
      this.status = 'failed';
      // Still try to record failed execution
      try {
        await this.recordExecutionAnalytics(testCase, context, executionStartTime);
      } catch (analyticsError) {
        console.debug('Failed to record analytics:', analyticsError);
      }
      throw error;
    } finally {
      await this.destroyAgent();
    }
  }

  /**
   * Record execution data for analytics
   */
  private async recordExecutionAnalytics(
    testCase: TestCase,
    context: ExecutionContext | undefined,
    startTime: number
  ): Promise<void> {
    try {
      // Convert execution results to step records
      const stepRecords: StepRecord[] = this.executionResults.map((result, index) => {
        const step = testCase.steps[index];
        return {
          index,
          description: step?.originalText || `Step ${index + 1}`,
          status: result.success ? 'passed' : 'failed',
          duration: result.duration,
          aiResponseTime: result.duration, // Approximate
          retryCount: result.healedByAI ? 1 : 0,
        };
      });

      // Determine viewport from context
      const viewport = context?.deviceEmulation
        ? { width: context.deviceEmulation.width, height: context.deviceEmulation.height }
        : { width: context?.viewportWidth || 1920, height: context?.viewportHeight || 1080 };

      // Create execution record
      const executionRecord = dataCollector.createExecutionRecord(
        testCase.id || `case-${Date.now()}`,
        testCase.name,
        stepRecords,
        {
          browser: 'chrome',
          viewport,
          url: context?.url || window.location.href,
        },
        // Include healing info if any step was healed
        this.executionResults.some(r => r.healedByAI)
          ? {
              attempted: true,
              success: this.executionResults.some(r => r.healedByAI && r.success),
              strategy: 'ai_relocate',
            }
          : undefined
      );

      // Record the execution
      await dataCollector.recordExecution(executionRecord);

      // Check alert rules
      await alertManager.checkAlerts(executionRecord);
    } catch (error) {
      console.debug('Failed to record execution analytics:', error);
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
      this.isPaused = true;
    }
  }

  /**
   * Resume execution
   */
  resume(): void {
    if (this.status === 'paused' && this.resumeResolve) {
      this.status = 'running';
      this.isPaused = false;
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Stop execution
   */
  stop(): void {
    this.status = 'idle';
    this.isPaused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  /**
   * Retry failed step with modified instruction
   */
  async retryStep(stepId: string, newInstruction?: string): Promise<ExecutionResult> {
    // This would be called from UI when user modifies the instruction
    // For now, just re-execute
    const step: TaskStep = {
      id: stepId,
      originalText: newInstruction || '',
      status: 'pending',
    };

    await this.initAgent();
    const result = await this.executeStep(step);
    return result;
  }

  /**
   * Generate YAML from test case and results
   */
  generateYaml(testCase: TestCase, context?: ExecutionContext): string {
    const lines: string[] = [
      '# Generated by AI Test Agent',
      `# ${new Date().toISOString()}`,
      '',
    ];

    // Target section
    if (context?.url) {
      lines.push('target:');
      lines.push(`  url: "${context.url}"`);
      if (context.viewportWidth && context.viewportHeight) {
        lines.push(`  viewportWidth: ${context.viewportWidth}`);
        lines.push(`  viewportHeight: ${context.viewportHeight}`);
      }
      lines.push('');
    }

    // Cases section
    lines.push('cases:');
    lines.push(`  - name: "${testCase.name}"`);

    if (testCase.description) {
      lines.push(`    description: "${testCase.description}"`);
    }

    lines.push('    flow:');

    for (const step of testCase.steps) {
      const action = step.generatedAction || generateYamlAction(step);
      // Indent properly under flow
      lines.push(`      ${action}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate YAML from multiple test cases
   */
  generateYamlFromCases(cases: TestCase[], context?: ExecutionContext): string {
    const lines: string[] = [
      '# Generated by AI Test Agent',
      `# ${new Date().toISOString()}`,
      '',
    ];

    // Target section
    if (context?.url) {
      lines.push('target:');
      lines.push(`  url: "${context.url}"`);
      if (context.viewportWidth && context.viewportHeight) {
        lines.push(`  viewportWidth: ${context.viewportWidth}`);
        lines.push(`  viewportHeight: ${context.viewportHeight}`);
      }
      lines.push('');
    }

    // Cases section
    lines.push('cases:');

    for (const testCase of cases) {
      lines.push(`  - name: "${testCase.name}"`);

      if (testCase.description) {
        lines.push(`    description: "${testCase.description}"`);
      }

      lines.push('    flow:');

      for (const step of testCase.steps) {
        const action = step.generatedAction || generateYamlAction(step);
        lines.push(`      ${action}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
