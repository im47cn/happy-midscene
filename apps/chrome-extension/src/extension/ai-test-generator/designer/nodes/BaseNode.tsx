/**
 * Base Node Component
 * 基础节点组件 - 所有节点类型的通用 UI
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DesignerNodeData, NodeCategory } from '../../types/designer';

/**
 * React Flow 兼容的节点数据类型
 */
export interface CompatibleNodeData extends Record<string, unknown> {
  label?: string;
  description?: string;
  category?: NodeCategory;
  icon?: string;
  errors?: string[];
  warnings?: string[];
  config?: Record<string, unknown>;
  inputs?: boolean;
  outputs?: boolean;
  stepType?: string;
  deletable?: boolean;
}

/**
 * 基础节点属性
 */
export interface BaseNodeProps extends Omit<NodeProps, 'data'> {
  data: CompatibleNodeData;
}

/**
 * 节点颜色配置
 */
const NODE_COLORS: Record<NodeCategory, { bg: string; border: string; text: string }> = {
  special: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  action: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  validation: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  control: { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },
  data: { bg: '#fce7f3', border: '#ec4899', text: '#9f1239' },
} as const;

/**
 * 节点图标映射
 */
const NODE_ICONS: Record<string, string> = {
  start: '🚀',
  end: '🏁',
  comment: '💬',
  subflow: '📦',
  click: '👆',
  input: '⌨️',
  scroll: '📜',
  wait: '⏱️',
  navigate: '🔗',
  hover: '🖱️',
  drag: '✋',
  assertExists: '👁️',
  assertText: '📝',
  assertState: '✅',
  aiAssert: '🤖',
  ifElse: '🔀',
  loop: '🔁',
  parallel: '⚡',
  group: '📁',
  setVariable: '📊',
  extractData: '📤',
  externalData: '📥',
} as const;

/**
 * BaseNode 组件
 */
export const BaseNode = memo<BaseNodeProps>(({ data, selected, type }) => {
  const category = data.category || 'action';
  const colors = NODE_COLORS[category];
  const icon = data.icon || NODE_ICONS[type || ''] || '•';
  const hasErrors = data.errors && data.errors.length > 0;
  const hasWarnings = data.warnings && data.warnings.length > 0;

  return (
    <div
      className={`designer-node min-w-[160px] max-w-[240px] rounded-lg border-2 transition-all ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      } ${hasErrors ? 'border-red-500' : hasWarnings ? 'border-yellow-500' : ''}`}
      style={{
        backgroundColor: colors.bg,
        borderColor: hasErrors ? '#ef4444' : hasWarnings ? '#eab308' : colors.border,
        color: colors.text,
      }}
    >
      {/* 输入端口 */}
      {data.inputs !== false && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}

      {/* 节点内容 */}
      <div className="px-3 py-2">
        {/* 节点标题 */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg" aria-label="node-icon">
            {icon}
          </span>
          <span className="font-medium text-sm truncate flex-1" title={data.label}>
            {data.label}
          </span>
        </div>

        {/* 节点描述 */}
        {data.description && (
          <div className="text-xs opacity-75 truncate mb-1" title={data.description}>
            {data.description}
          </div>
        )}

        {/* 错误/警告显示 */}
        {hasErrors && (
          <div className="mt-2 text-xs bg-red-100 text-red-700 rounded px-2 py-1 truncate">
            ❌ {data.errors![0]}
          </div>
        )}
        {hasWarnings && !hasErrors && (
          <div className="mt-2 text-xs bg-yellow-100 text-yellow-700 rounded px-2 py-1 truncate">
            ⚠️ {data.warnings![0]}
          </div>
        )}
      </div>

      {/* 输出端口 */}
      {data.outputs !== false && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-gray-400 border-2 border-white"
        />
      )}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';
