/**
 * History View Component
 * Displays execution history records with details
 */

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Empty,
  List,
  Popconfirm,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import {
  type ExecutionHistoryItem,
  historyService,
} from '../services/historyService';
import { useGeneratorStore } from '../store';

const { Text, Title } = Typography;

interface HistoryViewProps {
  onBack: () => void;
}

export function HistoryView({ onBack }: HistoryViewProps) {
  const { t } = useI18n();
  const [historyItems, setHistoryItems] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ExecutionHistoryItem | null>(
    null,
  );

  const { setMarkdownInput, setCurrentView, setGeneratedYaml } =
    useGeneratorStore();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const items = await historyService.getAllHistory();
      setHistoryItems(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: string) => {
    await historyService.deleteHistoryItem(id);
    setHistoryItems((items) => items.filter((item) => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
    message.success(t('deleted'));
  };

  const handleClearAll = async () => {
    await historyService.clearAllHistory();
    setHistoryItems([]);
    setSelectedItem(null);
    message.success(t('allHistoryCleared'));
  };

  const handleReuse = (item: ExecutionHistoryItem) => {
    setMarkdownInput(item.markdownInput);
    setCurrentView('input');
    message.success(t('loadedToInput'));
  };

  const handleCopyYaml = (yaml: string) => {
    navigator.clipboard.writeText(yaml);
    message.success(t('yamlCopied'));
  };

  const getStatusTag = (status: ExecutionHistoryItem['status']) => {
    switch (status) {
      case 'success':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {t('success')}
          </Tag>
        );
      case 'partial':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            {t('partialSuccess')}
          </Tag>
        );
      case 'failed':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            {t('failed')}
          </Tag>
        );
      case 'cancelled':
        return (
          <Tag icon={<StopOutlined />} color="default">
            {t('cancelled')}
          </Tag>
        );
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderHistoryItem = (item: ExecutionHistoryItem) => {
    const successRate =
      item.totalSteps > 0
        ? Math.round((item.successSteps / item.totalSteps) * 100)
        : 0;

    return (
      <List.Item
        key={item.id}
        className={`history-item ${selectedItem?.id === item.id ? 'selected' : ''}`}
        onClick={() => setSelectedItem(item)}
      >
        <div className="history-item-content">
          <div className="history-item-header">
            <Space>
              {getStatusTag(item.status)}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatTime(item.createdAt)}
              </Text>
            </Space>
            <Space size={4}>
              <Tooltip title={t('rerun')}>
                <Button
                  type="text"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReuse(item);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title={t('confirmDeleteRecord')}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDelete(item.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
                okText={t('delete')}
                cancelText={t('cancel')}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          </div>

          <div className="history-item-summary">
            <Text ellipsis style={{ maxWidth: '100%' }}>
              {item.testCases.length} {t('cases')} · {item.totalSteps} {t('steps')}
            </Text>
          </div>

          <div className="history-item-progress">
            <Progress
              percent={successRate}
              size="small"
              status={
                item.status === 'success'
                  ? 'success'
                  : item.status === 'failed'
                    ? 'exception'
                    : 'normal'
              }
              format={() => `${item.successSteps}/${item.totalSteps}`}
            />
          </div>

          <div className="history-item-footer">
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('duration')}: {formatDuration(item.duration)}
            </Text>
          </div>
        </div>
      </List.Item>
    );
  };

  const renderDetail = () => {
    if (!selectedItem) {
      return (
        <div className="history-detail-empty">
          <Empty description={t('selectRecordToViewDetails')} />
        </div>
      );
    }

    return (
      <div className="history-detail">
        <div className="detail-header">
          <Space>
            {getStatusTag(selectedItem.status)}
            <Text>{formatTime(selectedItem.createdAt)}</Text>
          </Space>
        </div>

        <Card size="small" title={t('executionStats')} className="detail-card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="stat-row">
              <Text type="secondary">{t('caseCount')}:</Text>
              <Text strong>{selectedItem.testCases.length}</Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">{t('totalSteps')}:</Text>
              <Text strong>{selectedItem.totalSteps}</Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">{t('success')}:</Text>
              <Text strong style={{ color: '#52c41a' }}>
                {selectedItem.successSteps}
              </Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">{t('failed')}:</Text>
              <Text strong style={{ color: '#ff4d4f' }}>
                {selectedItem.failedSteps}
              </Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">{t('duration')}:</Text>
              <Text strong>{formatDuration(selectedItem.duration)}</Text>
            </div>
          </Space>
        </Card>

        <Card size="small" title={t('testCases')} className="detail-card">
          <List
            size="small"
            dataSource={selectedItem.testCases}
            renderItem={(testCase) => (
              <List.Item>
                <Text ellipsis>{testCase.name}</Text>
              </List.Item>
            )}
          />
        </Card>

        {selectedItem.generatedYaml && (
          <Card
            size="small"
            title={t('generatedYaml')}
            className="detail-card"
            extra={
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyYaml(selectedItem.generatedYaml)}
              >
                {t('copy')}
              </Button>
            }
          >
            <pre className="yaml-preview">{selectedItem.generatedYaml}</pre>
          </Card>
        )}

        <div className="detail-actions">
          <Button
            icon={<PlayCircleOutlined />}
            onClick={() => handleReuse(selectedItem)}
          >
            {t('rerun')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="history-view-container">
      <div className="history-header">
        <Title level={5} style={{ margin: 0 }}>
          <HistoryOutlined /> {t('executionHistory')}
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadHistory}
            loading={loading}
          >
            {t('refresh')}
          </Button>
          {historyItems.length > 0 && (
            <Popconfirm
              title={t('confirmClearAllHistory')}
              onConfirm={handleClearAll}
              okText={t('clear')}
              cancelText={t('cancel')}
            >
              <Button icon={<ClearOutlined />} danger>
                {t('clear')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <div className="history-content">
        <div className="history-list-section">
          {historyItems.length === 0 ? (
            <Empty description={t('noExecutionHistory')} />
          ) : (
            <List
              loading={loading}
              dataSource={historyItems}
              renderItem={renderHistoryItem}
              className="history-list"
            />
          )}
        </div>

        <div className="history-detail-section">{renderDetail()}</div>
      </div>
    </div>
  );
}
