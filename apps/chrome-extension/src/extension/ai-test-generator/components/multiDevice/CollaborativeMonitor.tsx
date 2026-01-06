/**
 * Collaborative Monitor Component
 * Real-time monitoring of multi-device test execution
 */

import {
  AndroidOutlined,
  AppleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Image,
  Progress,
  Row,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type {
  DeviceInfo,
  DeviceType,
  OrchestratorState,
  OrchestratorStatus,
  TimelineEvent,
} from '../../types/multiDevice';

const { Text, Title } = Typography;

/**
 * Device type icons
 */
const deviceTypeIcons: Record<DeviceType, React.ReactNode> = {
  browser: <DesktopOutlined />,
  android: <AndroidOutlined />,
  ios: <AppleOutlined />,
  remote: <CloudServerOutlined />,
};

/**
 * State colors and icons
 */
const stateConfig: Record<
  OrchestratorState,
  { color: string; icon: React.ReactNode; text: string }
> = {
  idle: { color: 'default', icon: <StopOutlined />, text: '空闲' },
  initializing: {
    color: 'processing',
    icon: <LoadingOutlined spin />,
    text: '初始化',
  },
  running: {
    color: 'processing',
    icon: <SyncOutlined spin />,
    text: '运行中',
  },
  paused: {
    color: 'warning',
    icon: <PauseCircleOutlined />,
    text: '已暂停',
  },
  completed: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    text: '完成',
  },
  failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
};

/**
 * Props for CollaborativeMonitor
 */
interface CollaborativeMonitorProps {
  status: OrchestratorStatus;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  showTimeline?: boolean;
  showScreenshots?: boolean;
}

/**
 * Device card component
 */
function DeviceCard({
  device,
  showScreenshot,
}: {
  device: DeviceInfo;
  showScreenshot: boolean;
}) {
  const statusColors: Record<string, string> = {
    disconnected: 'default',
    connecting: 'processing',
    ready: 'success',
    busy: 'warning',
    error: 'error',
  };

  const progress =
    device.totalSteps && device.totalSteps > 0
      ? Math.round(((device.currentStep || 0) / device.totalSteps) * 100)
      : 0;

  return (
    <Card
      size="small"
      title={
        <Space>
          {deviceTypeIcons[device.type]}
          <Text strong>{device.alias}</Text>
          <Badge status={statusColors[device.status] as any} />
        </Space>
      }
      style={{ height: '100%' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {/* Progress */}
        {device.totalSteps !== undefined && device.totalSteps > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              步骤: {device.currentStep || 0}/{device.totalSteps}
            </Text>
            <Progress
              percent={progress}
              size="small"
              status={device.status === 'error' ? 'exception' : undefined}
            />
          </div>
        )}

        {/* Error message */}
        {device.lastError && (
          <Text type="danger" style={{ fontSize: 12 }}>
            <ExclamationCircleOutlined /> {device.lastError}
          </Text>
        )}

        {/* Screenshot */}
        {showScreenshot && device.lastScreenshot && (
          <div style={{ marginTop: 8 }}>
            <Image
              src={`data:image/png;base64,${device.lastScreenshot}`}
              alt={`${device.alias} Screenshot`}
              style={{
                width: '100%',
                maxHeight: 150,
                objectFit: 'contain',
                borderRadius: 4,
                border: '1px solid #f0f0f0',
              }}
              preview={{
                mask: '查看大图',
              }}
            />
          </div>
        )}
      </Space>
    </Card>
  );
}

/**
 * Timeline event component
 */
function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const eventConfig: Record<
    TimelineEvent['type'],
    { color: string; icon: React.ReactNode }
  > = {
    step_start: { color: 'blue', icon: <PlayCircleOutlined /> },
    step_end: { color: 'green', icon: <CheckCircleOutlined /> },
    sync_wait: { color: 'orange', icon: <LoadingOutlined /> },
    sync_release: { color: 'cyan', icon: <SyncOutlined /> },
    error: { color: 'red', icon: <CloseCircleOutlined /> },
  };

  const config = eventConfig[event.type];
  const time = new Date(event.timestamp).toLocaleTimeString();

  const getLabel = () => {
    switch (event.type) {
      case 'step_start':
        return `[${event.deviceId}] 开始步骤 ${event.stepIndex}`;
      case 'step_end':
        return `[${event.deviceId}] 完成步骤 ${event.stepIndex}`;
      case 'sync_wait':
        return `等待同步点: ${event.syncPointId}`;
      case 'sync_release':
        return `同步点释放: ${event.syncPointId}`;
      case 'error':
        return `[${event.deviceId}] 错误: ${event.message}`;
      default:
        return event.message || '';
    }
  };

  return (
    <Timeline.Item color={config.color} dot={config.icon}>
      <Space>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {time}
        </Text>
        <Text style={{ fontSize: 12 }}>{getLabel()}</Text>
      </Space>
    </Timeline.Item>
  );
}

