/**
 * Condition Engine
 * 条件引擎 - 评估条件表达式
 */

import type {
  ConditionExpression,
  ExecutionContext as AdaptiveExecutionContext,
  ElementCheck,
  PageState,
  EvaluateOptions,
} from '../../types/adaptive';

/**
 * 评估结果
 */
export interface EvaluationResult {
  success: boolean;
  value: boolean;
  error?: string;
  duration: number;
}

/**
 * AI Agent 接口 (Midscene)
 */
interface AIAgent {
  aiLocate?(prompt: string, options?: { deepThink?: boolean }): Promise<any>;
  describeElementAtPoint?(center: { x: number; y: number }, options?: any): Promise<any>;
  dump?: { executions?: any[] };
}

/**
 * 条件引擎选项
 */
export interface ConditionEngineOptions {
  agent?: AIAgent;
  timeout?: number;
  fallback?: boolean;
  debug?: boolean;
}

/**
 * 条件引擎类
 */
export class ConditionEngine {
  private agent: AIAgent | null = null;
  private timeout: number;
  private fallback: boolean;
  private debug: boolean;

  constructor(options: ConditionEngineOptions = {}) {
    this.agent = options.agent || null;
    this.timeout = options.timeout || 10000;
    this.fallback = options.fallback !== undefined ? options.fallback : false;
    this.debug = options.debug || false;
  }

  /**
   * 设置 AI Agent
   */
  setAgent(agent: AIAgent): void {
    this.agent = agent;
  }

