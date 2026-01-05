/**
 * Action Nodes
 * 动作节点 - Click, Input, Scroll, Wait, Navigate, Hover, Drag
 */

import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

/**
 * Click Node - 点击节点
 */
export const ClickNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { target?: string } | undefined;
  const target = config?.target || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '👆',
        description: target ? `点击: ${target}` : undefined,
      }}
    />
  );
});
ClickNode.displayName = 'ClickNode';

/**
 * Input Node - 输入节点
 */
export const InputNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { target?: string; value?: string } | undefined;
  const target = config?.target || '';
  const value = config?.value || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '⌨️',
        description: target ? `输入: ${value}` : undefined,
      }}
    />
  );
});
InputNode.displayName = 'InputNode';

/**
 * Scroll Node - 滚动节点
 */
export const ScrollNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { target?: string; direction?: string } | undefined;
  const direction = config?.direction || 'down';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '📜',
        description: `滚动: ${direction}`,
      }}
    />
  );
});
ScrollNode.displayName = 'ScrollNode';

/**
 * Wait Node - 等待节点
 */
export const WaitNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { duration?: number } | undefined;
  const duration = config?.duration || 1000;

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '⏱️',
        description: `等待 ${duration}ms`,
      }}
    />
  );
});
WaitNode.displayName = 'WaitNode';

/**
 * Navigate Node - 导航节点
 */
export const NavigateNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { url?: string } | undefined;
  const url = config?.url || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '🔗',
        description: url ? `导航到: ${url}` : undefined,
      }}
    />
  );
});
NavigateNode.displayName = 'NavigateNode';

/**
 * Hover Node - 悬停节点
 */
export const HoverNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { target?: string } | undefined;
  const target = config?.target || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '🖱️',
        description: target ? `悬停: ${target}` : undefined,
      }}
    />
  );
});
HoverNode.displayName = 'HoverNode';

/**
 * Drag Node - 拖拽节点
 */
export const DragNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { from?: string; to?: string; toTarget?: string } | undefined;
  const from = config?.from || '';
  const to = config?.to || config?.toTarget || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'action',
        icon: '✋',
        description: from && to ? `${from} → ${to}` : undefined,
      }}
    />
  );
});
DragNode.displayName = 'DragNode';
