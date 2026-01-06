/**
 * Control Flow Executor
 * 流程控制执行器 - 执行条件分支和循环
 */

import type {
  ExecutionContext as AdaptiveExecutionContext,
  AdaptiveStep,
  ConditionExpression,
  LoopConfig,
  PathEntry,
  StepResult,
} from '../../types/adaptive';
import { type ConditionEngine, getConditionEngine } from './conditionEngine';
import { type LoopManager, getLoopManager } from './loopManager';

/**
 * AI Agent 接口 (Midscene)
 */
interface AIAgent {
  aiLocate?(prompt: string, options?: { deepThink?: boolean }): Promise<any>;
  describeElementAtPoint?(
    center: { x: number; y: number },
    options?: any,
  ): Promise<any>;
  dump?: { executions?: any[] };
}

/**
 * 执行选项
 */
export interface ControlFlowOptions {
  agent?: AIAgent;
  onStepStart?: (step: AdaptiveStep) => void;
  onStepComplete?: (step: AdaptiveStep, result: ExtendedStepResult) => void;
  debug?: boolean;
}

/**
 * 执行结果扩展
 */
export interface ExtendedStepResult extends StepResult {
  stepId: string;
  branch?: 'then' | 'else' | 'loop' | 'end';
  contextSnapshot?: Partial<AdaptiveExecutionContext>;
}

/**
 * 流程控制执行器类
 */
export class ControlFlowExecutor {
  private agent: AIAgent | null = null;
  private conditionEngine: ConditionEngine;
  private loopManager: LoopManager;
  private options: ControlFlowOptions;

  constructor(options: ControlFlowOptions = {}) {
    this.agent = options.agent || null;
    this.options = options;
    this.conditionEngine = getConditionEngine(this.agent || undefined);
    this.loopManager = getLoopManager(this.agent || undefined);
  }

  /**
   * 设置 AI Agent
   */
  setAgent(agent: AIAgent): void {
    this.agent = agent;
    this.conditionEngine.setAgent(agent);
    this.loopManager.setAgent(agent);
  }

  /**
   * 执行步骤
   */
  async executeStep(
    step: AdaptiveStep,
    context: AdaptiveExecutionContext,
    executeAction?: (step: AdaptiveStep) => Promise<void>,
  ): Promise<ExtendedStepResult> {
    const startTime = performance.now();

    if (this.options.onStepStart) {
      this.options.onStepStart(step);
    }

    try {
      let result: ExtendedStepResult;

      switch (step.type) {
        case 'action':
          result = await this.executeAction(step, context, executeAction);
          break;

        case 'condition':
          result = await this.executeCondition(step, context, executeAction);
          break;

        case 'loop':
          result = await this.executeLoop(step, context, executeAction);
          break;

        case 'variable':
          result = await this.executeVariable(step, context);
          break;

        default:
          result = {
            stepId: step.id,
            success: false,
            error: new Error(`Unknown step type: ${step.type}`),
            duration: performance.now() - startTime,
          };
      }

      if (this.options.onStepComplete) {
        this.options.onStepComplete(step, result);
      }

      return result;
    } catch (error) {
      const errorResult: ExtendedStepResult = {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: performance.now() - startTime,
      };

      if (this.options.onStepComplete) {
        this.options.onStepComplete(step, errorResult);
      }

      return errorResult;
    }
  }

  /**
   * 执行动作步骤
   */
  private async executeAction(
    step: AdaptiveStep,
    context: AdaptiveExecutionContext,
    executeAction?: (step: AdaptiveStep) => Promise<void>,
  ): Promise<ExtendedStepResult> {
    const startTime = performance.now();

    if (executeAction) {
      await executeAction(step);
    }

    return {
      stepId: step.id,
      success: true,
      duration: performance.now() - startTime,
    };
  }

  /**
   * 执行条件分支
   */
  private async executeCondition(
    step: AdaptiveStep,
    context: AdaptiveExecutionContext,
    executeAction?: (step: AdaptiveStep) => Promise<void>,
  ): Promise<ExtendedStepResult> {
    const startTime = performance.now();
    const condition = step.condition;

    if (!condition) {
      return {
        stepId: step.id,
        success: false,
        error: new Error('Condition step missing condition data'),
        duration: performance.now() - startTime,
      };
    }

    // Evaluate condition expression
    const evaluation = await this.conditionEngine.evaluate(
      condition.expression,
      context,
    );

    if (!evaluation.success) {
      return {
        stepId: step.id,
        success: false,
        error: new Error(evaluation.error || 'Condition evaluation failed'),
        duration: evaluation.duration,
      };
    }

    // Record path decision
    const pathEntry: PathEntry = {
      stepId: step.id,
      branch: evaluation.value ? 'then' : 'else',
      timestamp: Date.now(),
      condition: condition.expression,
    };
    context.pathHistory.push(pathEntry);

    // Execute appropriate branch
    const branch = evaluation.value ? 'then' : 'else';
    const stepsToExecute = evaluation.value
      ? condition.thenSteps
      : condition.elseSteps;

    if (!stepsToExecute || stepsToExecute.length === 0) {
      return {
        stepId: step.id,
        success: true,
        skipped: true,
        branch,
        duration: evaluation.duration,
      };
    }

    // Execute all steps in the branch
    let allSucceeded = true;
    for (const subStep of stepsToExecute) {
      const result = await this.executeStep(subStep, context, executeAction);
      if (!result.success) {
        allSucceeded = false;
        break;
      }
    }

    return {
      stepId: step.id,
      success: allSucceeded,
      branch,
      duration: performance.now() - startTime,
      contextSnapshot: {
        variables: new Map(context.variables),
        currentDepth: context.currentDepth,
      },
    };
  }

