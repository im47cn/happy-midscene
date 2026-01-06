/**
 * YAML Converter Service
 * YAML 转换服务 - 将可视化流程转换为 YAML 格式，以及将 YAML 解析为可视化流程
 */

import yaml from 'js-yaml';
import type {
  Action,
  AdaptiveStep,
  AdaptiveTestCase,
  AdaptiveTestConfig,
  ConditionExpression,
  LoopConfig,
  VariableOperation,
} from '../../types/adaptive';
import { DEFAULT_ADAPTIVE_CONFIG } from '../../types/adaptive';
import type {
  DesignerEdge,
  DesignerNode,
  NodeConfig,
  NodeType,
  TestFlow,
} from '../../types/designer';
import { createNode, generateId, nodeRegistry } from './nodeRegistry';

/**
 * 转换选项
 */
export interface ConversionOptions {
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  /** YAML 缩进空格数 */
  indent?: number;
  /** 是否排序节点 */
  sortNodes?: boolean;
}

/**
 * 转换结果
 */
export interface ConversionResult {
  /** YAML 内容 */
  content: string;
  /** 转换的步骤数 */
  stepCount: number;
  /** 警告信息 */
  warnings: string[];
}

/**
 * 解析结果
 */
export interface ParseResult {
  /** 解析的流程 */
  flow: TestFlow;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

/**
 * 拓扑排序 - 按照节点连接关系排序
 */
function topologicalSort(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): DesignerNode[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const nodeMap = new Map<string, DesignerNode>();

  // 初始化
  nodes.forEach((node) => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
    nodeMap.set(node.id, node);
  });

