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
import { useI18n } from '../../../i18n';
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
function getConfidenceLevel(
  confidence: number,
  t: (key: string) => string,
): {
  color: string;
  status: 'success' | 'normal' | 'exception';
  label: string;
} {
  if (confidence >= 80) {
    return { color: 'green', status: 'success', label: t('high') };
  }
  if (confidence >= 50) {
    return { color: 'orange', status: 'normal', label: t('medium') };
  }
  return { color: 'red', status: 'exception', label: t('low') };
}

/**
 * Get strategy display info
 */
function getStrategyInfo(
  strategy: 'normal' | 'deepThink',
  t: (key: string) => string,
): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  if (strategy === 'normal') {
    return {
      label: t('normalMode'),
      color: 'blue',
      icon: <AimOutlined />,
    };
  }
  return {
    label: t('deepThink'),
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
  const { t } = useI18n();

  if (!healingResult) {
    return null;
  }

  const confidenceLevel = getConfidenceLevel(healingResult.confidence, t);
  const strategyInfo = getStrategyInfo(healingResult.strategy, t);

  return (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>{t('aiHealingSuccess')}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={520}
      footer={[
        <Button key="reject" onClick={onReject}>
          {t('rejectFix')}
        </Button>,
        <Button key="confirm" type="primary" onClick={onConfirm}>
          {t('acceptFix')}
        </Button>,
      ]}
    >
      <div className="healing-confirm-content">
        <Alert
          type="info"
          icon={<ExclamationCircleOutlined />}
          message={t('possibleElementMatch')}
          description={t('aiFoundMatchingElement')}
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Descriptions
          column={1}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        >
          <Descriptions.Item label={t('originalStep')}>
            <Text>{stepDescription}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('healingStrategy')}>
            <Tag icon={strategyInfo.icon} color={strategyInfo.color}>
              {strategyInfo.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('attempts')}>
            <Text>
              {healingResult.attemptsCount} {t('times')}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('timeCost')}>
            <Text>
              {(healingResult.timeCost / 1000).toFixed(2)} {t('seconds')}
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <div className="confidence-section" style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            {t('confidenceAssessment')}
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
                <Text type="secondary">{t('positionOffset')}：</Text>
                <Text strong>
                  {healingResult.confidenceFactors.distanceScore}%
                </Text>
              </div>
              <div>
                <Text type="secondary">{t('sizeChange')}：</Text>
                <Text strong>{healingResult.confidenceFactors.sizeScore}%</Text>
              </div>
              <div>
                <Text type="secondary">{t('strategyScore')}：</Text>
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
              {t('elementPosition')}：(
              {Math.round(healingResult.element.center[0])},{' '}
              {Math.round(healingResult.element.center[1])})
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
