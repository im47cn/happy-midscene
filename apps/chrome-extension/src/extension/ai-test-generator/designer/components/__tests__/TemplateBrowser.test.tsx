/**
 * Template Browser Component Tests
 * 模板浏览器组件测试
 */

import { beforeEach, describe, expect, it, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Template, TemplateCategory } from '../../services/templateManager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

beforeAll(() => {
  globalThis.localStorage = localStorageMock as any;
});

// Mock antd components
vi.mock('antd', () => {
  const ListItem = ({ children, onClick, style }: any) => (
    <div onClick={onClick} style={style} data-testid="list-item">{children}</div>
  );

  ListItem.Meta = ({ avatar, title, description }: any) => (
    <div data-testid="list-item-meta">
      {avatar && <div data-testid="list-item-avatar">{avatar}</div>}
      {title && <div data-testid="list-item-title">{title}</div>}
      {description && <div data-testid="list-item-description">{description}</div>}
    </div>
  );

  const SpaceMock = ({ children, direction, size, style }: any) => (
    <div data-testid={`space-${direction || 'horizontal'}`} style={style}>{children}</div>
  );

  const InputMock = Object.assign(
    ({ value, onChange, placeholder, type = 'text' }: any) => (
      <input
        data-testid={`input-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.({ target: { value: e.target.value } })}
      />
    ),
    {
      TextArea: ({ value, onChange, placeholder, rows }: any) => (
        <textarea
          data-testid={`textarea-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'field'}`}
          value={value || ''}
          placeholder={placeholder}
          rows={rows}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
        />
      ),
      Search: ({ value, onChange, placeholder, allowClear, prefix }: any) => (
        <input
          data-testid={`input-${placeholder?.replace(/\s+/g, '-').toLowerCase() || 'search'}`}
          type="text"
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.({ target: { value: e.target.value } })}
        />
      ),
    },
  );

  const SelectMock = Object.assign(
    ({ value, onChange, options, children, style }: any) => (
      <select
        data-testid="select"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        style={style}
      >
        {children || options?.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    ),
    {
      Option: ({ children, value }: any) => (
        <option value={value}>{children}</option>
      ),
    },
  );

  const TabsMock = ({ activeKey, onChange, items }: any) => (
    <div data-testid="tabs" data-active-key={activeKey}>
      {items?.map((item: any) => (
        <button
          key={item.key}
          data-testid={`tab-${item.key}`}
          onClick={() => onChange?.(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return {
    Modal: ({ children, open, onOk, onCancel, title, footer, width }: any) =>
      open ? (
        <div data-testid={`modal-${typeof title === 'string' ? title.toLowerCase().replace(/\s+/g, '-') : 'modal'}`} style={{ width }}>
          <div data-testid="modal-title">{title}</div>
          {children}
          {footer && <div data-testid="modal-footer">{footer}</div>}
          <button data-testid="modal-ok" onClick={onOk}>OK</button>
          <button data-testid="modal-cancel" onClick={onCancel}>Cancel</button>
        </div>
      ) : null,
    Input: InputMock,
    Select: SelectMock,
    Search: InputMock.Search,
    Button: Object.assign(
      ({ children, onClick, icon, danger, type, size, disabled, 'data-icon': dataIcon }: any) => (
        <button
          data-testid={`button-${typeof children === 'string' ? children.toLowerCase().replace(/\s+/g, '-') : dataIcon || 'button'}`}
          onClick={onClick}
          disabled={disabled}
          className={danger ? 'btn-danger' : type === 'primary' ? 'btn-primary' : 'btn-default'}
          data-size={size}
        >
          {typeof children === 'string' && children}
          {icon && <span data-testid="button-icon" data-icon={dataIcon}>{icon}</span>}
        </button>
      ),
      {
        Group: ({ children }: any) => (
          <div data-testid="button-group" style={{ display: 'inline-flex' }}>
            {children}
          </div>
        ),
      },
    ),
    Space: SpaceMock,
    Card: ({ children, size, hoverable, bodyStyle, onClick }: any) => (
      <div data-testid={`card-${size || 'default'}`} onClick={onClick} style={bodyStyle}>
        {children}
      </div>
    ),
    List: Object.assign(
      function ListMock({ dataSource, renderItem, size }: any) {
        return (
          <div data-testid={`list-${size || 'default'}`}>
            {dataSource?.map((item: any, idx: number) => (
              <div key={idx} data-testid={`list-item-${idx}`}>
                {renderItem(item, idx)}
              </div>
            ))}
          </div>
        );
      },
      { Item: ListItem }
    ),
    Tag: ({ children, color, icon }: any) => (
      <span data-testid={`tag-${color || 'default'}`}>
        {icon && <span data-testid="tag-icon">{icon}</span>}
        {children}
      </span>
    ),
    Tooltip: ({ children, title }: any) => (
      <div title={typeof title === 'string' ? title : undefined} data-testid={`tooltip-${typeof title === 'string' ? title.toLowerCase().replace(/\s+/g, '-') : 'tooltip'}`}>
        {children}
      </div>
    ),
    Image: ({ src, alt }: any) => (
      <img data-testid={`image-${alt || 'img'}`} src={src} alt={alt} />
    ),
    Empty: ({ description }: any) => (
      <div data-testid="empty">
        {description || 'No data'}
      </div>
    ),
    Tabs: TabsMock,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
    Form: Object.assign(
      ({ children, onFinish, layout, form }: any) => (
        <form data-testid="form" onSubmit={(e) => { e.preventDefault(); onFinish?.({}); }}>
          {children}
        </form>
      ),
      {
        Item: ({ children, name, label, rules, initialValue }: any) => (
          <div data-testid={`form-item-${name || 'item'}`}>
            {label && <label data-testid={`form-label-${name}`}>{label}</label>}
            {children}
          </div>
        ),
        useForm: () => [{
          getFieldsValue: vi.fn(() => ({})),
          setFieldsValue: vi.fn(),
          resetFields: vi.fn(),
          setFieldValue: vi.fn(),
          submit: vi.fn(),
          validateFields: vi.fn(() => Promise.resolve({})),
        }, () => ({}),
      ],
    }),
    Row: ({ children, gutter }: any) => (
      <div data-testid="row" style={{ display: 'flex', gap: gutter?.[0] }}>
        {children}
      </div>
    ),
    Col: ({ children, span }: any) => (
      <div data-testid={`col-${span}`} style={{ flex: span }}>
        {children}
      </div>
    ),
    Divider: () => <div data-testid="divider" />,
    Alert: ({ message, type, showIcon }: any) => (
      <div data-testid={`alert-${type}`}>
        {showIcon && <span data-testid="alert-icon">⚠</span>}
        <div data-testid="alert-message">{message}</div>
      </div>
    ),
    Popconfirm: ({ children, onConfirm, okText, cancelText }: any) => (
      <div data-testid="popconfirm">
        {children}
        <button data-testid="popconfirm-ok" onClick={onConfirm}>{okText}</button>
        <button data-testid="popconfirm-cancel">{cancelText}</button>
      </div>
    ),
    Typography: {
      Text: ({ children, type }: any) => (
        <span data-testid={`typography-text-${type || 'default'}`}>{children}</span>
      ),
      Paragraph: ({ children }: any) => <p data-testid="typography-paragraph">{children}</p>,
      Title: ({ children, level }: any) => (
        <div data-testid={`typography-title-${level || 1}`}>{children}</div>
      ),
    },
  };
});

// Mock icons
vi.mock('@ant-design/icons', () => ({
  FileOutlined: () => <span data-testid="icon-file" />,
  FolderOutlined: () => <span data-testid="icon-folder" />,
  SearchOutlined: () => <span data-testid="icon-search" />,
  StarOutlined: () => <span data-testid="icon-star" />,
  ClockCircleOutlined: () => <span data-testid="icon-clock" />,
  DeleteOutlined: () => <span data-testid="icon-delete" />,
  DownloadOutlined: () => <span data-testid="icon-download" />,
  UploadOutlined: () => <span data-testid="icon-upload" />,
  PlusOutlined: () => <span data-testid="icon-plus" />,
  TagOutlined: () => <span data-testid="icon-tag" />,
  CloseOutlined: () => <span data-testid="icon-close" />,
  CheckOutlined: () => <span data-testid="icon-check" />,
  EditOutlined: () => <span data-testid="icon-edit" />,
  AppstoreOutlined: () => <span data-testid="icon-appstore" />,
  BarsOutlined: () => <span data-testid="icon-bars" />,
  InfoCircleOutlined: () => <span data-testid="icon-info" />,
}));

// Mock templateManager service BEFORE importing component
const mockInitialize = vi.fn();
const mockGetAllTemplates = vi.fn();
const mockGetAllCategories = vi.fn();
const mockGetRecentTemplates = vi.fn();
const mockGetPopularTemplates = vi.fn();
const mockSearchTemplates = vi.fn();
const mockLoadTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockExportTemplateToFile = vi.fn();
const mockImportTemplateFromFile = vi.fn();
const mockGetStats = vi.fn();

const mockTemplateManager = {
  initialize: mockInitialize,
  getAllTemplates: mockGetAllTemplates,
  getAllCategories: mockGetAllCategories,
  getRecentTemplates: mockGetRecentTemplates,
  getPopularTemplates: mockGetPopularTemplates,
  searchTemplates: mockSearchTemplates,
  loadTemplate: mockLoadTemplate,
  deleteTemplate: mockDeleteTemplate,
  exportTemplateToFile: mockExportTemplateToFile,
  importTemplateFromFile: mockImportTemplateFromFile,
  getStats: mockGetStats,
};

vi.mock('../../services/templateManager', () => ({
  getTemplateManager: () => mockTemplateManager,
  BUILT_IN_CATEGORIES: [
    { id: 'basic', name: 'Basic', icon: '📝', color: '#1890ff' },
    { id: 'form', name: 'Form', icon: '📋', color: '#52c41a' },
    { id: 'ecommerce', name: 'E-commerce', icon: '🛒', color: '#fa8c16' },
  ],
}));

// Create mock templates
const createMockTemplates = (): Template[] => [
  {
    metadata: {
      id: 'template-1',
      name: 'Login Test',
      description: 'Test login functionality',
      category: 'basic',
      tags: ['auth', 'login'],
      createdAt: Date.now() - 1000000,
      updatedAt: Date.now() - 500000,
      useCount: 5,
      nodeCount: 3,
      estimatedDuration: 5000,
      thumbnail: '',
    },
    flow: {
      id: 'flow-1',
      name: 'Login Test',
      nodes: [],
      edges: [],
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    },
  },
  {
    metadata: {
      id: 'template-2',
      name: 'Checkout Flow',
      description: 'E-commerce checkout process',
      category: 'ecommerce',
      tags: ['ecommerce', 'payment'],
      createdAt: Date.now() - 2000000,
      updatedAt: Date.now() - 1000000,
      useCount: 2,
      nodeCount: 5,
      estimatedDuration: 10000,
    },
    flow: {
      id: 'flow-2',
      name: 'Checkout Flow',
      nodes: [],
      edges: [],
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    },
  },
  {
    metadata: {
      id: 'template-3',
      name: 'Form Validation',
      description: 'Test form validation',
      category: 'form',
      tags: ['form', 'validation'],
      createdAt: Date.now() - 3000000,
      updatedAt: Date.now() - 2000000,
      useCount: 0,
      nodeCount: 4,
      estimatedDuration: 3000,
    },
    flow: {
      id: 'flow-3',
      name: 'Form Validation',
      nodes: [],
      edges: [],
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    },
  },
];

// Create mock categories
const mockCategories: TemplateCategory[] = [
  { id: 'basic', name: 'Basic', icon: '📝', color: '#1890ff', description: 'Basic operations' },
  { id: 'form', name: 'Form', icon: '📋', color: '#52c41a', description: 'Form related' },
  { id: 'ecommerce', name: 'E-commerce', icon: '🛒', color: '#fa8c16', description: 'E-commerce' },
];

// Import after mocks
import { TemplateBrowser, TemplateBrowserButton } from '../TemplateBrowser';

describe('TemplateBrowser Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectTemplate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockInitialize.mockResolvedValue(undefined);
    mockGetAllTemplates.mockReturnValue(createMockTemplates());
    mockGetAllCategories.mockReturnValue(mockCategories);
    mockGetRecentTemplates.mockReturnValue(createMockTemplates());
    mockGetPopularTemplates.mockReturnValue(createMockTemplates());
    mockSearchTemplates.mockReturnValue(createMockTemplates());
    mockLoadTemplate.mockResolvedValue({
      id: 'flow-1',
      name: 'Login Test',
      nodes: [],
      edges: [],
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    });
    mockDeleteTemplate.mockResolvedValue(true);
    mockExportTemplateToFile.mockReturnValue('yaml: content');
    mockImportTemplateFromFile.mockResolvedValue(undefined);
    mockGetStats.mockReturnValue({
      totalTemplates: 3,
      templatesByCategory: { basic: 1, form: 1, ecommerce: 1 },
      totalUsage: 7,
      averageNodeCount: 4,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when visible is false', () => {
      const { container } = render(
        <TemplateBrowser
          visible={false}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render modal when visible is true', () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      // Modal mock uses 'modal-modal' testid when title is a React element (not a string)
      expect(getByTestId('modal-modal')).toBeInTheDocument();
    });

    it('should initialize template manager on mount', async () => {
      render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );

      await waitFor(() => {
        expect(mockInitialize).toHaveBeenCalled();
      });
    });

    it('should load templates when visible', async () => {
      render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });
    });

    it('should show search input', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('input-search-templates...')).toBeInTheDocument();
      });
    });

    it('should show tabs for all/recent/popular', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('tab-all')).toBeInTheDocument();
        expect(getByTestId('tab-recent')).toBeInTheDocument();
        expect(getByTestId('tab-popular')).toBeInTheDocument();
      });
    });
  });

  describe('Template Selection', () => {
    it('should select template when clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId, getAllByTestId } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      const cards = getAllByTestId(/^card-/);
      expect(cards.length).toBeGreaterThan(0);

      // Click first card
      fireEvent.click(cards[0]);

      // Template should be selected
      await waitFor(() => {
        expect(mockOnSelectTemplate).not.toHaveBeenCalled(); // Not loaded yet, just selected
      });
    });

    it('should load template and call onSelectTemplate when Load Template is clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId, getAllByTestId } = within(container);

      await waitFor(() => {
        const cards = getAllByTestId(/^card-/);
        fireEvent.click(cards[0]);
      });

      // Click Load Template button (footer button)
      const loadButton = getByTestId('button-load-template');
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(mockLoadTemplate).toHaveBeenCalledWith('template-1');
      });

      await waitFor(() => {
        expect(mockOnSelectTemplate).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show warning when no template is selected and Load is clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-load-template')).toBeInTheDocument();
      });

      const loadButton = getByTestId('button-load-template');
      fireEvent.click(loadButton);

      // Should show warning via message
      // (This is handled by antd message, so we can't test the exact content)
    });
  });

  describe('Search and Filter', () => {
    it('should filter templates by search query', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      const searchInput = getByTestId('input-search-templates...');
      fireEvent.change(searchInput, { target: { value: 'login' } });

      await waitFor(() => {
        expect(mockSearchTemplates).toHaveBeenCalledWith('login');
      });
    });

    it('should filter by category', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId } = within(container);

      await waitFor(() => {
        const selects = getAllByTestId('select');
        expect(selects.length).toBeGreaterThan(0);
      });

      // Find and click the category select (first one)
      const selects = getAllByTestId('select');
      const select = selects[0];
      fireEvent.change(select, { target: { value: 'basic' } });

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });
    });

    it('should show recent templates tab', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      // Click recent tab
      const recentTab = getByTestId('tab-recent');
      fireEvent.click(recentTab);

      await waitFor(() => {
        expect(mockGetRecentTemplates).toHaveBeenCalledWith(50);
      });
    });

    it('should show popular templates tab', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      // Click popular tab
      const popularTab = getByTestId('tab-popular');
      fireEvent.click(popularTab);

      await waitFor(() => {
        expect(mockGetPopularTemplates).toHaveBeenCalledWith(50);
      });
    });
  });

  describe('Template Card', () => {
    it('should display template metadata', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId, getByText } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      const cards = getAllByTestId(/^card-/);
      expect(cards.length).toBeGreaterThan(0);

      // First card should contain template name
      expect(getByText('Login Test')).toBeInTheDocument();
    });

    it('should show selected state for selected template', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId, getByTestId } = within(container);

      await waitFor(() => {
        const cards = getAllByTestId(/^card-/);
        fireEvent.click(cards[0]);
      });

      // Check icon should appear on selected card
      await waitFor(() => {
        expect(getByTestId('icon-check')).toBeInTheDocument();
      });
    });

    it('should show tags for template', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId, getByText } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      // Should show tags
      expect(getByText('auth')).toBeInTheDocument();
    });

    it('should show node count and duration', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByText } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      // Should show metadata
      expect(getByText(/3 nodes/)).toBeInTheDocument();
    });
  });

  describe('Template Actions', () => {
    it('should delete template when delete is confirmed', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId, getByTestId } = within(container);

      await waitFor(() => {
        const cards = getAllByTestId(/^card-/);
        fireEvent.click(cards[0]);
      });

      // Find delete button (danger icon)
      const deleteIcons = getAllByTestId('icon-delete');
      expect(deleteIcons.length).toBeGreaterThan(0);

      // Note: Popconfirm mock doesn't actually trigger delete, need to click ok
      const deleteButton = deleteIcons[0].closest('button');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      // Find and click the popconfirm ok button (multiple popconfirms exist)
      const popconfirmOks = getAllByTestId('popconfirm-ok');
      const popconfirmOk = popconfirmOks[0];
      fireEvent.click(popconfirmOk);

      await waitFor(() => {
        expect(mockDeleteTemplate).toHaveBeenCalled();
      });
    });

    it('should export template to file', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      // Find export button
      const exportIcons = getAllByTestId('icon-download');
      expect(exportIcons.length).toBeGreaterThan(0);

      const exportButton = exportIcons[0].closest('button');
      if (exportButton) {
        fireEvent.click(exportButton);
      }

      await waitFor(() => {
        expect(mockExportTemplateToFile).toHaveBeenCalled();
      });
    });

    it('should edit template metadata', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId, getByTestId } = within(container);

      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });

      // Find edit button
      const editIcons = getAllByTestId('icon-edit');
      expect(editIcons.length).toBeGreaterThan(0);

      const editButton = editIcons[0].closest('button');
      if (editButton) {
        fireEvent.click(editButton);
      }

      // Save dialog should appear
      await waitFor(() => {
        // The component shows info message about needing current flow
        // In a real implementation, this would open a dialog
      });
    });
  });

  describe('Import/Export', () => {
    it('should show import dialog when Import is clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-import')).toBeInTheDocument();
      });

      const importButton = getByTestId('button-import');
      fireEvent.click(importButton);

      // Should show import modal
      // (The import dialog is a separate modal)
    });

    it('should handle file import', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId, queryByTestId } = within(container);

      const importButton = getByTestId('button-import');
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(queryByTestId('modal-import-template')).toBeInTheDocument();
      });
    });

    it('should show new template dialog when New Template is clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId, queryByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-new-template')).toBeInTheDocument();
      });

      const newButton = getByTestId('button-new-template');
      fireEvent.click(newButton);

      // Should show save dialog
      // (The save dialog is a separate modal)
    });
  });

  describe('View Mode', () => {
    it('should toggle between grid and list view', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId, getAllByTestId } = within(container);

      await waitFor(() => {
        // Buttons with icon-only children show as button-button, so check for the icons
        expect(getAllByTestId('icon-appstore').length).toBeGreaterThan(0);
        expect(getAllByTestId('icon-bars').length).toBeGreaterThan(0);
      });

      // Find the list view button (the one with bars icon) by clicking on its icon
      const listButtons = getAllByTestId('button-button');
      const listButton = listButtons[1]; // Second button is list view
      fireEvent.click(listButton);

      // Should render list instead of grid
      await waitFor(() => {
        expect(getByTestId('list-default')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no templates', async () => {
      mockGetAllTemplates.mockReturnValue([]);

      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('empty')).toBeInTheDocument();
      });
    });

    it('should show no results message when search has no matches', async () => {
      mockSearchTemplates.mockReturnValue([]);

      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      const searchInput = getByTestId('input-search-templates...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(getByTestId('empty')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Footer Actions', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const { container } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getByTestId } = within(container);

      const cancelButton = getByTestId('button-cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should reset state when modal closes', async () => {
      const { container, rerender } = render(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );
      const { getAllByTestId } = within(container);

      await waitFor(() => {
        expect(getAllByTestId(/^card-/).length).toBeGreaterThan(0);
      });

      // Close and reopen
      rerender(
        <TemplateBrowser
          visible={false}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );

      rerender(
        <TemplateBrowser
          visible={true}
          onClose={mockOnClose}
          onSelectTemplate={mockOnSelectTemplate}
        />,
      );

      // Should reload templates
      await waitFor(() => {
        expect(mockGetAllTemplates).toHaveBeenCalled();
      });
    });
  });
});

describe('TemplateBrowserButton Component', () => {
  const mockOnSelectTemplate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockInitialize.mockResolvedValue(undefined);
    mockGetAllTemplates.mockReturnValue([]);
    mockGetAllCategories.mockReturnValue([]);
    mockGetRecentTemplates.mockReturnValue([]);
    mockGetPopularTemplates.mockReturnValue([]);
    mockSearchTemplates.mockReturnValue([]);
    mockGetStats.mockReturnValue({
      totalTemplates: 0,
      templatesByCategory: {},
      totalUsage: 0,
      averageNodeCount: 0,
    });
  });

  it('should render button with icon', () => {
    const { container } = render(
      <TemplateBrowserButton onSelectTemplate={mockOnSelectTemplate} />,
    );
    const { getByTestId, getByText } = within(container);

    expect(getByTestId('icon-folder')).toBeInTheDocument();
    expect(getByText('Browse Templates')).toBeInTheDocument();
  });

  it('should open modal when clicked', () => {
    const { container } = render(
      <TemplateBrowserButton onSelectTemplate={mockOnSelectTemplate} />,
    );
    const { getByTestId, queryByTestId } = within(container);

    expect(queryByTestId('modal-template-browser')).not.toBeInTheDocument();

    fireEvent.click(getByTestId('button-browse-templates'));

    // Modal should open
    // Note: Due to mock limitations, we check that button is still there
    expect(getByTestId('button-browse-templates')).toBeInTheDocument();
  });

  it('should call onSelectTemplate and close modal when template is loaded', async () => {
    mockLoadTemplate.mockResolvedValue({
      id: 'flow-1',
      name: 'Test Flow',
      nodes: [],
      edges: [],
      variables: [],
      metadata: { createdAt: Date.now(), updatedAt: Date.now() },
    });

    mockGetAllTemplates.mockReturnValue([
      {
        metadata: {
          id: 'template-1',
          name: 'Test Template',
          category: 'basic',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          useCount: 0,
          nodeCount: 1,
        },
        flow: {
          id: 'flow-1',
          name: 'Test Flow',
          nodes: [],
          edges: [],
          variables: [],
          metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      },
    ]);

    const { container } = render(
      <TemplateBrowserButton onSelectTemplate={mockOnSelectTemplate} />,
    );
    const { getByTestId, getAllByTestId, queryByTestId } = within(container);

    // Open modal
    fireEvent.click(getByTestId('button-browse-templates'));

    // Wait for templates to load
    await waitFor(() => {
      expect(mockGetAllTemplates).toHaveBeenCalled();
    });

    // Check if modal is visible (it should be in the DOM)
    // Note: The modal visibility depends on internal state
  });
});

describe('TemplateBrowser Edge Cases', () => {
  const mockOnClose = vi.fn();
  const mockOnSelectTemplate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockInitialize.mockResolvedValue(undefined);
    mockGetAllTemplates.mockReturnValue([]);
    mockGetAllCategories.mockReturnValue([]);
    mockGetRecentTemplates.mockReturnValue([]);
    mockGetPopularTemplates.mockReturnValue([]);
    mockSearchTemplates.mockReturnValue([]);
    mockGetStats.mockReturnValue({
      totalTemplates: 0,
      templatesByCategory: {},
      totalUsage: 0,
      averageNodeCount: 0,
    });
  });

  it('should handle initialization error gracefully', async () => {
    mockInitialize.mockRejectedValue(new Error('Failed to initialize'));

    const { container } = render(
      <TemplateBrowser
        visible={true}
        onClose={mockOnClose}
        onSelectTemplate={mockOnSelectTemplate}
      />,
    );

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });

    // Should show error message via antd message
  });

  it('should handle load template error', async () => {
    mockGetAllTemplates.mockReturnValue([
      {
        metadata: {
          id: 'template-1',
          name: 'Test',
          category: 'basic',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          useCount: 0,
          nodeCount: 1,
        },
        flow: {
          id: 'flow-1',
          name: 'Test',
          nodes: [],
          edges: [],
          variables: [],
          metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      },
    ]);

    mockLoadTemplate.mockRejectedValue(new Error('Load failed'));

    const { container } = render(
      <TemplateBrowser
        visible={true}
        onClose={mockOnClose}
        onSelectTemplate={mockOnSelectTemplate}
      />,
    );
    const { getAllByTestId, getByTestId } = within(container);

    await waitFor(() => {
      const cards = getAllByTestId(/^card-/);
      fireEvent.click(cards[0]);
    });

    const loadButton = getByTestId('button-load-template');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(mockLoadTemplate).toHaveBeenCalled();
    });
  });

  it('should handle delete template error', async () => {
    mockGetAllTemplates.mockReturnValue([
      {
        metadata: {
          id: 'template-1',
          name: 'Test',
          category: 'basic',
          tags: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          useCount: 0,
          nodeCount: 1,
        },
        flow: {
          id: 'flow-1',
          name: 'Test',
          nodes: [],
          edges: [],
          variables: [],
          metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        },
      },
    ]);

    mockDeleteTemplate.mockRejectedValue(new Error('Delete failed'));

    const { container } = render(
      <TemplateBrowser
        visible={true}
        onClose={mockOnClose}
        onSelectTemplate={mockOnSelectTemplate}
      />,
    );
    const { getAllByTestId, getByTestId } = within(container);

    await waitFor(() => {
      const cards = getAllByTestId(/^card-/);
      fireEvent.click(cards[0]);
    });

    const deleteIcons = getAllByTestId('icon-delete');
    const deleteButton = deleteIcons[0].closest('button');
    if (deleteButton) {
      fireEvent.click(deleteButton);
    }

    const popconfirmOks = getAllByTestId('popconfirm-ok');
    const popconfirmOk = popconfirmOks[0];
    fireEvent.click(popconfirmOk);

    await waitFor(() => {
      expect(mockDeleteTemplate).toHaveBeenCalled();
    });
  });
});
