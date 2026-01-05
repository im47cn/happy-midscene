/**
 * Flow Validator Service
 * 流程验证服务 - 验证流程的完整性和正确性
 */

import type {
  TestFlow,
  DesignerNode,
  DesignerEdge,
  NodeType,
} from '../../types/designer';
import { nodeRegistry } from './nodeRegistry';

/**
 * 验证错误类型
 */
export type ValidationErrorType = 'structure' | 'connection' | 'configuration' | 'cycle';

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误类型 */
  type: ValidationErrorType;
  /** 错误消息 */
  message: string;
  /** 相关节点ID */
  nodeId?: string;
  /** 相关边ID */
  edgeId?: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告消息 */
  message: string;
  /** 相关节点ID */
  nodeId?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationWarning[];
}

/**
 * 验证流程
 */
export function validateFlow(flow: TestFlow): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 基本验证
  if (!flow.id) {
    errors.push({ type: 'structure', message: '流程缺少ID' });
  }
  if (!flow.name || flow.name.trim() === '') {
    errors.push({ type: 'structure', message: '流程名称不能为空' });
  }
  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push({ type: 'structure', message: '流程至少需要一个节点' });
  }

  if (!flow.nodes) {
    return { valid: false, errors, warnings };
  }

  // 检查开始和结束节点
  const startNodes = flow.nodes.filter((n) => n.type === 'start');
  const endNodes = flow.nodes.filter((n) => n.type === 'end');

  if (startNodes.length === 0) {
    errors.push({ type: 'structure', message: '流程缺少开始节点' });
  } else if (startNodes.length > 1) {
    warnings.push({ message: '流程有多个开始节点，可能不是预期行为' });
  }

  if (endNodes.length === 0) {
    warnings.push({ message: '流程没有结束节点' });
  }

  // 验证节点配置
  flow.nodes.forEach((node) => {
    const nodeErrors = validateNode(node);
    errors.push(...nodeErrors);
  });

  // 验证连接
  if (flow.edges) {
    const edgeErrors = validateEdges(flow.nodes, flow.edges);
    errors.push(...edgeErrors);
  }

  // 检查循环引用
  if (flow.nodes && flow.edges) {
    const cycleErrors = detectCycles(flow.nodes, flow.edges);
    errors.push(...cycleErrors);
  }

  // 检查孤立节点
  if (flow.nodes && flow.edges && flow.nodes.length > 1) {
    const isolatedWarnings = detectIsolatedNodes(flow.nodes, flow.edges);
    warnings.push(...isolatedWarnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证节点配置
 */
export function validateNode(node: DesignerNode): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!node.id) {
    errors.push({ type: 'structure', message: '节点缺少ID', nodeId: node.id });
  }

  if (!node.type) {
    errors.push({ type: 'structure', message: '节点缺少类型', nodeId: node.id });
  }

  // 验证节点定义
  const nodeDefinition = nodeRegistry.get(node.type as NodeType);
  if (!nodeDefinition) {
    errors.push({ type: 'structure', message: `未知的节点类型: ${node.type}`, nodeId: node.id });
    return errors;
  }

  // 验证节点配置
  if (nodeDefinition.validate) {
    const validationResult = nodeDefinition.validate(node.data.config || {});
    errors.push(
      ...validationResult.errors.map((e: any) => ({
        type: 'configuration' as ValidationErrorType,
        message: e.message,
        nodeId: node.id,
      }))
    );
  }

  return errors;
}

/**
 * 验证边连接
 */
function validateEdges(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  edges.forEach((edge) => {
    if (!edge.source) {
      errors.push({ type: 'connection', message: '边缺少源节点', edgeId: edge.id });
    } else if (!nodeIds.has(edge.source)) {
      errors.push({
        type: 'connection',
        message: `边的源节点不存在: ${edge.source}`,
        edgeId: edge.id,
      });
    }

    if (!edge.target) {
      errors.push({ type: 'connection', message: '边缺少目标节点', edgeId: edge.id });
    } else if (!nodeIds.has(edge.target)) {
      errors.push({
        type: 'connection',
        message: `边的目标节点不存在: ${edge.target}`,
        edgeId: edge.id,
      });
    }
  });

  return errors;
}

/**
 * 检测循环引用
 */
function detectCycles(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = new Map<string, string[]>();

  // 构建邻接表
  nodes.forEach((node) => {
    graph.set(node.id, []);
  });

  edges.forEach((edge) => {
    const neighbors = graph.get(edge.source) || [];
    neighbors.push(edge.target);
    graph.set(edge.source, neighbors);
  });

  // DFS 检测环
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string, path: string[]): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // 发现环
        const cycleIndex = path.indexOf(neighbor);
        const cyclePath = [...path.slice(cycleIndex), neighbor].join(' -> ');
        errors.push({
          type: 'cycle',
          message: `检测到循环: ${cyclePath}`,
          nodeId: neighbor,
        });
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return errors;
}

/**
 * 检测孤立节点（没有连接的节点）
 */
function detectIsolatedNodes(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const connectedNodeIds = new Set<string>();

  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  nodes.forEach((node) => {
    // 跳过开始节点和孤立的单个节点
    if (node.type === 'start' || nodes.length === 1) {
      return;
    }
    if (!connectedNodeIds.has(node.id)) {
      warnings.push({ message: `节点 ${node.data.label || node.id} 没有任何连接`, nodeId: node.id });
    }
  });

  return warnings;
}

/**
 * 验证节点配置
 */
export function validateNodeConfig(type: NodeType, config: Record<string, unknown>): ValidationResult {
  const errors: ValidationError[] = [];

  const nodeDefinition = nodeRegistry.get(type);
  if (!nodeDefinition) {
    errors.push({ type: 'structure', message: `未知的节点类型: ${type}` });
    return { valid: false, errors, warnings: [] };
  }

  if (nodeDefinition.validate) {
    const validationResult = nodeDefinition.validate(config as any);
    errors.push(
      ...validationResult.errors.map((e: any) => ({
        type: 'configuration' as ValidationErrorType,
        message: e.message,
      }))
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

export default {
  validateFlow,
  validateNode,
  validateNodeConfig,
};
