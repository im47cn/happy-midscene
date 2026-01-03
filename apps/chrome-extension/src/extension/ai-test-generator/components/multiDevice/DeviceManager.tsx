/**
 * Device Manager Component
 * Manages multi-device connections and configurations
 */

import {
  AndroidOutlined,
  AppleOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  LinkOutlined,
  LoadingOutlined,
  MobileOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import React, { useState, useCallback } from 'react';
import type {
  DeviceConfig,
  DeviceInfo,
  DeviceStatus,
  DeviceType,
} from '../../types/multiDevice';

const { Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

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
 * Device type labels
 */
const deviceTypeLabels: Record<DeviceType, string> = {
  browser: '浏览器',
  android: 'Android',
  ios: 'iOS',
  remote: '远程设备',
};

/**
 * Status colors and icons
 */
const statusConfig: Record<
  DeviceStatus,
  { color: string; icon: React.ReactNode; text: string }
> = {
  disconnected: {
    color: 'default',
    icon: <DisconnectOutlined />,
    text: '未连接',
  },
  connecting: {
    color: 'processing',
    icon: <LoadingOutlined spin />,
    text: '连接中',
  },
  ready: { color: 'success', icon: <LinkOutlined />, text: '就绪' },
  busy: { color: 'warning', icon: <LoadingOutlined spin />, text: '忙碌' },
  error: { color: 'error', icon: <DisconnectOutlined />, text: '错误' },
};

/**
 * Viewport presets
 */
const viewportPresets = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Pro', width: 1024, height: 1366 },
];

/**
 * Props for DeviceManager
 */
interface DeviceManagerProps {
  devices: DeviceInfo[];
  onAddDevice: (config: DeviceConfig) => Promise<void>;
  onRemoveDevice: (deviceId: string) => Promise<void>;
  onConnectDevice: (deviceId: string) => Promise<void>;
  onDisconnectDevice: (deviceId: string) => Promise<void>;
  onReconnectDevice: (deviceId: string) => Promise<void>;
  maxDevices?: number;
  disabled?: boolean;
}

/**
 * Device configuration form values
 */
interface DeviceFormValues {
  alias: string;
  type: DeviceType;
  // Browser options
  viewportWidth?: number;
  viewportHeight?: number;
  startUrl?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  userAgent?: string;
  // Android options
  deviceId?: string;
  package?: string;
  // iOS options
  wdaHost?: string;
  wdaPort?: number;
  // Remote options
  wsUrl?: string;
}

/**
 * Device Manager Component
 */
export function DeviceManager({
  devices,
  onAddDevice,
  onRemoveDevice,
  onConnectDevice,
  onDisconnectDevice,
  onReconnectDevice,
  maxDevices = 5,
  disabled = false,
}: DeviceManagerProps) {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [form] = Form.useForm<DeviceFormValues>();
  const [deviceType, setDeviceType] = useState<DeviceType>('browser');

  // Open add device modal
  const openAddModal = useCallback(() => {
    form.resetFields();
    setDeviceType('browser');
    form.setFieldsValue({
      type: 'browser',
      viewportWidth: 1920,
      viewportHeight: 1080,
      deviceScaleFactor: 1,
    });
    setAddModalVisible(true);
  }, [form]);

  // Handle add device
  const handleAddDevice = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setLoading('add');

      const config: DeviceConfig = {
        id: `device_${Date.now()}`,
        alias: values.alias,
        type: values.type,
      };

      // Add type-specific config
      if (values.type === 'browser') {
        config.viewport = {
          width: values.viewportWidth || 1920,
          height: values.viewportHeight || 1080,
        };
        config.startUrl = values.startUrl;
      } else if (values.type === 'android') {
        config.deviceId = values.deviceId;
        config.package = values.package;
      } else if (values.type === 'ios') {
        config.wdaHost = values.wdaHost;
        config.wdaPort = values.wdaPort;
      } else if (values.type === 'remote') {
        config.wsUrl = values.wsUrl;
      }

      await onAddDevice(config);
      setAddModalVisible(false);
      message.success(`设备 "${values.alias}" 已添加`);
    } catch (error) {
      if (error instanceof Error) {
        message.error(`添加失败: ${error.message}`);
      }
    } finally {
      setLoading(null);
    }
  }, [form, onAddDevice]);

  // Handle connect device
  const handleConnect = useCallback(
    async (deviceId: string) => {
      setLoading(deviceId);
      try {
        await onConnectDevice(deviceId);
        message.success('连接成功');
      } catch (error) {
        if (error instanceof Error) {
          message.error(`连接失败: ${error.message}`);
        }
      } finally {
        setLoading(null);
      }
    },
    [onConnectDevice],
  );

  // Handle disconnect device
  const handleDisconnect = useCallback(
    async (deviceId: string) => {
      setLoading(deviceId);
      try {
        await onDisconnectDevice(deviceId);
        message.success('已断开连接');
      } catch (error) {
        if (error instanceof Error) {
          message.error(`断开失败: ${error.message}`);
        }
      } finally {
        setLoading(null);
      }
    },
    [onDisconnectDevice],
  );

  // Handle reconnect device
  const handleReconnect = useCallback(
    async (deviceId: string) => {
      setLoading(deviceId);
      try {
        await onReconnectDevice(deviceId);
        message.success('重新连接成功');
      } catch (error) {
        if (error instanceof Error) {
          message.error(`重新连接失败: ${error.message}`);
        }
      } finally {
        setLoading(null);
      }
    },
    [onReconnectDevice],
  );

  // Handle remove device
  const handleRemove = useCallback(
    async (deviceId: string) => {
      setLoading(deviceId);
      try {
        await onRemoveDevice(deviceId);
        message.success('设备已移除');
      } catch (error) {
        if (error instanceof Error) {
          message.error(`移除失败: ${error.message}`);
        }
      } finally {
        setLoading(null);
      }
    },
    [onRemoveDevice],
  );

  // Apply viewport preset
  const applyViewportPreset = useCallback(
    (preset: { width: number; height: number }) => {
      form.setFieldsValue({
        viewportWidth: preset.width,
        viewportHeight: preset.height,
      });
    },
    [form],
  );

  // Render device type specific fields
  const renderTypeSpecificFields = () => {
    switch (deviceType) {
      case 'browser':
        return (
          <>
            <Form.Item label="视口尺寸">
              <Space>
                <Form.Item
                  name="viewportWidth"
                  noStyle
                  rules={[{ required: true, message: '请输入宽度' }]}
                >
                  <InputNumber min={320} max={3840} placeholder="宽度" />
                </Form.Item>
                <Text>×</Text>
                <Form.Item
                  name="viewportHeight"
                  noStyle
                  rules={[{ required: true, message: '请输入高度' }]}
                >
                  <InputNumber min={480} max={2160} placeholder="高度" />
                </Form.Item>
              </Space>
            </Form.Item>
            <Form.Item label="快捷预设">
              <Space wrap>
                {viewportPresets.map((preset) => (
                  <Tag
                    key={preset.name}
                    style={{ cursor: 'pointer' }}
                    onClick={() => applyViewportPreset(preset)}
                  >
                    {preset.name}
                  </Tag>
                ))}
              </Space>
            </Form.Item>
            <Form.Item name="startUrl" label="起始 URL">
              <Input placeholder="https://example.com" />
            </Form.Item>
          </>
        );

      case 'android':
        return (
          <>
            <Form.Item
              name="deviceId"
              label="设备 ID"
              rules={[{ required: true, message: '请输入设备 ID' }]}
            >
              <Input placeholder="adb devices 获取的设备 ID" />
            </Form.Item>
            <Form.Item name="package" label="应用包名">
              <Input placeholder="com.example.app" />
            </Form.Item>
          </>
        );

      case 'ios':
        return (
          <>
            <Form.Item
              name="wdaHost"
              label="WDA 主机"
              rules={[{ required: true, message: '请输入 WDA 主机地址' }]}
            >
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item
              name="wdaPort"
              label="WDA 端口"
              rules={[{ required: true, message: '请输入 WDA 端口' }]}
            >
              <InputNumber min={1} max={65535} placeholder="8100" />
            </Form.Item>
          </>
        );

      case 'remote':
        return (
          <Form.Item
            name="wsUrl"
            label="WebSocket URL"
            rules={[{ required: true, message: '请输入 WebSocket URL' }]}
          >
            <Input placeholder="ws://remote-host:8080/device" />
          </Form.Item>
        );

      default:
        return null;
    }
  };

  // Render device card
  const renderDeviceCard = (device: DeviceInfo) => {
    const status = statusConfig[device.status];
    const isLoading = loading === device.id;
    const isConnected =
      device.status === 'ready' || device.status === 'busy';

    return (
      <List.Item key={device.id}>
        <Card
          size="small"
          style={{ width: '100%' }}
          actions={[
            isConnected ? (
              <Tooltip title="断开连接" key="disconnect">
                <Button
                  type="text"
                  size="small"
                  icon={<DisconnectOutlined />}
                  onClick={() => handleDisconnect(device.id)}
                  loading={isLoading}
                  disabled={disabled}
                />
              </Tooltip>
            ) : (
              <Tooltip title="连接" key="connect">
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => handleConnect(device.id)}
                  loading={isLoading}
                  disabled={disabled}
                />
              </Tooltip>
            ),
            <Tooltip title="重新连接" key="reconnect">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleReconnect(device.id)}
                loading={isLoading}
                disabled={disabled || device.status === 'connecting'}
              />
            </Tooltip>,
            <Popconfirm
              key="delete"
              title="确定移除此设备？"
              onConfirm={() => handleRemove(device.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="移除">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={isLoading}
                  disabled={disabled}
                />
              </Tooltip>
            </Popconfirm>,
          ]}
        >
          <Card.Meta
            avatar={
              <Badge
                status={status.color as any}
                dot
                offset={[-2, 24]}
              >
                <span style={{ fontSize: 24 }}>
                  {deviceTypeIcons[device.type]}
                </span>
              </Badge>
            }
            title={
              <Space>
                <Text strong>{device.alias}</Text>
                <Tag color={status.color}>{status.text}</Tag>
              </Space>
            }
            description={
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {deviceTypeLabels[device.type]} · {device.id}
                </Text>
                {device.lastError && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {device.lastError}
                  </Text>
                )}
                {device.currentStep !== undefined &&
                  device.totalSteps !== undefined && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      进度: {device.currentStep}/{device.totalSteps}
                    </Text>
                  )}
              </Space>
            }
          />
          {device.lastScreenshot && (
            <div style={{ marginTop: 8 }}>
              <img
                src={`data:image/png;base64,${device.lastScreenshot}`}
                alt="Screenshot"
                style={{
                  width: '100%',
                  maxHeight: 100,
                  objectFit: 'contain',
                  borderRadius: 4,
                  border: '1px solid #f0f0f0',
                }}
              />
            </div>
          )}
        </Card>
      </List.Item>
    );
  };

  const connectedCount = devices.filter(
    (d) => d.status === 'ready' || d.status === 'busy',
  ).length;

  return (
    <Card
      title={
        <Space>
          <MobileOutlined />
          <span>设备管理</span>
          <Badge
            count={`${connectedCount}/${devices.length}`}
            style={{ backgroundColor: connectedCount > 0 ? '#52c41a' : '#d9d9d9' }}
          />
        </Space>
      }
      size="small"
      extra={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={openAddModal}
          disabled={disabled || devices.length >= maxDevices}
        >
          添加设备
        </Button>
      }
    >
      {devices.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 24,
            color: '#999',
          }}
        >
          <MobileOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <div>暂无设备，点击"添加设备"开始</div>
        </div>
      ) : (
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={devices}
          renderItem={renderDeviceCard}
        />
      )}

      {/* Add Device Modal */}
      <Modal
        title="添加设备"
        open={addModalVisible}
        onOk={handleAddDevice}
        onCancel={() => setAddModalVisible(false)}
        confirmLoading={loading === 'add'}
        width={480}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'browser',
            viewportWidth: 1920,
            viewportHeight: 1080,
            deviceScaleFactor: 1,
          }}
        >
          <Form.Item
            name="alias"
            label="设备别名"
            rules={[{ required: true, message: '请输入设备别名' }]}
          >
            <Input placeholder="如: 桌面浏览器、用户手机" />
          </Form.Item>

          <Form.Item
            name="type"
            label="设备类型"
            rules={[{ required: true, message: '请选择设备类型' }]}
          >
            <Select
              onChange={(type) => setDeviceType(type)}
              placeholder="选择设备类型"
            >
              {Object.entries(deviceTypeLabels).map(([type, label]) => (
                <Option key={type} value={type}>
                  <Space>
                    {deviceTypeIcons[type as DeviceType]}
                    {label}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {renderTypeSpecificFields()}
        </Form>
      </Modal>
    </Card>
  );
}

export default DeviceManager;
