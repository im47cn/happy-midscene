/**
 * Execution Panel Component
 * 执行面板 - 显示测试执行状态和结果
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CloseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  StepForwardOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  List,
  Space,
  Tag,
  Timeline,
  Tooltip,
  Progress,
  Drawer,
  Typography,
  Empty,
  Divider,
  Alert,
  message,
} from 'antd';
import type { ExecuteResult, ExecutionStatus } from '../services/designerExecutor';
import { getDesignerExecutor } from '../services/designerExecutor';

const { Text, Paragraph } = Typography;

/**
 * 执行步骤状态
 */
interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: any;
}

/**
 * 执行状态
 */
interface ExecutionState {
  status: ExecutionStatus;
  currentStep: number;
  totalSteps: number;
  currentNodeId?: string;
  steps: ExecutionStep[];
  startTime?: number;
  endTime?: number;
  results?: ExecuteResult;
}

const STATUS_CONFIG: Record<
  ExecutionStep['status'],
  { icon: React.ReactNode; color: string; text: string }
> = {
  pending: {
    icon: <LoadingOutlined />,
    color: 'default',
    text: 'Pending',
  },
  running: {
    icon: <LoadingOutlined spin />,
    color: 'processing',
    text: 'Running',
  },
  success: {
    icon: <CheckCircleOutlined />,
    color: 'success',
    text: 'Success',
  },
  error: {
    icon: <CloseCircleOutlined />,
    color: 'error',
    text: 'Error',
  },
  skipped: {
    icon: <CloseOutlined />,
    color: 'default',
    text: 'Skipped',
  },
};

/**
 * 执行步骤项
 */
