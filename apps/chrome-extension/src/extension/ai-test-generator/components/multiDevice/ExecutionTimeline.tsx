/**
 * Execution Timeline Component
 * Visual timeline showing multi-device execution flow with sync points
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Card,
  Empty,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import type {
  DeviceExecutionResult,
  SyncPointTiming,
  TimelineEvent,
} from '../../types/multiDevice';

const { Text } = Typography;

/**
 * Timeline entry for rendering
 */
interface TimelineEntry {
  id: string;
  deviceId: string;
  deviceAlias: string;
  type: 'step' | 'sync' | 'error';
  startTime: number;
  endTime: number;
  duration: number;
  label: string;
  success?: boolean;
  error?: string;
}

/**
 * Props for ExecutionTimeline
 */
interface ExecutionTimelineProps {
  devices: DeviceExecutionResult[];
  syncPoints: SyncPointTiming[];
  timeline: TimelineEvent[];
  startTime: number;
  endTime?: number;
  onStepClick?: (deviceId: string, stepIndex: number) => void;
  onSyncPointClick?: (syncPointId: string) => void;
}

/**
 * Colors for devices (max 8)
 */
const deviceColors = [
  '#1890ff', // Blue
  '#52c41a', // Green
  '#722ed1', // Purple
  '#fa8c16', // Orange
  '#eb2f96', // Pink
  '#13c2c2', // Cyan
  '#faad14', // Yellow
  '#2f54eb', // Geekblue
];

/**
 * Format duration in ms to readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

/**
 * Format timestamp to time string
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Execution Timeline Component
 */
