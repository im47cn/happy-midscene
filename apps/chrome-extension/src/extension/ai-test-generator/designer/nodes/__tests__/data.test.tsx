/**
 * Data Nodes Component Tests
 * 数据节点组件测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReactFlowProvider } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import {
  SetVariableNode,
  ExtractDataNode,
  ExternalDataNode,
} from '../data';

// Helper to render node with ReactFlowProvider
function renderNodeWithProvider(node: Node, Component: React.ComponentType<Node>) {
  return render(
    <ReactFlowProvider>
      <Component {...node} />
    </ReactFlowProvider>
  );
}

describe('SetVariableNode', () => {
  const mockNode: Node = {
    id: 'set-var-1',
    type: 'setVariable',
    position: { x: 0, y: 0 },
    data: { label: 'Set Variable' },
  };

  it('should have correct displayName', () => {
    expect(SetVariableNode.displayName).toBe('SetVariableNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, SetVariableNode);

    expect(screen.getByText('Set Variable')).toBeInTheDocument();
  });

  it('should render description with name and value', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { name: 'username', value: 'testuser' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, SetVariableNode);

    expect(screen.getByText('username = testuser')).toBeInTheDocument();
  });

  it('should render with empty value', () => {
    const nodeWithEmptyValue = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { name: 'counter', value: '' },
      },
    };

    const { container } = renderNodeWithProvider(nodeWithEmptyValue, SetVariableNode);

    // Use container query since getByText normalizes whitespace
    const description = container.querySelector('.opacity-75');
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent('counter =');
  });

  it('should handle numeric values', () => {
    const nodeWithNumber = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { name: 'count', value: '42' },
      },
    };

    renderNodeWithProvider(nodeWithNumber, SetVariableNode);

    expect(screen.getByText('count = 42')).toBeInTheDocument();
  });

  it('should handle expression values', () => {
    const nodeWithExpression = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { name: 'result', value: '${count} + 1' },
      },
    };

    renderNodeWithProvider(nodeWithExpression, SetVariableNode);

    expect(screen.getByText('result = ${count} + 1')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, SetVariableNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📊');
  });

  it('should apply data category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, SetVariableNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fce7f3',
      borderColor: '#ec4899',
    });
  });

  it('should not render description when name is empty', () => {
    const nodeWithEmptyName = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { name: '', value: 'value' },
      },
    };

    renderNodeWithProvider(nodeWithEmptyName, SetVariableNode);

    expect(screen.queryByText('= value')).not.toBeInTheDocument();
  });
});

describe('ExtractDataNode', () => {
  const mockNode: Node = {
    id: 'extract-data-1',
    type: 'extractData',
    position: { x: 0, y: 0 },
    data: { label: 'Extract Data' },
  };

  it('should have correct displayName', () => {
    expect(ExtractDataNode.displayName).toBe('ExtractDataNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, ExtractDataNode);

    expect(screen.getByText('Extract Data')).toBeInTheDocument();
  });

  it('should render description with extractType and variable', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { extractType: 'text', variable: 'extractedText' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, ExtractDataNode);

    expect(screen.getByText('提取 text → extractedText')).toBeInTheDocument();
  });

  it('should use default extractType when not provided', () => {
    const nodeWithoutType = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { variable: 'data' },
      },
    };

    renderNodeWithProvider(nodeWithoutType, ExtractDataNode);

    expect(screen.getByText('提取 text → data')).toBeInTheDocument();
  });

  it('should render with attribute extractType', () => {
    const nodeWithAttribute = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { extractType: 'attribute', variable: 'href' },
      },
    };

    renderNodeWithProvider(nodeWithAttribute, ExtractDataNode);

    expect(screen.getByText('提取 attribute → href')).toBeInTheDocument();
  });

  it('should render with html extractType', () => {
    const nodeWithHtml = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { extractType: 'html', variable: 'content' },
      },
    };

    renderNodeWithProvider(nodeWithHtml, ExtractDataNode);

    expect(screen.getByText('提取 html → content')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, ExtractDataNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📤');
  });

  it('should apply data category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, ExtractDataNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fce7f3',
      borderColor: '#ec4899',
    });
  });

  it('should not render description when variable is empty', () => {
    const nodeWithEmptyVariable = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { extractType: 'text', variable: '' },
      },
    };

    renderNodeWithProvider(nodeWithEmptyVariable, ExtractDataNode);

    expect(screen.queryByText(/提取/)).not.toBeInTheDocument();
  });

  it('should handle different extract types', () => {
    const types = ['text', 'attribute', 'html', 'value', 'src', 'href'];

    types.forEach((type) => {
      const nodeWithType = {
        ...mockNode,
        data: {
          ...mockNode.data,
          config: { extractType: type, variable: 'result' },
        },
      };

      const { unmount } = renderNodeWithProvider(nodeWithType, ExtractDataNode);

      expect(screen.getByText(`提取 ${type} → result`)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('ExternalDataNode', () => {
  const mockNode: Node = {
    id: 'external-data-1',
    type: 'externalData',
    position: { x: 0, y: 0 },
    data: { label: 'Load Data' },
  };

  it('should have correct displayName', () => {
    expect(ExternalDataNode.displayName).toBe('ExternalDataNode');
  });

  it('should render node label', () => {
    renderNodeWithProvider(mockNode, ExternalDataNode);

    expect(screen.getByText('Load Data')).toBeInTheDocument();
  });

  it('should render description with format and variable', () => {
    const nodeWithConfig = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { source: 'https://api.example.com/data', format: 'json', variable: 'apiData' },
      },
    };

    renderNodeWithProvider(nodeWithConfig, ExternalDataNode);

    expect(screen.getByText('加载 json → apiData')).toBeInTheDocument();
  });

  it('should use default format when not provided', () => {
    const nodeWithoutFormat = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { source: 'https://api.example.com/data', variable: 'data' },
      },
    };

    renderNodeWithProvider(nodeWithoutFormat, ExternalDataNode);

    expect(screen.getByText('加载 json → data')).toBeInTheDocument();
  });

  it('should render with csv format', () => {
    const nodeWithCsv = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { source: 'data.csv', format: 'csv', variable: 'tableData' },
      },
    };

    renderNodeWithProvider(nodeWithCsv, ExternalDataNode);

    expect(screen.getByText('加载 csv → tableData')).toBeInTheDocument();
  });

  it('should render with xml format', () => {
    const nodeWithXml = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { source: 'data.xml', format: 'xml', variable: 'xmlData' },
      },
    };

    renderNodeWithProvider(nodeWithXml, ExternalDataNode);

    expect(screen.getByText('加载 xml → xmlData')).toBeInTheDocument();
  });

  it('should use correct icon', () => {
    renderNodeWithProvider(mockNode, ExternalDataNode);

    const icon = screen.getByLabelText('node-icon');
    expect(icon).toHaveTextContent('📥');
  });

  it('should apply data category colors', () => {
    const { container } = renderNodeWithProvider(mockNode, ExternalDataNode);
    const nodeElement = container.querySelector('.designer-node');

    expect(nodeElement).toHaveStyle({
      backgroundColor: '#fce7f3',
      borderColor: '#ec4899',
    });
  });

  it('should not render description when source is empty', () => {
    const nodeWithEmptySource = {
      ...mockNode,
      data: {
        ...mockNode.data,
        config: { source: '', format: 'json', variable: 'data' },
      },
    };

    renderNodeWithProvider(nodeWithEmptySource, ExternalDataNode);

    expect(screen.queryByText(/加载/)).not.toBeInTheDocument();
  });

  it('should handle different formats', () => {
    const formats = ['json', 'csv', 'xml', 'yaml', 'txt'];

    formats.forEach((format) => {
      const nodeWithFormat = {
        ...mockNode,
        data: {
          ...mockNode.data,
          config: { source: 'data.ext', format, variable: 'loadedData' },
        },
      };

      const { unmount } = renderNodeWithProvider(nodeWithFormat, ExternalDataNode);

      expect(screen.getByText(`加载 ${format} → loadedData`)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('Data nodes common behavior', () => {
  describe('Category colors', () => {
    it('SetVariableNode should have data category', () => {
      const mockNode: Node = {
        id: 'set-var-1',
        type: 'setVariable',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, SetVariableNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#fce7f3',
        borderColor: '#ec4899',
      });
    });

    it('ExtractDataNode should have data category', () => {
      const mockNode: Node = {
        id: 'extract-data-1',
        type: 'extractData',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, ExtractDataNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#fce7f3',
        borderColor: '#ec4899',
      });
    });

    it('ExternalDataNode should have data category', () => {
      const mockNode: Node = {
        id: 'external-data-1',
        type: 'externalData',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      const { container } = renderNodeWithProvider(mockNode, ExternalDataNode);
      const nodeElement = container.querySelector('.designer-node');

      expect(nodeElement).toHaveStyle({
        backgroundColor: '#fce7f3',
        borderColor: '#ec4899',
      });
    });
  });

  describe('Icons', () => {
    it('SetVariableNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'set-var-1',
        type: 'setVariable',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, SetVariableNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('📊');
    });

    it('ExtractDataNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'extract-data-1',
        type: 'extractData',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, ExtractDataNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('📤');
    });

    it('ExternalDataNode should have correct icon', () => {
      const mockNode: Node = {
        id: 'external-data-1',
        type: 'externalData',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      };
      renderNodeWithProvider(mockNode, ExternalDataNode);

      const icon = screen.getByLabelText('node-icon');
      expect(icon).toHaveTextContent('📥');
    });
  });
});
