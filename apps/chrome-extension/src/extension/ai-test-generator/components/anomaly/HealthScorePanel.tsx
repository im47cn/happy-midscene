/**
 * input: Health score data from healthScorer service
 * output: Visual health score panel with dimensions breakdown
 * pos: Health score visualization component
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Card, Progress, Space, Tag, Tooltip, Typography, Spin, Empty } from 'antd';
import type { HealthScore, HealthDimension, TrendDirection } from '../../types/anomaly';

const { Text, Title } = Typography;

// ============================================================================
// Types
// ============================================================================

interface HealthScorePanelProps {
  score: HealthScore | null;
  loading?: boolean;
  onRefresh?: () => void;
}

interface DimensionCardProps {
  dimension: HealthDimension;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 90) return '#52c41a'; // Excellent - green
  if (score >= 75) return '#73d13d'; // Good - light green
  if (score >= 60) return '#faad14'; // Fair - yellow
  if (score >= 40) return '#ff7a45'; // Poor - orange
  return '#ff4d4f'; // Critical - red
}

function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: '优秀', color: '#52c41a' };
  if (score >= 75) return { label: '良好', color: '#73d13d' };
  if (score >= 60) return { label: '一般', color: '#faad14' };
  if (score >= 40) return { label: '较差', color: '#ff7a45' };
  return { label: '危险', color: '#ff4d4f' };
}

function getTrendIcon(trend: TrendDirection) {
  switch (trend) {
    case 'improving':
      return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
    case 'declining':
      return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
    default:
      return <MinusOutlined style={{ color: '#999' }} />;
  }
}

function getTrendText(trend: TrendDirection): string {
  switch (trend) {
    case 'improving':
      return '上升趋势';
    case 'declining':
      return '下降趋势';
    default:
      return '保持稳定';
  }
}

function getImpactIcon(impact: 'positive' | 'neutral' | 'negative') {
  switch (impact) {
    case 'positive':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'negative':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    default:
      return <InfoCircleOutlined style={{ color: '#999' }} />;
  }
}

function getDimensionIcon(name: string) {
  switch (name) {
    case 'Reliability':
      return <CheckCircleOutlined />;
    case 'Stability':
      return <MinusOutlined />;
    case 'Efficiency':
      return <ArrowUpOutlined />;
    case 'Coverage':
      return <InfoCircleOutlined />;
    default:
      return <InfoCircleOutlined />;
  }
}

function translateDimensionName(name: string): string {
  switch (name) {
    case 'Reliability':
      return '可靠性';
    case 'Stability':
      return '稳定性';
    case 'Efficiency':
      return '效率';
    case 'Coverage':
      return '覆盖率';
    default:
      return name;
  }
}

// ============================================================================
// Dimension Card Component
// ============================================================================

function DimensionCard({ dimension }: DimensionCardProps) {
  const scoreColor = getScoreColor(dimension.score);

  return (
    <Card
      size="small"
      className="dimension-card"
      style={{ marginBottom: 8 }}
    >
      <div className="dimension-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space>
          {getDimensionIcon(dimension.name)}
          <Text strong>{translateDimensionName(dimension.name)}</Text>
        </Space>
        <Text style={{ color: scoreColor, fontWeight: 600, fontSize: 18 }}>
          {dimension.score}
        </Text>
      </div>

      <Progress
        percent={dimension.score}
        showInfo={false}
        strokeColor={scoreColor}
        size="small"
        style={{ marginBottom: 8 }}
      />

      <div className="dimension-factors">
        {dimension.factors.map((factor, index) => (
          <div
            key={`${factor.name}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              color: '#666',
              padding: '2px 0',
            }}
          >
            <Space size={4}>
              {getImpactIcon(factor.impact)}
              <span>{factor.name}</span>
            </Space>
            <span>{typeof factor.value === 'number' ? factor.value.toFixed(1) : factor.value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 4, fontSize: 11, color: '#999' }}>
        权重: {(dimension.weight * 100).toFixed(0)}%
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HealthScorePanel({ score, loading = false, onRefresh }: HealthScorePanelProps) {
  if (loading) {
    return (
      <Card className="health-score-panel" title="健康评分">
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#999' }}>加载中...</div>
        </div>
      </Card>
    );
  }

  if (!score) {
    return (
      <Card className="health-score-panel" title="健康评分">
        <Empty description="暂无健康评分数据" />
      </Card>
    );
  }

  const scoreLevel = getScoreLevel(score.overall);
  const scoreColor = getScoreColor(score.overall);

  return (
    <Card
      className="health-score-panel"
      title="健康评分"
      extra={
        <Space>
          <Tag color={scoreLevel.color}>{scoreLevel.label}</Tag>
          {onRefresh && (
            <Tooltip title="刷新">
              <a onClick={onRefresh}>刷新</a>
            </Tooltip>
          )}
        </Space>
      }
    >
      {/* Overall Score */}
      <div className="overall-score" style={{ textAlign: 'center', marginBottom: 24 }}>
        <Progress
          type="dashboard"
          percent={score.overall}
          strokeColor={scoreColor}
          format={(percent) => (
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scoreColor }}>{percent}</div>
              <div style={{ fontSize: 12, color: '#666' }}>总分</div>
            </div>
          )}
        />

        <div className="trend-info" style={{ marginTop: 12 }}>
          <Space>
            {getTrendIcon(score.trend)}
            <Text type="secondary">{getTrendText(score.trend)}</Text>
          </Space>
        </div>

        {/* Comparison */}
        <div className="comparison" style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
            <span>
              上周: <Text strong>{score.comparedTo.lastWeek || '-'}</Text>
            </span>
            <span>
              上月: <Text strong>{score.comparedTo.lastMonth || '-'}</Text>
            </span>
          </Space>
        </div>
      </div>

      {/* Dimensions */}
      <div className="dimensions" style={{ marginBottom: 16 }}>
        <Title level={5} style={{ marginBottom: 12 }}>维度评分</Title>
        {score.dimensions.map((dimension, index) => (
          <DimensionCard key={`${dimension.name}-${index}`} dimension={dimension} />
        ))}
      </div>

      {/* Recommendations */}
      {score.recommendations.length > 0 && (
        <div className="recommendations">
          <Title level={5} style={{ marginBottom: 8 }}>
            <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
            改进建议
          </Title>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {score.recommendations.map((rec, index) => (
              <li key={index} style={{ color: '#666', marginBottom: 4, fontSize: 13 }}>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      <div style={{ marginTop: 16, fontSize: 11, color: '#999', textAlign: 'right' }}>
        计算时间: {new Date(score.calculatedAt).toLocaleString()}
      </div>
    </Card>
  );
}

export default HealthScorePanel;