export function ExecutionTimeline({
  devices,
  syncPoints,
  timeline,
  startTime,
  endTime,
  onStepClick,
  onSyncPointClick,
}: ExecutionTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  // Calculate timeline range
  const timeRange = useMemo(() => {
    const end = endTime || Date.now();
    const duration = end - startTime;
    return { start: startTime, end, duration };
  }, [startTime, endTime]);

  // Build timeline entries from device results
  const entries = useMemo(() => {
    const result: TimelineEntry[] = [];

    // Add device steps
    devices.forEach((device) => {
      let currentTime = startTime;

      device.steps.forEach((step, index) => {
        const stepStart = currentTime;
        const stepEnd = stepStart + step.result.duration;

        result.push({
          id: `${device.deviceId}_step_${index}`,
          deviceId: device.deviceId,
          deviceAlias: device.deviceAlias,
          type: 'step',
          startTime: stepStart,
          endTime: stepEnd,
          duration: step.result.duration,
          label: step.instruction,
          success: step.result.success,
          error: step.result.error,
        });

        currentTime = stepEnd;
      });
    });

    // Add sync points
    syncPoints.forEach((sp) => {
      result.push({
        id: `sync_${sp.id}`,
        deviceId: 'sync',
        deviceAlias: 'Sync',
        type: 'sync',
        startTime: sp.startTime,
        endTime: sp.endTime,
        duration: sp.duration,
        label: sp.id,
      });
    });

    return result;
  }, [devices, syncPoints, startTime]);

  // Get device color
  const getDeviceColor = useCallback(
    (deviceId: string, index?: number) => {
      const deviceIndex =
        index ?? devices.findIndex((d) => d.deviceId === deviceId);
      return deviceColors[deviceIndex % deviceColors.length];
    },
    [devices],
  );

  // Calculate position for timeline entry
  const getPosition = useCallback(
    (entry: TimelineEntry) => {
      const left =
        ((entry.startTime - timeRange.start) / timeRange.duration) * 100;
      const width =
        ((entry.endTime - entry.startTime) / timeRange.duration) * 100;
      return {
        left: `${left}%`,
        width: `${Math.max(width, 0.5)}%`, // Minimum 0.5% width
      };
    },
    [timeRange],
  );

  // Handle entry click
  const handleEntryClick = useCallback(
    (entry: TimelineEntry) => {
      if (entry.type === 'step' && onStepClick) {
        const stepIndex = Number.parseInt(entry.id.split('_step_')[1], 10);
        onStepClick(entry.deviceId, stepIndex);
      } else if (entry.type === 'sync' && onSyncPointClick) {
        onSyncPointClick(entry.label);
      }
    },
    [onStepClick, onSyncPointClick],
  );

  // Render timeline entry
  const renderEntry = useCallback(
    (entry: TimelineEntry, deviceIndex: number) => {
      const position = getPosition(entry);
      const color =
        entry.type === 'sync' ? '#faad14' : getDeviceColor(entry.deviceId);
      const isHovered = hoveredEntry === entry.id;

      let bgColor = color;
      if (entry.type === 'step') {
        if (entry.success === false) {
          bgColor = '#ff4d4f';
        } else if (entry.success === true) {
          bgColor = color;
        }
      }

      return (
        <Tooltip
          key={entry.id}
          title={
            <div>
              <div>
                <strong>{entry.label}</strong>
              </div>
              <div>时长: {formatDuration(entry.duration)}</div>
              <div>开始: {formatTime(entry.startTime)}</div>
              <div>结束: {formatTime(entry.endTime)}</div>
              {entry.error && (
                <div style={{ color: '#ff4d4f' }}>错误: {entry.error}</div>
              )}
            </div>
          }
        >
          <div
            style={{
              position: 'absolute',
              ...position,
              height: 24,
              backgroundColor: bgColor,
              borderRadius: 4,
              cursor: 'pointer',
              opacity: isHovered ? 1 : 0.8,
              transition: 'all 0.2s',
              transform: isHovered ? 'scaleY(1.1)' : 'scaleY(1)',
              zIndex: isHovered ? 10 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            }}
            onMouseEnter={() => setHoveredEntry(entry.id)}
            onMouseLeave={() => setHoveredEntry(null)}
            onClick={() => handleEntryClick(entry)}
          >
            {entry.type === 'sync' ? (
              <SyncOutlined style={{ color: '#fff', fontSize: 12 }} />
            ) : entry.success === false ? (
              <CloseCircleOutlined style={{ color: '#fff', fontSize: 12 }} />
            ) : entry.success === true ? (
              <CheckCircleOutlined style={{ color: '#fff', fontSize: 12 }} />
            ) : (
              <LoadingOutlined style={{ color: '#fff', fontSize: 12 }} />
            )}
            <Text
              ellipsis
              style={{
                color: '#fff',
                fontSize: 10,
                marginLeft: 4,
                maxWidth: 'calc(100% - 20px)',
              }}
            >
              {entry.label}
            </Text>
          </div>
        </Tooltip>
      );
    },
    [getPosition, getDeviceColor, hoveredEntry, handleEntryClick],
  );

  // Render device lane
  const renderDeviceLane = useCallback(
    (device: DeviceExecutionResult, index: number) => {
      const color = getDeviceColor(device.deviceId, index);
      const deviceEntries = entries.filter(
        (e) => e.deviceId === device.deviceId,
      );

      return (
        <div
          key={device.deviceId}
          style={{
            display: 'flex',
            marginBottom: 8,
          }}
        >
          {/* Device label */}
          <div
            style={{
              width: 100,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Badge color={color} />
            <Text ellipsis style={{ fontSize: 12 }} title={device.deviceAlias}>
              {device.deviceAlias}
            </Text>
          </div>

          {/* Timeline lane */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              height: 32,
              backgroundColor: '#f5f5f5',
              borderRadius: 4,
              padding: '4px 0',
            }}
          >
            {deviceEntries.map((entry) => renderEntry(entry, index))}
          </div>
        </div>
      );
    },
    [entries, getDeviceColor, renderEntry],
  );

  // Render sync points lane
  const renderSyncPointsLane = useCallback(() => {
    const syncEntries = entries.filter((e) => e.type === 'sync');

    if (syncEntries.length === 0) return null;

    return (
      <div
        style={{
          display: 'flex',
          marginBottom: 8,
          marginTop: 8,
        }}
      >
        {/* Label */}
        <div
          style={{
            width: 100,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <SyncOutlined style={{ color: '#faad14' }} />
          <Text style={{ fontSize: 12 }}>同步点</Text>
        </div>

        {/* Timeline lane */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            height: 32,
            backgroundColor: '#fffbe6',
            borderRadius: 4,
            padding: '4px 0',
            borderTop: '1px dashed #faad14',
            borderBottom: '1px dashed #faad14',
          }}
        >
          {syncEntries.map((entry, index) => renderEntry(entry, index))}
        </div>
      </div>
    );
  }, [entries, renderEntry]);

  // Render time axis
  const renderTimeAxis = useCallback(() => {
    const marks = 10;
    const interval = timeRange.duration / marks;

    return (
      <div
        style={{
          display: 'flex',
          marginLeft: 100,
          borderTop: '1px solid #d9d9d9',
          paddingTop: 4,
        }}
      >
        {Array.from({ length: marks + 1 }).map((_, index) => {
          const time = timeRange.start + interval * index;
          return (
            <div
              key={index}
              style={{
                flex: 1,
                textAlign:
                  index === 0 ? 'left' : index === marks ? 'right' : 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 10 }}>
                {formatTime(time)}
              </Text>
            </div>
          );
        })}
      </div>
    );
  }, [timeRange]);

  if (devices.length === 0 && syncPoints.length === 0) {
    return (
      <Card title="执行时间线" size="small">
        <Empty description="暂无执行数据" />
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <ClockCircleOutlined />
          <span>执行时间线</span>
          <Tag color="blue">{formatDuration(timeRange.duration)}</Tag>
        </Space>
      }
      size="small"
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            缩放:
          </Text>
          <Slider
            style={{ width: 100 }}
            min={50}
            max={200}
            value={zoom}
            onChange={setZoom}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </Space>
      }
    >
      <div
        ref={containerRef}
        style={{
          overflowX: 'auto',
          padding: '8px 0',
        }}
      >
        <div
          style={{
            minWidth: `${zoom}%`,
            transition: 'min-width 0.2s',
          }}
        >
          {/* Device lanes */}
          {devices.map((device, index) => renderDeviceLane(device, index))}

          {/* Sync points lane */}
          {renderSyncPointsLane()}

          {/* Time axis */}
          {renderTimeAxis()}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}
      >
        {devices.map((device, index) => (
          <Space key={device.deviceId} size={4}>
            <Badge color={getDeviceColor(device.deviceId, index)} />
            <Text style={{ fontSize: 12 }}>{device.deviceAlias}</Text>
          </Space>
        ))}
        <Space size={4}>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text style={{ fontSize: 12 }}>成功</Text>
        </Space>
        <Space size={4}>
          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          <Text style={{ fontSize: 12 }}>失败</Text>
        </Space>
        <Space size={4}>
          <SyncOutlined style={{ color: '#faad14' }} />
          <Text style={{ fontSize: 12 }}>同步点</Text>
        </Space>
      </div>
    </Card>
  );
}

export default ExecutionTimeline;
