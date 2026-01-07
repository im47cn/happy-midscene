/**
 * Designer Executor Service
 * 设计器执行服务 - 将可视化流程转换为可执行的测试用例并执行
 */

import type {
  DeviceEmulationConfig,
  ExecutionContext as EngineExecutionContext,
  ExecutionCallbacks as EngineExecutionCallbacks,
  ExecutionEngine,
  ExecutionResult as EngineExecutionResult,
  ExecutionStatus,
} from '../../services/executionEngine';
import type { TestCase, TaskStep } from '../../services/markdownParser';
import type {
  DesignerEdge,
  DesignerNode,
  NodeConfig,
  NodeType,
  TestFlow,
  VariableDefinition,
} from '../../types/designer';
import { validateFlow } from './flowValidator';

/**
 * 设计器执行回调
 */
export interface DesignerExecutionCallbacks {
  /** 执行开始 */
  onExecutionStart?: (flow: TestFlow) => void;
  /** 执行完成 */
  onExecutionComplete?: (
    success: boolean,
    results: DesignerExecutionResult[],
    yaml: string,
  ) => void;
  /** 节点执行开始 */
  onNodeStart?: (nodeId: string, label: string) => void;
  /** 节点执行完成 */
  onNodeComplete?: (
    nodeId: string,
    result: DesignerExecutionResult,
  ) => void;
  /** 节点执行失败 */
  onNodeFailed?: (
    nodeId: string,
    error: string,
    result: DesignerExecutionResult,
  ) => void;
  /** 进度更新 */
  onProgress?: (current: number, total: number) => void;
  /** 元素高亮 */
  onHighlight?: (element: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** 自愈尝试 */
  onHealingAttempt?: (
    nodeId: string,
    healingResult: import('../../types/healing').HealingResult,
  ) => void;
  /** 确认自愈 */
  onHealingConfirmRequest?: (
    nodeId: string,
    healingResult: import('../../types/healing').HealingResult,
  ) => Promise<boolean>;
}

/**
 * 设计器执行结果
 */
export interface DesignerExecutionResult {
  /** 节点 ID */
  nodeId: string;
  /** 步骤 ID (在执行引擎中) */
  stepId: string;
  /** 节点类型 */
  nodeType: NodeType;
  /** 是否成功 */
  success: boolean;
  /** 生成的 YAML 动作 */
  generatedAction?: string;
  /** 错误信息 */
  error?: string;
  /** 错误详情 */
  errorDetails?: {
    message: string;
    type: string;
    details?: string;
    suggestion?: string;
  };
  /** 截图 (base64) */
  screenshot?: string;
  /** 执行时长 (ms) */
  duration: number;
  /** 自愈结果 */
  healingResult?: import('../../types/healing').HealingResult;
  /** 是否通过自愈修复 */
  healedByAI?: boolean;
}

/**
 * 设计器执行选项
 */
export interface DesignerExecutionOptions {
  /** 执行上下文 */
  context?: {
    url?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    deviceEmulation?: DeviceEmulationConfig;
  };
  /** 是否启用自愈 */
  enableSelfHealing?: boolean;
  /** 是否启用高亮 */
  enableHighlighting?: boolean;
  /** 是否存储截图 */
  storeScreenshots?: boolean;
  /** 失败时是否继续执行 */
  continueOnError?: boolean;
  /** 执行开始前延迟 (ms) */
  startDelay?: number;
}

/**
 * 设计器执行状态
 */
export type DesignerExecutionStatus =
  | 'idle'
  | 'validating'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped';

/**
 * 节点执行顺序
 */
interface NodeExecutionOrder {
  /** 节点 ID */
  nodeId: string;
  /** 节点 */
  node: DesignerNode;
  /** 深度 */
  depth: number;
  /** 父节点 ID (用于控制流) */
  parentId?: string;
  /** 源 handle (用于条件分支) */
  sourceHandle?: string;
  /** 是否在循环体中 */
  inLoop?: boolean;
  /** 是否在条件分支中 */
  inCondition?: boolean;
  /** 条件分支类型 (true/false) */
  conditionBranch?: 'true' | 'false';
}

/**
 * 设计器执行器
 */
export class DesignerExecutor {
  private executionEngine: ExecutionEngine | null = null;
  private status: DesignerExecutionStatus = 'idle';
  private results: Map<string, DesignerExecutionResult> = new Map();
  private currentFlow: TestFlow | null = null;
  private callbacks: DesignerExecutionCallbacks = {};
  private nodeStatus: Map<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'> =
    new Map();
  private currentStepIndex = 0;
  private totalSteps = 0;

