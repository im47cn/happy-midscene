/**
 * Action Nodes Component Tests
 * 动作节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  ClickNode,
  InputNode,
  ScrollNode,
  WaitNode,
  NavigateNode,
  HoverNode,
  DragNode,
} from '../actions';
import type { CompatibleNodeData } from '../BaseNode';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node) {
  return render(
    <ReactFlowProvider>
      <ClickNode {...node} />
    </ReactFlowProvider>
  );
}

describe('ClickNode', () => {
  const mockNode: Node = {
    id: 'click-1',
    type: 'click',
    position: { x: 0, y: 0 },
    data: { label: 'Click Button' },
  };

  it('should have correct displayName', () => {
    expect(ClickNode.displayName).toBe('ClickNode');
  });

  it('should render with default description when no target', () => {
    render(
      <ReactFlowProvider>
        <ClickNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Click Button')).toBeInTheDocument();
  });

  it('should render with target in description', () => {
    const nodeWithTarget = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#submit-button' },
      },
    };

    render(
      <ReactFlowProvider>
        <ClickNode {...nodeWithTarget} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('点击: #submit-button')).toBeInTheDocument();
  });

  it('should use click icon', () => {
    render(
      <ReactFlowProvider>
        <ClickNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('👆');
  });

  it('should apply action category colors', () => {
    const { container } = render(
      <ReactFlowProvider>
        <ClickNode {...mockNode} />
      </ReactFlowProvider>
    );
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#dbeafe',
      borderColor: '#3b82f6',
    });
  });
});

describe('InputNode', () => {
  const mockNode: Node = {
    id: 'input-1',
    type: 'input',
    position: { x: 0, y: 0 },
    data: { label: 'Input Text' },
  };

  it('should have correct displayName', () => {
    expect(InputNode.displayName).toBe('InputNode');
  });

  it('should render with default description when no target', () => {
    render(
      <ReactFlowProvider>
        <InputNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Input Text')).toBeInTheDocument();
  });

  it('should render with value in description', () => {
    const nodeWithValue = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '#username', value: 'testuser' },
      },
    };

    render(
      <ReactFlowProvider>
        <InputNode {...nodeWithValue} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('输入: testuser')).toBeInTheDocument();
  });

  it('should use input icon', () => {
    render(
      <ReactFlowProvider>
        <InputNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('⌨️');
  });
});

describe('ScrollNode', () => {
  const mockNode: Node = {
    id: 'scroll-1',
    type: 'scroll',
    position: { x: 0, y: 0 },
    data: { label: 'Scroll Page' },
  };

  it('should have correct displayName', () => {
    expect(ScrollNode.displayName).toBe('ScrollNode');
  });

  it('should render with default direction', () => {
    render(
      <ReactFlowProvider>
        <ScrollNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('滚动: down')).toBeInTheDocument();
  });

  it('should render with custom direction', () => {
    const nodeWithDirection = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { direction: 'up' },
      },
    };

    render(
      <ReactFlowProvider>
        <ScrollNode {...nodeWithDirection} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('滚动: up')).toBeInTheDocument();
  });

  it('should render with left direction', () => {
    const nodeWithDirection = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { direction: 'left' },
      },
    };

    render(
      <ReactFlowProvider>
        <ScrollNode {...nodeWithDirection} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('滚动: left')).toBeInTheDocument();
  });

  it('should use scroll icon', () => {
    render(
      <ReactFlowProvider>
        <ScrollNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📜');
  });
});

describe('WaitNode', () => {
  const mockNode: Node = {
    id: 'wait-1',
    type: 'wait',
    position: { x: 0, y: 0 },
    data: { label: 'Wait for Element' },
  };

  it('should have correct displayName', () => {
    expect(WaitNode.displayName).toBe('WaitNode');
  });

  it('should render with default duration', () => {
    render(
      <ReactFlowProvider>
        <WaitNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('等待 1000ms')).toBeInTheDocument();
  });

  it('should render with custom duration', () => {
    const nodeWithDuration = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { duration: 5000 },
      },
    };

    render(
      <ReactFlowProvider>
        <WaitNode {...nodeWithDuration} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('等待 5000ms')).toBeInTheDocument();
  });

  it('should fallback to default when duration is 0 (falsy)', () => {
    const nodeWithDuration = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { duration: 0 },
      },
    };

    render(
      <ReactFlowProvider>
        <WaitNode {...nodeWithDuration} />
      </ReactFlowProvider>
    );

    // 0 is falsy, so it falls back to default 1000
    expect(screen.getByText('等待 1000ms')).toBeInTheDocument();
  });

  it('should use wait icon', () => {
    render(
      <ReactFlowProvider>
        <WaitNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('⏱️');
  });
});

describe('NavigateNode', () => {
  const mockNode: Node = {
    id: 'navigate-1',
    type: 'navigate',
    position: { x: 0, y: 0 },
    data: { label: 'Go to Page' },
  };

  it('should have correct displayName', () => {
    expect(NavigateNode.displayName).toBe('NavigateNode');
  });

  it('should render without description when no URL', () => {
    render(
      <ReactFlowProvider>
        <NavigateNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Go to Page')).toBeInTheDocument();
  });

  it('should render with URL in description', () => {
    const nodeWithUrl = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { url: 'https://example.com' },
      },
    };

    render(
      <ReactFlowProvider>
        <NavigateNode {...nodeWithUrl} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('导航到: https://example.com')).toBeInTheDocument();
  });

  it('should render with relative URL', () => {
    const nodeWithUrl = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { url: '/dashboard' },
      },
    };

    render(
      <ReactFlowProvider>
        <NavigateNode {...nodeWithUrl} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('导航到: /dashboard')).toBeInTheDocument();
  });

  it('should use navigate icon', () => {
    render(
      <ReactFlowProvider>
        <NavigateNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('🔗');
  });
});

describe('HoverNode', () => {
  const mockNode: Node = {
    id: 'hover-1',
    type: 'hover',
    position: { x: 0, y: 0 },
    data: { label: 'Hover Element' },
  };

  it('should have correct displayName', () => {
    expect(HoverNode.displayName).toBe('HoverNode');
  });

  it('should render without description when no target', () => {
    render(
      <ReactFlowProvider>
        <HoverNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Hover Element')).toBeInTheDocument();
  });

  it('should render with target in description', () => {
    const nodeWithTarget = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { target: '.menu-item' },
      },
    };

    render(
      <ReactFlowProvider>
        <HoverNode {...nodeWithTarget} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('悬停: .menu-item')).toBeInTheDocument();
  });

  it('should use hover icon', () => {
    render(
      <ReactFlowProvider>
        <HoverNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('🖱️');
  });
});

describe('DragNode', () => {
  const mockNode: Node = {
    id: 'drag-1',
    type: 'drag',
    position: { x: 0, y: 0 },
    data: { label: 'Drag Element' },
  };

  it('should have correct displayName', () => {
    expect(DragNode.displayName).toBe('DragNode');
  });

  it('should render without description when no from/to', () => {
    render(
      <ReactFlowProvider>
        <DragNode {...mockNode} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('Drag Element')).toBeInTheDocument();
  });

  it('should render with from and to in description', () => {
    const nodeWithPath = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { from: '#draggable', to: '#dropzone' },
      },
    };

    render(
      <ReactFlowProvider>
        <DragNode {...nodeWithPath} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('#draggable → #dropzone')).toBeInTheDocument();
  });

  it('should render with toTarget when to is missing', () => {
    const nodeWithPath = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { from: '#source', toTarget: '#destination' },
      },
    };

    render(
      <ReactFlowProvider>
        <DragNode {...nodeWithPath} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('#source → #destination')).toBeInTheDocument();
  });

  it('should prefer "to" over "toTarget"', () => {
    const nodeWithPath = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { from: '#source', to: '#primary', toTarget: '#fallback' },
      },
    };

    render(
      <ReactFlowProvider>
        <DragNode {...nodeWithPath} />
      </ReactFlowProvider>
    );

    expect(screen.getByText('#source → #primary')).toBeInTheDocument();
  });

  it('should use drag icon', () => {
    render(
      <ReactFlowProvider>
        <DragNode {...mockNode} />
      </ReactFlowProvider>
    );

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('✋');
  });
});

describe('Action nodes common behavior', () => {
  describe('Category colors', () => {
    it('ClickNode should have action category', () => {
      const mockNode: Node = {
        id: 'click-1',
        type: 'click',
        position: { x: 0, y: 0 },
        data: { label: 'Test click' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <ClickNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('InputNode should have action category', () => {
      const mockNode: Node = {
        id: 'input-1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: { label: 'Test input' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <InputNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('ScrollNode should have action category', () => {
      const mockNode: Node = {
        id: 'scroll-1',
        type: 'scroll',
        position: { x: 0, y: 0 },
        data: { label: 'Test scroll' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <ScrollNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('WaitNode should have action category', () => {
      const mockNode: Node = {
        id: 'wait-1',
        type: 'wait',
        position: { x: 0, y: 0 },
        data: { label: 'Test wait' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <WaitNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('NavigateNode should have action category', () => {
      const mockNode: Node = {
        id: 'navigate-1',
        type: 'navigate',
        position: { x: 0, y: 0 },
        data: { label: 'Test navigate' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <NavigateNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('HoverNode should have action category', () => {
      const mockNode: Node = {
        id: 'hover-1',
        type: 'hover',
        position: { x: 0, y: 0 },
        data: { label: 'Test hover' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <HoverNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('DragNode should have action category', () => {
      const mockNode: Node = {
        id: 'drag-1',
        type: 'drag',
        position: { x: 0, y: 0 },
        data: { label: 'Test drag' },
      };
      const { container } = render(
        <ReactFlowProvider>
          <DragNode {...mockNode} />
        </ReactFlowProvider>
      );
      const nodeElement = container.querySelector('.designer-node');
      expect(nodeElement).toHaveStyle({ backgroundColor: '#dbeafe' });
    });
  });

  describe('Icons', () => {
    it('click should have correct icon', () => {
      const mockNode: Node = {
        id: 'click-1',
        type: 'click',
        position: { x: 0, y: 0 },
        data: { label: 'Test click' },
      };
      render(
        <ReactFlowProvider>
          <ClickNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('👆');
    });

    it('input should have correct icon', () => {
      const mockNode: Node = {
        id: 'input-1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: { label: 'Test input' },
      };
      render(
        <ReactFlowProvider>
          <InputNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('⌨️');
    });

    it('scroll should have correct icon', () => {
      const mockNode: Node = {
        id: 'scroll-1',
        type: 'scroll',
        position: { x: 0, y: 0 },
        data: { label: 'Test scroll' },
      };
      render(
        <ReactFlowProvider>
          <ScrollNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('📜');
    });

    it('wait should have correct icon', () => {
      const mockNode: Node = {
        id: 'wait-1',
        type: 'wait',
        position: { x: 0, y: 0 },
        data: { label: 'Test wait' },
      };
      render(
        <ReactFlowProvider>
          <WaitNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('⏱️');
    });

    it('navigate should have correct icon', () => {
      const mockNode: Node = {
        id: 'navigate-1',
        type: 'navigate',
        position: { x: 0, y: 0 },
        data: { label: 'Test navigate' },
      };
      render(
        <ReactFlowProvider>
          <NavigateNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('🔗');
    });

    it('hover should have correct icon', () => {
      const mockNode: Node = {
        id: 'hover-1',
        type: 'hover',
        position: { x: 0, y: 0 },
        data: { label: 'Test hover' },
      };
      render(
        <ReactFlowProvider>
          <HoverNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('🖱️');
    });

    it('drag should have correct icon', () => {
      const mockNode: Node = {
        id: 'drag-1',
        type: 'drag',
        position: { x: 0, y: 0 },
        data: { label: 'Test drag' },
      };
      render(
        <ReactFlowProvider>
          <DragNode {...mockNode} />
        </ReactFlowProvider>
      );
      const iconElement = screen.getByLabelText('node-icon');
      expect(iconElement).toHaveTextContent('✋');
    });
  });
});
