/**
 * Data Nodes
 * 数据节点 - SetVariable, ExtractData, ExternalData
 */

import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';

/**
 * SetVariable Node - 设置变量节点
 */
export const SetVariableNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { name?: string; value?: string } | undefined;
  const name = config?.name || '';
  const value = config?.value || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'data',
        icon: '📊',
        description: name ? `${name} = ${value}` : undefined,
      }}
    />
  );
});
SetVariableNode.displayName = 'SetVariableNode';

/**
 * ExtractData Node - 提取数据节点
 */
export const ExtractDataNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { target?: string; extractType?: string; variable?: string } | undefined;
  const target = config?.target || '';
  const extractType = config?.extractType || 'text';
  const variable = config?.variable || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'data',
        icon: '📤',
        description: variable ? `提取 ${extractType} → ${variable}` : undefined,
      }}
    />
  );
});
ExtractDataNode.displayName = 'ExtractDataNode';

/**
 * ExternalData Node - 外部数据节点
 */
export const ExternalDataNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { source?: string; format?: string; variable?: string } | undefined;
  const source = config?.source || '';
  const format = config?.format || 'json';
  const variable = config?.variable || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'data',
        icon: '📥',
        description: source ? `加载 ${format} → ${variable}` : undefined,
      }}
    />
  );
});
ExternalDataNode.displayName = 'ExternalDataNode';