  constructor(private getExecutionEngine: () => ExecutionEngine | null) {}

  /**
   * 设置回调
   */
  setCallbacks(callbacks: DesignerExecutionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * 获取当前状态
   */
  getStatus(): DesignerExecutionStatus {
    return this.status;
  }

  /**
   * 获取执行结果
   */
  getResults(): DesignerExecutionResult[] {
    return Array.from(this.results.values());
  }

  /**
   * 获取节点状态
   */
  getNodeStatus(nodeId: string): 'pending' | 'running' | 'success' | 'failed' | 'skipped' {
    return this.nodeStatus.get(nodeId) || 'pending';
  }

  /**
   * 获取所有节点状态
   */
  getAllNodeStatus(): Map<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'> {
    return new Map(this.nodeStatus);
  }

  /**
   * 验证流程
   */
  private async validateFlow(flow: TestFlow): Promise<{ valid: boolean; errors: string[] }> {
    this.status = 'validating';
    this.callbacks.onExecutionStart?.(flow);

    const validation = validateFlow(flow);

    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors.map((e) => e.message),
      };
    }

    // 检查是否有开始节点
    const hasStartNode = flow.nodes.some((n) => n.type === 'start');
    if (!hasStartNode) {
      return {
        valid: false,
        errors: ['缺少开始节点'],
      };
    }

    // 检查是否有可执行的节点
    const executableNodes = flow.nodes.filter(
      (n) =>
        !['start', 'end', 'comment', 'group'].includes(
          n.type,
        ),
    );
    if (executableNodes.length === 0) {
      return {
        valid: false,
        errors: ['没有可执行的节点'],
      };
    }

