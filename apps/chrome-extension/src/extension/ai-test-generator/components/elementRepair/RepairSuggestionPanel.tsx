/**
 * Repair Suggestion Panel Component
 * Shows repair suggestions based on selected element and allows applying repairs
 */

import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../../i18n';
import { repairEngine } from '../../services/elementRepair';
import type {
  RepairOptions,
  RepairResult,
  RepairSuggestion,
  SelectedElement,
} from '../../types/elementRepair';

const { Text, Title, Paragraph } = Typography;

interface RepairSuggestionPanelProps {
  visible: boolean;
  selectedElement: SelectedElement | null;
  repairOptions: RepairOptions | null;
  onRepairApplied?: (result: RepairResult) => void;
  onClose?: () => void;
}

/**
 * Get action type display info
 */
function getActionTypeInfo(actionType: RepairSuggestion['actionType']) {
  const types = {
    update_selector: {
      label: '更新选择器',
      icon: <ToolOutlined />,
      color: 'blue',
    },
    add_fallback: {
      label: '添加备用',
      icon: <BulbOutlined />,
      color: 'green',
    },
    update_description: {
      label: '更新描述',
      icon: <ExclamationCircleOutlined />,
      color: 'orange',
    },
    add_wait_condition: {
      label: '添加等待',
      icon: <ExclamationCircleOutlined />,
      color: 'purple',
    },
  };
  return (
    types[actionType] || {
      label: actionType,
      icon: <ToolOutlined />,
      color: 'default',
    }
  );
}

/**
 * Get impact color
 */
function getImpactColor(impact: RepairSuggestion['impact']): string {
  if (impact === 'high') return 'red';
  if (impact === 'medium') return 'orange';
  return 'default';
}

/**
 * Get confidence level
 */
function getConfidenceLevel(confidence: number) {
  if (confidence >= 80) return { label: '高', status: 'success' as const };
  if (confidence >= 50) return { label: '中', status: 'normal' as const };
  return { label: '低', status: 'exception' as const };
}

