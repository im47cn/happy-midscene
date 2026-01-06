/**
 * Adaptive Test Types
 * 自适应测试类型定义 - 支持条件分支、循环和变量
 */

/**
 * 条件表达式类型
 */
export type ConditionType =
  | 'element'
  | 'text'
  | 'state'
  | 'variable'
  | 'compound';

/**
 * 循环类型
 */
export type LoopType = 'count' | 'while' | 'forEach';

/**
 * 步骤类型
 */
export type StepType = 'action' | 'condition' | 'loop' | 'variable';

/**
 * 操作符类型
 */
export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

/**
 * 逻辑操作符
 */
export type LogicalOperator = 'and' | 'or' | 'not';

/**
 * 文本匹配操作符
 */
export type TextOperator = 'equals' | 'contains' | 'matches';

/**
 * 元素检查类型
 */
export type ElementCheck = 'exists' | 'visible' | 'enabled' | 'selected';

/**
 * 页面状态类型
 */
export type PageState = 'logged_in' | 'loading' | 'error' | 'empty' | 'custom';

/**
 * 变量操作类型 (枚举值)
 */
export type VariableOperationType = 'set' | 'get' | 'increment' | 'extract';

/**
 * 条件表达式接口
 */
export interface ConditionExpression {
  type: ConditionType;

  // 元素条件
  element?: {
    target: string;
    check: ElementCheck;
  };

  // 文本条件
  text?: {
    target: string;
    operator: TextOperator;
    value: string;
  };

  // 状态条件
  state?: {
    type: PageState;
    customDescription?: string;
  };

  // 变量条件
  variable?: {
    name: string;
    operator: ComparisonOperator;
    value: any;
  };

  // 复合条件
  compound?: {
    operator: LogicalOperator;
    operands: ConditionExpression[];
  };
}

/**
 * 循环配置接口
 */
export interface LoopConfig {
  type: LoopType;

  // 计数循环
  count?: number;

  // 条件循环
  condition?: string;

  // 遍历循环
  collection?: string;
  itemVar?: string;

  // 循环体
  body: AdaptiveStep[];

  // 安全限制
  maxIterations: number;
  timeout?: number;
}

/**
 * 变量操作接口
 */
export interface VariableOperation {
  operation: VariableOperationType;
  name: string;
  value?: any;

  // 从页面提取时的描述
  source?: string;
}

/**
 * 动作接口
 */
export interface Action {
  type:
    | 'click'
    | 'input'
    | 'assert'
    | 'wait'
    | 'navigate'
    | 'scroll'
    | 'hover'
    | 'drag';
  target: string;
  value?: string;
}

/**
 * 自适应步骤接口
 */
export interface AdaptiveStep {
  id: string;
  type: StepType;
  description: string;

  // 基础操作
  action?: Action;

  // 条件分支
  condition?: {
    expression: string;
    parsedExpression?: ConditionExpression;
    thenSteps: AdaptiveStep[];
    elseSteps?: AdaptiveStep[];
  };

  // 循环
  loop?: LoopConfig;

  // 变量操作
  variable?: VariableOperation;

  // 元数据
  lineNumber?: number;
  indent?: number;
}

/**
 * 执行上下文接口
 */
export interface ExecutionContext {
  variables: Map<string, any>;
  loopStack: LoopContext[];
  pathHistory: PathEntry[];
  errorStack: Error[];
  currentDepth: number;
}

/**
 * 循环上下文接口
 */
export interface LoopContext {
  loopId: string;
  currentIteration: number;
  maxIterations: number;
  collection?: any[];
  currentItem?: any;
  itemVar?: string;
  startTime: number;
}

/**
 * 路径历史条目
 */
export interface PathEntry {
  stepId: string;
  branch: 'then' | 'else' | 'loop' | 'end';
  timestamp: number;
  condition?: string;
}

/**
 * 自适应测试用例接口
 */
export interface AdaptiveTestCase {
  id: string;
  name: string;
  description?: string;

  // 步骤列表
  steps: AdaptiveStep[];

  // 初始变量
  variables: Record<string, any>;

  // 错误处理器
  errorHandlers?: ErrorHandler[];

  // 配置
  config: AdaptiveTestConfig;

  // 元数据
  createdAt?: number;
  updatedAt?: number;
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  condition: string; // 触发条件
  steps: AdaptiveStep[];
  maxRetries?: number;
}

/**
 * 自适应测试配置
 */
export interface AdaptiveTestConfig {
  // 循环限制
  maxLoopIterations: number;
  maxNestedDepth: number;
  loopIterationTimeout: number;
  totalTimeout: number;

  // 条件评估
  conditionEvaluationTimeout: number;
  defaultConditionFallback: boolean;

  // 路径优化
  enablePathOptimization: boolean;
  trackPathStatistics: boolean;

  // 调试
  enableDebugLogging: boolean;
  saveVariableSnapshots: boolean;
}

/**
 * 默认配置
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveTestConfig = {
  maxLoopIterations: 50,
  maxNestedDepth: 3,
  loopIterationTimeout: 30000,
  totalTimeout: 300000,
  conditionEvaluationTimeout: 10000,
  defaultConditionFallback: false,
  enablePathOptimization: true,
  trackPathStatistics: true,
  enableDebugLogging: false,
  saveVariableSnapshots: false,
};

/**
 * 步骤执行结果
 */
export interface StepResult {
  success: boolean;
  skipped?: boolean;
  error?: Error;
  duration: number;
  branch?: 'then' | 'else' | 'loop' | 'end';
  iterations?: number;
  context?: Partial<ExecutionContext>;
}

/**
 * 变量快照
 */
export interface VariableSnapshot {
  executionId: string;
  stepId: string;
  timestamp: number;
  variables: Record<string, any>;
}

/**
 * 路径统计
 */
export interface PathStatistics {
  testCaseId: string;
  pathId: string;
  executionCount: number;
  successCount: number;
  avgDuration: number;
  lastExecuted: number;
  path: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 验证错误
 */
export interface ValidationError {
  type: 'syntax' | 'reference' | 'structure' | 'limit';
  message: string;
  line?: number;
  column?: number;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  type: 'performance' | 'maintainability' | 'complexity';
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * 语法节点类型（用于 AST）
 */
export type SyntaxNodeType =
  | 'condition'
  | 'loop'
  | 'variable'
  | 'action'
  | 'else'
  | 'end';

/**
 * 语法节点接口
 */
export interface SyntaxNode {
  type: SyntaxNodeType;
  content: string;
  indent: number;
  lineNumber: number;
  children?: SyntaxNode[];
}

/**
 * 解析选项
 */
export interface ParseOptions {
  strictMode?: boolean;
  maxDepth?: number;
  allowUnknownSyntax?: boolean;
}

/**
 * 条件评估选项
 */
export interface EvaluateOptions {
  timeout?: number;
  fallback?: boolean;
  useCache?: boolean;
}
