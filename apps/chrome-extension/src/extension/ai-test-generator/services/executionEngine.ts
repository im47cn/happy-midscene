/**
 * Execution Engine for AI Test Generator
 * Orchestrates Midscene.js to execute test steps on the host page
 */

import type { TaskStep, TestCase } from './markdownParser';

export interface ExecutionContext {
  url: string;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  generatedAction?: string;
  screenshot?: string;
  error?: string;
  duration: number;
}

export interface ExecutionCallbacks {
  onStepStart?: (step: TaskStep, index: number) => void;
  onStepComplete?: (step: TaskStep, result: ExecutionResult) => void;
  onStepFailed?: (step: TaskStep, error: string) => void;
  onHighlight?: (element: { x: number; y: number; width: number; height: number }) => void;
  onProgress?: (current: number, total: number) => void;
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

export class ExecutionEngine {
  private status: ExecutionStatus = 'idle';
  private currentStepIndex = 0;
  private executionResults: ExecutionResult[] = [];
  private agent: any = null;
  private callbacks: ExecutionCallbacks = {};
  private isPaused = false;
  private resumeResolve: (() => void) | null = null;

  constructor(private getAgent: (forceSameTabNavigation?: boolean) => any) {}

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
   * Destroy agent after execution
   */
  private async destroyAgent(): Promise<void> {
    if (this.agent?.page?.destroy) {
      await this.agent.page.destroy();
    }
    this.agent = null;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: TaskStep): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Use Midscene's AI action
      await this.agent.aiAct(step.originalText);

      const result: ExecutionResult = {
        stepId: step.id,
        success: true,
        generatedAction: generateYamlAction(step),
        duration: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
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

    try {
      await this.initAgent();

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
          this.callbacks.onStepFailed?.(step, result.error || 'Unknown error');

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

      return {
        success: allSuccess,
        results: this.executionResults,
        yamlContent,
      };
    } catch (error) {
      this.status = 'failed';
      throw error;
    } finally {
      await this.destroyAgent();
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
