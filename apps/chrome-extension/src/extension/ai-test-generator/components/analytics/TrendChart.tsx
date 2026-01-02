/**
 * Trend Chart Component
 * Displays execution trends over time using ECharts
 */

import { useEffect, useRef, useMemo } from 'react';
import { Card, Empty, Spin } from 'antd';
import type { DailyStats } from '../../types/analytics';

// Simple inline chart implementation without external dependencies
interface TrendChartProps {
  data: DailyStats[];
  loading?: boolean;
  height?: number;
}

export function TrendChart({
  data,
  loading = false,
  height = 250,
}: TrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const labels = data.map((d) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    const passed = data.map((d) => d.passed);
    const failed = data.map((d) => d.failed);
    const maxValue = Math.max(...data.map((d) => d.totalExecutions), 1);

    return { labels, passed, failed, maxValue };
  }, [data]);

  if (loading) {
    return (
      <Card className="trend-chart-card" size="small">
        <div
          className="chart-loading"
          style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spin />
        </div>
      </Card>
    );
  }

  if (!chartData) {
    return (
      <Card className="trend-chart-card" size="small">
        <Empty description="暂无数据" style={{ height, paddingTop: 60 }} />
      </Card>
    );
  }

  const barWidth = Math.max(
    12,
    Math.min(40, (chartRef.current?.clientWidth || 400) / chartData.labels.length - 8)
  );

  return (
    <Card
      className="trend-chart-card"
      title="执行趋势"
      size="small"
    >
      <div ref={chartRef} className="trend-chart" style={{ height }}>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-color" style={{ background: '#52c41a' }} />
            通过
          </span>
          <span className="legend-item">
            <span className="legend-color" style={{ background: '#ff4d4f' }} />
            失败
          </span>
        </div>
        <div className="chart-container">
          <div className="chart-y-axis">
            <span>{chartData.maxValue}</span>
            <span>{Math.round(chartData.maxValue / 2)}</span>
            <span>0</span>
          </div>
          <div className="chart-bars">
            {chartData.labels.map((label, i) => {
              const passedHeight =
                (chartData.passed[i] / chartData.maxValue) * (height - 60);
              const failedHeight =
                (chartData.failed[i] / chartData.maxValue) * (height - 60);

              return (
                <div key={label} className="bar-group">
                  <div
                    className="bar-stack"
                    style={{ height: height - 60 }}
                  >
                    <div
                      className="bar bar-failed"
                      style={{
                        height: failedHeight,
                        width: barWidth,
                        background: '#ff4d4f',
                      }}
                      title={`失败: ${chartData.failed[i]}`}
                    />
                    <div
                      className="bar bar-passed"
                      style={{
                        height: passedHeight,
                        width: barWidth,
                        background: '#52c41a',
                      }}
                      title={`通过: ${chartData.passed[i]}`}
                    />
                  </div>
                  <span className="bar-label">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Pass Rate Line Chart
 */
interface PassRateChartProps {
  data: DailyStats[];
  loading?: boolean;
  height?: number;
}

export function PassRateChart({
  data,
  loading = false,
  height = 200,
}: PassRateChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const points = data.map((d, i) => {
      const passRate =
        d.totalExecutions > 0 ? (d.passed / d.totalExecutions) * 100 : 0;
      return {
        date: d.date,
        label: `${new Date(d.date).getMonth() + 1}/${new Date(d.date).getDate()}`,
        passRate,
        x: i,
      };
    });

    return points;
  }, [data]);

  if (loading) {
    return (
      <Card className="pass-rate-chart-card" size="small">
        <div
          className="chart-loading"
          style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spin />
        </div>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card className="pass-rate-chart-card" size="small">
        <Empty description="暂无数据" style={{ height, paddingTop: 40 }} />
      </Card>
    );
  }

  const chartWidth = 100;
  const chartHeight = height - 50;
  const stepX = chartData.length > 1 ? chartWidth / (chartData.length - 1) : chartWidth;

  // Generate SVG path
  const pathData = chartData
    .map((point, i) => {
      const x = i * stepX;
      const y = chartHeight - (point.passRate / 100) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate area path
  const areaPath = `${pathData} L ${(chartData.length - 1) * stepX} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <Card className="pass-rate-chart-card" title="通过率趋势" size="small">
      <div className="pass-rate-chart" style={{ height }}>
        <div className="chart-y-axis">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="chart-svg-container">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: chartHeight }}
          >
            {/* Grid lines */}
            <line
              x1="0"
              y1={chartHeight * 0.5}
              x2={chartWidth}
              y2={chartHeight * 0.5}
              stroke="#f0f0f0"
              strokeWidth="0.5"
            />
            {/* Area fill */}
            <path
              d={areaPath}
              fill="rgba(24, 144, 255, 0.1)"
            />
            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke="#1890ff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Data points */}
            {chartData.map((point, i) => (
              <circle
                key={point.date}
                cx={i * stepX}
                cy={chartHeight - (point.passRate / 100) * chartHeight}
                r="3"
                fill="#1890ff"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${point.label}: ${point.passRate.toFixed(1)}%`}</title>
              </circle>
            ))}
          </svg>
          <div className="chart-x-labels">
            {chartData.length <= 7
              ? chartData.map((point) => (
                  <span key={point.date}>{point.label}</span>
                ))
              : [
                  <span key="start">{chartData[0].label}</span>,
                  <span key="end">{chartData[chartData.length - 1].label}</span>,
                ]}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Duration Trend Chart
 */
interface DurationChartProps {
  data: DailyStats[];
  loading?: boolean;
  height?: number;
}

export function DurationChart({
  data,
  loading = false,
  height = 200,
}: DurationChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const maxDuration = Math.max(...data.map((d) => d.avgDuration), 1);

    const points = data.map((d, i) => ({
      date: d.date,
      label: `${new Date(d.date).getMonth() + 1}/${new Date(d.date).getDate()}`,
      duration: d.avgDuration,
      durationStr: formatDuration(d.avgDuration),
      x: i,
    }));

    return { points, maxDuration };
  }, [data]);

  if (loading) {
    return (
      <Card className="duration-chart-card" size="small">
        <div
          className="chart-loading"
          style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Spin />
        </div>
      </Card>
    );
  }

  if (!chartData || chartData.points.length === 0) {
    return (
      <Card className="duration-chart-card" size="small">
        <Empty description="暂无数据" style={{ height, paddingTop: 40 }} />
      </Card>
    );
  }

  const chartWidth = 100;
  const chartHeight = height - 50;
  const stepX =
    chartData.points.length > 1
      ? chartWidth / (chartData.points.length - 1)
      : chartWidth;

  // Generate SVG path
  const pathData = chartData.points
    .map((point, i) => {
      const x = i * stepX;
      const y =
        chartHeight - (point.duration / chartData.maxDuration) * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <Card className="duration-chart-card" title="平均耗时趋势" size="small">
      <div className="duration-chart" style={{ height }}>
        <div className="chart-y-axis">
          <span>{formatDuration(chartData.maxDuration)}</span>
          <span>{formatDuration(chartData.maxDuration / 2)}</span>
          <span>0</span>
        </div>
        <div className="chart-svg-container">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: chartHeight }}
          >
            {/* Grid lines */}
            <line
              x1="0"
              y1={chartHeight * 0.5}
              x2={chartWidth}
              y2={chartHeight * 0.5}
              stroke="#f0f0f0"
              strokeWidth="0.5"
            />
            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke="#722ed1"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Data points */}
            {chartData.points.map((point, i) => (
              <circle
                key={point.date}
                cx={i * stepX}
                cy={
                  chartHeight -
                  (point.duration / chartData.maxDuration) * chartHeight
                }
                r="3"
                fill="#722ed1"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${point.label}: ${point.durationStr}`}</title>
              </circle>
            ))}
          </svg>
          <div className="chart-x-labels">
            {chartData.points.length <= 7
              ? chartData.points.map((point) => (
                  <span key={point.date}>{point.label}</span>
                ))
              : [
                  <span key="start">{chartData.points[0].label}</span>,
                  <span key="end">
                    {chartData.points[chartData.points.length - 1].label}
                  </span>,
                ]}
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m${seconds}s`;
}
