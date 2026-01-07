/**
 * VariableManager Component Tests
 * 变量管理器组件测试
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock antd components - all defined inline in factory to avoid hoisting issues
vi.mock('antd', () => {
  // Define List.Item component inside the factory
  const ListItem = ({ children, onClick, style }: any) => (
    <div onClick={onClick} style={style} data-testid="list-item">{children}</div>
  );

  // Define List.Item.Meta component
  ListItem.Meta = ({ avatar, title, description }: any) => (
    <div data-testid="list-item-meta">
      {avatar && <div data-testid="list-item-avatar">{avatar}</div>}
      {title && <div data-testid="list-item-title">{title}</div>}
      {description && <div data-testid="list-item-description">{description}</div>}
    </div>
  );

  // Space component
  const SpaceMock = ({ children, direction, size, style }: any) => (
    <div data-testid={`space-${direction || 'horizontal'}`} style={style}>{children}</div>
  );

  // TextArea component
  const TextAreaMock = ({ value, onChange, placeholder, rows, status, maxLength, showCount }: any) => (
    <div>
      <textarea
        data-testid={`textarea-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
        value={value || ''}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
        className={status === 'error' ? 'input-error' : ''}
      />
      {showCount && <span data-testid="input-count">{String(value || '').length}/{maxLength}</span>}
      {status === 'error' && <span data-testid="textarea-error">error</span>}
    </div>
  );

  // Input component with TextArea as property
  const InputMock = ({ value, onChange, placeholder, status, type = 'text', rows, maxLength, showCount }: any) => {
    // Handle TextArea
    if (rows) {
      return (
        <div>
          <textarea
            data-testid={`textarea-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
            value={value || ''}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            onChange={(e) => onChange?.({ target: { value: e.target.value } })}
            className={status === 'error' ? 'input-error' : ''}
          />
            {showCount && <span data-testid="input-count">{String(value || '').length}/{maxLength}</span>}
          {status === 'error' && <span data-testid="textarea-error">error</span>}
        </div>
      );
    }
    return (
      <div>
        <input
          data-testid={`input-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
          type={type}
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
          className={status === 'error' ? 'input-error' : ''}
        />
        {status === 'error' && <span data-testid="input-error">error</span>}
      </div>
    );
  };

  // Add TextArea as a property of Input
  InputMock.TextArea = TextAreaMock;

  return {
    Modal: ({ children, open, onOk, onCancel, title }: any) =>
      open ? (
        <div data-testid={`modal-${typeof title === 'string' ? title.replace(/\s+/g, '-').toLowerCase() : 'dialog'}`}>
          <div data-testid="modal-title">{title}</div>
          {children}
          <button data-testid="modal-ok" onClick={onOk}>OK</button>
          <button data-testid="modal-cancel" onClick={onCancel}>Cancel</button>
        </div>
      ) : null,
    Input: InputMock,
    'Input.TextArea': TextAreaMock,
    Select: ({ value, onChange, options, style }: any) => (
      <select
        data-testid="select-type"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={style}
      >
        {options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ),
    Button: ({ children, onClick, icon, danger, type, size }: any) => (
      <button
        data-testid={`button-${typeof children === 'string' ? children.toLowerCase().replace(/\s+/g, '-') : 'button'}`}
        onClick={onClick}
        className={danger ? 'btn-danger' : type === 'primary' ? 'btn-primary' : 'btn-default'}
        data-size={size}
      >
        {typeof children === 'string' && children}
        {icon && <span data-testid="button-icon">{icon}</span>}
      </button>
    ),
    Space: SpaceMock,
    Table: ({ columns, dataSource, rowKey, emptyText, pagination, locale }: any) => {
      const keyAccessor = typeof rowKey === 'function' ? rowKey : (item: any) => item[rowKey];
      const hasData = dataSource && dataSource.length > 0;
      return (
        <div data-testid="table">
          <table>
            <thead>
              <tr>
                {columns?.map((col: any) => (
                  <th key={col.key || col.dataIndex}>{col.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasData ? (
                dataSource.map((item: any, idx: number) => (
                  <tr key={keyAccessor(item, idx) || idx}>
                    {columns?.map((col: any) => (
                      <td key={col.key || col.dataIndex} data-testid={`cell-${col.key || col.dataIndex}`}>
                        {col.render ? col.render(item[col.dataIndex], item, idx) : item[col.dataIndex]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns?.length || 1}>{locale?.emptyText || emptyText || 'No data'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    },
    Tag: ({ children, color }: any) => (
      <span data-testid={`tag-${color || 'default'}`}>{children}</span>
    ),
    Tooltip: ({ children, title }: any) => {
      const titleStr = typeof title === 'string' ? title : 'tooltip';
      return (
        <div data-testid={`tooltip-${titleStr.replace(/\s+/g, '-').toLowerCase()}`} title={typeof title === 'string' ? title : undefined}>{children}</div>
      );
    },
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Mock icons - all defined inline in factory
vi.mock('@ant-design/icons', () => ({
  DeleteOutlined: () => <span data-testid="icon-delete" />,
  EditOutlined: () => <span data-testid="icon-edit" />,
  PlusOutlined: () => <span data-testid="icon-plus" />,
  CodeOutlined: () => <span data-testid="icon-code" />,
  CheckCircleOutlined: () => <span data-testid="icon-check" />,
  ExclamationCircleOutlined: () => <span data-testid="icon-exclamation" />,
}));

// Mock data with variables
const mockFlowWithVariables = {
  id: 'test-flow',
  name: 'Test Flow',
  description: 'Test flow description',
  version: 1,
  nodes: [
    {
      id: 'node-1',
      type: 'input',
      data: {
        label: 'Input Node',
        config: {
          value: '${testVar}',
          selector: '#submit',
        },
      },
    },
    {
      id: 'node-2',
      type: 'click',
      data: {
        label: 'Click Node',
        config: {
          element: '${anotherVar}',
        },
      },
    },
  ],
  edges: [],
  variables: [
    {
      name: 'testVar',
      type: 'string',
      defaultValue: 'hello',
      description: 'Test variable',
    },
    {
      name: 'numberVar',
      type: 'number',
      defaultValue: 42,
    },
  ],
  metadata: {
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

// Mock data with no variables
const mockFlowWithoutVariables = {
  ...mockFlowWithVariables,
  variables: [],
};

// Mock data with null flow
const mockNullFlow = null;

const mockSetFlow = vi.fn();

// Mock the store BEFORE importing the component
vi.mock('../../store/designerStore', () => ({
  useDesignerStore: vi.fn((selector?: any) => {
    // Return flow with variables by default
    const state = {
      flow: mockFlowWithVariables,
      setFlow: mockSetFlow,
    };
    return selector ? selector(state) : state;
  }),
}));

// Import after mocks
import { VariableManager } from '../VariableManager';
import { useDesignerStore } from '../../store/designerStore';

describe('VariableManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default flow with variables
    (useDesignerStore as any).mockImplementation((selector?: any) => {
      const state = {
        flow: mockFlowWithVariables,
        setFlow: mockSetFlow,
      };
      return selector ? selector(state) : state;
    });
  });

  describe('Rendering', () => {
    it('should render correctly with variables', () => {
      const { container } = render(<VariableManager />);
      const { getByText, getByTestId } = within(container);

      // Check component renders
      expect(container.firstChild).toBeInTheDocument();

      // Check header text
      expect(getByText('变量管理')).toBeInTheDocument();

      // Check buttons exist
      expect(getByTestId('button-关闭')).toBeInTheDocument();
      expect(getByTestId('button-添加变量')).toBeInTheDocument();

      // Check table exists
      expect(getByTestId('table')).toBeInTheDocument();
    });

    it('should render null when visible is false', () => {
      const { container } = render(<VariableManager visible={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<VariableManager onClose={onClose} />);
      const { getByTestId } = within(container);

      fireEvent.click(getByTestId('button-关闭'));
      expect(onClose).toHaveBeenCalled();
    });

    it('should show variable count in header', () => {
      const { container } = render(<VariableManager />);
      const { getByText } = within(container);
      // Should show "2 个变量" since we have 2 variables
      expect(getByText('2 个变量')).toBeInTheDocument();
    });
  });

  describe('Add Variable', () => {
    it('should open edit dialog when add button is clicked', () => {
      const { container } = render(<VariableManager />);
      const { getByTestId } = within(container);

      fireEvent.click(getByTestId('button-添加变量'));

      // Edit dialog should open
      expect(getByTestId('modal-添加变量')).toBeInTheDocument();
    });

    it('should render dialog form fields when dialog is open', () => {
      const { container } = render(<VariableManager />);
      const { getByTestId } = within(container);

      fireEvent.click(getByTestId('button-添加变量'));

      // Check for form inputs using test ids
      expect(getByTestId('input-例如:-userid,-username')).toBeInTheDocument();
      expect(getByTestId('select-type')).toBeInTheDocument();
      expect(getByTestId('textarea-输入默认值')).toBeInTheDocument();
      expect(getByTestId('textarea-变量的用途说明')).toBeInTheDocument();
    });
  });

  describe('Table Structure', () => {
    it('should have correct column headers', () => {
      const { container } = render(<VariableManager />);
      const { getByTestId } = within(container);

      const table = getByTestId('table');
      expect(table).toBeInTheDocument();

      // Check for column headers
      expect(table.textContent).toContain('变量名');
      expect(table.textContent).toContain('类型');
      expect(table.textContent).toContain('默认值');
      expect(table.textContent).toContain('描述');
      expect(table.textContent).toContain('引用数');
      expect(table.textContent).toContain('操作');
    });

    it('should render rows for each variable', () => {
      const { container } = render(<VariableManager />);
      const { getByTestId } = within(container);

      const table = getByTestId('table');

      // Should have variable names in the table
      expect(table.textContent).toContain('testVar');
      expect(table.textContent).toContain('numberVar');
    });
  });

  describe('Edit Variable', () => {
    it('should have edit buttons in actions column', () => {
      const { container } = render(<VariableManager />);
      const { getAllByTestId } = within(container);

      // Check for edit icons
      const editIcons = getAllByTestId('icon-edit');
      expect(editIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Delete Variable', () => {
    it('should have delete buttons in actions column', () => {
      const { container } = render(<VariableManager />);
      const { getAllByTestId } = within(container);

      // Check for delete icons
      const deleteIcons = getAllByTestId('icon-delete');
      expect(deleteIcons.length).toBeGreaterThan(0);
    });
  });
});

describe('VariableManager with different states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle null flow gracefully', () => {
    (useDesignerStore as any).mockImplementation((selector?: any) => {
      const state = {
        flow: mockNullFlow,
        setFlow: mockSetFlow,
      };
      return selector ? selector(state) : state;
    });

    const { container } = render(<VariableManager />);
    // Should not crash with null flow
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should handle empty variables array', () => {
    (useDesignerStore as any).mockImplementation((selector?: any) => {
      const state = {
        flow: mockFlowWithoutVariables,
        setFlow: mockSetFlow,
      };
      return selector ? selector(state) : state;
    });

    const { container } = render(<VariableManager />);
    const { getByText } = within(container);
    // Should not crash with empty variables
    expect(container.firstChild).toBeInTheDocument();

    // Should show empty state message
    expect(getByText('暂无变量')).toBeInTheDocument();
  });

  it('should show correct count for single variable', () => {
    const singleVarFlow = { ...mockFlowWithVariables, variables: [{ name: 'singleVar', type: 'string', defaultValue: 'test' }] };

    (useDesignerStore as any).mockImplementation((selector?: any) => {
      const state = {
        flow: singleVarFlow,
        setFlow: mockSetFlow,
      };
      return selector ? selector(state) : state;
    });

    const { container } = render(<VariableManager />);
    const { getByText } = within(container);
    // Should show "1 个变量" for single variable
    expect(getByText('1 个变量')).toBeInTheDocument();
    // Check that the variable name is in the table
    expect(getByText('singleVar')).toBeInTheDocument();
  });
});
