/**
 * Element Picker Component
 * Provides UI for interactive element selection from the page
 */

import {
  CloseOutlined,
  CopyOutlined,
  EyeOutlined,
  HighlightOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Button, Card, List, Space, Tag, Tooltip, Typography, message } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../../../i18n';
import type { SelectedElement, SelectionMode, SelectionState } from '../../types/elementRepair';
import type { ElementSelector as SelectorType } from '../../types/elementRepair';
import { elementSelector } from '../../services/elementRepair';

const { Text, Paragraph, Title } = Typography;

interface ElementPickerProps {
  visible: boolean;
  mode?: SelectionMode;
  onStart?: () => void;
  onStop?: () => void;
  onElementSelected?: (element: SelectedElement) => void;
  disabled?: boolean;
}

/**
 * Get priority color
 */
function getPriorityColor(priority: number): string {
  if (priority >= 90) return 'green';
  if (priority >= 70) return 'blue';
  if (priority >= 50) return 'orange';
  return 'default';
}

/**
 * Get selector type icon/color
 */
function getSelectorTypeInfo(type: SelectorType['type']) {
  const types = {
    css: { label: 'CSS', color: 'blue' },
    xpath: { label: 'XPath', color: 'purple' },
    text: { label: 'Text', color: 'green' },
    semantic: { label: 'Semantic', color: 'cyan' },
    'data-testid': { label: 'Test ID', color: 'green' },
  };
  return types[type] || { label: type, color: 'default' };
}

export function ElementPicker({
  visible,
  mode = 'click',
  onStart,
  onStop,
  onElementSelected,
  disabled = false,
}: ElementPickerProps) {
  const { t } = useI18n();
  const [state, setState] = useState<SelectionState>('idle');
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  // Listen for element selection events
  useEffect(() => {
    const handleElementSelected = (e: CustomEvent) => {
      const element = e.detail.selectedElement as SelectedElement;
      setSelectedElement(element);
      onElementSelected?.(element);
    };

    document.addEventListener('midscene-element-selected', handleElementSelected as EventListener);

    return () => {
      document.removeEventListener('midscene-element-selected', handleElementSelected as EventListener);
    };
  }, [onElementSelected]);

  // Sync state with service
  useEffect(() => {
    const checkState = () => {
      setState(elementSelector.getSelectionState());
      setSelectedElement(elementSelector.getSelectedElement());
    };

    checkState();
    const interval = setInterval(checkState, 100);

    return () => clearInterval(interval);
  }, []);

  // Start selection
  const handleStart = useCallback(async () => {
    if (disabled) return;

    try {
      await elementSelector.startSelection({ mode });
      onStart?.();
      message.info(t('clickElementToSelect'));
    } catch (error) {
      message.error(t('failedToStartSelection'));
      console.error('Failed to start selection:', error);
    }
  }, [mode, disabled, onStart, t]);

  // Stop selection
  const handleStop = useCallback(() => {
    elementSelector.stopSelection();
    onStop?.();
  }, [onStop]);

  // Clear selection
  const handleClear = useCallback(() => {
    elementSelector.clearSelection();
    setSelectedElement(null);
  }, []);

  // Copy selector to clipboard
  const handleCopySelector = useCallback((selector: string) => {
    navigator.clipboard.writeText(selector);
    message.success(t('copiedToClipboard'));
  }, [t]);

  if (!visible) {
    return null;
  }

  return (
    <Card
      size="small"
      title={
        <Space>
          <HighlightOutlined />
          <span>{t('elementSelector')}</span>
          {state === 'selecting' && (
            <Tag color="processing">{t('statusRunning')}</Tag>
          )}
          {state === 'selected' && (
            <Tag color="success">{t('statusSuccess')}</Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          {state === 'selecting' ? (
            <Button size="small" icon={<CloseOutlined />} onClick={handleStop}>
              {t('cancel')}
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<EyeOutlined />}
              onClick={handleStart}
              disabled={disabled}
            >
              {t('startSelection')}
            </Button>
          )}
        </Space>
      }
      className="element-picker-card"
    >
      {state === 'idle' && (
        <div className="element-picker-idle">
          <Text type="secondary">{t('clickStartToSelect')}</Text>
        </div>
      )}

      {state === 'selecting' && (
        <div className="element-picker-selecting">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="info"
              message={t('selectionMode')}
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>{t('moveMouseToHighlight')}</li>
                  <li>{t('clickToSelectElement')}</li>
                  <li>{t('pressEscToCancel')}</li>
                </ul>
              }
            />
          </Space>
        </div>
      )}

      {state === 'selected' && selectedElement && (
        <div className="element-picker-selected">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {/* Element Info */}
            <div className="element-info">
              <Title level={5}>{t('selectedElement')}</Title>
              <Paragraph style={{ marginBottom: 8 }}>
                <Text strong>{t('semanticDescription')}：</Text>
                <Text>{selectedElement.semanticDescription || 'N/A'}</Text>
              </Paragraph>
              <Paragraph style={{ marginBottom: 8 }}>
                <Text strong>{t('position')}：</Text>
                <Text>
                  ({Math.round(selectedElement.center[0])}, {Math.round(selectedElement.center[1])})
                </Text>
              </Paragraph>
              <Paragraph style={{ marginBottom: 8 }}>
                <Text strong>{t('size')}：</Text>
                <Text>
                  {Math.round(selectedElement.rect.width)} × {Math.round(selectedElement.rect.height)}
                </Text>
              </Paragraph>
            </div>

            {/* Suggested Selectors */}
            <div className="element-selectors">
              <Title level={5}>{t('suggestedSelectors')}</Title>
              <List
                size="small"
                dataSource={selectedElement.suggestedSelectors}
                renderItem={(selector, index) => {
                  const typeInfo = getSelectorTypeInfo(selector.type);
                  return (
                    <List.Item
                      key={index}
                      actions={[
                        <Tooltip title={t('copySelector')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleCopySelector(selector.value)}
                          />
                        </Tooltip>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
                        }
                        title={
                          <Space>
                            <Text>{selector.value.slice(0, 40)}{selector.value.length > 40 ? '...' : ''}</Text>
                            <Tag color={getPriorityColor(selector.priority)}>{selector.priority}%</Tag>
                          </Space>
                        }
                        description={selector.reason}
                      />
                    </List.Item>
                  );
                }}
              />
            </div>

            {/* Actions */}
            <Space>
              <Button icon={<CheckOutlined />} type="primary">
                {t('confirmSelection')}
              </Button>
              <Button icon={<HighlightOutlined />} onClick={handleStart}>
                {t('reselect')}
              </Button>
              <Button danger onClick={handleClear}>
                {t('clear')}
              </Button>
            </Space>
          </Space>
        </div>
      )}
    </Card>
  );
}

// Import Alert from antd
import { Alert } from 'antd';
