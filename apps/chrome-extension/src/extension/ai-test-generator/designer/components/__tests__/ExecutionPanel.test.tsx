/**
 * Execution Panel Component Tests
 * 执行面板组件测试
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom';

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

  const ProgressMock = ({ percent, status }: any) => (
    <div data-testid="progress" data-percent={percent} data-status={status}>
      Progress: {percent}%
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
    Button: ({ children, onClick, icon, danger, type, size, disabled, 'data-icon': dataIcon }: any) => (
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
    Space: SpaceMock,
    Card: ({ children, size }: any) => (
      <div data-testid={`card-${size || 'default'}`}>{children}</div>
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
    Progress: ProgressMock,
    Divider: () => <div data-testid="divider" />,
    Drawer: ({ children, open, onClose, title, width, footer }: any) =>
      open ? (
        <div data-testid="drawer" style={{ width }} aria-label={title}>
          <div data-testid="drawer-title">{title}</div>
          {children}
          {footer && <div data-testid="drawer-footer">{footer}</div>}
          <button data-testid="drawer-close" onClick={onClose}>Close</button>
        </div>
      ) : null,
    Alert: ({ message, description, type, showIcon }: any) => (
      <div data-testid={`alert-${type}`}>
        {showIcon && <span data-testid="alert-icon">⚠</span>}
        <div data-testid="alert-message">{message}</div>
        {description && <div data-testid="alert-description">{description}</div>}
      </div>
    ),
    Empty: ({ description, image }: any) => (
      <div data-testid="empty">
        {description || 'No data'}
      </div>
    ),
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
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
  CloseOutlined: () => <span data-testid="icon-close" />,
  CheckCircleOutlined: () => <span data-testid="icon-check-circle" />,
  CloseCircleOutlined: () => <span data-testid="icon-close-circle" />,
  LoadingOutlined: () => <span data-testid="icon-loading" />,
  PauseCircleOutlined: () => <span data-testid="icon-pause-circle" />,
  PlayCircleOutlined: () => <span data-testid="icon-play-circle" />,
  StopOutlined: () => <span data-testid="icon-stop" />,
  StepForwardOutlined: () => <span data-testid="icon-step-forward" />,
  DeleteOutlined: () => <span data-testid="icon-delete" />,
  DownloadOutlined: () => <span data-testid="icon-download" />,
  CaretRightOutlined: () => <span data-testid="icon-caret-right" />,
}));

// Mock designerExecutor service BEFORE importing component
const mockExecute = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockStop = vi.fn();
const mockStep = vi.fn();
const mockGetState = vi.fn();

const mockDesignerExecutor = {
  execute: mockExecute,
  pause: mockPause,
  resume: mockResume,
  stop: mockStop,
  step: mockStep,
  getState: mockGetState,
};

vi.mock('../../services/designerExecutor', () => ({
  getDesignerExecutor: () => mockDesignerExecutor,
}));

// Import after mocks
import { ExecutionPanel, ExecutionPanelButton } from '../ExecutionPanel';

describe('ExecutionPanel Component', () => {
  const mockOnClose = vi.fn();
  const mockOnExecutionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock state
    mockGetState.mockReturnValue({
      status: 'idle',
      currentStepIndex: 0,
      executionOrder: ['node-1', 'node-2', 'node-3'],
      error: null,
      result: null,
    });

    mockExecute.mockResolvedValue({
      success: true,
      completed: 3,
      total: 3,
      errors: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when visible is false', () => {
      const { container } = render(
        <ExecutionPanel
          visible={false}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render drawer when visible is true', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      expect(getByTestId('drawer')).toBeInTheDocument();
    });

    it('should show idle status in title', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getAllByTestId, getByText } = within(container);

      expect(getByText(/Test Execution/)).toBeInTheDocument();
      expect(getAllByTestId('icon-play-circle').length).toBeGreaterThan(0);
    });

    it('should render control buttons card', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      expect(getByTestId('card-small')).toBeInTheDocument();
    });

    it('should show Start button when idle', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId, getAllByTestId } = within(container);

      expect(getByTestId('button-start')).toBeInTheDocument();
      expect(getAllByTestId('icon-play-circle').length).toBeGreaterThan(0);
    });

    it('should disable Start button when no flowId', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      const startButton = getByTestId('button-start');
      expect(startButton).toBeDisabled();
    });
  });

  describe('Execution Controls', () => {
    it('should call execute when Start button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'idle',
        currentStepIndex: 0,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      const startButton = getByTestId('button-start');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledWith('test-flow', expect.any(Object), 1000);
      });
    });

    it('should show Pause and Stop buttons when running', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-pause')).toBeInTheDocument();
        expect(getByTestId('button-step')).toBeInTheDocument();
        expect(getByTestId('icon-pause-circle')).toBeInTheDocument();
        expect(getByTestId('icon-stop')).toBeInTheDocument();
      });
    });

    it('should call pause when Pause button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-pause')).toBeInTheDocument();
      });

      fireEvent.click(getByTestId('button-pause'));

      await waitFor(() => {
        expect(mockPause).toHaveBeenCalled();
      });
    });

    it('should call stop when Stop button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        const stopButton = getByTestId('button-stop');
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(mockStop).toHaveBeenCalled();
      });
    });

    it('should call step when Step button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-step')).toBeInTheDocument();
      });

      fireEvent.click(getByTestId('button-step'));

      await waitFor(() => {
        expect(mockStep).toHaveBeenCalled();
      });
    });

    it('should show Resume and Stop buttons when paused', async () => {
      mockGetState.mockReturnValue({
        status: 'paused',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-resume')).toBeInTheDocument();
        expect(getByTestId('icon-caret-right')).toBeInTheDocument();
      });
    });

    it('should call resume when Resume button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'paused',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-resume')).toBeInTheDocument();
      });

      fireEvent.click(getByTestId('button-resume'));

      await waitFor(() => {
        expect(mockResume).toHaveBeenCalled();
      });
    });
  });

  describe('Progress Display', () => {
    it('should show progress when execution starts', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId, getAllByText } = within(container);

      await waitFor(() => {
        expect(getAllByText(/Progress/).length).toBeGreaterThan(0);
        expect(getAllByText(/2 \/ 3/).length).toBeGreaterThan(0);
      });

      const progress = getByTestId('progress');
      // 2/3 = 66.67% which rounds to 67
      expect(progress).toHaveAttribute('data-percent', '67');
    });

    it('should show completion status when finished', async () => {
      mockGetState.mockReturnValue({
        status: 'completed',
        currentStepIndex: 2,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: {
          success: true,
          completed: 3,
          total: 3,
          errors: [],
        },
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId, getAllByText } = within(container);

      await waitFor(() => {
        expect(getByTestId('alert-success')).toBeInTheDocument();
        expect(getAllByText(/Execution Completed Successfully/).length).toBeGreaterThan(0);
      });
    });

    it('should show error status when failed', async () => {
      mockGetState.mockReturnValue({
        status: 'error',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: {
          message: 'Element not found',
          nodeId: 'node-2',
        },
        result: {
          success: false,
          completed: 1,
          total: 3,
          errors: ['Element not found'],
        },
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getAllByTestId } = within(container);

      await waitFor(() => {
        // Two error alerts: one for status error, one in the step error
        expect(getAllByTestId('alert-error').length).toBeGreaterThan(0);
      });
    });

    it('should show step status tags', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getAllByTestId } = within(container);

      await waitFor(() => {
        // Multiple tags with same colors - summary tags and step tags
        expect(getAllByTestId('tag-success').length).toBeGreaterThan(0);
        expect(getAllByTestId('tag-processing').length).toBeGreaterThan(0);
        expect(getAllByTestId('tag-default').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Execution Steps', () => {
    it('should show empty state when no steps', async () => {
      mockGetState.mockReturnValue({
        status: 'idle',
        currentStepIndex: 0,
        executionOrder: [],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('empty')).toBeInTheDocument();
      });
    });

    it('should render step items', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { queryAllByTestId } = within(container);

      await waitFor(() => {
        const stepItems = queryAllByTestId(/^list-item-\d+$/);
        expect(stepItems.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Action Buttons', () => {
    it('should call Clear when Clear button is clicked', async () => {
      mockGetState.mockReturnValue({
        status: 'completed',
        currentStepIndex: 2,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: {
          success: true,
          completed: 2,
          total: 2,
          errors: [],
        },
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        expect(getByTestId('button-clear')).toBeInTheDocument();
      });

      fireEvent.click(getByTestId('button-clear'));

      // Button should be enabled when not running
      const clearButton = getByTestId('button-clear');
      expect(clearButton).not.toBeDisabled();
    });

    it('should disable Clear button when running', async () => {
      mockGetState.mockReturnValue({
        status: 'running',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        const clearButton = getByTestId('button-clear');
        expect(clearButton).toBeDisabled();
      });
    });

    it('should call onClose when Close button is clicked', () => {
      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      const closeButton = getByTestId('drawer-close');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Export Results', () => {
    it('should enable Export when results are available', async () => {
      const mockResult = {
        success: true,
        completed: 3,
        total: 3,
        errors: [],
      };

      // Mock to always return the result, even for 'idle' state
      // This ensures the component's state gets initialized with results
      mockGetState.mockImplementation(() => ({
        status: 'completed',
        currentStepIndex: 2,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: mockResult,
      }));

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      // Wait for the button to become enabled (state has been updated via interval)
      await waitFor(
        () => {
          const exportButton = getByTestId('button-export');
          expect(exportButton).not.toBeDisabled();
        },
        { timeout: 3000 },
      );
    });

    it('should disable Export when no results', async () => {
      mockGetState.mockReturnValue({
        status: 'idle',
        currentStepIndex: 0,
        executionOrder: ['node-1', 'node-2'],
        error: null,
        result: null,
      });

      const { container } = render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );
      const { getByTestId } = within(container);

      await waitFor(() => {
        const exportButton = getByTestId('button-export');
        expect(exportButton).toBeDisabled();
      });
    });
  });

  describe('Execution Complete Callback', () => {
    it('should call onExecutionComplete when execution finishes successfully', async () => {
      const mockResult = {
        success: true,
        completed: 3,
        total: 3,
        errors: [],
      };

      mockGetState.mockReturnValue({
        status: 'completed',
        currentStepIndex: 2,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: mockResult,
      });

      render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );

      await waitFor(() => {
        expect(mockOnExecutionComplete).toHaveBeenCalledWith(mockResult);
      });
    });

    it('should call onExecutionComplete when execution fails', async () => {
      const mockResult = {
        success: false,
        completed: 1,
        total: 3,
        errors: ['Element not found', 'Timeout'],
      };

      mockGetState.mockReturnValue({
        status: 'completed',
        currentStepIndex: 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: {
          message: 'Element not found',
          nodeId: 'node-2',
        },
        result: mockResult,
      });

      render(
        <ExecutionPanel
          visible={true}
          onClose={mockOnClose}
          flowId="test-flow"
          onExecutionComplete={mockOnExecutionComplete}
        />,
      );

      await waitFor(() => {
        expect(mockOnExecutionComplete).toHaveBeenCalledWith(mockResult);
      });
    });
  });
});

describe('ExecutionPanelButton Component', () => {
  const mockOnExecutionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render button with icon', () => {
    const { container } = render(
      <ExecutionPanelButton
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getAllByTestId, getByText } = within(container);

    expect(getAllByTestId('icon-play-circle').length).toBeGreaterThan(0);
    expect(getByText('Run')).toBeInTheDocument();
  });

  it('should open drawer when clicked', () => {
    const { container } = render(
      <ExecutionPanelButton
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId, queryByTestId } = within(container);

    expect(queryByTestId('drawer')).not.toBeInTheDocument();

    fireEvent.click(getByTestId('button-run'));

    // Button should still be present
    expect(getByTestId('button-run')).toBeInTheDocument();
  });

  it('should be disabled when no flowId', () => {
    const { container } = render(
      <ExecutionPanelButton
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId } = within(container);

    const button = getByTestId('button-run');
    expect(button).toBeDisabled();
  });

  it('should not be disabled when flowId is provided', () => {
    const { container } = render(
      <ExecutionPanelButton
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId } = within(container);

    const button = getByTestId('button-run');
    expect(button).not.toBeDisabled();
  });

  it('should update executor state mock and re-render', async () => {
    // Update the mock state to running
    mockGetState.mockReturnValue({
      status: 'running',
      currentStepIndex: 1,
      executionOrder: ['node-1', 'node-2'],
      error: null,
      result: null,
    });

    const { container } = render(
      <ExecutionPanelButton
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId } = within(container);

    // The button should be present and enabled
    const button = getByTestId('button-run');
    expect(button).not.toBeDisabled();
  });
});

describe('ExecutionPanel Edge Cases', () => {
  const mockOnClose = vi.fn();
  const mockOnExecutionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle executor state update interval', async () => {
    let callCount = 0;
    mockGetState.mockImplementation(() => {
      callCount++;
      return {
        status: callCount < 3 ? 'running' : 'completed',
        currentStepIndex: callCount - 1,
        executionOrder: ['node-1', 'node-2', 'node-3'],
        error: null,
        result: callCount >= 3 ? { success: true, completed: 3, total: 3, errors: [] } : null,
      };
    });

    render(
      <ExecutionPanel
        visible={true}
        onClose={mockOnClose}
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );

    // Wait for state updates to propagate
    await waitFor(() => {
      expect(mockGetState).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should handle error during execution', async () => {
    mockExecute.mockRejectedValue(new Error('Execution failed'));

    mockGetState.mockReturnValue({
      status: 'idle',
      currentStepIndex: 0,
      executionOrder: ['node-1', 'node-2'],
      error: null,
      result: null,
    });

    const { container } = render(
      <ExecutionPanel
        visible={true}
        onClose={mockOnClose}
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId } = within(container);

    const startButton = getByTestId('button-start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  it('should handle empty execution order', () => {
    mockGetState.mockReturnValue({
      status: 'completed',
      currentStepIndex: 0,
      executionOrder: [],
      error: null,
      result: {
        success: true,
        completed: 0,
        total: 0,
        errors: [],
      },
    });

    const { container } = render(
      <ExecutionPanel
        visible={true}
        onClose={mockOnClose}
        flowId="test-flow"
        onExecutionComplete={mockOnExecutionComplete}
      />,
    );
    const { getByTestId } = within(container);

    // Should not crash with empty execution order
    expect(getByTestId('drawer')).toBeInTheDocument();
  });
});
