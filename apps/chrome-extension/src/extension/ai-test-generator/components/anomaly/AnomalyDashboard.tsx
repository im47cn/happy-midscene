/**
 * input: Anomaly data, health scores from storage
 * output: Unified dashboard for anomaly monitoring
 * pos: Main dashboard combining health scores, anomaly list, and trends
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import {
  AlertOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Tabs,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  alertTrigger,
  anomalyStorage,
  healthScorer,
} from '../../services/anomaly';
import type {
  Anomaly,
  AnomalyAlert,
  AnomalyWithAnalysis,
  HealthScore,
} from '../../types/anomaly';
import { AnomalyDetail } from './AnomalyDetail';
import { AnomalyList } from './AnomalyList';
import { HealthScorePanel } from './HealthScorePanel';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface AnomalyDashboardProps {
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onSettingsClick?: () => void;
}

interface DashboardStats {
  totalAnomalies: number;
  activeAnomalies: number;
  criticalCount: number;
  pendingAlerts: number;
  resolvedToday: number;
}

// ============================================================================
// Sub Components
// ============================================================================

function StatsOverview({
  stats,
  loading,
}: { stats: DashboardStats; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card>
          <Statistic
            title="活跃异常"
            value={stats.activeAnomalies}
            valueStyle={{
              color: stats.activeAnomalies > 0 ? '#cf1322' : '#3f8600',
            }}
            prefix={<AlertOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="严重/紧急"
            value={stats.criticalCount}
            valueStyle={{
              color: stats.criticalCount > 0 ? '#fa541c' : '#1890ff',
            }}
            prefix={<AlertOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待处理告警"
            value={stats.pendingAlerts}
            valueStyle={{
              color: stats.pendingAlerts > 0 ? '#faad14' : '#1890ff',
            }}
            prefix={<BellOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="今日已解决"
            value={stats.resolvedToday}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
}

function TrendMiniChart({ data, title }: { data: number[]; title: string }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text type="secondary">暂无数据</Text>
      </div>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 200;
  const height = 60;
  const padding = 4;

  const points = data
    .map((value, index) => {
      const x =
        padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y =
        height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  // Determine trend color
  const trendUp = data.length > 1 && data[data.length - 1] > data[0];
  const color = title.includes('健康')
    ? trendUp
      ? '#52c41a'
      : '#cf1322'
    : trendUp
      ? '#cf1322'
      : '#52c41a';

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Text>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        {/* Latest point marker */}
        {data.length > 0 && (
          <circle
            cx={width - padding}
            cy={
              height -
              padding -
              ((data[data.length - 1] - min) / range) * (height - 2 * padding)
            }
            r="3"
            fill={color}
          />
        )}
      </svg>
    </div>
  );
}