  /**
   * 执行循环
   */
  private async executeLoop(
    step: AdaptiveStep,
    context: AdaptiveExecutionContext,
    executeAction?: (step: AdaptiveStep) => Promise<void>,
  ): Promise<ExtendedStepResult> {
    const startTime = performance.now();
    const loop = step.loop;

    if (!loop) {
      return {
        stepId: step.id,
        success: false,
        error: new Error('Loop step missing loop configuration'),
        duration: performance.now() - startTime,
      };
    }

    // Execute loop body
    const loopResult = await this.loopManager.execute(
      loop,
      context,
      async (iteration, item) => {
        // Record path entry
        context.pathHistory.push({
          stepId: step.id,
          branch: 'loop',
          timestamp: Date.now(),
        });

        // Execute all steps in loop body
        for (const bodyStep of loop.body) {
          const result = await this.executeStep(
            bodyStep,
            context,
            executeAction,
          );
          if (!result.success) {
            throw result.error || new Error('Loop body step failed');
          }
        }
      },
    );

    return {
      stepId: step.id,
      success: loopResult.completed,
      iterations: loopResult.iterations,
      branch: 'loop',
      duration: performance.now() - startTime,
      contextSnapshot: {
        variables: new Map(context.variables),
        currentDepth: context.currentDepth,
      },
    };
  }

  /**
   * 执行变量操作
   */
  private async executeVariable(
    step: AdaptiveStep,
    context: AdaptiveExecutionContext,
  ): Promise<ExtendedStepResult> {
    const startTime = performance.now();
    const variable = step.variable;

    if (!variable) {
      return {
        stepId: step.id,
        success: false,
        error: new Error('Variable step missing variable operation'),
        duration: performance.now() - startTime,
      };
    }

    try {
      switch (variable.operation) {
        case 'set':
          context.variables.set(variable.name, variable.value);
          break;

        case 'increment':
          const current = context.variables.get(variable.name) ?? 0;
          context.variables.set(
            variable.name,
            typeof current === 'number' ? current + 1 : 1,
          );
          break;

        case 'extract':
          // Value would be extracted during execution
          // For now, set placeholder
          if (variable.value !== undefined) {
            context.variables.set(variable.name, variable.value);
          }
          break;

        default:
          return {
            stepId: step.id,
            success: false,
            error: new Error(
              `Unknown variable operation: ${variable.operation}`,
            ),
            duration: performance.now() - startTime,
          };
      }

      return {
        stepId: step.id,
        success: true,
        duration: performance.now() - startTime,
        contextSnapshot: {
          variables: new Map(context.variables),
        },
      };
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * 执行多个步骤
   */
  async executeSteps(
    steps: AdaptiveStep[],
    context: AdaptiveExecutionContext,
    executeAction?: (step: AdaptiveStep) => Promise<void>,
  ): Promise<ExtendedStepResult[]> {
    const results: ExtendedStepResult[] = [];

    for (const step of steps) {
      const result = await this.executeStep(step, context, executeAction);
      results.push(result);

      // Stop on failure
      if (!result.success && result.error) {
        break;
      }
    }

    return results;
  }

  /**
   * 检查是否应该中断执行
   */
  shouldStop(context: AdaptiveExecutionContext): boolean {
    // Check max depth
    if (context.currentDepth > 10) {
      return true;
    }

    // Check error stack
    if (context.errorStack.length > 5) {
      return true;
    }

    return false;
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(context: AdaptiveExecutionContext): {
    totalSteps: number;
    executedBranches: number;
    loopIterations: number;
    maxDepth: number;
  } {
    let executedBranches = 0;
    let loopIterations = 0;

    for (const entry of context.pathHistory) {
      if (entry.branch === 'then' || entry.branch === 'else') {
        executedBranches++;
      }
      if (entry.branch === 'loop') {
        loopIterations++;
      }
    }

    return {
      totalSteps: context.pathHistory.length,
      executedBranches,
      loopIterations,
      maxDepth: context.currentDepth,
    };
  }
}

/**
 * 默认流程控制执行器实例
 */
let defaultExecutor: ControlFlowExecutor | null = null;

/**
 * 获取默认流程控制执行器
 */
export function getControlFlowExecutor(agent?: AIAgent): ControlFlowExecutor {
  if (!defaultExecutor) {
    defaultExecutor = new ControlFlowExecutor();
  }
  if (agent) {
    defaultExecutor.setAgent(agent);
  }
  return defaultExecutor;
}

/**
 * 快捷执行函数
 */
export async function executeStep(
  step: AdaptiveStep,
  context: AdaptiveExecutionContext,
  executeAction?: (step: AdaptiveStep) => Promise<void>,
  agent?: AIAgent,
): Promise<ExtendedStepResult> {
  const executor = getControlFlowExecutor(agent);
  return executor.executeStep(step, context, executeAction);
}
