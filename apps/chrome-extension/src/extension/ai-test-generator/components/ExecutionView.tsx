/**
 * Execution View Component
 * Shows real-time execution progress and allows intervention
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Progress,
  Space,
  Typography,
  Timeline,
  Input,
  Modal,
  Alert,
  Spin,
  Tag,
  Collapse,
  message,
} from 'antd';
import { useEffect, useState, useRef } from 'react';
import { useGeneratorStore } from '../store';
import { ExecutionEngine, type ExecutionError, type DeviceEmulationConfig } from '../services/executionEngine';
import { historyService } from '../services/historyService';
import { getDevicePreset } from '../config/devicePresets';
import type { TestCase, TaskStep } from '../types';
import type { TaskStep as ExecutionTaskStep } from '../services/markdownParser';
import type { HealingResult } from '../types/healing';
import { HealingConfirmDialog } from './HealingConfirmDialog';
import {
  ChromeExtensionProxyPage,
  ChromeExtensionProxyPageAgent,
} from '@midscene/web/chrome-extension';

const { Text, Title } = Typography;

// Error type labels in Chinese
const errorTypeLabels: Record<ExecutionError['type'], string> = {
  element_not_found: '元素未找到',
  timeout: '操作超时',
  action_failed: '操作失败',
  navigation_failed: '导航失败',
  assertion_failed: '验证失败',
  unknown: '未知错误',
};

// Error type colors
const errorTypeColors: Record<ExecutionError['type'], string> = {
  element_not_found: 'orange',
  timeout: 'gold',
  action_failed: 'red',
  navigation_failed: 'purple',
  assertion_failed: 'magenta',
  unknown: 'default',
};

// Detailed error display component
function DetailedErrorDisplay({ errorDetails }: { errorDetails: ExecutionError }) {
  return (
    <div className="detailed-error">
      <div className="error-header">
        <Tag color={errorTypeColors[errorDetails.type]}>
          {errorTypeLabels[errorDetails.type]}
        </Tag>
        <Text type="danger">{errorDetails.details}</Text>
      </div>

      {errorDetails.message && (
        <Collapse
          size="small"
          ghost
          items={[
            {
              key: 'message',
              label: (
                <Space>
                  <InfoCircleOutlined />
                  <Text type="secondary">详细信息</Text>
                </Space>
              ),
              children: (
                <Text code copyable style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {errorDetails.message}
                </Text>
              ),
            },
          ]}
        />
      )}

      {errorDetails.suggestion && (
        <Alert
          type="info"
          icon={<BulbOutlined />}
          message={
            <Text style={{ fontSize: 12 }}>{errorDetails.suggestion}</Text>
          }
          style={{ marginTop: 8 }}
          showIcon
        />
      )}
    </div>
  );
}

// Create agent factory
const createAgent = (forceSameTabNavigation = true) => {
  const page = new ChromeExtensionProxyPage(forceSameTabNavigation);
  return new ChromeExtensionProxyPageAgent(page);
};

export function ExecutionView() {
  const {
    parseResult,
    markdownInput,
    executionStatus,
    setExecutionStatus,
    currentStepIndex,
    setCurrentStepIndex,
    executionResults,
    addExecutionResult,
    clearExecutionResults,
    updateStepStatus,
    setGeneratedYaml,
    setCurrentView,
    setError,
    selectedCaseIds,
    selectedDeviceId,
  } = useGeneratorStore();

  const [currentCase, setCurrentCase] = useState<TestCase | null>(null);
  const [retryModalVisible, setRetryModalVisible] = useState(false);
  const [retryStepId, setRetryStepId] = useState<string | null>(null);
  const [retryInstruction, setRetryInstruction] = useState('');
  const [totalProgress, setTotalProgress] = useState(0);
  const [currentErrorDetails, setCurrentErrorDetails] = useState<ExecutionError | null>(null);
  const [stepErrorMap, setStepErrorMap] = useState<Map<string, ExecutionError>>(new Map());

  // Self-healing state
  const [healingDialogVisible, setHealingDialogVisible] = useState(false);
  const [currentHealingResult, setCurrentHealingResult] = useState<HealingResult | null>(null);
  const [healingStepDescription, setHealingStepDescription] = useState('');
  const healingResolveRef = useRef<((accepted: boolean) => void) | null>(null);

  const engineRef = useRef<ExecutionEngine | null>(null);
  const executionStartTimeRef = useRef<number>(0);

  useEffect(() => {
    // Initialize engine
    engineRef.current = new ExecutionEngine(createAgent);

    // Set up callbacks
    engineRef.current.setCallbacks({
      onStepStart: (step, index) => {
        updateStepStatus(step.id, 'running');
        setCurrentStepIndex(index);
        setCurrentErrorDetails(null);
      },
      onStepComplete: (step, result) => {
        updateStepStatus(step.id, 'success');
        addExecutionResult(result);

        // Show healing success indicator if step was healed
        if (result.healedByAI) {
          message.success({
            content: (
              <span>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                步骤已通过 AI 自愈成功执行
              </span>
            ),
            duration: 3,
          });
        }
      },
      onStepFailed: (step, error, errorDetails) => {
        updateStepStatus(step.id, 'failed');
        // Store error details for display
        if (errorDetails) {
          setCurrentErrorDetails(errorDetails);
          setStepErrorMap((prev) => {
            const next = new Map(prev);
            next.set(step.id, errorDetails);
            return next;
          });
        }
        // Show retry modal
        setRetryStepId(step.id);
        setRetryInstruction(step.originalText);
        setRetryModalVisible(true);
      },
      onProgress: (current, total) => {
        setTotalProgress(Math.round((current / total) * 100));
      },
      onHealingAttempt: (step: ExecutionTaskStep, _healingResult: HealingResult) => {
        message.loading({
          content: `正在尝试 AI 自愈: ${step.originalText.slice(0, 30)}...`,
          key: 'healing',
          duration: 0,
        });
      },
      onHealingConfirmRequest: (step: ExecutionTaskStep, healingResult: HealingResult) => {
        message.destroy('healing');
        return new Promise<boolean>((resolve) => {
          healingResolveRef.current = resolve;
          setCurrentHealingResult(healingResult);
          setHealingStepDescription(step.originalText);
          setHealingDialogVisible(true);
        });
      },
    });

    return () => {
      // Cleanup
      if (engineRef.current) {
        engineRef.current.stop();
      }
    };
  }, []);

  // Start execution when view is mounted
  useEffect(() => {
    if (parseResult && parseResult.cases.length > 0 && executionStatus === 'idle') {
      startExecution();
    }
  }, [parseResult]);

  const saveExecutionHistory = async (yaml: string, isCancelled = false) => {
    if (!parseResult) return;

    try {
      const currentResults = useGeneratorStore.getState().executionResults;
      const historyItem = historyService.createHistoryItem(
        markdownInput,
        parseResult.cases,
        currentResults,
        yaml,
        executionStartTimeRef.current
      );

      if (isCancelled) {
        historyItem.status = 'cancelled';
      }

      await historyService.addHistoryItem(historyItem);
    } catch (error) {
      console.error('Failed to save execution history:', error);
    }
  };

  const startExecution = async () => {
    if (!parseResult || !engineRef.current) return;

    clearExecutionResults();
    setExecutionStatus('running');
    executionStartTimeRef.current = Date.now();

    // Determine which cases to execute
    const casesToExecute = selectedCaseIds.length > 0
      ? parseResult.cases.filter((c) => selectedCaseIds.includes(c.id))
      : parseResult.cases;

    // Execute selected cases sequentially
    const allYamlParts: string[] = [];

    try {
      for (const testCase of casesToExecute) {
        setCurrentCase(testCase);

        // Get current tab URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Build device emulation config if not desktop
        const devicePreset = getDevicePreset(selectedDeviceId);
        let deviceEmulation: DeviceEmulationConfig | undefined;

        if (devicePreset && devicePreset.isMobile) {
          deviceEmulation = {
            deviceId: devicePreset.id,
            width: devicePreset.width,
            height: devicePreset.height,
            deviceScaleFactor: devicePreset.deviceScaleFactor,
            userAgent: devicePreset.userAgent,
            isMobile: devicePreset.isMobile,
            hasTouch: devicePreset.hasTouch,
          };
        }

        const context = {
          url: tab?.url || '',
          viewportWidth: devicePreset?.width || 1280,
          viewportHeight: devicePreset?.height || 720,
          deviceEmulation,
        };

        const result = await engineRef.current.executeTestCase(testCase, context);

        if (result.success) {
          allYamlParts.push(result.yamlContent);
        } else {
          // If execution failed, still generate partial YAML
          allYamlParts.push(result.yamlContent);
          break;
        }
      }

      // Combine all YAML
      const combinedYaml = allYamlParts.join('\n---\n');
      setGeneratedYaml(combinedYaml);

      // Save to history
      await saveExecutionHistory(combinedYaml);

      setExecutionStatus('completed');
      setCurrentView('commit');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Execution failed');
      setExecutionStatus('failed');

      // Save failed execution to history
      const partialYaml = allYamlParts.join('\n---\n');
      await saveExecutionHistory(partialYaml);
    }
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
      setExecutionStatus('paused');
    }
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resume();
      setExecutionStatus('running');
    }
  };

  const handleStop = async () => {
    if (engineRef.current) {
      engineRef.current.stop();

      // Save cancelled execution to history
      await saveExecutionHistory('', true);

      setExecutionStatus('idle');
      setCurrentView('preview');
    }
  };

  const handleRetry = async () => {
    if (!engineRef.current || !retryStepId) return;

    setRetryModalVisible(false);

    try {
      const result = await engineRef.current.retryStep(retryStepId, retryInstruction);

      if (result.success) {
        updateStepStatus(retryStepId, 'success');
        addExecutionResult(result);
        // Resume execution
        engineRef.current.resume();
        setExecutionStatus('running');
      } else {
        // Still failed, show modal again
        setRetryModalVisible(true);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Retry failed');
    }
  };

  const handleSkipStep = () => {
    if (!retryStepId) return;

    setRetryModalVisible(false);
    updateStepStatus(retryStepId, 'skipped');

    // Resume execution
    if (engineRef.current) {
      engineRef.current.resume();
      setExecutionStatus('running');
    }
  };

  // Healing dialog handlers
  const handleHealingConfirm = () => {
    setHealingDialogVisible(false);
    if (healingResolveRef.current) {
      healingResolveRef.current(true);
      healingResolveRef.current = null;
    }
    setCurrentHealingResult(null);
  };

  const handleHealingReject = () => {
    setHealingDialogVisible(false);
    if (healingResolveRef.current) {
      healingResolveRef.current(false);
      healingResolveRef.current = null;
    }
    setCurrentHealingResult(null);
  };

  const handleHealingCancel = () => {
    // Treat cancel as reject
    handleHealingReject();
  };

  const getStatusColor = () => {
    switch (executionStatus) {
      case 'running':
        return '#1890ff';
      case 'paused':
        return '#faad14';
      case 'completed':
        return '#52c41a';
      case 'failed':
        return '#ff4d4f';
      default:
        return '#d9d9d9';
    }
  };

  const getStatusText = () => {
    switch (executionStatus) {
      case 'running':
        return '执行中...';
      case 'paused':
        return '已暂停';
      case 'completed':
        return '执行完成';
      case 'failed':
        return '执行失败';
      default:
        return '准备就绪';
    }
  };

  if (!currentCase) {
    return (
      <div className="execution-loading">
        <Spin size="large" />
        <Text>准备执行...</Text>
      </div>
    );
  }

  return (
    <div className="execution-view-container">
      <div className="execution-header">
        <Title level={5} style={{ margin: 0 }}>
          脚本生成中
        </Title>
        <Space>
          <div
            className="status-indicator"
            style={{ backgroundColor: getStatusColor() }}
          />
          <Text>{getStatusText()}</Text>
        </Space>
      </div>

      <Card size="small" className="execution-progress-card">
        <div className="case-info">
          <Text strong>当前用例: {currentCase.name}</Text>
        </div>
        <Progress
          percent={totalProgress}
          status={executionStatus === 'failed' ? 'exception' : 'active'}
          strokeColor={getStatusColor()}
        />
        <Text type="secondary">
          步骤 {currentStepIndex + 1} / {currentCase.steps.length}
        </Text>
      </Card>

      <div className="execution-timeline">
        <Timeline
          items={currentCase.steps.map((step, index) => ({
            color:
              step.status === 'success'
                ? 'green'
                : step.status === 'failed'
                  ? 'red'
                  : step.status === 'running'
                    ? 'blue'
                    : 'gray',
            dot:
              step.status === 'running' ? (
                <LoadingOutlined />
              ) : step.status === 'success' ? (
                <CheckCircleOutlined />
              ) : step.status === 'failed' ? (
                <CloseCircleOutlined />
              ) : undefined,
            children: (
              <div className={`timeline-step step-${step.status}`}>
                <Text
                  className={step.status === 'running' ? 'step-running-text' : ''}
                >
                  {index + 1}. {step.originalText}
                </Text>
                {step.status === 'failed' && stepErrorMap.has(step.id) ? (
                  <div style={{ marginTop: 8 }}>
                    <DetailedErrorDisplay errorDetails={stepErrorMap.get(step.id)!} />
                  </div>
                ) : step.error ? (
                  <Alert
                    type="error"
                    message={step.error}
                    style={{ marginTop: 8 }}
                    showIcon
                  />
                ) : null}
              </div>
            ),
          }))}
        />
      </div>

      <div className="execution-controls">
        <Space>
          {executionStatus === 'running' && (
            <Button icon={<PauseCircleOutlined />} onClick={handlePause}>
              暂停
            </Button>
          )}
          {executionStatus === 'paused' && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleResume}
            >
              继续
            </Button>
          )}
          <Button icon={<StopOutlined />} onClick={handleStop} danger>
            停止
          </Button>
        </Space>
      </div>

      {/* Retry Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            步骤执行失败
          </Space>
        }
        open={retryModalVisible}
        onCancel={() => setRetryModalVisible(false)}
        width={500}
        footer={[
          <Button key="skip" onClick={handleSkipStep}>
            跳过此步骤
          </Button>,
          <Button key="retry" type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
            重试
          </Button>,
        ]}
      >
        <div className="retry-modal-content">
          {currentErrorDetails && (
            <div style={{ marginBottom: 16 }}>
              <DetailedErrorDisplay errorDetails={currentErrorDetails} />
            </div>
          )}

          <Text strong>修改指令后重试：</Text>
          <Input.TextArea
            value={retryInstruction}
            onChange={(e) => setRetryInstruction(e.target.value)}
            rows={3}
            style={{ marginTop: 8 }}
            placeholder="修改指令描述..."
          />

          {!currentErrorDetails?.suggestion && (
            <Alert
              type="info"
              icon={<BulbOutlined />}
              message="提示：尝试使用更具体的描述，如元素的颜色、位置或文字内容"
              style={{ marginTop: 12 }}
              showIcon
            />
          )}
        </div>
      </Modal>

      {/* Self-Healing Confirm Dialog */}
      <HealingConfirmDialog
        visible={healingDialogVisible}
        healingResult={currentHealingResult}
        stepDescription={healingStepDescription}
        onConfirm={handleHealingConfirm}
        onReject={handleHealingReject}
        onCancel={handleHealingCancel}
      />
    </div>
  );
}
