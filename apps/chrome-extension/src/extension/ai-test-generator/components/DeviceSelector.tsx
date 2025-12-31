/**
 * Device Selector Component
 * Allows users to select device presets for H5 mobile mode testing
 */

import { useState, useMemo } from 'react';
import { Select, Tag, Tooltip, Space, Typography, Divider } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
} from '@ant-design/icons';
import {
  devicePresets,
  devicePresetsByCategory,
  getDevicePreset,
  type DevicePreset,
} from '../config/devicePresets';

const { Text } = Typography;

interface DeviceSelectorProps {
  value?: string;
  onChange?: (deviceId: string) => void;
  disabled?: boolean;
}

// Category icons
const categoryIcons = {
  desktop: <DesktopOutlined />,
  mobile: <MobileOutlined />,
  tablet: <TabletOutlined />,
};

// Category labels
const categoryLabels = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
};

// Format device option label
function formatDeviceLabel(device: DevicePreset): React.ReactNode {
  return (
    <Space size={4}>
      {categoryIcons[device.category]}
      <span>{device.name}</span>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {device.width}×{device.height}
      </Text>
    </Space>
  );
}

// Device info tooltip content
function DeviceInfoTooltip({ device }: { device: DevicePreset }) {
  return (
    <div className="device-info-tooltip">
      <div><strong>{device.name}</strong></div>
      <div>Resolution: {device.width}×{device.height}</div>
      <div>Scale: {device.deviceScaleFactor}x</div>
      <div>Touch: {device.hasTouch ? 'Yes' : 'No'}</div>
      {device.isMobile && <div>Mobile: Yes</div>}
    </div>
  );
}

export function DeviceSelector({
  value = 'desktop',
  onChange,
  disabled = false,
}: DeviceSelectorProps) {
  const selectedDevice = useMemo(() => getDevicePreset(value), [value]);

  const handleChange = (deviceId: string) => {
    onChange?.(deviceId);
  };

  // Build grouped options
  const options = useMemo(() => {
    return [
      {
        label: (
          <Space>
            {categoryIcons.desktop}
            <span>{categoryLabels.desktop}</span>
          </Space>
        ),
        options: devicePresetsByCategory.desktop.map((device) => ({
          value: device.id,
          label: formatDeviceLabel(device),
        })),
      },
      {
        label: (
          <Space>
            {categoryIcons.mobile}
            <span>{categoryLabels.mobile}</span>
          </Space>
        ),
        options: devicePresetsByCategory.mobile.map((device) => ({
          value: device.id,
          label: formatDeviceLabel(device),
        })),
      },
      {
        label: (
          <Space>
            {categoryIcons.tablet}
            <span>{categoryLabels.tablet}</span>
          </Space>
        ),
        options: devicePresetsByCategory.tablet.map((device) => ({
          value: device.id,
          label: formatDeviceLabel(device),
        })),
      },
    ];
  }, []);

  return (
    <div className="device-selector">
      <Select
        value={value}
        onChange={handleChange}
        options={options}
        disabled={disabled}
        style={{ width: '100%' }}
        placeholder="Select device"
        optionLabelProp="label"
        popupMatchSelectWidth={false}
        dropdownStyle={{ minWidth: 220 }}
      />
      {selectedDevice && selectedDevice.isMobile && (
        <div className="device-mode-indicator">
          <Tag color="blue" icon={<MobileOutlined />}>
            H5 Mode
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Touch events enabled
          </Text>
        </div>
      )}
    </div>
  );
}

// Compact version for toolbar
export function DeviceSelectorCompact({
  value = 'desktop',
  onChange,
  disabled = false,
}: DeviceSelectorProps) {
  const selectedDevice = useMemo(() => getDevicePreset(value), [value]);

  return (
    <Tooltip
      title={selectedDevice ? <DeviceInfoTooltip device={selectedDevice} /> : null}
    >
      <Select
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ width: 140 }}
        size="small"
        bordered={false}
        suffixIcon={
          selectedDevice?.isMobile ? <MobileOutlined /> : <DesktopOutlined />
        }
      >
        {devicePresets.map((device) => (
          <Select.Option key={device.id} value={device.id}>
            <Space size={4}>
              {categoryIcons[device.category]}
              <span style={{ fontSize: 12 }}>{device.name}</span>
            </Space>
          </Select.Option>
        ))}
      </Select>
    </Tooltip>
  );
}

export default DeviceSelector;