function AlertPanel({
  alerts,
  onAcknowledge,
  onAcknowledgeAll,
}: {
  alerts: AnomalyAlert[];
  onAcknowledge: (alertId: string) => void;
  onAcknowledgeAll: () => void;
}) {
  if (alerts.length === 0) {
    return (
      <Card title="待处理告警" size="small">
        <Empty
          description="暂无待处理告警"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <BellOutlined />
          <span>待处理告警</span>
          <Badge count={alerts.length} />
        </Space>
      }
      size="small"
      extra={
        <Button size="small" onClick={onAcknowledgeAll}>
          全部确认
        </Button>
      }
    >
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {alerts.slice(0, 10).map((alert) => (
          <div
            key={alert.id}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Space>
                <Badge
                  status={
                    alert.level === 'emergency'
                      ? 'error'
                      : alert.level === 'critical'
                        ? 'error'
                        : alert.level === 'warning'
                          ? 'warning'
                          : alert.level === 'info'
                            ? 'processing'
                            : 'default'
                  }
                />
                <Text ellipsis style={{ maxWidth: 200 }}>
                  {alert.message}
                </Text>
              </Space>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(alert.createdAt).toLocaleTimeString('zh-CN')}
                </Text>
              </div>
            </div>
            <Button
              size="small"
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={() => onAcknowledge(alert.id)}
            />
          </div>
        ))}
        {alerts.length > 10 && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Text type="secondary">还有 {alerts.length - 10} 条告警...</Text>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnomalyDashboard({
  autoRefresh = true,
  refreshInterval = 60000,
  onSettingsClick,
}: AnomalyDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalAnomalies: 0,
    activeAnomalies: 0,
    criticalCount: 0,
    pendingAlerts: 0,
    resolvedToday: 0,
  });
  const [selectedAnomaly, setSelectedAnomaly] =
    useState<AnomalyWithAnalysis | null>(null);
  const [healthHistory, setHealthHistory] = useState<number[]>([]);
  const [anomalyTrend, setAnomalyTrend] = useState<number[]>([]);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load anomalies
      const allAnomalies = await anomalyStorage.getAll();
      setAnomalies(allAnomalies);

      // Load health score
      const score = await healthScorer.getLatestScore();
      setHealthScore(score);

      // Load health history for trend
      const history = await healthScorer.getScoreHistory(7);
      setHealthHistory(history.map((h) => h.overall));

      // Load alerts
      const pendingAlerts = await alertTrigger.getPendingAlerts();
      setAlerts(pendingAlerts);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const activeAnomalies = allAnomalies.filter(
        (a: Anomaly) => a.status === 'new',
      );
      const criticalCount = activeAnomalies.filter(
        (a: Anomaly) => a.severity === 'critical' || a.severity === 'high',
      ).length;
      const resolvedToday = allAnomalies.filter(
        (a: Anomaly) =>
          a.status === 'resolved' && a.resolvedAt && a.resolvedAt >= todayStart,
      ).length;

      setStats({
        totalAnomalies: allAnomalies.length,
        activeAnomalies: activeAnomalies.length,
        criticalCount,
        pendingAlerts: pendingAlerts.length,
        resolvedToday,
      });

      // Calculate anomaly trend (count per day for last 7 days)
      const trend: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = todayStart - i * 24 * 60 * 60 * 1000;
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const count = allAnomalies.filter(
          (a: Anomaly) => a.detectedAt >= dayStart && a.detectedAt < dayEnd,
        ).length;
        trend.push(count);
      }
      setAnomalyTrend(trend);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(loadData, refreshInterval);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, loadData]);

  // Handlers
  const handleAcknowledge = async (anomalyId: string) => {
    try {
      const anomaly = anomalies.find((a) => a.id === anomalyId);
      if (anomaly) {
        await anomalyStorage.update({
          ...anomaly,
          status: 'acknowledged',
          acknowledgedAt: Date.now(),
        } as AnomalyWithAnalysis);
        message.success('异常已确认');
        loadData();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleResolve = async (anomalyId: string, resolution: string) => {
    try {
      const anomaly = anomalies.find((a) => a.id === anomalyId);
      if (anomaly) {
        await anomalyStorage.update({
          ...anomaly,
          status: 'resolved',
          resolvedAt: Date.now(),
          resolution,
        } as AnomalyWithAnalysis);
        message.success('异常已解决');
        setSelectedAnomaly(null);
        loadData();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleIgnore = async (anomalyId: string) => {
    try {
      const anomaly = anomalies.find((a) => a.id === anomalyId);
      if (anomaly) {
        // Since 'ignored' status doesn't exist, resolve with a note instead
        await anomalyStorage.update({
          ...anomaly,
          status: 'resolved',
          resolvedAt: Date.now(),
          resolution: '已忽略',
        } as AnomalyWithAnalysis);
        message.success('异常已忽略');
        setSelectedAnomaly(null);
        loadData();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAlertAcknowledge = async (alertId: string) => {
    try {
      await alertTrigger.acknowledgeAlert(alertId);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAlertAcknowledgeAll = async () => {
    try {
      const count = await alertTrigger.acknowledgeAll();
      message.success(`已确认 ${count} 条告警`);
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  return (
    <div className="anomaly-dashboard" style={{ padding: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <Space>
          <DashboardOutlined style={{ fontSize: 24 }} />
          <Title level={4} style={{ margin: 0 }}>
            异常监控仪表板
          </Title>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={loadData}
            disabled={loading}
          >
            刷新
          </Button>
          {onSettingsClick && (
            <Button icon={<SettingOutlined />} onClick={onSettingsClick}>
              设置
            </Button>
          )}
        </Space>
      </div>

      {/* Stats Overview */}
      <div style={{ marginBottom: 16 }}>
        <StatsOverview stats={stats} loading={loading} />
      </div>

      {/* Main Content */}
      <Row gutter={16}>
        {/* Left Column - Health Score & Alerts */}
        <Col span={8}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* Health Score */}
            {healthScore && (
              <HealthScorePanel score={healthScore} onRefresh={loadData} />
            )}

            {/* Mini Trends */}
            <Card title="趋势概览" size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <TrendMiniChart data={healthHistory} title="健康度趋势 (7天)" />
                <TrendMiniChart
                  data={anomalyTrend}
                  title="异常数量趋势 (7天)"
                />
              </Space>
            </Card>

            {/* Alerts */}
            <AlertPanel
              alerts={alerts}
              onAcknowledge={handleAlertAcknowledge}
              onAcknowledgeAll={handleAlertAcknowledgeAll}
            />
          </Space>
        </Col>

        {/* Right Column - Anomaly List */}
        <Col span={16}>
          <AnomalyList
            anomalies={anomalies}
            loading={loading}
            onSelect={(anomaly) =>
              setSelectedAnomaly(anomaly as AnomalyWithAnalysis)
            }
            onAcknowledge={handleAcknowledge}
            onResolve={(id) => {
              const anomaly = anomalies.find((a) => a.id === id);
              if (anomaly) {
                setSelectedAnomaly(anomaly as AnomalyWithAnalysis);
              }
            }}
          />
        </Col>
      </Row>

      {/* Detail Drawer */}
      <Drawer
        title="异常详情"
        placement="right"
        width={600}
        open={selectedAnomaly !== null}
        onClose={() => setSelectedAnomaly(null)}
        destroyOnClose
      >
        {selectedAnomaly && (
          <AnomalyDetail
            anomaly={selectedAnomaly}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
            onIgnore={handleIgnore}
            onClose={() => setSelectedAnomaly(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

export default AnomalyDashboard;
