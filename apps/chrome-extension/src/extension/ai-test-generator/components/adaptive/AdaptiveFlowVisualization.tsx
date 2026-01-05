/**
 * Adaptive Flow Visualization Component
 * 自适应流程可视化组件 - 可视化条件分支和循环执行流程
 */

import React, { useMemo } from 'react';
import {
  BranchesOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { Card, Collapse, Space, Tag, Timeline, Tooltip, Typography } from 'antd';

const { Text } = Typography;

// Flow node types
export type FlowNodeType = 'action' | 'condition' | 'loop' | 'variable' | 'start' | 'end';

// Flow node status
export type FlowNodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

// Flow node interface
export interface FlowNode {
  id: string;
  type: FlowNodeType;
  status: FlowNodeStatus;
  label: string;
  description?: string;
  children?: FlowNode[];
  branch?: 'then' | 'else' | 'loop';
  iteration?: number;
  depth?: number;
}

// Flow edge interface
export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  condition?: boolean;
}

interface AdaptiveFlowVisualizationProps {
  /** Flow nodes to visualize */
  nodes: FlowNode[];
  /** Show execution path */
  showPath?: boolean;
  /** Maximum depth to display */
  maxDepth?: number;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Get node icon based on type
 */
function getNodeIcon(type: FlowNodeType, status: FlowNodeStatus) {
  const iconProps = { style: { fontSize: 16 } };

  switch (type) {
    case 'condition':
      return <BranchesOutlined {...iconProps} style={{ color: '#f59e0b', ...iconProps.style }} />;
    case 'loop':
      return <SyncOutlined spin={status === 'running'} {...iconProps} style={{ color: '#10b981', ...iconProps.style }} />;
    case 'variable':
      return <CodeOutlined {...iconProps} style={{ color: '#3b82f6', ...iconProps.style }} />;
    case 'start':
      return <CheckCircleOutlined {...iconProps} style={{ color: '#6b7280', ...iconProps.style }} />;
    case 'end':
      return status === 'success' ? (
        <CheckCircleOutlined {...iconProps} style={{ color: '#22c55e', ...iconProps.style }} />
      ) : (
        <CloseCircleOutlined {...iconProps} style={{ color: '#ef4444', ...iconProps.style }} />
      );
    default:
      return <ArrowDownOutlined {...iconProps} style={{ color: '#6b7280', ...iconProps.style }} />;
  }
}

/**
 * Get status color
 */
function getStatusColor(status: FlowNodeStatus): string {
  switch (status) {
    case 'pending':
      return '#d1d5db';
    case 'running':
      return '#3b82f6';
    case 'success':
      return '#22c55e';
    case 'failed':
      return '#ef4444';
    case 'skipped':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

/**
 * Get status tag
 */
function getStatusTag(status: FlowNodeStatus) {
  const statusLabels: Record<FlowNodeStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    success: 'Success',
    failed: 'Failed',
    skipped: 'Skipped',
  };

  return (
    <Tag color={getStatusColor(status)} style={{ fontSize: 10, margin: 0 }}>
      {statusLabels[status]}
    </Tag>
  );
}

/**
 * Flow node component
 */
function FlowNodeItem({
  node,
  depth = 0,
  compact = false,
  maxDepth = 10,
}: {
  node: FlowNode;
  depth?: number;
  compact?: boolean;
  maxDepth?: number;
}) {
  const isCondition = node.type === 'condition';
  const isLoop = node.type === 'loop';
  const hasChildren = node.children && node.children.length > 0;
  const shouldShowChildren = hasChildren && depth < maxDepth;

  const nodeStyle = {
    marginLeft: compact ? depth * 16 : depth * 24,
    marginBottom: 8,
    padding: compact ? '6px 10px' : '10px 14px',
    backgroundColor: node.status === 'running' ? '#eff6ff' : '#ffffff',
    border: `1px solid ${getStatusColor(node.status)}`,
    borderRadius: 6,
    transition: 'all 0.2s',
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={nodeStyle}>
        <Space size="small" align="center">
          {getNodeIcon(node.type, node.status)}
          <Text strong={!compact} style={{ fontSize: compact ? 12 : 13 }}>
            {node.label}
          </Text>
          {node.iteration && node.iteration > 1 && (
            <Tag color="blue" style={{ fontSize: 10 }}>
              x{node.iteration}
            </Tag>
          )}
          {node.branch && (
            <Tag color={node.branch === 'then' ? 'green' : 'orange'} style={{ fontSize: 10 }}>
              {node.branch}
            </Tag>
          )}
          {!compact && getStatusTag(node.status)}
        </Space>
        {node.description && !compact && (
          <div style={{ marginTop: 6, marginLeft: 24 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {node.description}
            </Text>
          </div>
        )}
      </div>

      {/* Render children for conditions and loops */}
      {shouldShowChildren && (
        <div style={{ marginLeft: 12, marginTop: 4 }}>
          {isCondition && (
            <>
              {node.children!.map((child, idx) => (
                <div key={child.id}>
                  {idx > 0 && (
                    <div
                      style={{
                        marginLeft: depth * 24,
                        padding: '4px 0',
                        color: '#6b7280',
                        fontSize: 12,
                      }}
                    >
                      <Space size={4}>
                        <ArrowRightOutlined />
                        <Text type="secondary">else branch</Text>
                      </Space>
                    </div>
                  )}
                  <FlowNodeItem node={child} depth={depth + 1} compact={compact} maxDepth={maxDepth} />
                </div>
              ))}
            </>
          )}
          {isLoop && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#f0fdf4',
                border: '1px dashed #22c55e',
                borderRadius: 6,
                marginLeft: depth * 24,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                <SyncOutlined spin={node.status === 'running'} /> Loop body
              </Text>
              {node.children!.map((child) => (
                <FlowNodeItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  compact={compact}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Convert adaptive test case to flow nodes
 */
export function testCaseToFlowNodes(
  testCase: {
    steps: Array<{
      id: string;
      type?: string;
      description?: string;
      status?: string;
      condition?: any;
      loop?: any;
      variable?: any;
      thenSteps?: any[];
      elseSteps?: any[];
    }>;
  },
  executionResults?: Array<{ stepId: string; success: boolean; branch?: string; iterations?: number }>
): FlowNode[] {
  const resultMap = new Map(
    executionResults?.map((r) => [r.stepId, r]) || []
  );

  return testCase.steps.map((step) => {
    const result = resultMap.get(step.id);
    const status: FlowNodeStatus =
      (step.status as FlowNodeStatus) ||
      (result?.success ? 'success' : 'failed') ||
      'pending';

    const baseNode: FlowNode = {
      id: step.id,
      type: (step.type as FlowNodeType) || 'action',
      status,
      label: step.description || step.id,
      description: step.type,
      branch: result?.branch as 'then' | 'else' | 'loop',
      iteration: result?.iterations,
    };

    // Handle condition with branches
    if (step.condition && (step.thenSteps || step.elseSteps)) {
      return {
        ...baseNode,
        type: 'condition',
        children: [
          ...(step.thenSteps || []).map((s, i): FlowNode => ({
            id: `${step.id}-then-${i}`,
            type: 'action' as FlowNodeType,
            status,
            label: s.description || 'Then action',
            branch: 'then',
            depth: 1,
          })),
          ...(step.elseSteps || []).map((s, i): FlowNode => ({
            id: `${step.id}-else-${i}`,
            type: 'action' as FlowNodeType,
            status: 'skipped',
            label: s.description || 'Else action',
            branch: 'else',
            depth: 1,
          })),
        ],
      };
    }

    // Handle loop with body
    if (step.loop?.body) {
      return {
        ...baseNode,
        type: 'loop',
        children: step.loop.body.map((s: any, i: number): FlowNode => ({
          id: `${step.id}-loop-${i}`,
          type: 'action' as FlowNodeType,
          status,
          label: s.description || 'Loop action',
          depth: 1,
        })),
      };
    }

    return baseNode;
  });
}

/**
 * Main flow visualization component
 */
export function AdaptiveFlowVisualization({
  nodes,
  showPath = true,
  maxDepth = 10,
  compact = false,
  className = '',
}: AdaptiveFlowVisualizationProps) {
  // Calculate statistics
  const stats = useMemo(() => {
    const countByType = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const countByStatus = nodes.reduce((acc, node) => {
      acc[node.status] = (acc[node.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalIterations = nodes.reduce(
      (sum, node) => sum + (node.iteration || 0),
      0
    );

    return { countByType, countByStatus, totalIterations };
  }, [nodes]);

  // Calculate path
  const executionPath = useMemo(() => {
    if (!showPath) return [];

    const path: string[] = [];
    const traverse = (node: FlowNode, currentPath: string[] = []) => {
      const entry = node.branch ? `${node.id}:${node.branch}` : node.id;
      const newPath = [...currentPath, entry];

      if (node.children) {
        for (const child of node.children) {
          traverse(child, newPath);
        }
      } else {
        path.push(newPath.join(' → '));
      }
    };

    for (const node of nodes) {
      traverse(node);
    }

    return path;
  }, [nodes, showPath]);

  return (
    <div className={`adaptive-flow-visualization ${className}`}>
      {/* Statistics */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size="large" wrap>
          <Text type="secondary">
            Total: <Text strong>{nodes.length}</Text>
          </Text>
          {stats.countByType.condition > 0 && (
            <Text type="secondary">
              Conditions: <Text strong>{stats.countByType.condition}</Text>
            </Text>
          )}
          {stats.countByType.loop > 0 && (
            <Text type="secondary">
              Loops: <Text strong>{stats.countByType.loop}</Text>
            </Text>
          )}
          {stats.countByType.variable > 0 && (
            <Text type="secondary">
              Variables: <Text strong>{stats.countByType.variable}</Text>
            </Text>
          )}
          {stats.totalIterations > 0 && (
            <Text type="secondary">
              Iterations: <Text strong>{stats.totalIterations}</Text>
            </Text>
          )}
          {stats.countByStatus.success > 0 && (
            <Text type="secondary">
              Success: <Text style={{ color: '#22c55e' }}>{stats.countByStatus.success}</Text>
            </Text>
          )}
          {stats.countByStatus.failed > 0 && (
            <Text type="secondary">
              Failed: <Text style={{ color: '#ef4444' }}>{stats.countByStatus.failed}</Text>
            </Text>
          )}
        </Space>
      </Card>

      {/* Execution path */}
      {showPath && executionPath.length > 0 && (
        <Collapse
          size="small"
          style={{ marginBottom: 12 }}
          items={[
            {
              key: 'path',
              label: (
                <Space>
                  <BranchesOutlined />
                  <Text>Execution Path</Text>
                </Space>
              ),
              children: (
                <Timeline
                  items={executionPath.slice(0, 20).map((path, idx) => ({
                    color: idx === executionPath.length - 1 ? 'green' : 'blue',
                    children: (
                      <Tooltip title={path}>
                        <Text
                          ellipsis
                          style={{ maxWidth: 400, fontSize: 12, fontFamily: 'monospace' }}
                        >
                          {path}
                        </Text>
                      </Tooltip>
                    ),
                  }))}
                />
              ),
            },
          ]}
        />
      )}

      {/* Flow nodes */}
      <div
        className="flow-nodes-container"
        style={{
          maxHeight: compact ? 300 : 500,
          overflowY: 'auto',
          padding: 8,
          backgroundColor: '#f9fafb',
          borderRadius: 6,
        }}
      >
        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <ClockCircleOutlined style={{ fontSize: 32, color: '#d1d5db' }} />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">No flow nodes to display</Text>
            </div>
          </div>
        ) : (
          nodes.map((node) => (
            <FlowNodeItem
              key={node.id}
              node={node}
              depth={0}
              compact={compact}
              maxDepth={maxDepth}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Mini flow visualization for inline display
 */
export function MiniFlowVisualization({
  nodes,
  className = '',
}: {
  nodes: FlowNode[];
  className?: string;
}) {
  return (
    <div className={`mini-flow-visualization ${className}`}>
      <Space size={4} wrap>
        {nodes.map((node, idx) => (
          <React.Fragment key={node.id}>
            <Tooltip title={`${node.label} (${node.status})`}>
              <Tag
                color={getStatusColor(node.status)}
                icon={getNodeIcon(node.type, node.status)}
                style={{ margin: 0, fontSize: 11 }}
              >
                {node.type === 'condition' && 'if'}
                {node.type === 'loop' && 'loop'}
                {node.type === 'variable' && 'var'}
                {node.type === 'action' && idx + 1}
              </Tag>
            </Tooltip>
            {idx < nodes.length - 1 && (
              <ArrowRightOutlined style={{ color: '#d1d5db', fontSize: 10 }} />
            )}
          </React.Fragment>
        ))}
      </Space>
    </div>
  );
}

export default AdaptiveFlowVisualization;