/**
 * Collaborative Monitor Component
 */
export function CollaborativeMonitor({
  status,
  onPause,
  onResume,
  onStop,
  onRestart,
  showTimeline = true,
  showScreenshots = true,
}: CollaborativeMonitorProps) {
  const state = stateConfig[status.state];

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDevices = status.devices.length;
    const readyDevices = status.devices.filter(
      (d) => d.status === 'ready',
    ).length;
    const busyDevices = status.devices.filter(
      (d) => d.status === 'busy',
    ).length;
    const errorDevices = status.devices.filter(
      (d) => d.status === 'error',
    ).length;

    return {
      totalDevices,
      activeDevices: readyDevices + busyDevices,
      errorDevices,
    };
  }, [status.devices]);

  // Recent timeline events (last 10)
  const recentEvents = useMemo(() => {
    return [...status.timeline].reverse().slice(0, 10);
  }, [status.timeline]);

  const canPause = status.state === 'running';
  const canResume = status.state === 'paused';
  const canStop = status.state === 'running' || status.state === 'paused';
  const canRestart = status.state === 'completed' || status.state === 'failed';

  return (
    <Card
      title={
        <Space>
          <SyncOutlined spin={status.state === 'running'} />
          <span>协同执行监控</span>
          <Tag color={state.color} icon={state.icon}>
            {state.text}
          </Tag>
        </Space>
      }
      size="small"
      extra={
        <Space>
          {canPause && onPause && (
            <Tooltip title="暂停">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={onPause}
              />
            </Tooltip>
          )}
          {canResume && onResume && (
            <Tooltip title="继续">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={onResume}
              />
            </Tooltip>
          )}
          {canStop && onStop && (
            <Tooltip title="停止">
              <Button
                danger
                size="small"
                icon={<StopOutlined />}
                onClick={onStop}
              />
            </Tooltip>
          )}
          {canRestart && onRestart && (
            <Tooltip title="重新执行">
              <Button
                type="primary"
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRestart}
              />
            </Tooltip>
          )}
        </Space>
      }
    >
      {/* Overall Progress */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic
            title="总进度"
            value={status.progress.percentage}
            suffix="%"
            valueStyle={{
              color: status.progress.percentage === 100 ? '#3f8600' : undefined,
            }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="已完成步骤"
            value={status.progress.completedSteps}
            suffix={`/ ${status.progress.totalSteps}`}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="活跃设备"
            value={stats.activeDevices}
            suffix={`/ ${stats.totalDevices}`}
            valueStyle={{
              color: stats.activeDevices > 0 ? '#1890ff' : undefined,
            }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="错误设备"
            value={stats.errorDevices}
            valueStyle={{
              color: stats.errorDevices > 0 ? '#cf1322' : '#3f8600',
            }}
          />
        </Col>
      </Row>

      <Progress
        percent={status.progress.percentage}
        status={
          status.state === 'failed'
            ? 'exception'
            : status.state === 'completed'
              ? 'success'
              : 'active'
        }
        strokeColor={{
          '0%': '#108ee9',
          '100%': '#87d068',
        }}
      />

      {/* Current Sync Point */}
      {status.currentSyncPoint && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Tag color="orange" icon={<LoadingOutlined spin />}>
            等待同步点: {status.currentSyncPoint}
          </Tag>
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Device Cards */}
      <Row gutter={[16, 16]}>
        {status.devices.map((device) => (
          <Col key={device.id} xs={24} sm={12} md={8} lg={6}>
            <DeviceCard device={device} showScreenshot={showScreenshots} />
          </Col>
        ))}
      </Row>

      {/* Timeline */}
      {showTimeline && recentEvents.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0' }}>执行时间线</Divider>
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              padding: '0 8px',
            }}
          >
            <Timeline mode="left">
              {recentEvents.map((event, index) => (
                <TimelineEventItem
                  key={`${event.timestamp}_${index}`}
                  event={event}
                />
              ))}
            </Timeline>
          </div>
        </>
      )}

      {/* Shared Data Summary */}
      {Object.keys(status.sharedData).length > 0 && (
        <>
          <Divider style={{ margin: '16px 0' }}>共享数据</Divider>
          <Descriptions size="small" column={2} bordered>
            {Object.entries(status.sharedData).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                <Text code style={{ fontSize: 11 }}>
                  {typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value)}
                </Text>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </>
      )}
    </Card>
  );
}

export default CollaborativeMonitor;
