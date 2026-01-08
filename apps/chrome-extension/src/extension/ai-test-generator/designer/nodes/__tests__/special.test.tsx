/**
 * Special Nodes Component Tests
 * 特殊节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  StartNode,
  EndNode,
  CommentNode,
  SubflowNode,
} from '../special';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node, Component: React.ComponentType<Node>) {
  return render(
    <ReactFlowProvider>
      <Component {...node} />
    </ReactFlowProvider>
  );
}

describe('StartNode', () => {
  const mockNode: Node = {
    id: 'start-1',
    type: 'start',
    position: { x: 0, y: 0 },
    data: { label: 'Start' },
  };

  it('should have correct displayName', () => {
    expect(StartNode.displayName).toBe('StartNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, StartNode);

    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, StartNode);

    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('should have rounded shape', () => {
    const { container } = renderNodeWithProvider(mockNode, StartNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('rounded-full');
  });

  it('should apply start node colors', () => {
    const { container } = renderNodeWithProvider(mockNode, StartNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#d1fae5',
      borderColor: '#10b981',
      color: '#065f46',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, StartNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-green-500', 'ring-offset-2');
  });

  it('should have source handle only', () => {
    const { container } = renderNodeWithProvider(mockNode, StartNode);

    // Should have source handle (right side)
    const sourceHandle = container.querySelector('.react-flow__handle-right');
    expect(sourceHandle).toBeInTheDocument();
    expect(sourceHandle).toHaveClass('source');
  });

  it('should not have target handle', () => {
    const { container } = renderNodeWithProvider(mockNode, StartNode);

    const targetHandle = container.querySelector('.react-flow__handle-left');
    expect(targetHandle).not.toBeInTheDocument();
  });
});

describe('EndNode', () => {
  const mockNode: Node = {
    id: 'end-1',
    type: 'end',
    position: { x: 0, y: 0 },
    data: { label: 'End' },
  };

  it('should have correct displayName', () => {
    expect(EndNode.displayName).toBe('EndNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, EndNode);

    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, EndNode);

    expect(screen.getByText('🏁')).toBeInTheDocument();
  });

  it('should have rounded shape', () => {
    const { container } = renderNodeWithProvider(mockNode, EndNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('rounded-full');
  });

  it('should apply end node colors', () => {
    const { container } = renderNodeWithProvider(mockNode, EndNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fee2e2',
      borderColor: '#ef4444',
      color: '#991b1b',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, EndNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-red-500', 'ring-offset-2');
  });

  it('should have target handle only', () => {
    const { container } = renderNodeWithProvider(mockNode, EndNode);

    // Should have target handle (left side)
    const targetHandle = container.querySelector('.react-flow__handle-left');
    expect(targetHandle).toBeInTheDocument();
    expect(targetHandle).toHaveClass('target');
  });

  it('should not have source handle', () => {
    const { container } = renderNodeWithProvider(mockNode, EndNode);

    const sourceHandle = container.querySelector('.react-flow__handle-right');
    expect(sourceHandle).not.toBeInTheDocument();
  });
});

describe('CommentNode', () => {
  const mockNode: Node = {
    id: 'comment-1',
    type: 'comment',
    position: { x: 0, y: 0 },
    data: { label: 'Note' },
  };

  it('should have correct displayName', () => {
    expect(CommentNode.displayName).toBe('CommentNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, CommentNode);

    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('should render content from config', () => {
    const nodeWithContent = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { content: 'This is a comment explaining the flow' },
      },
    };

    renderNodeWithProvider(nodeWithContent, CommentNode);

    expect(screen.getByText('This is a comment explaining the flow')).toBeInTheDocument();
  });

  it('should render empty content when not provided', () => {
    renderNodeWithProvider(mockNode, CommentNode);

    // Should not have content div with text
    const contentDiv = screen.queryByText((content, element) => {
      return element?.classList.contains('text-yellow-900') && content === '';
    });
    expect(contentDiv).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, CommentNode);

    expect(screen.getByText('💬')).toBeInTheDocument();
  });

  it('should apply default comment node colors', () => {
    const { container } = renderNodeWithProvider(mockNode, CommentNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fff9c4',
      borderColor: '#fbbf24',
    });
  });

  it('should apply custom color when provided', () => {
    const coloredNode = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { color: '#e0f2fe' },
      },
    };

    const { container } = renderNodeWithProvider(coloredNode, CommentNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#e0f2fe',
    });
  });

  it('should apply ring when selected', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, CommentNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('ring-2', 'ring-yellow-500', 'ring-offset-2');
  });

  it('should have dashed border', () => {
    const { container } = renderNodeWithProvider(mockNode, CommentNode);
    const nodeElement = container.firstChild as HTMLElement;

    expect(nodeElement).toHaveClass('border-dashed');
  });

  it('should handle multiline content', () => {
    const nodeWithMultiline = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { content: 'Line 1\nLine 2\nLine 3' },
      },
    };

    const { container } = renderNodeWithProvider(nodeWithMultiline, CommentNode);

    const contentDiv = container.querySelector('.whitespace-pre-wrap');
    expect(contentDiv).toBeInTheDocument();
    // textContent normalizes whitespace, but the element still has the class for CSS rendering
    expect(contentDiv).toHaveTextContent('Line 1 Line 2 Line 3');
    expect(contentDiv).toHaveClass('whitespace-pre-wrap');
  });

  it('should handle long content with word break', () => {
    const longContent = 'This is a very long comment that should wrap to multiple lines without overflowing the container width';
    const nodeWithLongContent = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { content: longContent },
      },
    };

    const { container } = renderNodeWithProvider(nodeWithLongContent, CommentNode);
    const contentDiv = container.querySelector('.break-words');

    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveTextContent(longContent);
  });
});

describe('SubflowNode', () => {
  const mockNode: Node = {
    id: 'subflow-1',
    type: 'subflow',
    position: { x: 0, y: 0 },
    data: { label: 'Sub Process' },
  };

  it('should have correct displayName', () => {
    expect(SubflowNode.displayName).toBe('SubflowNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, SubflowNode);

    expect(screen.getByText('Sub Process')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, SubflowNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📦');
  });

  it('should apply special category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, SubflowNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fef3c7',
      borderColor: '#f59e0b',
    });
  });

  it('should pass through selected state', () => {
    const selectedNode = { ...mockNode, selected: true };
    const { container } = renderNodeWithProvider(selectedNode, SubflowNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2');
  });
});

describe('Special nodes comparison', () => {
  it('Start and End nodes have different colors', () => {
    const startNode: Node = {
      id: 'start-1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: 'Start' },
    };

    const endNode: Node = {
      id: 'end-1',
      type: 'end',
      position: { x: 0, y: 0 },
      data: { label: 'End' },
    };

    const { container: startContainer } = renderNodeWithProvider(startNode, StartNode);
    const { container: endContainer } = renderNodeWithProvider(endNode, EndNode);

    const startElement = startContainer.firstChild as HTMLElement;
    const endElement = endContainer.firstChild as HTMLElement;

    expect(startElement.style.backgroundColor).toBe('rgb(209, 250, 229)'); // green
    expect(endElement.style.backgroundColor).toBe('rgb(254, 226, 226)'); // red
  });

  it('Start has source handle, End has target handle', () => {
    const startNode: Node = {
      id: 'start-1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: 'Start' },
    };

    const endNode: Node = {
      id: 'end-1',
      type: 'end',
      position: { x: 0, y: 0 },
      data: { label: 'End' },
    };

    const { container: startContainer } = renderNodeWithProvider(startNode, StartNode);
    const { container: endContainer } = renderNodeWithProvider(endNode, EndNode);

    expect(startContainer.querySelector('.react-flow__handle-right')).toBeInTheDocument();
    expect(startContainer.querySelector('.react-flow__handle-left')).not.toBeInTheDocument();

    expect(endContainer.querySelector('.react-flow__handle-left')).toBeInTheDocument();
    expect(endContainer.querySelector('.react-flow__handle-right')).not.toBeInTheDocument();
  });
});
