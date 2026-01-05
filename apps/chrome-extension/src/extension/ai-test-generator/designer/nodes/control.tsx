/**
 * Control Nodes
 * 控制节点 - IfElse, Loop, Parallel, Group
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/**
 * IfElse Node - 条件分支节点
 */
export const IfElseNode = memo<NodeProps>((props) => {
  const { data, selected } = props;
  const config = data.config as { condition?: string; trueLabel?: string; falseLabel?: string } | undefined;
  const condition = config?.condition || '';

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#e0e7ff',
        borderColor: '#6366f1',
        color: '#4338ca',
      }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔀</span>
          <span className="font-medium text-sm">{String(data.label || '')}</span>
        </div>
        {condition && (
          <div className="text-xs text-indigo-700 truncate mb-2" title={condition}>
            {condition}
          </div>
        )}
        <div className="flex items-center justify-center gap-1 mt-2 text-xs">
          <span
            className="bg-green-200 text-green-800 px-2 py-0.5 rounded"
            title="True 分支"
          >
            {config?.trueLabel || 'True'}
          </span>
          <span className="text-gray-400">|</span>
          <span
            className="bg-red-200 text-red-800 px-2 py-0.5 rounded"
            title="False 分支"
          >
            {config?.falseLabel || 'False'}
          </span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-indigo-500" />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-2 h-2 !bg-green-500 top-1/2 -translate-y-4"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="w-2 h-2 !bg-red-500 top-1/2 translate-y-4"
      />
    </div>
  );
});
IfElseNode.displayName = 'IfElseNode';

/**
 * Loop Node - 循环节点
 */
export const LoopNode = memo<NodeProps>((props) => {
  const { data, selected } = props;
  const config = data.config as { type?: string; count?: number; whileCondition?: string; loopType?: string } | undefined;
  const type = config?.loopType || config?.type || 'count';

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#e0e7ff',
        borderColor: '#6366f1',
        color: '#4338ca',
      }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🔁</span>
          <span className="font-medium text-sm">{String(data.label || '')}</span>
        </div>
        <div className="text-xs text-indigo-700 mb-1">类型: {type}</div>
        {type === 'count' && config?.count && (
          <div className="text-xs text-indigo-600">次数: {config.count}</div>
        )}
        {type === 'while' && config?.whileCondition && (
          <div className="text-xs text-indigo-600 truncate" title={config.whileCondition}>
            {config.whileCondition}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-indigo-500" />
      <Handle
        type="source"
        position={Position.Right}
        id="body"
        className="w-2 h-2 !bg-indigo-400 top-1/2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="exit"
        className="w-2 h-2 !bg-indigo-600 left-1/2 -translate-x-1/2"
      />
    </div>
  );
});
LoopNode.displayName = 'LoopNode';

/**
 * Parallel Node - 并行节点
 */
export const ParallelNode = memo<NodeProps>((props) => {
  const { data, selected } = props;
  const config = data.config as { branches?: number; waitAll?: boolean } | undefined;
  const branches = config?.branches || 2;

  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: '#e0e7ff',
        borderColor: '#6366f1',
        color: '#4338ca',
      }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚡</span>
          <span className="font-medium text-sm">{String(data.label || '')}</span>
        </div>
        <div className="text-xs text-indigo-700">{branches} 个并行分支</div>
        {config?.waitAll !== undefined && (
          <div className="text-xs text-indigo-600">
            {config.waitAll ? '等待全部完成' : '任一完成即继续'}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-indigo-500" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-indigo-500" />
    </div>
  );
});
ParallelNode.displayName = 'ParallelNode';

/**
 * Group Node - 分组节点
 */
export const GroupNode = memo<NodeProps>((props) => {
  const { data, selected } = props;
  const config = data.config as { label?: string; collapsed?: boolean; color?: string } | undefined;
  const label = config?.label || '分组';

  return (
    <div
      className={`min-w-[120px] min-h-[80px] rounded-lg border-2 border-dashed ${
        selected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      } ${config?.collapsed ? 'h-10' : ''}`}
      style={{
        backgroundColor: config?.color || '#f3f4f6',
        borderColor: '#9ca3af',
        color: '#374151',
      }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📁</span>
          <span className="font-medium text-sm">{label}</span>
        </div>
        {config?.collapsed && (
          <div className="text-xs text-gray-500 mt-1">...</div>
        )}
      </div>
    </div>
  );
});
GroupNode.displayName = 'GroupNode';