export function RepairSuggestionPanel({
  visible,
  selectedElement,
  repairOptions,
  onRepairApplied,
  onClose,
}: RepairSuggestionPanelProps) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<RepairSuggestion[]>([]);
  const [applying, setApplying] = useState<string | null>(null);
  const [appliedRepairs, setAppliedRepairs] = useState<Set<string>>(new Set());

  // Generate suggestions when element or options change
  useEffect(() => {
    if (visible && selectedElement && repairOptions) {
      generateSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [visible, selectedElement, repairOptions]);

  const generateSuggestions = async () => {
    if (!selectedElement || !repairOptions) return;

    try {
      const result = await repairEngine.generateSuggestions(
        selectedElement,
        repairOptions,
      );
      setSuggestions(result);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
      message.error(t('failedToGenerateSuggestions'));
    }
  };

  // Apply repair suggestion
  const handleApplyRepair = useCallback(
    async (suggestion: RepairSuggestion) => {
      if (!selectedElement || !repairOptions) return;

      setApplying(suggestion.id);

      try {
        const result = await repairEngine.applyRepair(
          suggestion,
          selectedElement,
          repairOptions,
        );

        if (result.success) {
          setAppliedRepairs((prev) => new Set(prev).add(suggestion.id));
          message.success(t('repairApplied'));
          onRepairApplied?.(result);
        } else {
          message.error(t('repairFailed'));
        }
      } catch (error) {
        console.error('Failed to apply repair:', error);
        message.error(t('repairFailed'));
      } finally {
        setApplying(null);
      }
    },
    [selectedElement, repairOptions, onRepairApplied, t],
  );

  if (!visible || !selectedElement || !repairOptions) {
    return null;
  }

  const actionTypeInfo = getActionTypeInfo;

  return (
    <Card
      size="small"
      title={
        <Space>
          <ToolOutlined />
          <span>{t('repairSuggestions')}</span>
          <Tag>{suggestions.length}</Tag>
        </Space>
      }
      extra={
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
      }
      className="repair-suggestion-panel"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* Repair Options Info */}
        <Alert
          type="info"
          message={t('repairContext')}
          description={
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('step')}>
                <Text ellipsis style={{ maxWidth: 300 }}>
                  {repairOptions.originalDescription}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('failureReason')}>
                <Text type="danger">{repairOptions.failureReason}</Text>
              </Descriptions.Item>
              {selectedElement.semanticDescription && (
                <Descriptions.Item label={t('selectedElementDesc')}>
                  <Text>{selectedElement.semanticDescription}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          }
          showIcon
        />

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          <Alert
            type="warning"
            message={t('noSuggestions')}
            description={t('tryAnotherElement')}
            showIcon
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {suggestions.map((suggestion) => {
              const typeInfo = actionTypeInfo(suggestion.actionType);
              const confidenceLevel = getConfidenceLevel(suggestion.confidence);
              const isApplied = appliedRepairs.has(suggestion.id);
              const isApplying = applying === suggestion.id;

              return (
                <Card
                  key={suggestion.id}
                  size="small"
                  type={isApplied ? 'inner' : undefined}
                  className={isApplied ? 'repair-applied' : ''}
                  extra={
                    isApplied ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">
                        {t('applied')}
                      </Tag>
                    ) : (
                      <Tag color={getImpactColor(suggestion.impact)}>
                        {suggestion.impact === 'high'
                          ? t('high')
                          : suggestion.impact === 'medium'
                            ? t('medium')
                            : t('low')}
                      </Tag>
                    )
                  }
                >
                  <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size="small"
                  >
                    {/* Title */}
                    <Space>
                      {typeInfo.icon}
                      <Text strong>{suggestion.title}</Text>
                      <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                    </Space>

                    {/* Description */}
                    <Paragraph style={{ marginBottom: 8 }}>
                      {suggestion.description}
                    </Paragraph>

                    {/* Confidence */}
                    <div style={{ marginBottom: 8 }}>
                      <Space
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text type="secondary">{t('confidence')}:</Text>
                        <Text strong>{suggestion.confidence}%</Text>
                      </Space>
                      <Progress
                        percent={suggestion.confidence}
                        status={confidenceLevel.status}
                        size="small"
                        strokeColor={
                          suggestion.confidence >= 80
                            ? '#52c41a'
                            : suggestion.confidence >= 50
                              ? '#faad14'
                              : '#ff4d4f'
                        }
                      />
                    </div>

                    {/* Value Change */}
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('change')}:
                      </Text>
                      <div style={{ marginTop: 4 }}>
                        <Text delete type="secondary">
                          {suggestion.currentValue.slice(0, 50)}
                          {suggestion.currentValue.length > 50 ? '...' : ''}
                        </Text>
                        <Text strong> → </Text>
                        <Text style={{ color: '#52c41a' }}>
                          {suggestion.suggestedValue.slice(0, 50)}
                          {suggestion.suggestedValue.length > 50 ? '...' : ''}
                        </Text>
                      </div>
                    </div>

                    {/* Apply Button */}
                    {!isApplied && (
                      <Button
                        type="primary"
                        size="small"
                        loading={isApplying}
                        onClick={() => handleApplyRepair(suggestion)}
                        icon={<ToolOutlined />}
                        block
                      >
                        {isApplying ? t('applying') : t('applyRepair')}
                      </Button>
                    )}
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}

        {/* Repair Statistics */}
        {appliedRepairs.size > 0 && (
          <Alert
            type="success"
            message={`${t('repairsCompleted').replace('{count}', String(appliedRepairs.size))}`}
            showIcon
          />
        )}
      </Space>

      <style>{`
        .repair-suggestion-panel .repair-applied {
          background-color: #f6ffed;
          border-color: #b7eb8f;
        }
        .repair-suggestion-panel .repair-applied .ant-card-head {
          border-bottom-color: #b7eb8f;
        }
      `}</style>
    </Card>
  );
}