function ExecutionStepItem({ step }: { step: ExecutionStep }) {
  const config = STATUS_CONFIG[step.status];
  const duration =
    step.startTime && step.endTime
      ? ((step.endTime - step.startTime) / 1000).toFixed(2)
      : undefined;

  return (
    <div
      className={`execution-step execution-step-${step.status}`}
      style={{
        padding: '8px 12px',
        borderRadius: 4,
        background:
          step.status === 'running'
            ? '#e6f7ff'
            : step.status === 'error'
              ? '#fff2f0'
              : step.status === 'success'
                ? '#f6ffed'
                : 'transparent',
        marginBottom: 4,
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <span style={{ color: config.color === 'processing' ? '#1890ff' :
                         config.color === 'success' ? '#52c41a' :
                         config.color === 'error' ? '#ff4d4f' : '#999' }}>
            {config.icon}
          </span>
          <Text strong={step.status === 'running'}>{step.nodeName}</Text>
          <Tag color={config.color}>{config.text}</Tag>
        </Space>
        {duration !== undefined && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {duration}s
          </Text>
        )}
      </Space>

      {step.error && (
        <Alert
          type="error"
          message={step.error}
          size="small"
          style={{ marginTop: 8 }}
        />
      )}

      {step.result && typeof step.result === 'object' && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12 }}>
            Result
          </summary>
          <pre
            style={{
              marginTop: 4,
              padding: 8,
              background: '#f5f5f5',
              borderRadius: 4,
              fontSize: 11,
              overflow: 'auto',
            }}
          >
            {JSON.stringify(step.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export interface ExecutionPanelProps {
  visible?: boolean;
  onClose?: () => void;
  flowId?: string;
  onExecutionComplete?: (result: ExecuteResult) => void;
}

/**
 * Execution Panel Component
 */
export function ExecutionPanel({
  visible = false,
  onClose,
  flowId,
  onExecutionComplete,
}: ExecutionPanelProps) {
  const [state, setState] = useState<ExecutionState>({
    status: 'idle',
    currentStep: 0,
    totalSteps: 0,
    steps: [],
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * 更新执行状态
   */
  const updateExecutionState = useCallback(() => {
    const executor = getDesignerExecutor();
    const currentState = executor.getState();

    setState((prev) => {
      // 构建步骤列表
      const steps: ExecutionStep[] = (currentState.executionOrder || []).map(
        (nodeId, index) => {
          const existingStep = prev.steps[index];
          const isCurrentStep = index === currentState.currentStepIndex;
          const isPast = index < currentState.currentStepIndex;
          const isRunning = currentState.status === 'running' && isCurrentStep;
          const hasError =
            currentState.error && currentState.currentStepIndex === index;

          let stepStatus: ExecutionStep['status'] = 'pending';
          if (hasError) {
            stepStatus = 'error';
          } else if (isRunning) {
            stepStatus = 'running';
          } else if (isPast) {
            stepStatus = 'success';
          }

          return {
            ...existingStep,
            nodeId,
            nodeName: `Step ${index + 1}`,
            status: stepStatus,
            error: hasError ? currentState.error?.message : undefined,
            startTime: existingStep?.startTime,
            endTime: hasError || isPast ? existingStep?.endTime || Date.now() : undefined,
          };
        },
      );

      return {
        status: currentState.status,
        currentStep: currentState.currentStepIndex + 1,
        totalSteps: currentState.executionOrder?.length || 0,
        currentNodeId: currentState.executionOrder?.[currentState.currentStepIndex],
        steps,
        startTime: prev.startTime || (currentState.status === 'running' ? Date.now() : undefined),
        endTime: currentState.status === 'completed' || currentState.status === 'error'
          ? Date.now()
          : undefined,
        results: currentState.result,
      };
    });

    // 自动滚动到底部
    if (autoScroll && currentState.status === 'running') {
      setTimeout(() => {
        const container = document.querySelector('.execution-steps-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }

    // 执行完成回调
    if (
      currentState.status === 'completed' &&
      onExecutionComplete &&
      currentState.result
    ) {
      onExecutionComplete(currentState.result);
    }
  }, [autoScroll, onExecutionComplete]);

  /**
   * 监听执行器状态变化
   */
  useEffect(() => {
    if (!visible || !flowId) return;

    const executor = getDesignerExecutor();
    const interval = setInterval(updateExecutionState, 100);

    return () => clearInterval(interval);
  }, [visible, flowId, updateExecutionState]);

  /**
   * 开始执行
   */
  const handleStart = useCallback(async () => {
    if (!flowId) {
      message.error('No flow to execute');
      return;
    }

    const executor = getDesignerExecutor();
    setState({
      status: 'running',
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      startTime: Date.now(),
    });

    try {
      await executor.execute(
        flowId,
        {
          onStepStart: (nodeId) => {
            console.log('Step started:', nodeId);
          },
          onStepComplete: (nodeId, result) => {
            console.log('Step completed:', nodeId, result);
          },
          onStepError: (nodeId, error) => {
            console.error('Step error:', nodeId, error);
          },
          onProgress: (current, total) => {
            console.log(`Progress: ${current}/${total}`);
          },
        },
        1000, // step delay for visualization
      );
    } catch (error) {
      message.error('Execution failed: ' + (error as Error).message);
    }
  }, [flowId]);

  /**
   * 暂停执行
   */
  const handlePause = useCallback(async () => {
    const executor = getDesignerExecutor();
    await executor.pause();
  }, []);

  /**
   * 继续执行
   */
  const handleResume = useCallback(async () => {
    const executor = getDesignerExecutor();
    await executor.resume();
  }, []);

  /**
   * 停止执行
   */
  const handleStop = useCallback(async () => {
    const executor = getDesignerExecutor();
    await executor.stop();
    setState((prev) => ({
      ...prev,
      status: 'idle',
      endTime: Date.now(),
    }));
  }, []);

  /**
   * 单步执行
   */
  const handleStep = useCallback(async () => {
    const executor = getDesignerExecutor();
    await executor.step();
  }, []);

  /**
   * 清空结果
   */
  const handleClear = useCallback(() => {
    setState({
      status: 'idle',
      currentStep: 0,
      totalSteps: 0,
      steps: [],
    });
  }, []);

  /**
   * 导出结果
   */
  const handleExport = useCallback(() => {
    if (!state.results) {
      message.warning('No results to export');
      return;
    }

    const data = JSON.stringify(state.results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-result-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Results exported');
  }, [state.results]);

  /**
   * 计算执行时间
   */
  const getDuration = useCallback(() => {
    if (!state.startTime) return 0;
    const endTime = state.endTime || Date.now();
    return ((endTime - state.startTime) / 1000).toFixed(2);
  }, [state.startTime, state.endTime]);

  /**
   * 计算进度百分比
   */
  const getProgress = useCallback(() => {
    if (state.totalSteps === 0) return 0;
    return (state.currentStep / state.totalSteps) * 100;
  }, [state.currentStep, state.totalSteps]);

  /**
   * 获取状态摘要
   */
  const getStatusSummary = useCallback(() => {
    const success = state.steps.filter((s) => s.status === 'success').length;
    const error = state.steps.filter((s) => s.status === 'error').length;
    const running = state.steps.filter((s) => s.status === 'running').length;
    const pending = state.steps.filter((s) => s.status === 'pending').length;

    return { success, error, running, pending };
  }, [state.steps]);

  const summary = getStatusSummary();
  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const isIdle = state.status === 'idle';

  return (
    <Drawer
      title={
        <Space>
          <PlayCircleOutlined />
          <span>Test Execution</span>
          {state.status !== 'idle' && (
            <Tag color={isRunning ? 'processing' : isPaused ? 'warning' : 'default'}>
              {state.status.toUpperCase()}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onClose={onClose}
      width={480}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button
              icon={<DeleteOutlined />}
              onClick={handleClear}
              disabled={isRunning}
            >
              Clear
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={!state.results}
            >
              Export
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<CloseOutlined />}
            onClick={onClose}
          >
            Close
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 控制按钮 */}
        <Card size="small">
          <Space wrap>
            {isIdle && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStart}
                disabled={!flowId}
              >
                Start
              </Button>
            )}
            {isRunning && (
              <>
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={handlePause}
                >
                  Pause
                </Button>
                <Button
                  icon={<StepForwardOutlined />}
                  onClick={handleStep}
                >
                  Step
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                >
                  Stop
                </Button>
              </>
            )}
            {isPaused && (
              <>
                <Button
                  type="primary"
                  icon={<CaretRightOutlined />}
                  onClick={handleResume}
                >
                  Resume
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                >
                  Stop
                </Button>
              </>
            )}
          </Space>
        </Card>

        {/* 进度信息 */}
        {state.totalSteps > 0 && (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text>Progress</Text>
                <Text strong>
                  {state.currentStep} / {state.totalSteps}
                </Text>
              </div>
              <Progress
                percent={Math.round(getProgress())}
                status={
                  isRunning
                    ? 'active'
                    : summary.error > 0
                      ? 'exception'
                      : state.currentStep === state.totalSteps
                        ? 'success'
                        : undefined
                }
              />
              <Space wrap>
                <Tag color="success">Success: {summary.success}</Tag>
                {summary.error > 0 && (
                  <Tag color="error">Error: {summary.error}</Tag>
                )}
                {summary.running > 0 && (
                  <Tag color="processing">Running: {summary.running}</Tag>
                )}
                {summary.pending > 0 && (
                  <Tag>Pending: {summary.pending}</Tag>
                )}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Duration: {getDuration()}s
              </Text>
            </Space>
          </Card>
        )}

        {/* 错误信息 */}
        {state.status === 'error' && (
          <Alert
            type="error"
            message="Execution Failed"
            description="An error occurred during test execution. Check the step details below."
            showIcon
          />
        )}

        {/* 执行结果 */}
        {state.status === 'completed' && state.results && (
          <Alert
            type={
              state.results.success &&
              state.results.errors.length === 0
                ? 'success'
                : 'warning'
            }
            message={
              state.results.success
                ? 'Execution Completed Successfully'
                : 'Execution Completed with Errors'
            }
            description={
              <Space direction="vertical" size="small">
                <div>Steps: {state.results.completed}/{state.results.total}</div>
                {state.results.errors.length > 0 && (
                  <details>
                    <summary>Errors ({state.results.errors.length})</summary>
                    <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                      {state.results.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Space>
            }
            showIcon
          />
        )}

        <Divider style={{ margin: 0 }} />

        {/* 执行步骤列表 */}
        <div
          className="execution-steps-container"
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {state.steps.length === 0 ? (
            <Empty
              description={
                isIdle
                  ? 'Click "Start" to begin execution'
                  : 'Preparing execution...'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={state.steps}
              renderItem={(step) => (
                <ExecutionStepItem key={step.nodeId} step={step} />
              )}
            />
          )}
        </div>
      </Space>
    </Drawer>
  );
}

/**
 * 执行面板触发按钮
 */
export function ExecutionPanelButton({
  flowId,
  onExecutionComplete,
}: {
  flowId?: string;
  onExecutionComplete?: (result: ExecuteResult) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<ExecutionStatus>('idle');

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      const executor = getDesignerExecutor();
      setStatus(executor.getState().status);
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  return (
    <>
      <Tooltip title="Run test flow">
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => setVisible(true)}
          type={status === 'running' ? 'primary' : 'default'}
          disabled={!flowId}
        >
          Run
        </Button>
      </Tooltip>
      <ExecutionPanel
        visible={visible}
        onClose={() => setVisible(false)}
        flowId={flowId}
        onExecutionComplete={onExecutionComplete}
      />
    </>
  );
}

export default ExecutionPanel;
