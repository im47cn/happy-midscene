/**
 * Loop Manager
 * 循环管理器 - 管理循环执行与安全防护
 */

import type {
  ExecutionContext as AdaptiveExecutionContext,
  LoopConfig,
  LoopContext,
  LoopType,
} from '../../types/adaptive';
import { type ConditionEngine, getConditionEngine } from './conditionEngine';

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
 * 循环管理器选项
 */
export interface LoopManagerOptions {
  agent?: AIAgent;
  debug?: boolean;
}

/**
 * 循环执行结果
 */
export interface LoopExecutionResult {
  completed: boolean;
  iterations: number;
  duration: number;
  reason?: 'max_iterations' | 'timeout' | 'condition_false' | 'error';
  error?: Error;
}

/**
 * 循环管理器类
 */
export class LoopManager {
  private agent: AIAgent | null = null;
  private conditionEngine: ConditionEngine;
  private debug: boolean;

  constructor(options: LoopManagerOptions = {}) {
    this.agent = options.agent || null;
    this.conditionEngine = getConditionEngine(this.agent || undefined);
    this.debug = options.debug || false;
  }

  /**
   * 设置 AI Agent
   */
  setAgent(agent: AIAgent): void {
    this.agent = agent;
    this.conditionEngine.setAgent(agent);
  }