  // 构建邻接表和入度
  edges.forEach((edge) => {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // Kahn 算法
  const sorted: DesignerNode[] = [];
  const queue: string[] = [];

  // 找到所有入度为 0 的节点
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId);
    if (node) {
      sorted.push(node);
    }

    const neighbors = adjacency.get(nodeId) || [];
    neighbors.forEach((neighbor) => {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  return sorted;
}

/**
 * 将节点配置转换为动作
 */
function configToAction(type: NodeType, config: NodeConfig): Action | null {
  const cfg = config as any;
  switch (type) {
    case 'click':
      return {
        type: 'click',
        target: cfg.target || '',
        value: cfg.value,
      };
    case 'input':
      return {
        type: 'input',
        target: cfg.target || '',
        value: cfg.value || '',
      };
    case 'scroll':
      return {
        type: 'scroll',
        target: cfg.target || '',
        value: cfg.direction || 'down',
      };
    case 'wait':
      return {
        type: 'wait',
        target: '', // wait 不需要 target
        value: String(cfg.duration || 1000),
      };
    case 'navigate':
      return {
        type: 'navigate',
        target: cfg.url || '',
      };
    case 'hover':
      return {
        type: 'hover',
        target: cfg.target || '',
      };
    case 'drag':
      return {
        type: 'drag' as any, // drag action type
        target: cfg.target || '',
        value: `${cfg.toTarget || ''}`,
      };
    default:
      return null;
  }
}

/**
 * 将节点转换为步骤
 */
function nodeToStep(
  node: DesignerNode,
  nextNodesByHandle: Map<string, DesignerNode[]>,
  visited: Set<string>,
  options: ConversionOptions,
): AdaptiveStep {
  const step: AdaptiveStep = {
    id: node.id,
    type: (node.data.stepType as any) || 'action',
    description: String(
      node.data.label || nodeRegistry.get(node.type as NodeType)?.label || '',
    ),
  };

  const config = (node.data.config as any) || {};

  // 处理不同类型的节点
  switch (node.type) {
    case 'start':
      step.type = 'action';
      step.description = '开始测试';
      break;

    case 'end':
      step.type = 'action';
      step.description = '结束测试';
      break;

    case 'click':
    case 'input':
    case 'scroll':
    case 'wait':
    case 'navigate':
    case 'hover':
    case 'drag':
      const action = configToAction(node.type, config);
      if (action) {
        step.action = action;
        step.description =
          step.description || `${action.type} ${action.target}`;
      }
      break;

    case 'assertExists':
      step.type = 'action';
      step.action = {
        type: 'assert',
        target: config.target || '',
        value: config.state || 'exists',
      };
      break;

    case 'assertText':
      step.type = 'action';
      step.action = {
        type: 'assert',
        target: config.target || '',
        value: `text ${config.operator || 'contains'} "${config.text || ''}"`,
      };
      break;

    case 'assertState':
      step.type = 'action';
      step.action = {
        type: 'assert',
        target: config.target || '',
        value: config.state || 'checked',
      };
      break;

    case 'aiAssert':
      step.type = 'action';
      step.action = {
        type: 'assert',
        target: config.assertion || '',
        value: 'ai',
      };
      break;

    case 'ifElse':
      step.type = 'condition';
      const thenNodes = nextNodesByHandle.get(`${node.id}-true`) || [];
      const elseNodes = nextNodesByHandle.get(`${node.id}-false`) || [];

      step.condition = {
        expression: config.condition || 'true',
        thenSteps: thenNodes.map((n) =>
          nodeToStep(
            n,
            nextNodesByHandle,
            new Set([...visited, n.id]),
            options,
          ),
        ),
        elseSteps:
          elseNodes.length > 0
            ? elseNodes.map((n) =>
                nodeToStep(
                  n,
                  nextNodesByHandle,
                  new Set([...visited, n.id]),
                  options,
                ),
              )
            : undefined,
      };
      break;

    case 'loop':
      step.type = 'loop';
      const loopBodyNodes = nextNodesByHandle.get(`${node.id}-body`) || [];

      step.loop = {
        type: config.loopType || 'count',
        count: typeof config.count === 'number' ? config.count : undefined,
        condition: config.condition,
        collection: config.collection,
        itemVar: config.itemVar,
        body: loopBodyNodes.map((n) =>
          nodeToStep(
            n,
            nextNodesByHandle,
            new Set([...visited, n.id]),
            options,
          ),
        ),
        maxIterations: config.maxIterations || 50,
      } as LoopConfig;
      break;

    case 'setVariable':
      step.type = 'variable';
      step.variable = {
        operation: 'set',
        name: config.name || '',
        value: config.value,
      } as VariableOperation;
      break;

    case 'extractData':
      step.type = 'variable';
      step.variable = {
        operation: 'extract',
        name: config.variable || '',
        source: config.target,
      } as VariableOperation;
      break;

    case 'externalData':
      step.type = 'variable';
      step.variable = {
        operation: 'set',
        name: config.variable || '',
        value: config.source,
      } as VariableOperation;
      break;

    case 'parallel':
      // 并行节点转换为顺序执行（简化处理）
      step.type = 'action';
      step.description = `并行执行: ${config.branchCount || 2} 个分支`;
      break;

    case 'comment':
      step.description = `注释: ${config.content || ''}`;
      break;

    case 'subflow':
      step.description = `子流程: ${config.flowName || ''}`;
      break;
  }

  return step;
}

/**
 * 构建节点连接映射
 */
function buildConnectionMap(
  edges: DesignerEdge[],
): Map<string, DesignerEdge[]> {
  const map = new Map<string, DesignerEdge[]>();

  edges.forEach((edge) => {
    const key = edge.source;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(edge);
  });

  return map;
}

/**
 * 构建下一个节点映射（按 handle 分组）
 */
function buildNextNodesMap(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
): Map<string, DesignerNode[]> {
  const map = new Map<string, DesignerNode[]>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  edges.forEach((edge) => {
    const key = `${edge.source}-${edge.sourceHandle || 'default'}`;
    if (!map.has(key)) {
      map.set(key, []);
    }

    const targetNode = nodeMap.get(edge.target);
    if (targetNode) {
      map.get(key)!.push(targetNode);
    }
  });

  return map;
}

/**
 * 将流程转换为 YAML
 */
export function flowToYaml(
  flow: TestFlow,
  options: ConversionOptions = {},
): ConversionResult {
  const warnings: string[] = [];
  const { includeMetadata = true, indent = 2, sortNodes = false } = options;

  // 验证流程
  if (!flow || !flow.nodes || flow.nodes.length === 0) {
    return {
      content: '',
      stepCount: 0,
      warnings: ['流程为空'],
    };
  }

  // 排序节点
  const sortedNodes = sortNodes
    ? topologicalSort([...flow.nodes], flow.edges)
    : [...flow.nodes];

  // 构建连接映射
  const nextNodesMap = buildNextNodesMap(sortedNodes, flow.edges);

  // 找到开始节点
  const startNode = sortedNodes.find((n) => n.type === 'start');
  if (!startNode) {
    warnings.push('未找到开始节点');
  }

  // 转换节点为步骤
  const visited = new Set<string>();
  const steps: AdaptiveStep[] = [];

  // 从开始节点开始遍历
  const processNode = (node: DesignerNode, depth = 0): void => {
    if (visited.has(node.id) || depth > 100) {
      return;
    }
    visited.add(node.id);

    // 跳过开始和结束节点
    if (node.type === 'start' || node.type === 'end') {
      const outEdges = flow.edges.filter((e) => e.source === node.id);
      outEdges.forEach((edge) => {
        const nextNode = sortedNodes.find((n) => n.id === edge.target);
        if (nextNode) {
          processNode(nextNode, depth + 1);
        }
      });
      return;
    }

    // 跳过注释节点
    if (node.type === 'comment') {
      const outEdges = flow.edges.filter((e) => e.source === node.id);
      outEdges.forEach((edge) => {
        const nextNode = sortedNodes.find((n) => n.id === edge.target);
        if (nextNode) {
          processNode(nextNode, depth + 1);
        }
      });
      return;
    }

    // 转换节点为步骤
    const step = nodeToStep(node, nextNodesMap, visited, options);
    steps.push(step);

    // 处理下一个节点
    const outEdges = flow.edges.filter((e) => e.source === node.id);
    outEdges.forEach((edge) => {
      const nextNode = sortedNodes.find((n) => n.id === edge.target);
      if (nextNode) {
        processNode(nextNode, depth + 1);
      }
    });
  };

  if (startNode) {
    processNode(startNode);
  } else if (sortedNodes.length > 0) {
    // 如果没有开始节点，从第一个节点开始
    processNode(sortedNodes[0]);
  }

  // 构建测试用例对象
  const testCase: AdaptiveTestCase = {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    steps,
    variables:
      flow.variables?.reduce(
        (acc, v) => {
          acc[v.name] = v.defaultValue;
          return acc;
        },
        {} as Record<string, any>,
      ) || {},
    config: DEFAULT_ADAPTIVE_CONFIG,
    ...(includeMetadata && {
      createdAt: flow.metadata?.createdAt,
      updatedAt: flow.metadata?.updatedAt,
    }),
  };

  // 转换为 YAML
  const yamlContent = yaml.dump(testCase, {
    indent,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  return {
    content: yamlContent,
    stepCount: steps.length,
    warnings,
  };
}

/**
 * 将 YAML 解析为流程
 */
export function yamlToFlow(
  yamlContent: string,
  flowName?: string,
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 解析 YAML
    const parsed = yaml.load(yamlContent) as AdaptiveTestCase;

    if (!parsed) {
      return {
        flow: {
          id: generateId('flow'),
          name: flowName || 'Untitled Flow',
          description: '',
          version: 1,
          nodes: [],
          edges: [],
          variables: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        errors: ['YAML 内容为空'],
        warnings,
      };
    }

    // 转换步骤为节点
    const nodes: DesignerNode[] = [];
    const edges: DesignerEdge[] = [];
    let previousNodeId: string | null = null;
    let startNodeId: string | null = null;

    // 添加开始节点
    const startNode = createNode('start', { x: 100, y: 100 });
    nodes.push(startNode);
    startNodeId = startNode.id;
    previousNodeId = startNodeId;

    // 处理步骤
    let yOffset = 200;
    const processStep = (
      step: AdaptiveStep,
      parentId?: string,
      handle?: string,
    ): string => {
      let nodeType: NodeType = 'click';
      const config: any = {};
      let label = step.description;

      // 根据 step.type 确定节点类型
      if (step.action) {
        switch (step.action.type) {
          case 'click':
            nodeType = 'click';
            config.target = step.action.target;
            label = step.action.target || '点击';
            break;
          case 'input':
            nodeType = 'input';
            config.target = step.action.target;
            config.value = step.action.value;
            label = `输入: ${step.action.target}`;
            break;
          case 'assert':
            if (step.action.value === 'ai') {
              nodeType = 'aiAssert';
              config.assertion = step.action.target;
              label = step.action.target || 'AI 断言';
            } else {
              nodeType = 'assertExists';
              config.target = step.action.target;
              config.state = step.action.value;
              label = `断言: ${step.action.target}`;
            }
            break;
          case 'wait':
            nodeType = 'wait';
            config.duration = Number.parseInt(step.action.value || '1000', 10);
            label = `等待 ${config.duration}ms`;
            break;
          case 'navigate':
            nodeType = 'navigate';
            config.url = step.action.target;
            label = `导航到 ${step.action.target}`;
            break;
          case 'scroll':
            nodeType = 'scroll';
            config.target = step.action.target;
            config.direction = step.action.value;
            label = `滚动 ${step.action.value}`;
            break;
          case 'hover':
            nodeType = 'hover';
            config.target = step.action.target;
            label = `悬停: ${step.action.target}`;
            break;
          case 'drag':
            nodeType = 'drag';
            config.target = step.action.target;
            label = `拖拽: ${step.action.target}`;
            break;
        }
      } else if (step.condition) {
        nodeType = 'ifElse';
        config.condition = step.condition.expression;
        label = '条件判断';
      } else if (step.loop) {
        nodeType = 'loop';
        config.loopType = step.loop.type;
        config.count = step.loop.count;
        config.condition = step.loop.condition;
        label = '循环';
      } else if (step.variable) {
        switch (step.variable.operation) {
          case 'set':
            nodeType = 'setVariable';
            config.name = step.variable.name;
            config.value = step.variable.value;
            label = `设置变量: ${step.variable.name}`;
            break;
          case 'extract':
            nodeType = 'extractData';
            config.target = step.variable.source;
            config.variable = step.variable.name;
            label = `提取数据: ${step.variable.name}`;
            break;
        }
      }

      // 创建节点
      const node = createNode(nodeType, {
        x: parentId ? 400 : 200,
        y: yOffset,
      });
      node.data = { ...node.data, label, config };
      nodes.push(node);

      const nodeId = node.id;

      // 创建边
      if (parentId && handle) {
        edges.push({
          id: `edge-${Date.now()}-${Math.random()}`,
          source: parentId,
          target: nodeId,
          sourceHandle: handle,
          type: 'default',
        });
      } else if (previousNodeId) {
        edges.push({
          id: `edge-${Date.now()}-${Math.random()}`,
          source: previousNodeId,
          target: nodeId,
          type: 'default',
        });
      }

      // 处理条件分支
      if (step.condition) {
        yOffset += 150;
        step.condition.thenSteps.forEach((subStep) => {
          const subNodeId = processStep(subStep, nodeId, 'true');
          yOffset += 100;
        });

        if (step.condition.elseSteps) {
          yOffset += 150;
          step.condition.elseSteps.forEach((subStep) => {
            const subNodeId = processStep(subStep, nodeId, 'false');
            yOffset += 100;
          });
        }
      }

      // 处理循环体
      if (step.loop) {
        yOffset += 150;
        step.loop.body.forEach((subStep) => {
          processStep(subStep, nodeId, 'body');
          yOffset += 100;
        });
      }

      previousNodeId = nodeId;
      return nodeId;
    };

    // 处理所有步骤
    parsed.steps?.forEach((step) => {
      processStep(step);
      yOffset += 150;
    });

    // 添加结束节点
    const endNode = createNode('end', { x: 200, y: yOffset + 100 });
    nodes.push(endNode);

    if (previousNodeId) {
      edges.push({
        id: `edge-${Date.now()}`,
        source: previousNodeId,
        target: endNode.id,
        type: 'default',
      });
    }

    // 转换变量
    const variables = Object.entries(parsed.variables || {}).map(
      ([name, value]) => ({
        name,
        type:
          typeof value === 'boolean'
            ? ('boolean' as const)
            : typeof value === 'number'
              ? ('number' as const)
              : Array.isArray(value)
                ? ('array' as const)
                : typeof value === 'object'
                  ? ('object' as const)
                  : ('string' as const),
        defaultValue: value,
      }),
    );

    // 创建流程
    const flow: TestFlow = {
      id: parsed.id || generateId('flow'),
      name: flowName || parsed.name || 'Untitled Flow',
      description: parsed.description || '',
      version: 1,
      nodes,
      edges,
      variables,
      metadata: {
        createdAt: parsed.createdAt || Date.now(),
        updatedAt: parsed.updatedAt || Date.now(),
      },
    };

    return {
      flow,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      flow: {
        id: generateId('flow'),
        name: flowName || 'Untitled Flow',
        description: '',
        version: 1,
        nodes: [],
        edges: [],
        variables: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      errors: [
        `YAML 解析错误: ${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings,
    };
  }
}

/**
 * 将流程导出为 YAML 文件内容（带格式化）
 */
export function exportYaml(
  flow: TestFlow,
  options: ConversionOptions = {},
): string {
  const result = flowToYaml(flow, options);

  // 添加文件头注释
  const header = `# ${flow.name}
# ${flow.description || 'Auto-generated by Visual Designer'}
# Generated at: ${new Date().toISOString()}
`;

  return header + result.content;
}

/**
 * 从 YAML 文件内容导入流程
 */
export function importYaml(
  yamlContent: string,
  flowName?: string,
): TestFlow | null {
  const result = yamlToFlow(yamlContent, flowName);

  if (result.errors.length > 0) {
    console.error('YAML import errors:', result.errors);
    return null;
  }

  return result.flow;
}

/**
 * 获取流程的 YAML 预览（前 N 行）
 */
export function getYamlPreview(flow: TestFlow, lineCount = 20): string {
  const result = flowToYaml(flow);
  const lines = result.content.split('\n');
  return (
    lines.slice(0, lineCount).join('\n') +
    (lines.length > lineCount ? '\n...' : '')
  );
}

export default {
  flowToYaml,
  yamlToFlow,
  exportYaml,
  importYaml,
  getYamlPreview,
};
