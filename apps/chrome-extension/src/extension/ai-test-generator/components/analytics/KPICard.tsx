/**
 * KPI Card Component
 * Displays a key performance indicator with trend
 */

import { Card, Statistic, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: number | string;
  suffix?: string;
  precision?: number;
  trend?: number;
  trendSuffix?: string;
  icon?: ReactNode;
  loading?: boolean;
  tooltip?: string;
  valueStyle?: React.CSSProperties;
}

export function KPICard({
  title,
  value,
  suffix,
  precision = 1,
  trend,
  trendSuffix = '%',
  icon,
  loading = false,
  tooltip,
  valueStyle,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) {
      return <MinusOutlined style={{ color: '#999' }} />;
    }
    if (trend > 0) {
      return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
    }
    return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return '#999';
    return trend > 0 ? '#52c41a' : '#ff4d4f';
  };

  const formatTrend = () => {
    if (trend === undefined) return null;
    const absValue = Math.abs(trend).toFixed(precision);
    return `${trend > 0 ? '+' : ''}${trend.toFixed(precision)}${trendSuffix}`;
  };

  const content = (
    <Card className="kpi-card" loading={loading} size="small">
      <div className="kpi-card-content">
        <div className="kpi-header">
          {icon && <span className="kpi-icon">{icon}</span>}
          <span className="kpi-title">{title}</span>
        </div>
        <Statistic
          value={value}
          suffix={suffix}
          precision={typeof value === 'number' ? precision : undefined}
          valueStyle={{
            fontSize: 24,
            fontWeight: 600,
            ...valueStyle,
          }}
        />
        {trend !== undefined && (
          <div className="kpi-trend" style={{ color: getTrendColor() }}>
            {getTrendIcon()}
            <span className="trend-value">{formatTrend()}</span>
          </div>
        )}
      </div>
    </Card>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{content}</Tooltip>;
  }

  return content;
}

/**
 * Health Score Card with color coding
 */
interface HealthScoreCardProps {
  score: number;
  trend: 'improving' | 'stable' | 'declining';
  loading?: boolean;
}

export function HealthScoreCard({
  score,
  trend,
  loading = false,
}: HealthScoreCardProps) {
  const getScoreColor = () => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      case 'declining':
        return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <MinusOutlined style={{ color: '#999' }} />;
    }
  };

  const getTrendText = () => {
    switch (trend) {
      case 'improving':
        return '上升趋势';
      case 'declining':
        return '下降趋势';
      default:
        return '保持稳定';
    }
  };

  return (
    <Card className="kpi-card health-score-card" loading={loading} size="small">
      <div className="kpi-card-content">
        <div className="kpi-header">
          <span className="kpi-title">健康度</span>
        </div>
        <div className="health-score-value" style={{ color: getScoreColor() }}>
          {score}
        </div>
        <div className="kpi-trend">
          {getTrendIcon()}
          <span className="trend-text">{getTrendText()}</span>
        </div>
      </div>
    </Card>
  );
}
