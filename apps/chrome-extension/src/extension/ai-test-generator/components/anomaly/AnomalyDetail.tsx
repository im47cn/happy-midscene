/**
 * input: Single Anomaly object with root causes and suggestions
 * output: Detailed anomaly view with actions
 * pos: Anomaly detail panel for inspection and resolution
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import {
  AlertOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  EyeInvisibleOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  RollbackOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Input,
  List,
  Progress,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';
import type {
  AnomalyWithAnalysis,
  AnomalyStatus,
  AnomalyType,
  Evidence,
  RootCause,
  RootCauseCategory,
  Severity,
  Suggestion,
} from '../../types/anomaly';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

interface AnomalyDetailProps {
  anomaly: AnomalyWithAnalysis;
  onAcknowledge?: (anomalyId: string) => void;
  onResolve?: (anomalyId: string, resolution: string) => void;
  onIgnore?: (anomalyId: string) => void;
  onClose?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityConfig(severity: Severity): { color: string; icon: React.ReactNode; label: string } {
  switch (severity) {
    case 'critical':
      return { color: '#ff4d4f', icon: <AlertOutlined />, label: '严重' };
    case 'high':
      return { color: '#fa541c', icon: <ExclamationCircleOutlined />, label: '高' };
    case 'medium':
      return { color: '#faad14', icon: <WarningOutlined />, label: '中' };
    case 'low':
    default:
      return { color: '#1890ff', icon: <ClockCircleOutlined />, label: '低' };
  }
}

function getStatusConfig(status: AnomalyStatus): { color: string; label: string } {
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

function getCategoryLabel(category: RootCauseCategory): string {
  const labels: Record<RootCauseCategory, string> = {
    locator_change: '元素定位变更',
    timing_issue: '时序问题',
    environment_change: '环境变更',
    code_change: '代码变更',
    data_issue: '数据问题',
    network_issue: '网络问题',
    resource_constraint: '资源约束',
  };
  return labels[category] || category;
}

function getEffortLabel(effort: 'low' | 'medium' | 'high'): { color: string; label: string } {
  switch (effort) {
    case 'low':
      return { color: 'green', label: '低' };
    case 'medium':
      return { color: 'orange', label: '中' };
    case 'high':
      return { color: 'red', label: '高' };
    default:
      return { color: 'default', label: effort };
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function formatDuration(start: number, end: number): string {
  const diff = end - start;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天${hours % 24}小时`;
  if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
  return `${minutes}分钟`;
}

// ============================================================================
// Sub Components
// ============================================================================

function RootCauseCard({ rootCause, index }: { rootCause: RootCause; index: number }) {
  return (
    <Card
      size="small"
      title={
        <Space>
          <Badge count={index + 1} style={{ backgroundColor: '#1890ff' }} />
          <Text strong>{getCategoryLabel(rootCause.category)}</Text>
          <Tag color={rootCause.confidence >= 70 ? 'green' : rootCause.confidence >= 40 ? 'orange' : 'default'}>
            置信度 {rootCause.confidence}%
          </Tag>
        </Space>
      }
      style={{ marginBottom: 12 }}
    >
      <Paragraph>{rootCause.description}</Paragraph>

      {rootCause.evidence.length > 0 && (
        <>
          <Divider orientation="left" plain style={{ margin: '8px 0' }}>
            <FileSearchOutlined /> 证据
          </Divider>
          <List
            size="small"
            dataSource={rootCause.evidence}
            renderItem={(evidence: Evidence) => (
              <List.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Tag>{evidence.type}</Tag>
                    <Text type="secondary">权重: {evidence.weight.toFixed(2)}</Text>
                  </Space>
                  <Text>{evidence.description}</Text>
                </Space>
              </List.Item>
            )}
          />
        </>
      )}

      {rootCause.suggestions.length > 0 && (
        <>
          <Divider orientation="left" plain style={{ margin: '8px 0' }}>
            <BulbOutlined /> 建议
          </Divider>
          <List
            size="small"
            dataSource={rootCause.suggestions.sort((a, b) => a.priority - b.priority)}
            renderItem={(suggestion: Suggestion, idx) => {
              const effort = getEffortLabel(suggestion.effort);
              return (
                <List.Item>
                  <Space>
                    <Badge count={idx + 1} size="small" />
                    <Text>{suggestion.action}</Text>
                    <Tooltip title="实施难度">
                      <Tag color={effort.color}>{effort.label}</Tag>
                    </Tooltip>
                  </Space>
                </List.Item>
              );
            }}
          />
        </>
      )}
    </Card>
  );
}

function StatusTimeline({ anomaly }: { anomaly: AnomalyWithAnalysis }) {
  const items = [
    {
      color: 'red',
      children: (
        <div>
          <Text strong>检测到异常</Text>
          <br />
          <Text type="secondary">{formatTime(anomaly.detectedAt)}</Text>
        </div>
      ),
    },
  ];

  if (anomaly.acknowledgedAt) {
    items.push({
      color: 'orange',
      children: (
        <div>
          <Text strong>已确认</Text>
          {anomaly.acknowledgedBy && <Text type="secondary"> by {anomaly.acknowledgedBy}</Text>}
          <br />
          <Text type="secondary">{formatTime(anomaly.acknowledgedAt)}</Text>
        </div>
      ),
    });
  }

  if (anomaly.resolvedAt) {
    items.push({
      color: 'green',
      children: (
        <div>
          <Text strong>已解决</Text>
          <br />
          <Text type="secondary">{formatTime(anomaly.resolvedAt)}</Text>
          {anomaly.resolution && (
            <>
              <br />
              <Text>{anomaly.resolution}</Text>
            </>
          )}
        </div>
      ),
    });
  }

  return <Timeline items={items} />;
}

// ============================================================================
// Main Component
// ============================================================================

export function AnomalyDetail({
  anomaly,
  onAcknowledge,
  onResolve,
  onIgnore,
  onClose,
}: AnomalyDetailProps) {
  const [resolution, setResolution] = useState('');
  const [showResolveInput, setShowResolveInput] = useState(false);

  const severityConfig = getSeverityConfig(anomaly.severity);
  const statusConfig = getStatusConfig(anomaly.status);

  const handleResolve = () => {
    if (resolution.trim()) {
      onResolve?.(anomaly.id, resolution.trim());
      setShowResolveInput(false);
      setResolution('');
    }
  };

  return (
    <Card
      className="anomaly-detail"
      title={
        <Space>
          <span style={{ color: severityConfig.color, fontSize: 20 }}>
            {severityConfig.icon}
          </span>
          <span>{getTypeLabel(anomaly.type)}</span>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </Space>
      }
      extra={
        onClose && (
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        )
      }
    >
      {/* Overview Statistics */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <Statistic
          title="当前值"
          value={anomaly.currentValue}
          valueStyle={{ color: severityConfig.color }}
        />
        <Statistic
          title="期望值"
          value={anomaly.expectedValue}
          precision={2}
        />
        <Statistic
          title="偏差"
          value={anomaly.deviationInfo?.percentageDeviation ?? anomaly.deviation}
          suffix={anomaly.deviationInfo ? '%' : ''}
          valueStyle={{
            color: anomaly.deviation > 0 ? '#cf1322' : '#3f8600',
          }}
          prefix={anomaly.deviation > 0 ? '+' : ''}
        />
        {anomaly.deviationInfo?.zScore !== undefined && (
          <Statistic
            title="Z-Score"
            value={Math.abs(anomaly.deviationInfo.zScore)}
            precision={2}
          />
        )}
      </div>

      {/* Metric Details */}
      <Collapse
        defaultActiveKey={['metric', 'rootCauses']}
        items={[
          {
            key: 'metric',
            label: '指标详情',
            children: (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="指标名称">{anomaly.metric}</Descriptions.Item>
                <Descriptions.Item label="检测时间">{formatTime(anomaly.detectedAt)}</Descriptions.Item>
                {anomaly.baseline && (
                  <>
                    <Descriptions.Item label="基线周期">{anomaly.baseline.period}</Descriptions.Item>
                    <Descriptions.Item label="样本数量">{anomaly.baseline.sampleCount}</Descriptions.Item>
                    <Descriptions.Item label="基线范围">
                      {anomaly.baseline.min.toFixed(2)} - {anomaly.baseline.max.toFixed(2)}
                    </Descriptions.Item>
                    <Descriptions.Item label="标准差">
                      ±{anomaly.baseline.stdDev.toFixed(2)}
                    </Descriptions.Item>
                  </>
                )}
                {anomaly.caseName && (
                  <Descriptions.Item label="关联用例">{anomaly.caseName}</Descriptions.Item>
                )}
              </Descriptions>
            ),
          },
          ...(anomaly.impact ? [{
            key: 'impact',
            label: (
              <Space>
                影响范围
                <Tag color={
                  anomaly.impact.estimatedScope === 'high' ? 'red' :
                  anomaly.impact.estimatedScope === 'medium' ? 'orange' : 'green'
                }>
                  {anomaly.impact.estimatedScope === 'high' ? '高' :
                   anomaly.impact.estimatedScope === 'medium' ? '中' : '低'}
                </Tag>
              </Space>
            ),
            children: (
              <div>
                {anomaly.impact.affectedCases.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>受影响用例 ({anomaly.impact.affectedCases.length})</Text>
                    <div style={{ marginTop: 8 }}>
                      {anomaly.impact.affectedCases.slice(0, 5).map((caseId: string) => (
                        <Tag key={caseId} style={{ marginBottom: 4 }}>{caseId}</Tag>
                      ))}
                      {anomaly.impact.affectedCases.length > 5 && (
                        <Tag>+{anomaly.impact.affectedCases.length - 5} 更多</Tag>
                      )}
                    </div>
                  </div>
                )}
                {anomaly.impact.affectedFeatures.length > 0 && (
                  <div>
                    <Text strong>受影响功能 ({anomaly.impact.affectedFeatures.length})</Text>
                    <div style={{ marginTop: 8 }}>
                      {anomaly.impact.affectedFeatures.map((feature: string) => (
                        <Tag key={feature} color="blue" style={{ marginBottom: 4 }}>{feature}</Tag>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ),
          }] : []),
          {
            key: 'rootCauses',
            label: (
              <Space>
                根因分析
                <Badge count={anomaly.rootCauses?.length ?? 0} style={{ backgroundColor: '#1890ff' }} />
              </Space>
            ),
            children: (anomaly.rootCauses?.length ?? 0) > 0 ? (
              <div>
                {anomaly.rootCauses!
                  .sort((a: RootCause, b: RootCause) => b.confidence - a.confidence)
                  .map((cause: RootCause, idx: number) => (
                    <RootCauseCard key={cause.id} rootCause={cause} index={idx} />
                  ))}
              </div>
            ) : (
              <Text type="secondary">暂无根因分析结果</Text>
            ),
          },
          {
            key: 'timeline',
            label: (
              <Space>
                <HistoryOutlined /> 处理时间线
              </Space>
            ),
            children: <StatusTimeline anomaly={anomaly} />,
          },
        ]}
      />

      {/* Action Buttons */}
      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space direction="vertical" style={{ flex: 1 }}>
          {showResolveInput && (
            <div style={{ marginBottom: 12 }}>
              <TextArea
                placeholder="请输入解决方案描述..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
                style={{ marginBottom: 8 }}
              />
              <Space>
                <Button type="primary" onClick={handleResolve} disabled={!resolution.trim()}>
                  确认解决
                </Button>
                <Button onClick={() => setShowResolveInput(false)}>取消</Button>
              </Space>
            </div>
          )}
        </Space>

        <Space>
          {anomaly.status === 'new' && onAcknowledge && (
            <Button
              icon={<CheckCircleOutlined />}
              onClick={() => onAcknowledge(anomaly.id)}
            >
              确认
            </Button>
          )}
          {anomaly.status !== 'resolved' && onResolve && !showResolveInput && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => setShowResolveInput(true)}
            >
              解决
            </Button>
          )}
          {anomaly.status !== 'resolved' && onIgnore && (
            <Button
              icon={<EyeInvisibleOutlined />}
              onClick={() => onIgnore(anomaly.id)}
            >
              忽略
            </Button>
          )}
        </Space>
      </div>

      {/* Duration Info */}
      {anomaly.status === 'resolved' && anomaly.resolvedAt && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            处理耗时: {formatDuration(anomaly.detectedAt, anomaly.resolvedAt)}
          </Text>
        </div>
      )}
    </Card>
  );
}

export default AnomalyDetail;
