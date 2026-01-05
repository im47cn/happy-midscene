/**
 * Healing Statistics Panel Component
 * Displays self-healing performance metrics and analytics
 */

import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PercentageOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Card, Col, Empty, Progress, Row, Statistic, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import { healingEngine } from '../services/healing';
import type { HealingStatistics } from '../types/healing';

const { Title } = Typography;

interface UnstableElement {
  stepId: string;
  description: string;
  healingCount: number;
  key: string;
}

export function HealingStatistics() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<HealingStatistics | null>(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const stats = await healingEngine.getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load healing statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card loading={loading}>
        <div style={{ height: 300 }} />
      </Card>
    );
  }

  if (!statistics || statistics.totalAttempts === 0) {
    return (
      <Card>
        <Empty description={t('healing.noData')} />
      </Card>
    );
  }

  // Prepare unstable elements data for table
  const unstableElements: UnstableElement[] = statistics.unstableElements.map(
    (el, index) => ({
      ...el,
      key: `${el.stepId}-${index}`,
    }),
  );

  const columns: ColumnsType<UnstableElement> = [
    {
      title: t('healing.rank'),
      dataIndex: 'key',
      key: 'rank',
      width: 60,
      render: (_text, _record, index) => index + 1,
    },
    {
      title: t('healing.element'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('healing.healingCount'),
      dataIndex: 'healingCount',
      key: 'healingCount',
      width: 120,
      sorter: (a, b) => a.healingCount - b.healingCount,
      render: (count) => (
        <span
          style={{
            color: count > 5 ? '#ff4d4f' : count > 2 ? '#faad14' : '#52c41a',
          }}
        >
          {count} {t('healing.times')}
        </span>
      ),
    },
  ];

  // Calculate strategy percentages
  const totalSuccess = statistics.normalSuccessCount + statistics.deepThinkSuccessCount;
  const normalPercent =
    totalSuccess > 0
      ? Math.round((statistics.normalSuccessCount / totalSuccess) * 100)
      : 0;
  const deepThinkPercent =
    totalSuccess > 0
      ? Math.round((statistics.deepThinkSuccessCount / totalSuccess) * 100)
      : 0;

  return (
    <div className="healing-statistics">
      {/* Overview Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('healing.totalAttempts')}
              value={statistics.totalAttempts}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('healing.successRate')}
              value={statistics.successRate}
              suffix="%"
              prefix={<PercentageOutlined />}
              valueStyle={{
                color:
                  statistics.successRate >= 80
                    ? '#52c41a'
                    : statistics.successRate >= 50
                      ? '#faad14'
                      : '#ff4d4f',
              }}
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('healing.avgConfidence')}
              value={statistics.averageConfidence}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color:
                  statistics.averageConfidence >= 80
                    ? '#52c41a'
                    : statistics.averageConfidence >= 50
                      ? '#faad14'
                      : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('healing.avgTimeCost')}
              value={statistics.averageTimeCost}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Strategy Breakdown */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card
            title={
              <span>
                <ThunderboltOutlined style={{ marginRight: 8 }} />
                {t('healing.strategyBreakdown')}
              </span>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span>{t('healing.normalMode')}</span>
                <span>
                  {statistics.normalSuccessCount} / {totalSuccess} ({normalPercent}%)
                </span>
              </div>
              <Progress
                percent={normalPercent}
                strokeColor="#1890ff"
                showInfo={false}
              />
            </div>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span>{t('healing.deepThink')}</span>
                <span>
                  {statistics.deepThinkSuccessCount} / {totalSuccess} ({deepThinkPercent}%)
                </span>
              </div>
              <Progress
                percent={deepThinkPercent}
                strokeColor="#722ed1"
                showInfo={false}
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card
            title={
              <span>
                <BarChartOutlined style={{ marginRight: 8 }} />
                {t('healing.outcomeBreakdown')}
              </span>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span>{t('healing.success')}</span>
                <span>
                  {statistics.successCount} / {statistics.totalAttempts}
                </span>
              </div>
              <Progress
                percent={
                  statistics.totalAttempts > 0
                    ? (statistics.successCount / statistics.totalAttempts) * 100
                    : 0
                }
                strokeColor="#52c41a"
                showInfo={false}
              />
            </div>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <span>{t('healing.failure')}</span>
                <span>
                  {statistics.failureCount} / {statistics.totalAttempts}
                </span>
              </div>
              <Progress
                percent={
                  statistics.totalAttempts > 0
                    ? (statistics.failureCount / statistics.totalAttempts) * 100
                    : 0
                }
                strokeColor="#ff4d4f"
                showInfo={false}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Unstable Elements */}
      {unstableElements.length > 0 && (
        <Card
          title={
            <span>
              <BarChartOutlined style={{ marginRight: 8 }} />
              {t('healing.unstableElements')}
            </span>
          }
        >
          <Table
            columns={columns}
            dataSource={unstableElements}
            pagination={false}
            size="small"
          />
        </Card>
      )}
    </div>
  );
}

export default HealingStatistics;
