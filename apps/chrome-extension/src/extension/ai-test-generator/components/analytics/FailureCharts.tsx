/**
 * Failure Analysis Charts
 * Displays failure distribution and hotspots
 */

import { ExclamationCircleOutlined, FireOutlined } from '@ant-design/icons';
import { Card, Empty, List, Progress, Spin, Tag, Tooltip } from 'antd';
import { useMemo } from 'react';
import type { FailureType, Hotspot } from '../../types/analytics';
import { FAILURE_TYPE_LABELS } from '../../types/analytics';

/**
 * Failure Type Distribution Pie Chart
 */
interface FailureTypePieProps {
  data: Record<FailureType, number>;
  loading?: boolean;
  height?: number;
}

const FAILURE_COLORS: Record<FailureType, string> = {
  locator_failed: '#ff4d4f',
  assertion_failed: '#faad14',
  timeout: '#722ed1',
  network_error: '#13c2c2',
  script_error: '#eb2f96',
  unknown: '#8c8c8c',
};

export function FailureTypePie({
  data,
  loading = false,
  height = 200,
}: FailureTypePieProps) {
  const chartData = useMemo(() => {
    const entries = Object.entries(data)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        type: type as FailureType,
        count,
        label: FAILURE_TYPE_LABELS[type as FailureType],
        color: FAILURE_COLORS[type as FailureType],
      }))
      .sort((a, b) => b.count - a.count);

    const total = entries.reduce((sum, e) => sum + e.count, 0);

    return { entries, total };
  }, [data]);

  if (loading) {
    return (
      <Card className="failure-pie-card" size="small">
        <div
          className="chart-loading"
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      </Card>
    );
  }

  if (chartData.total === 0) {
    return (
      <Card className="failure-pie-card" title="失败类型分布" size="small">
        <Empty
          description="暂无失败记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ height: height - 50, paddingTop: 40 }}
        />
      </Card>
    );
  }

  // Calculate pie segments
  const radius = 60;
  const centerX = 80;
  const centerY = 80;
  let currentAngle = -90; // Start from top

  const segments = chartData.entries.map((entry) => {
    const percentage = entry.count / chartData.total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculate path
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;

    const path =
      chartData.entries.length === 1
        ? `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX - 0.01} ${centerY - radius} Z`
        : `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...entry,
      percentage,
      path,
    };
  });

  return (
    <Card className="failure-pie-card" title="失败类型分布" size="small">
      <div className="failure-pie-chart" style={{ height }}>
        <div className="pie-container">
          <svg viewBox="0 0 160 160" style={{ width: 140, height: 140 }}>
            {segments.map((seg) => (
              <path
                key={seg.type}
                d={seg.path}
                fill={seg.color}
                stroke="#fff"
                strokeWidth="1"
              >
                <title>{`${seg.label}: ${seg.count} (${(seg.percentage * 100).toFixed(1)}%)`}</title>
              </path>
            ))}
            {/* Center hole for donut effect */}
            <circle cx={centerX} cy={centerY} r={35} fill="#fff" />
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="20"
              fontWeight="bold"
              fill="#262626"
            >
              {chartData.total}
            </text>
            <text
              x={centerX}
              y={centerY + 16}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#8c8c8c"
            >
              总失败
            </text>
          </svg>
        </div>
        <div className="pie-legend">
          {segments.map((seg) => (
            <div key={seg.type} className="legend-item">
              <span
                className="legend-color"
                style={{ background: seg.color }}
              />
              <span className="legend-label">{seg.label}</span>
              <span className="legend-value">
                {seg.count} ({(seg.percentage * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Failure Hotspots List
 */
interface HotspotsListProps {
  data: Hotspot[];
  loading?: boolean;
  maxItems?: number;
}

export function HotspotsList({
  data,
  loading = false,
  maxItems = 5,
}: HotspotsListProps) {
  const displayData = data.slice(0, maxItems);

  return (
    <Card
      className="hotspots-card"
      title={
        <span>
          <FireOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
          失败热点
        </span>
      }
      size="small"
    >
      {loading ? (
        <div
          className="chart-loading"
          style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      ) : displayData.length === 0 ? (
        <Empty
          description="暂无失败热点"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          size="small"
          dataSource={displayData}
          renderItem={(item, index) => (
            <List.Item className="hotspot-item">
              <div className="hotspot-content">
                <div className="hotspot-header">
                  <span className="hotspot-rank">#{index + 1}</span>
                  <Tooltip title={item.description}>
                    <span className="hotspot-description">
                      {item.description}
                    </span>
                  </Tooltip>
                </div>
                <div className="hotspot-stats">
                  <span className="hotspot-count">
                    {item.failureCount} 次失败
                  </span>
                  {item.failureType && (
                    <Tag
                      color={FAILURE_COLORS[item.failureType]}
                      style={{ marginLeft: 8 }}
                    >
                      {FAILURE_TYPE_LABELS[item.failureType]}
                    </Tag>
                  )}
                </div>
                <Progress
                  percent={item.percentage}
                  size="small"
                  showInfo={false}
                  strokeColor="#ff4d4f"
                  trailColor="#f5f5f5"
                />
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

/**
 * Failure Patterns Card
 */
interface FailurePattern {
  type: 'consecutive' | 'time_based' | 'correlated';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

interface FailurePatternsProps {
  patterns: FailurePattern[];
  loading?: boolean;
}

const PATTERN_TYPE_LABELS = {
  consecutive: '连续失败',
  time_based: '时间规律',
  correlated: '关联失败',
};

const SEVERITY_COLORS = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#ff4d4f',
};

const SEVERITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
};

export function FailurePatterns({
  patterns,
  loading = false,
}: FailurePatternsProps) {
  return (
    <Card
      className="patterns-card"
      title={
        <span>
          <ExclamationCircleOutlined
            style={{ color: '#faad14', marginRight: 8 }}
          />
          失败模式检测
        </span>
      }
      size="small"
    >
      {loading ? (
        <div
          className="chart-loading"
          style={{
            height: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin />
        </div>
      ) : patterns.length === 0 ? (
        <Empty
          description="未检测到异常模式"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          size="small"
          dataSource={patterns.slice(0, 3)}
          renderItem={(pattern) => (
            <List.Item className="pattern-item">
              <div className="pattern-content">
                <div className="pattern-header">
                  <Tag>{PATTERN_TYPE_LABELS[pattern.type]}</Tag>
                  <Tag color={SEVERITY_COLORS[pattern.severity]}>
                    {SEVERITY_LABELS[pattern.severity]}风险
                  </Tag>
                </div>
                <div className="pattern-description">{pattern.description}</div>
                <div className="pattern-suggestion">
                  <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                  {pattern.suggestion}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
