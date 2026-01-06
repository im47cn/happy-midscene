/**
 * Recommendation Card Component
 * Displays a single optimization recommendation
 */

import {
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Card, Collapse, Space, Steps, Tag, Typography } from 'antd';
import { useState } from 'react';

import { recommendEngine } from '../../services/optimization';
import type {
  Priority,
  Recommendation,
  RecommendationType,
} from '../../types/optimization';
import {
  EFFORT_LABELS,
  PRIORITY_LABELS,
  RECOMMENDATION_TYPE_LABELS,
} from '../../types/optimization';

const { Text, Paragraph } = Typography;

const priorityColors: Record<Priority, string> = {
  critical: '#ff4d4f',
  high: '#fa8c16',
  medium: '#faad14',
  low: '#52c41a',
};

const typeIcons: Record<RecommendationType, React.ReactNode> = {
  efficiency: <ThunderboltOutlined />,
  redundancy: <ClockCircleOutlined />,
  coverage: <BulbOutlined />,
  stability: <CheckCircleOutlined />,
  maintainability: <BulbOutlined />,
  priority: <ClockCircleOutlined />,
  resource: <ThunderboltOutlined />,
};

interface RecommendationCardProps {
  recommendation: Recommendation;
  onAdopt?: (adopted: boolean) => void;
}

export function RecommendationCard({
  recommendation,
  onAdopt,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [adopting, setAdopting] = useState(false);

  const handleAdopt = async (adopted: boolean) => {
    setAdopting(true);
    try {
      await recommendEngine.trackAdoption(recommendation.id, adopted);
      onAdopt?.(adopted);
    } finally {
      setAdopting(false);
    }
  };

  return (
    <Card
      size="small"
      className="recommendation-card"
      style={{
        borderLeft: `4px solid ${priorityColors[recommendation.priority]}`,
      }}
    >
      <div className="recommendation-header">
        <Space wrap>
          <Tag color={priorityColors[recommendation.priority]}>
            {PRIORITY_LABELS[recommendation.priority]}
          </Tag>
          <Tag icon={typeIcons[recommendation.type]}>
            {RECOMMENDATION_TYPE_LABELS[recommendation.type]}
          </Tag>
          <Tag color="default">{EFFORT_LABELS[recommendation.effort]}</Tag>
        </Space>
      </div>

      <div style={{ marginTop: 8 }}>
        <Text strong style={{ fontSize: 15 }}>
          {recommendation.title}
        </Text>
      </div>

      <Paragraph
        type="secondary"
        style={{ marginTop: 8, marginBottom: 8 }}
        ellipsis={{ rows: 2, expandable: true }}
      >
        {recommendation.description}
      </Paragraph>

      {recommendation.impact.description && (
        <div
          style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 4,
            padding: '8px 12px',
            marginBottom: 12,
          }}
        >
          <Text type="success" style={{ fontSize: 13 }}>
            💡 {recommendation.impact.description}
          </Text>
        </div>
      )}

      <Collapse
        ghost
        size="small"
        activeKey={expanded ? ['actions'] : []}
        onChange={() => setExpanded(!expanded)}
        items={[
          {
            key: 'actions',
            label: `行动项 (${recommendation.actionItems.length})`,
            children: (
              <Steps
                direction="vertical"
                size="small"
                current={-1}
                items={recommendation.actionItems.map((item) => ({
                  title: item.action,
                  description: item.details,
                }))}
              />
            ),
          },
        ]}
      />

      {recommendation.relatedCases.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          影响 {recommendation.relatedCases.length} 个测试用例
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Space>
          <Button
            size="small"
            type="default"
            onClick={() => handleAdopt(false)}
            loading={adopting}
          >
            暂不处理
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={() => handleAdopt(true)}
            loading={adopting}
          >
            已采纳
          </Button>
        </Space>
      </div>
    </Card>
  );
}
