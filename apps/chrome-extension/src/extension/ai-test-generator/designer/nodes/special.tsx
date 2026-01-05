/**
 * Special Nodes
 * 特殊节点 - Start, End, Comment, Subflow
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BaseNode, type CompatibleNodeData } from './BaseNode';

/**
 * Start Node - 开始节点
 */
export const StartNode = memo<NodeProps>((props) => {
  const { data, selected } = props;

  return (
    <div
      className={`min-w-[120px] rounded-full border-3 px-4 py-2 ${
        selected ? 'ring-2 ring-green-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#d1fae5',
        borderColor: '#10b981',
        color: '#065f46',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🚀</span>
        <span className="font-medium text-sm">{String(data.label || '')}</span>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-green-500" />
    </div>
  );
});
StartNode.displayName = 'StartNode';

/**
 * End Node - 结束节点
 */
export const EndNode = memo<NodeProps>((props) => {
  const { data, selected } = props;

  return (
    <div
      className={`min-w-[120px] rounded-full border-3 px-4 py-2 ${
        selected ? 'ring-2 ring-red-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#fee2e2',
        borderColor: '#ef4444',
        color: '#991b1b',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🏁</span>
        <span className="font-medium text-sm">{String(data.label || '')}</span>
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-red-500" />
    </div>
  );
});
EndNode.displayName = 'EndNode';

/**
 * Comment Node - 注释节点
 */
export const CommentNode = memo<NodeProps>((props) => {
  const { data, selected } = props;
  const config = data.config as { content?: string; color?: string } | undefined;
  const content = config?.content || '';

  return (
    <div
      className={`min-w-[200px] max-w-[300px] rounded-lg border-2 border-dashed p-3 ${
        selected ? 'ring-2 ring-yellow-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: config?.color || '#fff9c4',
        borderColor: '#fbbf24',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">💬</span>
        <div className="flex-1">
          <div className="font-medium text-sm text-yellow-800 mb-1">{String(data.label || '')}</div>
          <div className="text-sm text-yellow-900 whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
});
CommentNode.displayName = 'CommentNode';

/**
 * Subflow Node - 子流程节点
 */
export const SubflowNode = memo<NodeProps>((props) => {
  return (
    <BaseNode
      {...props}
      data={{
        ...props.data,
        category: 'special',
        icon: '📦',
      }}
    />
  );
});
SubflowNode.displayName = 'SubflowNode';
