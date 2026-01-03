/**
 * Healing Confirm Dialog Component
 * Shows healing result and asks for user confirmation
 */

import {
  AimOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { HealingResult } from '../types/healing';

const { Text, Title } = Typography;

interface HealingConfirmDialogProps {
  visible: boolean;
  healingResult: HealingResult | null;
  stepDescription: string;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
}

/**
 * Get confidence level info based on score
 */
function getConfidenceLevel(confidence: number): {
  color: string;
  status: 'success' | 'normal' | 'exception';
  label: string;
} {
  if (confidence >= 80) {
    return { color: 'green', status: 'success', label: '高' };
  }
  if (confidence >= 50) {
    return { color: 'orange', status: 'normal', label: '中' };
  }
  return { color: 'red', status: 'exception', label: '低' };
}

/**
 * Get strategy display info
 */
function getStrategyInfo(strategy: 'normal' | 'deepThink'): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (strategy === 'normal') {
    return {
      label: '标准模式',
      color: 'blue',
      icon: <AimOutlined />,
    };
  }
  return {
    label: '深度思考',
    color: 'purple',
    icon: <ThunderboltOutlined />,
  };
}

export function HealingConfirmDialog({
  visible,
  healingResult,
  stepDescription,
  onConfirm,
  onReject,
  onCancel,
}: HealingConfirmDialogProps) {
  if (!healingResult) {
    return null;
  }

  const confidenceLevel = getConfidenceLevel(healingResult.confidence);
  const strategyInfo = getStrategyInfo(healingResult.strategy);

  return (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>AI 自愈成功</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={520}
      footer={[
        <Button key="reject" onClick={onReject}>
          拒绝修复
        </Button>,
        <Button key="confirm" type="primary" onClick={onConfirm}>
          采用修复
        </Button>,
      ]}
    >
      <div className="healing-confirm-content">
        <Alert
          type="info"
          icon={<ExclamationCircleOutlined />}
          message="发现可能的元素匹配"
          description="AI 在页面上找到了一个与原始描述匹配的元素，请确认是否采用此修复。"
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Descriptions
          column={1}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label="原始步骤">
            <Text>{stepDescription}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="修复策略">
            <Tag icon={strategyInfo.icon} color={strategyInfo.color}>
              {strategyInfo.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="尝试次数">
            <Text>{healingResult.attemptsCount} 次</Text>
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            <Text>{(healingResult.timeCost / 1000).toFixed(2)} 秒</Text>
          </Descriptions.Item>
        </Descriptions>

        <div className="confidence-section" style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            置信度评估
          </Title>
          <Progress
            percent={healingResult.confidence}
            status={confidenceLevel.status}
            strokeColor={confidenceLevel.color}
            format={(percent) => (
              <span>
                {percent}%{' '}
                <Tag color={confidenceLevel.color}>{confidenceLevel.label}</Tag>
              </span>
            )}
          />

          <div className="confidence-factors" style={{ marginTop: 12 }}>
            <Space size="large">
              <div>
                <Text type="secondary">位置偏移：</Text>
                <Text strong>
                  {healingResult.confidenceFactors.distanceScore}%
                </Text>
              </div>
              <div>
                <Text type="secondary">尺寸变化：</Text>
                <Text strong>{healingResult.confidenceFactors.sizeScore}%</Text>
              </div>
              <div>
                <Text type="secondary">策略评分：</Text>
                <Text strong>
                  {healingResult.confidenceFactors.strategyScore}%
                </Text>
              </div>
            </Space>
          </div>
        </div>

        {healingResult.element && (
          <div className="element-info">
            <Text type="secondary">
              元素位置：({Math.round(healingResult.element.center[0])},{' '}
              {Math.round(healingResult.element.center[1])})
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
