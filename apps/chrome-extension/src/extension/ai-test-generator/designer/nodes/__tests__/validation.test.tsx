/**
 * Validation Nodes Component Tests
 * 验证节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  AssertExistsNode,
  AssertTextNode,
  AssertStateNode,
  AiAssertNode,
} from '../validation';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node, Component: React.ComponentType<Node>) {
  return render(
    <ReactFlowProvider>
      <Component {...node} />
    </ReactFlowProvider>
  );
}

describe('AssertExistsNode', () => {
  const mockNode: Node = {
    id: 'assert-exists-1',
    type: 'assertExists',
    position: { x: 0, y: 0 },
    data: { label: 'Element Exists' },
  };

  it('should have correct displayName', () => {
    expect(AssertExistsNode.displayName).toBe('AssertExistsNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, AssertExistsNode);

    expect(screen.getByText('Element Exists')).toBeInTheDocument();
  });

  it('should render description with target and state', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#submit-button', state: 'visible' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, AssertExistsNode);

    expect(screen.getByText('visible: #submit-button')).toBeInTheDocument();
  });

  it('should render description with negate prefix', () => {
    const nodeWithNegate = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#hidden-element', state: 'visible', negate: true },
      },
    };

    renderNodeWithProvider(nodeWithNegate, AssertExistsNode);

    expect(screen.getByText('不visible: #hidden-element')).toBeInTheDocument();
  });

  it('should use default state when not provided', () => {
    const nodeWithoutState = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#button' },
      },
    };

    renderNodeWithProvider(nodeWithoutState, AssertExistsNode);

    expect(screen.getByText('visible: #button')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, AssertExistsNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('👁️');
  });

  it('should apply validation category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, AssertExistsNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#dcfce7',
      borderColor: '#22c55e',
    });
  });

  it('should handle different states', () => {
    const states = ['visible', 'enabled', 'disabled', 'checked', 'unchecked'];

    states.forEach((state) => {
      const nodeWithState = {
        ...mockNode,
        data: {
          ...mockNode.data,
          config: { target: '#element', state },
        },
      };

      const { unmount } = renderNodeWithProvider(nodeWithState, AssertExistsNode);

      expect(screen.getByText(`${state}: #element`)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('AssertTextNode', () => {
  const mockNode: Node = {
    id: 'assert-text-1',
    type: 'assertText',
    position: { x: 0, y: 0 },
    data: { label: 'Text Content' },
  };

  it('should have correct displayName', () => {
    expect(AssertTextNode.displayName).toBe('AssertTextNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, AssertTextNode);

    expect(screen.getByText('Text Content')).toBeInTheDocument();
  });

  it('should render description with text and operator', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { text: 'Welcome', operator: 'contains' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, AssertTextNode);

    expect(screen.getByText('"Welcome" contains')).toBeInTheDocument();
  });

  it('should use default operator when not provided', () => {
    const nodeWithoutOperator = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { text: 'Hello' },
      },
    };

    renderNodeWithProvider(nodeWithoutOperator, AssertTextNode);

    expect(screen.getByText('"Hello" contains')).toBeInTheDocument();
  });

  it('should render with equals operator', () => {
    const nodeWithEquals = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { text: 'Exact Match', operator: 'equals' },
      },
    };

    renderNodeWithProvider(nodeWithEquals, AssertTextNode);

    expect(screen.getByText('"Exact Match" equals')).toBeInTheDocument();
  });

  it('should render with matches operator', () => {
    const nodeWithMatches = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { text: '\\d+', operator: 'matches' },
      },
    };

    renderNodeWithProvider(nodeWithMatches, AssertTextNode);

    expect(screen.getByText('"\\d+" matches')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, AssertTextNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📝');
  });

  it('should apply validation category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, AssertTextNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#dcfce7',
      borderColor: '#22c55e',
    });
  });

  it('should handle empty text', () => {
    const nodeWithEmptyText = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { text: '' },
      },
    };

    renderNodeWithProvider(nodeWithEmptyText, AssertTextNode);

    // Empty text means no description rendered
    expect(screen.queryByText(/".*" contains/)).not.toBeInTheDocument();
  });
});

describe('AssertStateNode', () => {
  const mockNode: Node = {
    id: 'assert-state-1',
    type: 'assertState',
    position: { x: 0, y: 0 },
    data: { label: 'State Check' },
  };

  it('should have correct displayName', () => {
    expect(AssertStateNode.displayName).toBe('AssertStateNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, AssertStateNode);

    expect(screen.getByText('State Check')).toBeInTheDocument();
  });

  it('should render description with target and state', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#checkbox', state: 'checked' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, AssertStateNode);

    expect(screen.getByText('checked: #checkbox')).toBeInTheDocument();
  });

  it('should render description with negate prefix', () => {
    const nodeWithNegate = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#checkbox', state: 'checked', negate: true },
      },
    };

    renderNodeWithProvider(nodeWithNegate, AssertStateNode);

    expect(screen.getByText('不checked: #checkbox')).toBeInTheDocument();
  });

  it('should handle empty state', () => {
    const nodeWithEmptyState = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#element', state: '' },
      },
    };

    renderNodeWithProvider(nodeWithEmptyState, AssertStateNode);

    expect(screen.getByText(': #element')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, AssertStateNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('✅');
  });

  it('should apply validation category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, AssertStateNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#dcfce7',
      borderColor: '#22c55e',
    });
  });

  it('should handle common states', () => {
    const states = ['checked', 'unchecked', 'enabled', 'disabled', 'focused', 'hidden'];

    states.forEach((state) => {
      const nodeWithState = {
        ...mockNode,
        data: {
          ...mockNode.data,
          config: { target: '#element', state },
        },
      };

      const { unmount } = renderNodeWithProvider(nodeWithState, AssertStateNode);

      expect(screen.getByText(`${state}: #element`)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('AiAssertNode', () => {
  const mockNode: Node = {
    id: 'ai-assert-1',
    type: 'aiAssert',
    position: { x: 0, y: 0 },
    data: { label: 'AI Validation' },
  };

  it('should have correct displayName', () => {
    expect(AiAssertNode.displayName).toBe('AiAssertNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, AiAssertNode);

    expect(screen.getByText('AI Validation')).toBeInTheDocument();
  });

  it('should render description with assertion', () => {
    const nodeWithAssertion = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { assertion: 'The page shows a success message' },
      },
    };

    renderNodeWithProvider(nodeWithAssertion, AiAssertNode);

    expect(screen.getByText('The page shows a success message')).toBeInTheDocument();
  });

  it('should handle empty assertion', () => {
    const nodeWithEmptyAssertion = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { assertion: '' },
      },
    };

    renderNodeWithProvider(nodeWithEmptyAssertion, AiAssertNode);

    // Empty assertion means no description
    const description = screen.queryByText('The page shows a success message');
    expect(description).not.toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, AiAssertNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('🤖');
  });

  it('should apply validation category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, AiAssertNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#dcfce7',
      borderColor: '#22c55e',
    });
  });

  it('should handle long assertions', () => {
    const longAssertion = 'The user should see a confirmation dialog with title "Confirm Action" and two buttons: "Confirm" and "Cancel"';
    const nodeWithLongAssertion = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { assertion: longAssertion },
      },
    };

    const { container } = renderNodeWithProvider(nodeWithLongAssertion, AiAssertNode);

    // Check that the description is rendered (it will be truncated)
    const description = container.querySelector('.opacity-75');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent(longAssertion);
  });
});

describe('Validation nodes common behavior', () => {
  describe('Category colors', () => {
    it('AssertExistsNode should have validation category', () => {
      const mockNode: Node = {
        id: 'assert-exists-1',
        type: 'assertExists',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, AssertExistsNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
      });
    });

    it('AssertTextNode should have validation category', () => {
      const mockNode: Node = {
        id: 'assert-text-1',
        type: 'assertText',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, AssertTextNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
      });
    });

    it('AssertStateNode should have validation category', () => {
      const mockNode: Node = {
        id: 'assert-state-1',
        type: 'assertState',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, AssertStateNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
      });
    });

    it('AiAssertNode should have validation category', () => {
      const mockNode: Node = {
        id: 'ai-assert-1',
        type: 'aiAssert',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, AiAssertNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
      });
    });
  });

  describe('Icons', () => {
    it('AssertExistsNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'assert-exists-1',
        type: 'assertExists',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, AssertExistsNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('👁️');
    });

    it('AssertTextNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'assert-text-1',
        type: 'assertText',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, AssertTextNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('📝');
    });

    it('AssertStateNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'assert-state-1',
        type: 'assertState',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, AssertStateNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('✅');
    });

    it('AiAssertNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'ai-assert-1',
        type: 'aiAssert',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, AiAssertNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('🤖');
    });
  });
});
