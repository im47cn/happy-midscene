/**
 * Action Button Component
 * Button for executing debug actions
 */

import {
  EyeOutlined,
  CameraOutlined,
  DiffOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  LoginOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Button, Space, Tooltip, Dropdown, Typography } from 'antd';
import type { MenuProps } from 'antd';
import type { DebugAction, DebugActionType } from '../../types/debugAssistant';

const { Text } = Typography;

interface ActionButtonProps {
  type: DebugActionType | string;
  target?: string;
  value?: any;
  onExecute?: () => Promise<void>;
  loading?: boolean;
  size?: 'small' | 'middle' | 'large';
  showLabel?: boolean;
}

/**
 * Get icon for action type
 */
function getActionIcon(type: DebugActionType | string): React.ReactNode {
  switch (type) {
    case 'click':
    case 'input':
      return <PlayCircleOutlined />;
    case 'scroll':
      return <LoginOutlined />;
    case 'highlight':
      return <EyeOutlined />;
    case 'screenshot':
      return <CameraOutlined />;
    case 'compare':
      return <DiffOutlined />;
    case 'refresh':
      return <ReloadOutlined />;
    case 'locate':
      return <SearchOutlined />;
    case 'wait':
      return '⏱️';
    case 'describe':
      return '📝';
    default:
      return <PlayCircleOutlined />;
  }
}

/**
 * Get label for action type
 */
function getActionLabel(type: DebugActionType | string): string {
  const labels: Record<string, string> = {
    click: '点击',
    input: '输入',
    scroll: '滚动',
    highlight: '高亮',
    screenshot: '截图',
    compare: '对比',
    refresh: '刷新',
    wait: '等待',
    locate: '定位',
    describe: '描述',
  };
  return labels[type] || type;
}

/**
 * Get button type for action
 */
function getButtonType(type: DebugActionType | string): 'default' | 'primary' | 'dashed' | 'link' | 'text' {
  if (['highlight', 'screenshot', 'describe'].includes(type)) {
    return 'default';
  }
  if (['click', 'input'].includes(type)) {
    return 'primary';
  }
  return 'default';
}

export function ActionButton({
  type,
  target,
  value,
  onExecute,
  loading = false,
  size = 'small',
  showLabel = true,
}: ActionButtonProps) {
  const icon = getActionIcon(type);
  const label = getActionLabel(type);
  const buttonType = getButtonType(type);

  // For actions with value, show a dropdown
  if (value !== undefined && typeof value === 'object' && value.options) {
    const menuItems: MenuProps['items'] = value.options.map((opt: any, index: number) => ({
      key: index,
      label: opt.label || opt,
      onClick: () => onExecute?.(),
    }));

    return (
      <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={loading}>
        <Button size={size} type={buttonType} icon={icon} loading={loading}>
          {showLabel && <span>{label}</span>}
        </Button>
      </Dropdown>
    );
  }

  return (
    <Tooltip title={target ? `${label}: ${target}` : label}>
      <Button
        size={size}
        type={buttonType}
        icon={icon}
        onClick={onExecute}
        loading={loading}
      >
        {showLabel && <span>{label}</span>}
        {target && showLabel && (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
            {target.length > 10 ? `${target.slice(0, 10)}...` : target}
          </Text>
        )}
      </Button>
    </Tooltip>
  );
}

/**
 * Action button group
 */
interface ActionButtonGroupProps {
  actions: Array<DebugAction | { type: string; target?: string; value?: any }>;
  onExecute?: (action: DebugAction) => Promise<void>;
  loading?: boolean;
  size?: 'small' | 'middle' | 'large';
}

export function ActionButtonGroup({ actions, onExecute, loading, size }: ActionButtonGroupProps) {
  return (
    <Space size="small" wrap>
      {actions.map((action, index) => (
        <ActionButton
          key={index}
          type={action.type}
          target={action.target}
          value={action.value}
          onExecute={() => onExecute?.(action as DebugAction)}
          loading={loading}
          size={size}
        />
      ))}
    </Space>
  );
}

/**
 * Quick action toolbar
 */
interface QuickActionToolbarProps {
  onHighlight?: () => Promise<void>;
  onScreenshot?: () => Promise<void>;
  onLocate?: (target: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  loading?: boolean;
}

export function QuickActionToolbar({
  onHighlight,
  onScreenshot,
  onLocate,
  onRefresh,
  loading,
}: QuickActionToolbarProps) {
  return (
    <Space size="small">
      {onHighlight && (
        <Tooltip title="高亮元素">
          <Button size="small" icon={<EyeOutlined />} onClick={onHighlight} disabled={loading} />
        </Tooltip>
      )}
      {onScreenshot && (
        <Tooltip title="截取屏幕">
          <Button size="small" icon={<CameraOutlined />} onClick={onScreenshot} disabled={loading} />
        </Tooltip>
      )}
      {onRefresh && (
        <Tooltip title="刷新页面">
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} disabled={loading} />
        </Tooltip>
      )}
    </Space>
  );
}
