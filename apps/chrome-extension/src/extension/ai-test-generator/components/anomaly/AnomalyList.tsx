/**
 * input: Anomaly data from anomalyStorage
 * output: List view of anomalies with filtering and actions
 * pos: Anomaly list display component
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Empty,
  List,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useMemo, useState } from 'react';
import type {
  Anomaly,
  AnomalyStatus,
  AnomalyType,
  Severity,
} from '../../types/anomaly';

const { Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface AnomalyListProps {
  anomalies: Anomaly[];
  loading?: boolean;
  onSelect?: (anomaly: Anomaly) => void;
  onAcknowledge?: (anomalyId: string) => void;
  onResolve?: (anomalyId: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityConfig(severity: Severity): {
  color: string;
  icon: React.ReactNode;
  label: string;
} {
  switch (severity) {
    case 'critical':
      return { color: '#ff4d4f', icon: <AlertOutlined />, label: '严重' };
    case 'high':
      return {
        color: '#fa541c',
        icon: <ExclamationCircleOutlined />,
        label: '高',
      };
    case 'medium':
      return { color: '#faad14', icon: <WarningOutlined />, label: '中' };
    case 'low':
    default:
      return { color: '#1890ff', icon: <ClockCircleOutlined />, label: '低' };
  }
}

function getStatusConfig(status: AnomalyStatus): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'new':
      return { color: 'red', label: '新建' };
    case 'acknowledged':
      return { color: 'orange', label: '已确认' };
    case 'investigating':
      return { color: 'blue', label: '调查中' };
    case 'resolved':
      return { color: 'green', label: '已解决' };
    default:
      return { color: 'default', label: status };
  }
}

function getTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    duration_spike: '耗时飙升',
    failure_spike: '失败率飙升',
    flaky_pattern: '抖动模式',
    performance_degradation: '性能下降',
    success_rate_drop: '成功率下降',
    resource_anomaly: '资源异常',
    trend_change: '趋势变化',
    seasonal_deviation: '周期偏差',
  };
  return labels[type] || type;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(timestamp).toLocaleDateString();
}

// ============================================================================
// Main Component
// ============================================================================

export function AnomalyList({
  anomalies,
  loading = false,
  onSelect,
  onAcknowledge,
  onResolve,
}: AnomalyListProps) {
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus | 'all'>(
    'all',
  );
  const [typeFilter, setTypeFilter] = useState<AnomalyType | 'all'>('all');

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter)
        return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      return true;
    });
  }, [anomalies, severityFilter, statusFilter, typeFilter]);

  const activeCount = anomalies.filter((a) => a.status === 'new').length;

  if (loading) {
    return (
      <Card className="anomaly-list" title="异常列表">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="anomaly-list"
      title={
        <Space>
          <span>异常列表</span>
          {activeCount > 0 && <Badge count={activeCount} />}
        </Space>
      }
      extra={
        <Space>
          <FilterOutlined />
          <Select
            size="small"
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 90 }}
            options={[
              { value: 'all', label: '全部级别' },
              { value: 'critical', label: '严重' },
              { value: 'high', label: '高' },
              { value: 'medium', label: '中' },
              { value: 'low', label: '低' },
            ]}
          />
          <Select
            size="small"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 100 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'new', label: '新建' },
              { value: 'acknowledged', label: '已确认' },
              { value: 'investigating', label: '调查中' },
              { value: 'resolved', label: '已解决' },
            ]}
          />
          <Select
            size="small"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 110 }}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'duration_spike', label: '耗时飙升' },
              { value: 'failure_spike', label: '失败率飙升' },
              { value: 'flaky_pattern', label: '抖动模式' },
              { value: 'performance_degradation', label: '性能下降' },
              { value: 'success_rate_drop', label: '成功率下降' },
              { value: 'resource_anomaly', label: '资源异常' },
              { value: 'trend_change', label: '趋势变化' },
              { value: 'seasonal_deviation', label: '周期偏差' },
            ]}
          />
        </Space>
      }
    >
      {filteredAnomalies.length === 0 ? (
        <Empty description="暂无异常" />
      ) : (
        <List
          dataSource={filteredAnomalies}
          renderItem={(anomaly) => {
            const severityConfig = getSeverityConfig(anomaly.severity);
            const statusConfig = getStatusConfig(anomaly.status);

            return (
              <List.Item
                key={anomaly.id}
                className="anomaly-list-item"
                style={{
                  cursor: onSelect ? 'pointer' : 'default',
                  background: anomaly.status === 'new' ? '#fff7e6' : undefined,
                }}
                onClick={() => onSelect?.(anomaly)}
                actions={[
                  anomaly.status === 'new' && onAcknowledge && (
                    <Tooltip title="确认" key="ack">
                      <Button
                        type="text"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcknowledge(anomaly.id);
                        }}
                      />
                    </Tooltip>
                  ),
                  anomaly.status !== 'resolved' && onResolve && (
                    <Tooltip title="解决" key="resolve">
                      <Button
                        type="text"
                        size="small"
                        icon={
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(anomaly.id);
                        }}
                      />
                    </Tooltip>
                  ),
                  onSelect && (
                    <Tooltip title="详情" key="view">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(anomaly);
                        }}
                      />
                    </Tooltip>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  avatar={
                    <span style={{ color: severityConfig.color, fontSize: 20 }}>
                      {severityConfig.icon}
                    </span>
                  }
                  title={
                    <Space>
                      <Text strong>{getTypeLabel(anomaly.type)}</Text>
                      <Tag color={statusConfig.color} style={{ marginLeft: 8 }}>
                        {statusConfig.label}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">
                          {anomaly.metric}: {anomaly.currentValue.toFixed(2)}{' '}
                          (偏差: {anomaly.deviation > 0 ? '+' : ''}
                          {anomaly.deviation.toFixed(1)}%)
                        </Text>
                      </div>
                      <Space size="small" style={{ fontSize: 12 }}>
                        <Tag>{severityConfig.label}</Tag>
                        <Text type="secondary">
                          {formatTime(anomaly.detectedAt)}
                        </Text>
                      </Space>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}

export default AnomalyList;
