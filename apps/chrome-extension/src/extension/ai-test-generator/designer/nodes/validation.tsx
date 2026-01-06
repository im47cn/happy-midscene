/**
 * Validation Nodes
 * 验证节点 - AssertExists, AssertText, AssertState, AiAssert
 */

import type { NodeProps } from '@xyflow/react';
import React, { memo } from 'react';
import { BaseNode } from './BaseNode';

/**
 * AssertExists Node - 断言存在节点
 */
export const AssertExistsNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as
    | { target?: string; state?: string; negate?: boolean }
    | undefined;
  const target = config?.target || '';
  const state = config?.state || 'visible';
  const negate = config?.negate ? '不' : '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'validation',
        icon: '👁️',
        description: target ? `${negate}${state}: ${target}` : undefined,
      }}
    />
  );
});
AssertExistsNode.displayName = 'AssertExistsNode';

/**
 * AssertText Node - 断言文本节点
 */
export const AssertTextNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as
    | { target?: string; text?: string; operator?: string }
    | undefined;
  const target = config?.target || '';
  const text = config?.text || '';
  const operator = config?.operator || 'contains';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'validation',
        icon: '📝',
        description: text ? `"${text}" ${operator}` : undefined,
      }}
    />
  );
});
AssertTextNode.displayName = 'AssertTextNode';

/**
 * AssertState Node - 断言状态节点
 */
export const AssertStateNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as
    | { target?: string; state?: string; negate?: boolean }
    | undefined;
  const target = config?.target || '';
  const state = config?.state || '';
  const negate = config?.negate ? '不' : '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'validation',
        icon: '✅',
        description: target ? `${negate}${state}: ${target}` : undefined,
      }}
    />
  );
});
AssertStateNode.displayName = 'AssertStateNode';

/**
 * AiAssert Node - AI 断言节点
 */
export const AiAssertNode = memo<NodeProps>((props) => {
  const { data } = props;
  const config = data.config as { assertion?: string } | undefined;
  const assertion = config?.assertion || '';

  return (
    <BaseNode
      {...props}
      data={{
        ...data,
        category: 'validation',
        icon: '🤖',
        description: assertion || undefined,
      }}
    />
  );
});
AiAssertNode.displayName = 'AiAssertNode';