    return { valid: true, errors: [] };
  }

  /**
   * 构建节点执行顺序
   */
  private buildExecutionOrder(
    nodes: DesignerNode[],
    edges: DesignerEdge[],
  ): NodeExecutionOrder[] {
    const order: NodeExecutionOrder[] = [];
    const visited = new Set<string>();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // 从开始节点开始
    const startNode = nodes.find((n) => n.type === 'start');
    if (!startNode) {
      return order;
    }

    /**
     * 递归遍历节点
     */
    const traverse = (
      nodeId: string,
      depth = 0,
      parentId?: string,
      sourceHandle?: string,
      inLoop = false,
      inCondition = false,
      conditionBranch?: 'true' | 'false',
    ): void => {
      if (visited.has(nodeId) || depth > 100) {
        return;
      }

      visited.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (!node) {
        return;
      }

      // 跳过开始、结束、注释、分组节点
      if (['start', 'end', 'comment', 'group'].includes(node.type)) {
        // 继续遍历下一个节点
        const outEdges = edges.filter((e) => e.source === nodeId);
        for (const edge of outEdges) {
          traverse(
            edge.target,
            depth + 1,
            nodeId,
            edge.sourceHandle,
            inLoop,
            inCondition,
            conditionBranch,
          );
        }
        return;
      }

      // 添加到执行顺序
      order.push({
        nodeId,
        node,
        depth,
        parentId,
        sourceHandle,
        inLoop,
        inCondition,
        conditionBranch,
      });

      // 更新循环和条件状态
      let nextInLoop = inLoop;
      let nextInCondition = inCondition;
      let nextConditionBranch = conditionBranch;

      if (node.type === 'loop') {
        nextInLoop = true;
      }
      if (node.type === 'ifElse') {
        nextInCondition = true;
      }

      // 继续遍历下一个节点
      const outEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outEdges) {
        traverse(
          edge.target,
          depth + 1,
          nodeId,
          edge.sourceHandle,
          nextInLoop,
          nextInCondition,
          edge.sourceHandle === 'true' ? 'true' : edge.sourceHandle === 'false' ? 'false' : conditionBranch,
        );
      }
    };

    traverse(startNode.id);
    return order;
  }

  /**
   * 将节点转换为步骤文本
   */
  private nodeToStepText(node: DesignerNode, variables: VariableDefinition[]): string {
    const config = (node.data.config as any) || {};
    const vars = Object.fromEntries(
      variables.map((v) => [v.name, v.defaultValue]),
    );

    // 替换变量引用
    const replaceVars = (text: string): string => {
      if (!text) return '';
      return text.replace(/\$\{(\w+)\}/g, (_, name) => {
        const value = vars[name];
        return value !== undefined ? String(value) : `\${${name}}`;
      });
    };

    switch (node.type) {
      case 'click':
        return `点击 ${replaceVars(config.target) || '元素'}`;
      case 'input':
        const value = replaceVars(config.value || '');
        return `在 ${replaceVars(config.target)} 中输入 "${value}"`;
      case 'scroll':
        const direction = config.direction || 'down';
        const directionMap: Record<string, string> = {
          up: '向上',
          down: '向下',
          left: '向左',
          right: '向右',
          intoView: '滚动到可见区域',
        };
        return `${directionMap[direction] || '滚动'}${config.target ? ` ${replaceVars(config.target)}` : ''}`;
      case 'wait':
        const duration = config.duration || 1000;
        const unit = config.unit === 's' ? '秒' : '毫秒';
        const waitDuration = config.unit === 's' ? duration / 1000 : duration;
        return `等待 ${waitDuration} ${unit}`;
      case 'navigate':
        return `打开 ${replaceVars(config.url)}`;
      case 'hover':
        return `悬停在 ${replaceVars(config.target)} 上`;
      case 'drag':
        return `拖拽 ${replaceVars(config.target)} 到 ${replaceVars(config.destination)}`;
      case 'assertExists':
        const shouldExist = config.shouldExist !== false;
        return shouldExist
          ? `验证 ${replaceVars(config.target)} 存在`
          : `验证 ${replaceVars(config.target)} 不存在`;
      case 'assertText':
        const operator = config.matchType || 'contains';
        const operatorMap: Record<string, string> = {
          exact: '等于',
          contains: '包含',
          regex: '匹配正则',
        };
        return `验证 ${replaceVars(config.target)} 的文本${operatorMap[operator]}"${replaceVars(config.text)}"`;
      case 'assertState':
        const state = config.state || 'visible';
        return `验证 ${replaceVars(config.target)} 的状态为 "${state}"`;
      case 'aiAssert':
        return `验证: ${replaceVars(config.assertion)}`;
      case 'setVariable':
        return `设置变量 ${config.name} 为 "${replaceVars(String(config.value))}"`;
      case 'extractData':
        return `从 ${replaceVars(config.target)} 提取数据到变量 ${config.variable}`;
      case 'externalData':
        return `加载外部数据到变量 ${config.variable}`;
      case 'ifElse':
        return `条件判断: ${config.condition || 'true'}`;
      case 'loop':
        const loopType = config.loopType || 'count';
        return loopType === 'count'
          ? `循环 ${config.count || 1} 次`
          : `循环直到: ${config.condition || 'false'}`;
      default:
        return String(node.data.label || node.type);
    }
  }

  /**
   * 将流程转换为测试用例
   */
  private flowToTestCase(flow: TestFlow, executionOrder: NodeExecutionOrder[]): TestCase {
    const steps: TaskStep[] = executionOrder.map((item) => {
      const stepText = this.nodeToStepText(item.node, flow.variables);

      return {
        id: item.nodeId,
        originalText: stepText,
        status: 'pending',
      };
    });

    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      steps,
    };
  }

  /**
   * 创建引擎回调
   */
  private createEngineCallbacks(): EngineExecutionCallbacks {
    return {
      onStepStart: (step: TaskStep, index: number) => {
        this.currentStepIndex = index;
        const nodeId = step.id;
        this.nodeStatus.set(nodeId, 'running');

        const node = this.currentFlow?.nodes.find((n) => n.id === nodeId);
        const label = node?.data.label || step.originalText;
        this.callbacks.onNodeStart?.(nodeId, label);
      },
      onStepComplete: (step: TaskStep, result: EngineExecutionResult) => {
        const nodeId = step.id;
        this.nodeStatus.set(nodeId, 'success');

        const node = this.currentFlow?.nodes.find((n) => n.id === nodeId);
        const designerResult: DesignerExecutionResult = {
          nodeId,
          stepId: result.stepId,
          nodeType: node?.type || 'click',
          success: result.success,
          generatedAction: result.generatedAction,
          screenshot: result.screenshot,
          duration: result.duration,
          healingResult: result.healingResult,
          healedByAI: result.healedByAI,
        };

        this.results.set(nodeId, designerResult);
        this.callbacks.onNodeComplete?.(nodeId, designerResult);
      },
      onStepFailed: (
        step: TaskStep,
        error: string,
        errorDetails?: import('../../services/executionEngine').ExecutionError,
      ) => {
        const nodeId = step.id;
        this.nodeStatus.set(nodeId, 'failed');

        const node = this.currentFlow?.nodes.find((n) => n.id === nodeId);
        const designerResult: DesignerExecutionResult = {
          nodeId,
          stepId: step.id,
          nodeType: node?.type || 'click',
          success: false,
          error,
          errorDetails: errorDetails
            ? {
                message: errorDetails.message,
                type: errorDetails.type,
                details: errorDetails.details,
                suggestion: errorDetails.suggestion,
              }
            : undefined,
          screenshot: errorDetails?.screenshot,
          duration: 0,
        };

        this.results.set(nodeId, designerResult);
        this.callbacks.onNodeFailed?.(nodeId, error, designerResult);
      },
      onProgress: (current: number, total: number) => {
        this.currentStepIndex = current;
        this.totalSteps = total;
        this.callbacks.onProgress?.(current, total);
      },
      onHighlight: (element: { x: number; y: number; width: number; height: number }) => {
        this.callbacks.onHighlight?.(element);
      },
      onHealingAttempt: (step: TaskStep, healingResult: any) => {
        this.callbacks.onHealingAttempt?.(step.id, healingResult);
      },
      onHealingConfirmRequest: async (
        step: TaskStep,
        healingResult: any,
      ): Promise<boolean> => {
        return this.callbacks.onHealingConfirmRequest?.(step.id, healingResult) ?? false;
      },
    };
  }

  /**
   * 执行流程
   */
  async executeFlow(
    flow: TestFlow,
    options: DesignerExecutionOptions = {},
  ): Promise<{
    success: boolean;
    results: DesignerExecutionResult[];
    yamlContent: string;
    errors: string[];
  }> {
    // 重置状态
    this.results.clear();
    this.nodeStatus.clear();
    this.currentFlow = flow;
    this.status = 'preparing';

    try {
      // 验证流程
      const validation = await this.validateFlow(flow);
      if (!validation.valid) {
        this.status = 'failed';
        return {
          success: false,
          results: [],
          yamlContent: '',
          errors: validation.errors,
        };
      }

      // 构建执行顺序
      const executionOrder = this.buildExecutionOrder(flow.nodes, flow.edges);
      if (executionOrder.length === 0) {
        this.status = 'failed';
        return {
          success: false,
          results: [],
          yamlContent: '',
          errors: ['没有可执行的节点'],
        };
      }

      // 初始化节点状态
      executionOrder.forEach((item) => {
        this.nodeStatus.set(item.nodeId, 'pending');
      });

      // 获取执行引擎
      this.executionEngine = this.getExecutionEngine();
      if (!this.executionEngine) {
        this.status = 'failed';
        return {
          success: false,
          results: [],
          yamlContent: '',
          errors: ['执行引擎未初始化'],
        };
      }

      // 配置引擎
      if (options.enableSelfHealing !== undefined) {
        this.executionEngine.setSelfHealingConfig({
          enabled: options.enableSelfHealing,
        });
      }
      if (options.enableHighlighting !== undefined) {
        this.executionEngine.setHighlightingEnabled(options.enableHighlighting);
      }
      if (options.storeScreenshots !== undefined) {
        this.executionEngine.setScreenshotStorageEnabled(options.storeScreenshots);
      }

      // 设置回调
      this.executionEngine.setCallbacks(this.createEngineCallbacks());

      // 转换为测试用例
      const testCase = this.flowToTestCase(flow, executionOrder);

      // 执行前延迟
      if (options.startDelay && options.startDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.startDelay));
      }

      // 执行
      this.status = 'running';
      const engineContext: EngineExecutionContext = {
        url: options.context?.url,
        viewportWidth: options.context?.viewportWidth,
        viewportHeight: options.context?.viewportHeight,
        deviceEmulation: options.context?.deviceEmulation,
      };

      const engineResult = await this.executionEngine.executeTestCase(
        testCase,
        engineContext,
      );

      this.status = engineResult.success ? 'completed' : 'failed';

      // 转换结果
      const results = Array.from(this.results.values());

      this.callbacks.onExecutionComplete?.(
        engineResult.success,
        results,
        engineResult.yamlContent,
      );

      return {
        success: engineResult.success,
        results,
        yamlContent: engineResult.yamlContent,
        errors: [],
      };
    } catch (error) {
      this.status = 'failed';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        results: Array.from(this.results.values()),
        yamlContent: '',
        errors: [errorMessage],
      };
    }
  }

  /**
   * 暂停执行
   */
  pause(): void {
    if (this.status === 'running' && this.executionEngine) {
      this.executionEngine.pause();
      this.status = 'paused';
    }
  }

  /**
   * 恢复执行
   */
  resume(): void {
    if (this.status === 'paused' && this.executionEngine) {
      this.executionEngine.resume();
      this.status = 'running';
    }
  }

  /**
   * 停止执行
   */
  stop(): void {
    if (['running', 'paused'].includes(this.status) && this.executionEngine) {
      this.executionEngine.stop();
      this.status = 'stopped';
    }
  }

  /**
   * 重试失败的节点
   */
  async retryFailedNodes(
    flow: TestFlow,
    options: DesignerExecutionOptions = {},
  ): Promise<{
    success: boolean;
    results: DesignerExecutionResult[];
    yamlContent: string;
  }> {
    // 获取失败的节点
    const failedResults = Array.from(this.results.values()).filter((r) => !r.success);
    if (failedResults.length === 0) {
      return {
        success: true,
        results: Array.from(this.results.values()),
        yamlContent: '',
      };
    }

    // 重置失败节点的状态
    failedResults.forEach((r) => {
      this.nodeStatus.set(r.nodeId, 'pending');
      this.results.delete(r.nodeId);
    });

    // 重新执行（会跳过已成功的节点）
    return this.executeFlow(flow, options);
  }

  /**
   * 获取执行统计
   */
  getStats(): {
    total: number;
    success: number;
    failed: number;
    pending: number;
    running: number;
    skipped: number;
  } {
    const statuses = Array.from(this.nodeStatus.values());
    return {
      total: statuses.length,
      success: statuses.filter((s) => s === 'success').length,
      failed: statuses.filter((s) => s === 'failed').length,
      pending: statuses.filter((s) => s === 'pending').length,
      running: statuses.filter((s) => s === 'running').length,
      skipped: statuses.filter((s) => s === 'skipped').length,
    };
  }
}

/**
 * 创建执行器实例
 */
export function createDesignerExecutor(
  getExecutionEngine: () => ExecutionEngine | null,
): DesignerExecutor {
  return new DesignerExecutor(getExecutionEngine);
}

export default DesignerExecutor;