  /**
   * 评估条件表达式
   */
  async evaluate(
    expression: ConditionExpression | string,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions = {}
  ): Promise<EvaluationResult> {
    const startTime = performance.now();

    try {
      // If expression is string, parse it first
      let parsedExpression: ConditionExpression;
      if (typeof expression === 'string') {
        const { parseNaturalLanguageCondition } = await import('./expressionParser');
        const parseResult = parseNaturalLanguageCondition(expression);
        if (!parseResult.success || !parseResult.result) {
          return {
            success: false,
            value: options.fallback ?? this.fallback,
            error: parseResult.error || 'Failed to parse expression',
            duration: performance.now() - startTime,
          };
        }
        parsedExpression = parseResult.result;
      } else {
        parsedExpression = expression;
      }

      // Evaluate based on type
      const value = await this.evaluateExpression(parsedExpression, context, options);

      if (this.debug) {
        console.log('[ConditionEngine] Evaluation result:', {
          expression: parsedExpression,
          value,
          duration: performance.now() - startTime,
        });
      }

      return {
        success: true,
        value,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        value: options.fallback ?? this.fallback,
        error: errorMessage,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * 评估表达式
   */
  private async evaluateExpression(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    switch (expression.type) {
      case 'element':
        return this.evaluateElementCondition(expression, context, options);

      case 'text':
        return this.evaluateTextCondition(expression, context, options);

      case 'state':
        return this.evaluateStateCondition(expression, context, options);

      case 'variable':
        return this.evaluateVariableCondition(expression, context, options);

      case 'compound':
        return this.evaluateCompoundCondition(expression, context, options);

      default:
        return options.fallback ?? this.fallback;
    }
  }

  /**
   * 评估元素条件
   */
  private async evaluateElementCondition(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    const element = expression.element;
    if (!element) {
      return this.fallback;
    }

    if (!this.agent?.aiLocate) {
      // Fallback: assume element exists if no agent
      return this.fallback;
    }

    try {
      const timeout = options.timeout ?? this.timeout;
      const result = await Promise.race([
        this.agent.aiLocate(element.target, { deepThink: false }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
        ),
      ]);

      if (!result) {
        return false;
      }

      // Check based on element check type
      switch (element.check) {
        case 'exists':
          return true;

        case 'visible':
          // Element is visible if it was found and has valid bounds
          return result.element?.rect?.width > 0 && result.element?.rect?.height > 0;

        case 'enabled':
          // Assume found elements are enabled unless explicitly disabled
          return true;

        case 'selected':
          // Check if element has selected attribute
          return result.element?.attributes?.selected === true ||
                 result.element?.attributes?.checked === true;

        default:
          return true;
      }
    } catch (error) {
      if (this.debug) {
        console.warn('[ConditionEngine] Element evaluation failed:', error);
      }
      return options.fallback ?? this.fallback;
    }
  }

  /**
   * 评估文本条件
   */
  private async evaluateTextCondition(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    const text = expression.text;
    if (!text) {
      return this.fallback;
    }

    // Get text from context (if available) or use agent
    let actualText = context.variables.get('__text_' + text.target) as string | undefined;

    if (!actualText && this.agent?.aiLocate) {
      try {
        const timeout = options.timeout ?? this.timeout;
        const result = await Promise.race([
          this.agent.aiLocate(text.target, { deepThink: false }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Evaluation timeout')), timeout)
          ),
        ]);

        if (result?.element?.text) {
          actualText = result.element.text;
        }
      } catch (error) {
        if (this.debug) {
          console.warn('[ConditionEngine] Text evaluation failed:', error);
        }
        return options.fallback ?? this.fallback;
      }
    }

    if (!actualText) {
      return false;
    }

    // Compare based on operator
    switch (text.operator) {
      case 'equals':
        return actualText === text.value;

      case 'contains':
        return actualText.includes(text.value);

      case 'matches':
        try {
          const regex = new RegExp(text.value, 'i');
          return regex.test(actualText);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * 评估状态条件
   */
  private async evaluateStateCondition(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    const state = expression.state;
    if (!state) {
      return this.fallback;
    }

    // Import state detector
    const { StateDetector } = await import('./stateDetector');
    const detector = new StateDetector({ agent: this.agent || undefined });

    return detector.detect(state.type, options);
  }

  /**
   * 评估变量条件
   */
  private async evaluateVariableCondition(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    const variable = expression.variable;
    if (!variable) {
      return this.fallback;
    }

    const actualValue = context.variables.get(variable.name);
    const expectedValue = variable.value;

    // Compare based on operator
    switch (variable.operator) {
      case '==':
        return actualValue == expectedValue;

      case '!=':
        return actualValue != expectedValue;

      case '>':
        return typeof actualValue === 'number' && actualValue > expectedValue;

      case '<':
        return typeof actualValue === 'number' && actualValue < expectedValue;

      case '>=':
        return typeof actualValue === 'number' && actualValue >= expectedValue;

      case '<=':
        return typeof actualValue === 'number' && actualValue <= expectedValue;

      default:
        return false;
    }
  }

  /**
   * 评估复合条件
   */
  private async evaluateCompoundCondition(
    expression: ConditionExpression,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions
  ): Promise<boolean> {
    const compound = expression.compound;
    if (!compound || !compound.operands || compound.operands.length === 0) {
      return this.fallback;
    }

    switch (compound.operator) {
      case 'and': {
        const results = await Promise.all(
          compound.operands.map(op => this.evaluateExpression(op, context, options))
        );
        return results.every(r => r === true);
      }

      case 'or': {
        const results = await Promise.all(
          compound.operands.map(op => this.evaluateExpression(op, context, options))
        );
        return results.some(r => r === true);
      }

      case 'not': {
        if (compound.operands.length !== 1) {
          return false;
        }
        const result = await this.evaluateExpression(compound.operands[0], context, options);
        return !result;
      }

      default:
        return this.fallback;
    }
  }

  /**
   * 批量评估条件
   */
  async evaluateBatch(
    expressions: Array<ConditionExpression | string>,
    context: AdaptiveExecutionContext,
    options: EvaluateOptions = {}
  ): Promise<EvaluationResult[]> {
    return Promise.all(
      expressions.map(expr => this.evaluate(expr, context, options))
    );
  }

  /**
   * 创建评估上下文
   */
  createContext(initialVariables: Record<string, any> = {}): AdaptiveExecutionContext {
    return {
      variables: new Map(Object.entries(initialVariables)),
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: 0,
    };
  }
}

/**
 * 默认条件引擎实例
 */
let defaultEngine: ConditionEngine | null = null;

/**
 * 获取默认条件引擎
 */
export function getConditionEngine(agent?: AIAgent): ConditionEngine {
  if (!defaultEngine) {
    defaultEngine = new ConditionEngine();
  }
  if (agent) {
    defaultEngine.setAgent(agent);
  }
  return defaultEngine;
}

/**
 * 快捷评估函数
 */
export async function evaluateCondition(
  expression: ConditionExpression | string,
  context: AdaptiveExecutionContext,
  agent?: AIAgent
): Promise<EvaluationResult> {
  const engine = getConditionEngine(agent);
  return engine.evaluate(expression, context);
}
