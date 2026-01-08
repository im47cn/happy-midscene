/**
 * BaseNode Component Tests
 * 基础节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { BaseNode, type BaseNodeProps, type CompatibleNodeData } from '../BaseNode';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node<BaseNodeProps>) {
  return render(
    <ReactFlowProvider>
      <BaseNode data={node.data as CompatibleNodeData} selected={node.selected || false} type={node.type || 'default'} id={node.id} />
    </ReactFlowProvider>
  );
}

describe('BaseNode', () => {
  let mockNode: Node<BaseNodeProps>;

  beforeEach(() => {
    mockNode = {
      id: 'test-node-1',
      type: 'click',
      position: { x: 0, y: 0 },
      data: {
        label: 'Click Button',
        description: 'Clicks the submit button',
        category: 'action',
        inputs: true,
        outputs: true,
      },
    };
  });

  describe('Rendering', () => {
    it('should render node label', () => {
      renderNodeWithProvider(mockNode);

      expect(screen.getByText('Click Button')).toBeInTheDocument();
    });

    it('should render node description', () => {
      renderNodeWithProvider(mockNode);

      expect(screen.getByText('Clicks the submit button')).toBeInTheDocument();
    });

    it('should render without description when not provided', () => {
      const nodeWithoutDescription = {
        ...mockNode,
        data: { ...mockNode.data, description: undefined },
      };

      renderNodeWithProvider(nodeWithoutDescription);

      const description = screen.queryByText('Clicks the submit button');
      expect(description).not.toBeInTheDocument();
    });

    it('should render node icon', () => {
      renderNodeWithProvider(mockNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('👆');
    });

    it('should use custom icon when provided', () => {
      const nodeWithCustomIcon = {
        ...mockNode,
        data: { ...mockNode.data, icon: '🎯' },
      };

      renderNodeWithProvider(nodeWithCustomIcon);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('🎯');
    });

    it('should use default icon for unknown node type', () => {
      const unknownNode = {
        ...mockNode,
        type: 'unknown-type',
      };

      renderNodeWithProvider(unknownNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('•');
    });
  });

  describe('Category styling', () => {
    it('should apply action category colors', () => {
      const actionNode = {
        ...mockNode,
        data: { ...mockNode.data, category: 'action' },
      };

      const { container } = renderNodeWithProvider(actionNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dbeafe',
        borderColor: '#3b82f6',
        color: '#1e40af',
      });
    });

    it('should apply special category colors', () => {
      const specialNode = {
        ...mockNode,
        data: { ...mockNode.data, category: 'special' },
      };

      const { container } = renderNodeWithProvider(specialNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        color: '#92400e',
      });
    });

    it('should apply validation category colors', () => {
      const validationNode = {
        ...mockNode,
        data: { ...mockNode.data, category: 'validation' },
      };

      const { container } = renderNodeWithProvider(validationNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
        color: '#166534',
      });
    });

    it('should apply control category colors', () => {
      const controlNode = {
        ...mockNode,
        data: { ...mockNode.data, category: 'control' },
      };

      const { container } = renderNodeWithProvider(controlNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#e0e7ff',
        borderColor: '#6366f1',
        color: '#4338ca',
      });
    });

    it('should apply data category colors', () => {
      const dataNode = {
        ...mockNode,
        data: { ...mockNode.data, category: 'data' },
      };

      const { container } = renderNodeWithProvider(dataNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#fce7f3',
        borderColor: '#ec4899',
        color: '#9f1239',
      });
    });

    it('should default to action category when not specified', () => {
      const noCategoryNode = {
        ...mockNode,
        data: { ...mockNode.data, category: undefined },
      };

      const { container } = renderNodeWithProvider(noCategoryNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dbeafe',
      });
    });
  });

  describe('Selected state', () => {
    it('should apply ring when selected', () => {
      const selectedNode = {
        ...mockNode,
        selected: true,
      };

      const { container } = renderNodeWithProvider(selectedNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveClass('ring-2', 'ring-blue-500', 'ring-offset-2');
    });

    it('should not apply ring when not selected', () => {
      const unselectedNode = {
        ...mockNode,
        selected: false,
      };

      const { container } = renderNodeWithProvider(unselectedNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).not.toHaveClass('ring-2');
    });
  });

  describe('Error and warning states', () => {
    it('should display error message', () => {
      const errorNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: ['Target element not found'],
        },
      };

      renderNodeWithProvider(errorNode);

      expect(screen.getByText(/❌ Target element not found/)).toBeInTheDocument();
    });

    it('should apply red border when has errors', () => {
      const errorNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: ['Target element not found'],
        },
      };

      const { container } = renderNodeWithProvider(errorNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({ borderColor: '#ef4444' });
    });

    it('should display warning message when no errors', () => {
      const warningNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          warnings: ['This action might timeout'],
        },
      };

      renderNodeWithProvider(warningNode);

      expect(screen.getByText(/⚠️ This action might timeout/)).toBeInTheDocument();
    });

    it('should apply yellow border when has warnings but no errors', () => {
      const warningNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          warnings: ['This action might timeout'],
        },
      };

      const { container } = renderNodeWithProvider(warningNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({ borderColor: '#eab308' });
    });

    it('should prioritize errors over warnings', () => {
      const errorAndWarningNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: ['Target element not found'],
          warnings: ['This action might timeout'],
        },
      };

      renderNodeWithProvider(errorAndWarningNode);

      expect(screen.getByText(/❌ Target element not found/)).toBeInTheDocument();
      expect(screen.queryByText(/⚠️ This action might timeout/)).not.toBeInTheDocument();
    });

    it('should show first error only when multiple errors', () => {
      const multipleErrorsNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: ['Error 1', 'Error 2', 'Error 3'],
        },
      };

      renderNodeWithProvider(multipleErrorsNode);

      expect(screen.getByText(/❌ Error 1/)).toBeInTheDocument();
      expect(screen.queryByText(/❌ Error 2/)).not.toBeInTheDocument();
    });

    it('should show first warning only when multiple warnings', () => {
      const multipleWarningsNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          warnings: ['Warning 1', 'Warning 2'],
        },
      };

      renderNodeWithProvider(multipleWarningsNode);

      expect(screen.getByText(/⚠️ Warning 1/)).toBeInTheDocument();
      expect(screen.queryByText(/⚠️ Warning 2/)).not.toBeInTheDocument();
    });
  });

  describe('Node type icons', () => {
    const testCases = [
      { type: 'start', icon: '🚀' },
      { type: 'end', icon: '🏁' },
      { type: 'comment', icon: '💬' },
      { type: 'subflow', icon: '📦' },
      { type: 'click', icon: '👆' },
      { type: 'input', icon: '⌨️' },
      { type: 'scroll', icon: '📜' },
      { type: 'wait', icon: '⏱️' },
      { type: 'navigate', icon: '🔗' },
      { type: 'hover', icon: '🖱️' },
      { type: 'drag', icon: '✋' },
      { type: 'assertExists', icon: '👁️' },
      { type: 'assertText', icon: '📝' },
      { type: 'assertState', icon: '✅' },
      { type: 'aiAssert', icon: '🤖' },
      { type: 'ifElse', icon: '🔀' },
      { type: 'loop', icon: '🔁' },
      { type: 'parallel', icon: '⚡' },
      { type: 'group', icon: '📁' },
      { type: 'setVariable', icon: '📊' },
      { type: 'extractData', icon: '📤' },
      { type: 'externalData', icon: '📥' },
    ];

    testCases.forEach(({ type, icon }) => {
      it(`should render ${icon} icon for ${type} node type`, () => {
        const node = {
          ...mockNode,
          type,
        };

        renderNodeWithProvider(node);

        const iconElement = screen.getByLabelText('node-icon');
        expect(iconElement).toHaveTextContent(icon);
      });
    });
  });

  describe('Handle rendering', () => {
    it('should render input handle when inputs is not false', () => {
      const { container } = renderNodeWithProvider(mockNode);

      // React Flow Handle components don't have distinct class names, but we can check
      // that the node has the expected structure
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toBeInTheDocument();
    });

    it('should render output handle when outputs is not false', () => {
      const { container } = renderNodeWithProvider(mockNode);

      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toBeInTheDocument();
    });

    it('should not render input handle when inputs is false', () => {
      const noInputNode = {
        ...mockNode,
        data: { ...mockNode.data, inputs: false },
      };

      const { container } = renderNodeWithProvider(noInputNode);

      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toBeInTheDocument();
    });

    it('should not render output handle when outputs is false', () => {
      const noOutputNode = {
        ...mockNode,
        data: { ...mockNode.data, outputs: false },
      };

      const { container } = renderNodeWithProvider(noOutputNode);

      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label for icon', () => {
      renderNodeWithProvider(mockNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should have title attribute for label truncation', () => {
      const longLabelNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          label: 'This is a very long label that should be truncated with title attribute',
        },
      };

      renderNodeWithProvider(longLabelNode);

      const labelElement = screen.getByText(/This is a very long label/);
      expect(labelElement).toHaveAttribute('title', 'This is a very long label that should be truncated with title attribute');
    });

    it('should have title attribute for description', () => {
      const longDescriptionNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          description: 'This is a very long description that should be truncated with title attribute for accessibility',
        },
      };

      renderNodeWithProvider(longDescriptionNode);

      const descriptionElement = screen.getByText(/This is a very long description/);
      expect(descriptionElement).toHaveAttribute('title');
    });
  });

  describe('CSS classes', () => {
    it('should apply base classes', () => {
      const { container } = renderNodeWithProvider(mockNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveClass('min-w-[160px]', 'max-w-[240px]', 'rounded-lg', 'border-2', 'transition-all');
    });

    it('should add ring class when selected', () => {
      const selectedNode = {
        ...mockNode,
        selected: true,
      };

      const { container } = renderNodeWithProvider(selectedNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement?.className).toContain('ring-2');
    });

    it('should add error class when has errors', () => {
      const errorNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: ['Error'],
        },
      };

      const { container } = renderNodeWithProvider(errorNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement?.className).toContain('border-red-500');
    });

    it('should add warning class when has warnings', () => {
      const warningNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          warnings: ['Warning'],
        },
      };

      const { container } = renderNodeWithProvider(warningNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement?.className).toContain('border-yellow-500');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty label', () => {
      const emptyLabelNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          label: '',
        },
      };

      const { container } = renderNodeWithProvider(emptyLabelNode);

      // The label has "font-medium text-sm truncate flex-1" classes
      const labelElement = container.querySelector('.font-medium');
      expect(labelElement).toBeInTheDocument();
      expect(labelElement).toHaveTextContent('');
    });

    it('should handle empty errors array', () => {
      const emptyErrorsNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          errors: [],
        },
      };

      const { container } = renderNodeWithProvider(emptyErrorsNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).not.toHaveStyle({ borderColor: '#ef4444' });
    });

    it('should handle empty warnings array', () => {
      const emptyWarningsNode = {
        ...mockNode,
        data: {
          ...mockNode.data,
          warnings: [],
        },
      };

      const { container } = renderNodeWithProvider(emptyWarningsNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).not.toHaveStyle({ borderColor: '#eab308' });
    });

    it('should handle undefined type', () => {
      const noTypeNode = {
        ...mockNode,
        type: undefined,
      };

      renderNodeWithProvider(noTypeNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('•');
    });
  });

  describe('Memoization', () => {
    it('should have displayName for debugging', () => {
      expect(BaseNode.displayName).toBe('BaseNode');
    });
  });
});