  /**
   * 执行循环
   */
  async execute(
    loop: LoopConfig,
    context: AdaptiveExecutionContext,
    bodyFn: (iteration: number, item?: any) => Promise<void>,
  ): Promise<LoopExecutionResult> {
    const startTime = performance.now();

    try {
      switch (loop.type) {
        case 'count':
          return await this.executeCountLoop(loop, context, bodyFn);

        case 'while':
          return await this.executeWhileLoop(loop, context, bodyFn);

        case 'forEach':
          return await this.executeForEachLoop(loop, context, bodyFn);

        default:
          return {
            completed: false,
            iterations: 0,
            duration: performance.now() - startTime,
            reason: 'error',
            error: new Error(`Unknown loop type: ${loop.type}`),
          };
      }
    } catch (error) {
      return {
        completed: false,
        iterations:
          context.loopStack[context.loopStack.length - 1]?.currentIteration ||
          0,
        duration: performance.now() - startTime,
        reason: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 执行计数循环
   */
  private async executeCountLoop(
    loop: LoopConfig,
    context: AdaptiveExecutionContext,
    bodyFn: (iteration: number) => Promise<void>,
  ): Promise<LoopExecutionResult> {
    const count = loop.count || 1;
    const maxIterations = Math.min(count, loop.maxIterations);

    // Create loop context
    const loopContext: LoopContext = {
      loopId: `loop_${Date.now()}`,
      currentIteration: 0,
      maxIterations: maxIterations,
      startTime: Date.now(),
    };

    context.loopStack.push(loopContext);

    const startTime = performance.now();

    for (let i = 0; i < maxIterations; i++) {
      // Check timeout
      if (loop.timeout && Date.now() - loopContext.startTime > loop.timeout) {
        return {
          completed: false,
          iterations: i,
          duration: performance.now() - startTime,
          reason: 'timeout',
        };
      }

      loopContext.currentIteration = i + 1;

      if (this.debug) {
        console.log(
          `[LoopManager] Count loop iteration ${i + 1}/${maxIterations}`,
        );
      }

      await bodyFn(i + 1);
    }

    context.loopStack.pop();

    return {
      completed: true,
      iterations: maxIterations,
      duration: performance.now() - startTime,
      reason: 'max_iterations',
    };
  }

  /**
   * 执行条件循环
   */
  private async executeWhileLoop(
    loop: LoopConfig,
    context: AdaptiveExecutionContext,
    bodyFn: (iteration: number) => Promise<void>,
  ): Promise<LoopExecutionResult> {
    const condition = loop.condition;
    if (!condition) {
      return {
        completed: false,
        iterations: 0,
        duration: 0,
        reason: 'error',
        error: new Error('While loop requires a condition'),
      };
    }

    // Create loop context
    const loopContext: LoopContext = {
      loopId: `loop_while_${Date.now()}`,
      currentIteration: 0,
      maxIterations: loop.maxIterations,
      startTime: Date.now(),
    };

    context.loopStack.push(loopContext);

    const startTime = performance.now();
    let iteration = 0;

    while (iteration < loop.maxIterations) {
      // Check timeout
      if (loop.timeout && Date.now() - loopContext.startTime > loop.timeout) {
        return {
          completed: false,
          iterations: iteration,
          duration: performance.now() - startTime,
          reason: 'timeout',
        };
      }

      // Evaluate condition
      const result = await this.conditionEngine.evaluate(condition, context);
      if (!result.success || !result.value) {
        context.loopStack.pop();
        return {
          completed: true,
          iterations: iteration,
          duration: performance.now() - startTime,
          reason: 'condition_false',
        };
      }

      loopContext.currentIteration = iteration + 1;

      if (this.debug) {
        console.log(
          `[LoopManager] While loop iteration ${iteration + 1} (condition: true)`,
        );
      }

      await bodyFn(iteration + 1);
      iteration++;
    }

    context.loopStack.pop();

    return {
      completed: false,
      iterations: iteration,
      duration: performance.now() - startTime,
      reason: 'max_iterations',
    };
  }

  /**
   * 执行遍历循环
   */
  private async executeForEachLoop(
    loop: LoopConfig,
    context: AdaptiveExecutionContext,
    bodyFn: (iteration: number, item: any) => Promise<void>,
  ): Promise<LoopExecutionResult> {
    const collectionVar = loop.collection;
    const itemVar = loop.itemVar || 'item';

    // Get collection from context or variable
    let collection: any[] = [];

    if (collectionVar?.startsWith('.')) {
      // It's a selector - need to find elements
      // This would be handled during execution with agent
      collection = [];
    } else if (collectionVar) {
      // It's a variable reference
      const value = context.variables.get(collectionVar);
      collection = Array.isArray(value) ? value : [value];
    }

    const maxIterations = Math.min(collection.length, loop.maxIterations);

    // Create loop context
    const loopContext: LoopContext = {
      loopId: `loop_foreach_${Date.now()}`,
      currentIteration: 0,
      maxIterations: maxIterations,
      collection,
      currentItem: undefined,
      itemVar,
      startTime: Date.now(),
    };

    context.loopStack.push(loopContext);

    const startTime = performance.now();

    for (let i = 0; i < maxIterations; i++) {
      const item = collection[i];

      // Check timeout
      if (loop.timeout && Date.now() - loopContext.startTime > loop.timeout) {
        return {
          completed: false,
          iterations: i,
          duration: performance.now() - startTime,
          reason: 'timeout',
        };
      }

      loopContext.currentIteration = i + 1;
      loopContext.currentItem = item;

      // Set item variable in context
      context.variables.set(itemVar, item);

      if (this.debug) {
        console.log(
          `[LoopManager] ForEach loop iteration ${i + 1}/${maxIterations}, item:`,
          item,
        );
      }

      await bodyFn(i + 1, item);
    }

    // Clean up item variable
    context.variables.delete(itemVar);

    context.loopStack.pop();

    return {
      completed: true,
      iterations: maxIterations,
      duration: performance.now() - startTime,
    };
  }

  /**
   * 检查循环是否应该继续
   */
  shouldContinue(loopContext: LoopContext, loopConfig: LoopConfig): boolean {
    // Check max iterations
    if (loopContext.currentIteration >= loopContext.maxIterations) {
      return false;
    }

    // Check timeout
    if (loopConfig.timeout) {
      const elapsed = Date.now() - loopContext.startTime;
      if (elapsed > loopConfig.timeout) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取当前循环状态
   */
  getCurrentLoop(context: AdaptiveExecutionContext): LoopContext | undefined {
    return context.loopStack[context.loopStack.length - 1];
  }

  /**
   * 获取循环嵌套深度
   */
  getLoopDepth(context: AdaptiveExecutionContext): number {
    return context.loopStack.length;
  }

  /**
   * 中断当前循环
   */
  breakLoop(context: AdaptiveExecutionContext): void {
    const currentLoop = context.loopStack.pop();
    if (currentLoop && this.debug) {
      console.log(
        `[LoopManager] Breaking loop ${currentLoop.loopId} at iteration ${currentLoop.currentIteration}`,
      );
    }
  }

  /**
   * 跳过当前迭代
   */
  continueLoop(context: AdaptiveExecutionContext): void {
    const currentLoop = context.loopStack[context.loopStack.length - 1];
    if (currentLoop && this.debug) {
      console.log(
        `[LoopManager] Continuing loop ${currentLoop.loopId} (skipping iteration ${currentLoop.currentIteration})`,
      );
    }
  }
}

/**
 * 默认循环管理器实例
 */
let defaultManager: LoopManager | null = null;

/**
 * 获取默认循环管理器
 */
export function getLoopManager(agent?: AIAgent): LoopManager {
  if (!defaultManager) {
    defaultManager = new LoopManager();
  }
  if (agent) {
    defaultManager.setAgent(agent);
  }
  return defaultManager;
}

/**
 * 快捷执行函数
 */
export async function executeLoop(
  loop: LoopConfig,
  context: AdaptiveExecutionContext,
  bodyFn: (iteration: number, item?: any) => Promise<void>,
  agent?: AIAgent,
): Promise<LoopExecutionResult> {
  const manager = getLoopManager(agent);
  return manager.execute(loop, context, bodyFn);
}
