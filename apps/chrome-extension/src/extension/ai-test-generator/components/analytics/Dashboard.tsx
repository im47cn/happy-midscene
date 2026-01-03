/**
 * Analytics Dashboard Component
 * Main dashboard view for execution analytics
 */

import {
  ArrowLeftOutlined,
  BarChartOutlined,
  BellOutlined,
  ReloadOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  DatePicker,
  Radio,
  Space,
  Tabs,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import {
  alertManager,
  analysisEngine,
  failureAnalyzer,
} from '../../services/analytics';
import type { FailurePattern } from '../../services/analytics/failureAnalyzer';
import type {
  CaseStats,
  DashboardOverview,
  TimeRange,
} from '../../types/analytics';
import { AlertSettings } from './AlertSettings';
import { CaseList, CaseSummary } from './CaseList';
import { FailurePatterns, FailureTypePie, HotspotsList } from './FailureCharts';
import { HealthScoreCard, KPICard } from './KPICard';
import { DurationChart, PassRateChart, TrendChart } from './TrendChart';

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface DashboardProps {
  onBack: () => void;
  onSettings?: () => void;
}

type TabKey = 'overview' | 'cases' | 'failures' | 'alerts';

export function Dashboard({ onBack, onSettings }: DashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [caseStats, setCaseStats] = useState<CaseStats[]>([]);
  const [patterns, setPatterns] = useState<FailurePattern[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateRange =
        timeRange === 'custom' && customRange
          ? {
              startDate: customRange[0].format('YYYY-MM-DD'),
              endDate: customRange[1].format('YYYY-MM-DD'),
            }
          : undefined;

      const [overviewData, cases, failurePatterns, alertCount] =
        await Promise.all([
          analysisEngine.getDashboardOverview(timeRange, dateRange),
          analysisEngine.getCaseStatsSorted('lastRun', false),
          failureAnalyzer.detectPatterns(),
          alertManager.getUnacknowledgedCount(),
        ]);

      setOverview(overviewData);
      setCaseStats(cases);
      setPatterns(failurePatterns);
      setUnacknowledgedAlerts(alertCount);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      message.error('加载分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange, customRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTimeRangeChange = (value: TimeRange) => {
    setTimeRange(value);
    if (value !== 'custom') {
      setCustomRange(null);
    }
  };

  const handleCustomRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null,
  ) => {
    if (dates && dates[0] && dates[1]) {
      setCustomRange([dates[0], dates[1]]);
      setTimeRange('custom');
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const renderOverviewTab = () => (
    <div className="dashboard-overview">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard
          title="执行次数"
          value={overview?.totalExecutions || 0}
          loading={loading}
          tooltip="所选时间范围内的总执行次数"
        />
        <KPICard
          title="通过率"
          value={overview?.passRate.toFixed(1) || '0'}
          suffix="%"
          trend={overview?.passRateTrend}
          trendSuffix="%"
          loading={loading}
          valueStyle={{
            color:
              (overview?.passRate || 0) >= 80
                ? '#52c41a'
                : (overview?.passRate || 0) >= 50
                  ? '#faad14'
                  : '#ff4d4f',
          }}
          tooltip="测试通过率及与上一周期相比的变化"
        />
        <KPICard
          title="平均耗时"
          value={formatDuration(overview?.avgDuration || 0)}
          trend={overview?.avgDurationTrend}
          trendSuffix="%"
          loading={loading}
          tooltip="平均执行时长及与上一周期相比的变化"
        />
        <HealthScoreCard
          score={overview?.healthScore.overall || 0}
          trend={overview?.healthScore.trend || 'stable'}
          loading={loading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="charts-row">
        <div className="chart-col chart-col-2">
          <TrendChart data={overview?.dailyStats || []} loading={loading} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-row">
        <div className="chart-col">
          <PassRateChart data={overview?.dailyStats || []} loading={loading} />
        </div>
        <div className="chart-col">
          <DurationChart data={overview?.dailyStats || []} loading={loading} />
        </div>
      </div>

      {/* Failure Analysis */}
      <div className="charts-row">
        <div className="chart-col">
          <FailureTypePie
            data={
              overview?.failuresByType || {
                locator_failed: 0,
                assertion_failed: 0,
                timeout: 0,
                network_error: 0,
                script_error: 0,
                unknown: 0,
              }
            }
            loading={loading}
          />
        </div>
        <div className="chart-col">
          <HotspotsList data={overview?.hotspots || []} loading={loading} />
        </div>
      </div>

      {/* Patterns and Case Summary */}
      <div className="charts-row">
        <div className="chart-col">
          <FailurePatterns patterns={patterns} loading={loading} />
        </div>
        <div className="chart-col">
          <CaseSummary
            totalCases={overview?.totalCases || 0}
            stableCases={overview?.stableCases || 0}
            flakyCases={overview?.flakyCases || 0}
            unstableCases={overview?.unstableCases || 0}
          />
        </div>
      </div>
    </div>
  );

  const renderCasesTab = () => (
    <div className="dashboard-cases">
      <CaseList data={caseStats} loading={loading} />
    </div>
  );

  const renderFailuresTab = () => (
    <div className="dashboard-failures">
      <div className="charts-row">
        <div className="chart-col chart-col-2">
          <FailureTypePie
            data={
              overview?.failuresByType || {
                locator_failed: 0,
                assertion_failed: 0,
                timeout: 0,
                network_error: 0,
                script_error: 0,
                unknown: 0,
              }
            }
            loading={loading}
            height={280}
          />
        </div>
      </div>
      <div className="charts-row">
        <div className="chart-col">
          <HotspotsList
            data={overview?.hotspots || []}
            loading={loading}
            maxItems={10}
          />
        </div>
        <div className="chart-col">
          <FailurePatterns patterns={patterns} loading={loading} />
        </div>
      </div>
    </div>
  );

  const renderAlertsTab = () => (
    <div className="dashboard-alerts">
      <AlertSettings />
    </div>
  );

  const tabItems = [
    {
      key: 'overview' as TabKey,
      label: (
        <span>
          <BarChartOutlined />
          概览
        </span>
      ),
      children: renderOverviewTab(),
    },
    {
      key: 'cases' as TabKey,
      label: (
        <span>
          <UnorderedListOutlined />
          用例
        </span>
      ),
      children: renderCasesTab(),
    },
    {
      key: 'failures' as TabKey,
      label: (
        <span>
          <BarChartOutlined />
          失败分析
        </span>
      ),
      children: renderFailuresTab(),
    },
    {
      key: 'alerts' as TabKey,
      label: (
        <span>
          <Badge count={unacknowledgedAlerts} size="small" offset={[6, 0]}>
            <BellOutlined />
          </Badge>
          告警
        </span>
      ),
      children: renderAlertsTab(),
    },
  ];

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
          <Title level={5} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 8 }} />
            测试分析仪表板
          </Title>
        </div>
        <div className="header-right">
          <Space>
            <Radio.Group
              value={timeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              size="small"
            >
              <Radio.Button value="today">今日</Radio.Button>
              <Radio.Button value="7days">7天</Radio.Button>
              <Radio.Button value="30days">30天</Radio.Button>
            </Radio.Group>
            <RangePicker
              size="small"
              value={customRange}
              onChange={handleCustomRangeChange}
              allowClear
              placeholder={['开始日期', '结束日期']}
              style={{ width: 220 }}
            />
            <Tooltip title="刷新数据">
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                loading={loading}
                size="small"
              />
            </Tooltip>
            {onSettings && (
              <Tooltip title="设置">
                <Button
                  icon={<SettingOutlined />}
                  onClick={onSettings}
                  size="small"
                />
              </Tooltip>
            )}
          </Space>
        </div>
      </div>

      <div className="dashboard-content">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabKey)}
          items={tabItems}
          size="small"
        />
      </div>
    </div>
  );
}
