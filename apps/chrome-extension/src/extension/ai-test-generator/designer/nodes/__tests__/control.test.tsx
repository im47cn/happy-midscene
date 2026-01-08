/**
 * Control Nodes Component Tests
 * 控制节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  IfElseNode,
  LoopNode,
  ParallelNode,
  GroupNode,
} from '../control';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node, Component: React.ComponentType<Node>) {
  return render(
    <ReactFlowProvider>
      <Component {...node} />
    </ReactFlowProvider>
  );
}

describe('IfElseNode', () => {
  const mockNode: Node = {
    id: 'ifelse-1',
    type: 'ifElse',
    position: { x: 0, y: 0 },
    data: { label: 'Check Condition' },
  };

  it('should have correct displayName', () => {
    expect(IfElseNode.displayName).toBe('IfElseNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, IfElseNode);

    expect(screen.getByText('Check Condition')).toBeInTheDocument();
  });

  it('should render with condition', () => {
    const nodeWithCondition = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { condition: 'user.isLoggedIn === true' },
      },
    };

    renderNodeWithProvider(nodeWithCondition, IfElseNode);

    expect(screen.getByText('user.isLoggedIn === true')).toBeInTheDocument();
  });

  it('should use default branch labels when not provided', () => {
    renderNodeWithProvider(mockNode, IfElseNode);

    expect(screen.getByText('True')).toBeInTheDocument();
    expect(screen.getByText('False')).toBeInTheDocument();
  });

  it('should use custom branch labels when provided', () => {
    const nodeWithLabels = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: {
          trueLabel: 'Yes',
          falseLabel: 'No',
        },
      },
    };

    renderNodeWithProvider(nodeWithLabels, IfElseNode);

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, IfElseNode);

    expect(screen.getByText('🔀')).toBeInTheDocument();
  });

  it('should apply control category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, IfElseNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
      color: '#4338ca',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, IfElseNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-indigo-500', 'ring-offset-2');
  });

  it('should render true branch label with green styling', () => {
    const { container } = renderNodeWithProvider(mockNode, IfElseNode);
    const trueLabel = container.querySelector('.bg-green-200');

    expect(trueLabel).toBeInTheDocument();
    expect(trueLabel).toHaveTextContent('True');
    expect(trueLabel).toHaveClass('text-green-800');
  });

  it('should render false branch label with red styling', () => {
    const { container } = renderNodeWithProvider(mockNode, IfElseNode);
    const falseLabel = container.querySelector('.bg-red-200');

    expect(falseLabel).toBeInTheDocument();
    expect(falseLabel).toHaveTextContent('False');
    expect(falseLabel).toHaveClass('text-red-800');
  });
});

describe('LoopNode', () => {
  const mockNode: Node = {
    id: 'loop-1',
    type: 'loop',
    position: { x: 0, y: 0 },
    data: { label: 'Repeat Action' },
  };

  it('should have correct displayName', () => {
    expect(LoopNode.displayName).toBe('LoopNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, LoopNode);

    expect(screen.getByText('Repeat Action')).toBeInTheDocument();
  });

  it('should render default loop type', () => {
    renderNodeWithProvider(mockNode, LoopNode);

    expect(screen.getByText('类型: count')).toBeInTheDocument();
  });

  it('should render count loop type', () => {
    const countLoopNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { loopType: 'count', count: 5 },
      },
    };

    renderNodeWithProvider(countLoopNode, LoopNode);

    expect(screen.getByText('类型: count')).toBeInTheDocument();
    expect(screen.getByText('次数: 5')).toBeInTheDocument();
  });

  it('should render while loop type with condition', () => {
    const whileLoopNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: {
          loopType: 'while',
          whileCondition: 'i < 10',
        },
      },
    };

    renderNodeWithProvider(whileLoopNode, LoopNode);

    expect(screen.getByText('类型: while')).toBeInTheDocument();
    expect(screen.getByText('i < 10')).toBeInTheDocument();
  });

  it('should support legacy type config property', () => {
    const legacyTypeNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { type: 'while' },
      },
    };

    renderNodeWithProvider(legacyTypeNode, LoopNode);

    expect(screen.getByText('类型: while')).toBeInTheDocument();
  });

  it('should prefer loopType over type', () => {
    const bothTypesNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { type: 'count', loopType: 'while' },
      },
    };

    renderNodeWithProvider(bothTypesNode, LoopNode);

    expect(screen.getByText('类型: while')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, LoopNode);

    expect(screen.getByText('🔁')).toBeInTheDocument();
  });

  it('should apply control category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, LoopNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
      color: '#4338ca',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, LoopNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-indigo-500', 'ring-offset-2');
  });
});

describe('ParallelNode', () => {
  const mockNode: Node = {
    id: 'parallel-1',
    type: 'parallel',
    position: { x: 0, y: 0 },
    data: { label: 'Parallel Tasks' },
  };

  it('should have correct displayName', () => {
    expect(ParallelNode.displayName).toBe('ParallelNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, ParallelNode);

    expect(screen.getByText('Parallel Tasks')).toBeInTheDocument();
  });

  it('should render default branch count', () => {
    renderNodeWithProvider(mockNode, ParallelNode);

    expect(screen.getByText('2 个并行分支')).toBeInTheDocument();
  });

  it('should render custom branch count', () => {
    const branchesNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { branches: 5 },
      },
    };

    renderNodeWithProvider(branchesNode, ParallelNode);

    expect(screen.getByText('5 个并行分支')).toBeInTheDocument();
  });

  it('should render waitAll text when true', () => {
    const waitAllNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { waitAll: true },
      },
    };

    renderNodeWithProvider(waitAllNode, ParallelNode);

    expect(screen.getByText('等待全部完成')).toBeInTheDocument();
  });

  it('should render waitAny text when waitAll is false', () => {
    const waitAnyNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { waitAll: false },
      },
    };

    renderNodeWithProvider(waitAnyNode, ParallelNode);

    expect(screen.getByText('任一完成即继续')).toBeInTheDocument();
  });

  it('should not render waitAll info when not provided', () => {
    renderNodeWithProvider(mockNode, ParallelNode);

    expect(screen.queryByText('等待全部完成')).not.toBeInTheDocument();
    expect(screen.queryByText('任一完成即继续')).not.toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, ParallelNode);

    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('should apply control category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, ParallelNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
      color: '#4338ca',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, ParallelNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-indigo-500', 'ring-offset-2');
  });
});

describe('GroupNode', () => {
  const mockNode: Node = {
    id: 'group-1',
    type: 'group',
    position: { x: 0, y: 0 },
    data: {},
  };

  it('should have correct displayName', () => {
    expect(GroupNode.displayName).toBe('GroupNode');
  });

  it('should render default label when config.label not provided', () => {
    renderNodeWithProvider(mockNode, GroupNode);

    expect(screen.getByText('分组')).toBeInTheDocument();
  });

  it('should render custom label from config', () => {
    const customLabelNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { label: 'Custom Group' },
      },
    };

    renderNodeWithProvider(customLabelNode, GroupNode);

    expect(screen.getByText('Custom Group')).toBeInTheDocument();
  });

  it('should use default label when config.label is empty', () => {
    const emptyConfigNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: {},
      },
    };

    renderNodeWithProvider(emptyConfigNode, GroupNode);

    expect(screen.getByText('分组')).toBeInTheDocument();
  });

  it('should render collapsed indicator when collapsed', () => {
    const collapsedNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { collapsed: true },
      },
    };

    renderNodeWithProvider(collapsedNode, GroupNode);

    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('should not render collapsed indicator when not collapsed', () => {
    renderNodeWithProvider(mockNode, GroupNode);

    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, GroupNode);

    expect(screen.getByText('📁')).toBeInTheDocument();
  });

  it('should apply custom color when provided', () => {
    const coloredNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { color: '#fee2e2' },
      },
    };

    const { container } = renderNodeWithProvider(coloredNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fee2e2',
    });
  });

  it('should apply default color when not provided', () => {
    const { container } = renderNodeWithProvider(mockNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#f3f4f6',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-indigo-500', 'ring-offset-2');
  });

  it('should have dashed border', () => {
    const { container } = renderNodeWithProvider(mockNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('border-dashed');
  });

  it('should have minimum height styling', () => {
    const { container } = renderNodeWithProvider(mockNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('min-h-[80px]');
  });

  it('should have collapsed height when collapsed', () => {
    const collapsedNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { collapsed: true },
      },
    };

    const { container } = renderNodeWithProvider(collapsedNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('h-10');
  });
});

describe('Control nodes common behavior', () => {
  it('IfElseNode should have control category styling', () => {
    const mockNode: Node = {
      id: 'ifelse-1',
      type: 'ifElse',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };
    const { container } = renderNodeWithProvider(mockNode, IfElseNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
    });
  });

  it('LoopNode should have control category styling', () => {
    const mockNode: Node = {
      id: 'loop-1',
      type: 'loop',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };
    const { container } = renderNodeWithProvider(mockNode, LoopNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
    });
  });

  it('ParallelNode should have control category styling', () => {
    const mockNode: Node = {
      id: 'parallel-1',
      type: 'parallel',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };
    const { container } = renderNodeWithProvider(mockNode, ParallelNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0e7ff',
      borderColor: '#6366f1',
    });
  });

  it('GroupNode should have different styling (not control colors)', () => {
    const mockNode: Node = {
      id: 'group-1',
      type: 'group',
      position: { x: 0, y: 0 },
      data: { label: 'Test' },
    };
    const { container } = renderNodeWithProvider(mockNode, GroupNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#f3f4f6',
      borderColor: '#9ca3af',
    });
  });
});
