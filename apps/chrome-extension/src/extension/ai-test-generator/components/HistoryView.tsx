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
    message.success('已删除');
  };

  const handleClearAll = async () => {
    await historyService.clearAllHistory();
    setHistoryItems([]);
    setSelectedItem(null);
    message.success('已清空所有历史');
  };

  const handleReuse = (item: ExecutionHistoryItem) => {
    setMarkdownInput(item.markdownInput);
    setCurrentView('input');
    message.success('已加载到输入区');
  };

  const handleCopyYaml = (yaml: string) => {
    navigator.clipboard.writeText(yaml);
    message.success('YAML 已复制');
  };

  const getStatusTag = (status: ExecutionHistoryItem['status']) => {
    switch (status) {
      case 'success':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            成功
          </Tag>
        );
      case 'partial':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            部分成功
          </Tag>
        );
      case 'failed':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            失败
          </Tag>
        );
      case 'cancelled':
        return (
          <Tag icon={<StopOutlined />} color="default">
            已取消
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
              <Tooltip title="重新执行">
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
                title="确定删除此记录？"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDelete(item.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
                okText="删除"
                cancelText="取消"
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
              {item.testCases.length} 个用例 · {item.totalSteps} 步骤
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
              耗时: {formatDuration(item.duration)}
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
          <Empty description="选择一条记录查看详情" />
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

        <Card size="small" title="执行统计" className="detail-card">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div className="stat-row">
              <Text type="secondary">用例数:</Text>
              <Text strong>{selectedItem.testCases.length}</Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">总步骤:</Text>
              <Text strong>{selectedItem.totalSteps}</Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">成功:</Text>
              <Text strong style={{ color: '#52c41a' }}>
                {selectedItem.successSteps}
              </Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">失败:</Text>
              <Text strong style={{ color: '#ff4d4f' }}>
                {selectedItem.failedSteps}
              </Text>
            </div>
            <div className="stat-row">
              <Text type="secondary">耗时:</Text>
              <Text strong>{formatDuration(selectedItem.duration)}</Text>
            </div>
          </Space>
        </Card>

        <Card size="small" title="测试用例" className="detail-card">
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
            title="生成的 YAML"
            className="detail-card"
            extra={
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyYaml(selectedItem.generatedYaml)}
              >
                复制
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
            重新执行
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="history-view-container">
      <div className="history-header">
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
          <Title level={5} style={{ margin: 0 }}>
            <HistoryOutlined /> 执行历史
          </Title>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadHistory}
            loading={loading}
          >
            刷新
          </Button>
          {historyItems.length > 0 && (
            <Popconfirm
              title="确定清空所有历史记录？"
              onConfirm={handleClearAll}
              okText="清空"
              cancelText="取消"
            >
              <Button icon={<ClearOutlined />} danger>
                清空
              </Button>
            </Popconfirm>
          )}
        </Space>
      </div>

      <div className="history-content">
        <div className="history-list-section">
          {historyItems.length === 0 ? (
            <Empty description="暂无执行历史" />
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
