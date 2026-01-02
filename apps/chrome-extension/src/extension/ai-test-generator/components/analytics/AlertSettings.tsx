/**
 * Alert Settings Component
 * Manages alert rules and notification preferences
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  List,
  Switch,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Tooltip,
  Empty,
  message,
  Popconfirm,
  Badge,
  Collapse,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type {
  AlertRule,
  AlertEvent,
  AlertConditionType,
  NotificationChannel,
} from '../../types/analytics';
import { alertManager } from '../../services/analytics';

const { Option } = Select;

interface AlertSettingsProps {
  onBack?: () => void;
}

const CONDITION_TYPE_OPTIONS: {
  value: AlertConditionType;
  label: string;
  description: string;
}[] = [
  {
    value: 'pass_rate',
    label: '通过率阈值',
    description: '当时间窗口内的通过率低于阈值时触发',
  },
  {
    value: 'consecutive_failures',
    label: '连续失败',
    description: '当同一用例连续失败次数超过阈值时触发',
  },
  {
    value: 'duration',
    label: '执行时长',
    description: '当执行时长超过平均值的一定比例时触发',
  },
  {
    value: 'flaky_detected',
    label: 'Flaky 检测',
    description: '当检测到新的 Flaky 测试时触发',
  },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'browser', label: '浏览器通知' },
  { value: 'webhook', label: 'Webhook' },
];

export function AlertSettings({ onBack }: AlertSettingsProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await alertManager.init();
      const [allRules, recentEvents] = await Promise.all([
        alertManager.getAllRules(),
        alertManager.getRecentEvents(20),
      ]);
      setRules(allRules);
      setEvents(recentEvents);
    } catch (error) {
      console.error('Failed to load alert settings:', error);
      message.error('加载告警设置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleRule = async (rule: AlertRule, enabled: boolean) => {
    try {
      await alertManager.updateRule({ ...rule, enabled });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r))
      );
      message.success(enabled ? '规则已启用' : '规则已禁用');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await alertManager.deleteRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      message.success('规则已删除');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      conditionType: rule.condition.type,
      threshold: rule.condition.threshold,
      timeWindow: rule.condition.timeWindow,
      channels: rule.notification.channels,
      webhookUrl: rule.notification.webhookUrl,
    });
    setModalVisible(true);
  };

  const handleAddRule = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      channels: ['browser'],
    });
    setModalVisible(true);
  };

  const handleSaveRule = async () => {
    try {
      const values = await form.validateFields();

      const ruleData: Omit<AlertRule, 'id' | 'createdAt'> = {
        name: values.name,
        enabled: true,
        condition: {
          type: values.conditionType,
          threshold: values.threshold,
          timeWindow: values.timeWindow,
        },
        notification: {
          channels: values.channels,
          webhookUrl: values.webhookUrl,
        },
      };

      if (editingRule) {
        const updatedRule: AlertRule = {
          ...editingRule,
          ...ruleData,
        };
        await alertManager.updateRule(updatedRule);
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? updatedRule : r))
        );
        message.success('规则已更新');
      } else {
        const newRule = await alertManager.createRule(ruleData);
        setRules((prev) => [...prev, newRule]);
        message.success('规则已创建');
      }

      setModalVisible(false);
    } catch (error) {
      if (error instanceof Error && error.name !== 'ValidateError') {
        message.error('保存失败');
      }
    }
  };

  const handleAcknowledge = async (eventId: string) => {
    try {
      await alertManager.acknowledgeEvent(eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, acknowledged: true } : e))
      );
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getConditionLabel = (type: AlertConditionType): string => {
    return (
      CONDITION_TYPE_OPTIONS.find((o) => o.value === type)?.label || type
    );
  };

  const getThresholdUnit = (type: AlertConditionType): string => {
    switch (type) {
      case 'pass_rate':
        return '%';
      case 'consecutive_failures':
        return '次';
      case 'duration':
        return '%';
      default:
        return '';
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      return `${diffMins} 分钟前`;
    }
    if (diffHours < 24) {
      return `${diffHours} 小时前`;
    }
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unacknowledgedCount = events.filter((e) => !e.acknowledged).length;

  const conditionType = Form.useWatch('conditionType', form);

  return (
    <div className="alert-settings">
      <div className="alert-settings-header">
        <Space>
          <SettingOutlined />
          <span className="header-title">告警设置</span>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>
          添加规则
        </Button>
      </div>

      <div className="alert-settings-content">
        {/* Alert Rules */}
        <Card
          title={
            <Space>
              <BellOutlined />
              告警规则
            </Space>
          }
          size="small"
          className="rules-card"
        >
          {rules.length === 0 ? (
            <Empty description="暂无告警规则" />
          ) : (
            <List
              dataSource={rules}
              loading={loading}
              renderItem={(rule) => (
                <List.Item className="rule-item">
                  <div className="rule-content">
                    <div className="rule-header">
                      <div className="rule-info">
                        <Switch
                          checked={rule.enabled}
                          onChange={(checked) => handleToggleRule(rule, checked)}
                          size="small"
                        />
                        <span className="rule-name">{rule.name}</span>
                        {!rule.enabled && (
                          <Tag color="default">已禁用</Tag>
                        )}
                      </div>
                      <Space size="small">
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditRule(rule)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="确定要删除此规则吗？"
                          onConfirm={() => handleDeleteRule(rule.id)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                    <div className="rule-details">
                      <Tag color="blue">
                        {getConditionLabel(rule.condition.type)}
                      </Tag>
                      <span className="rule-threshold">
                        阈值: {rule.condition.threshold}
                        {getThresholdUnit(rule.condition.type)}
                      </span>
                      {rule.condition.timeWindow && (
                        <span className="rule-window">
                          时间窗口: {rule.condition.timeWindow}分钟
                        </span>
                      )}
                    </div>
                    <div className="rule-channels">
                      {rule.notification.channels.map((ch) => (
                        <Tag key={ch} color="green">
                          {ch === 'browser' ? '浏览器通知' : 'Webhook'}
                        </Tag>
                      ))}
                    </div>
                    {rule.lastTriggered && (
                      <div className="rule-last-triggered">
                        最后触发: {formatTime(rule.lastTriggered)}
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* Recent Events */}
        <Card
          title={
            <Space>
              <ExclamationCircleOutlined />
              最近告警
              {unacknowledgedCount > 0 && (
                <Badge count={unacknowledgedCount} size="small" />
              )}
            </Space>
          }
          size="small"
          className="events-card"
        >
          {events.length === 0 ? (
            <Empty description="暂无告警事件" />
          ) : (
            <List
              dataSource={events}
              size="small"
              renderItem={(event) => (
                <List.Item
                  className={`event-item ${event.acknowledged ? 'acknowledged' : ''}`}
                >
                  <div className="event-content">
                    <div className="event-header">
                      <span className="event-rule">{event.ruleName}</span>
                      <span className="event-time">
                        {formatTime(event.triggeredAt)}
                      </span>
                    </div>
                    <div className="event-message">{event.message}</div>
                    {!event.acknowledged && (
                      <Button
                        type="link"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleAcknowledge(event.id)}
                      >
                        确认
                      </Button>
                    )}
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>

      {/* Add/Edit Rule Modal */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={modalVisible}
        onOk={handleSaveRule}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Form form={form} layout="vertical" className="rule-form">
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="输入规则名称" />
          </Form.Item>

          <Form.Item
            name="conditionType"
            label="条件类型"
            rules={[{ required: true, message: '请选择条件类型' }]}
          >
            <Select placeholder="选择条件类型">
              {CONDITION_TYPE_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  <div>
                    <div>{opt.label}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {opt.description}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="threshold"
            label={`阈值${conditionType ? ` (${getThresholdUnit(conditionType)})` : ''}`}
            rules={[{ required: true, message: '请输入阈值' }]}
          >
            <InputNumber
              min={0}
              max={conditionType === 'pass_rate' ? 100 : 1000}
              style={{ width: '100%' }}
              placeholder="输入阈值"
            />
          </Form.Item>

          {conditionType === 'pass_rate' && (
            <Form.Item
              name="timeWindow"
              label="时间窗口 (分钟)"
              rules={[{ required: true, message: '请输入时间窗口' }]}
            >
              <InputNumber
                min={5}
                max={1440}
                style={{ width: '100%' }}
                placeholder="输入时间窗口"
              />
            </Form.Item>
          )}

          <Form.Item
            name="channels"
            label="通知渠道"
            rules={[{ required: true, message: '请选择通知渠道' }]}
          >
            <Select mode="multiple" placeholder="选择通知渠道">
              {CHANNEL_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.channels !== curr.channels
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('channels')?.includes('webhook') && (
                <Form.Item
                  name="webhookUrl"
                  label="Webhook URL"
                  rules={[
                    { required: true, message: '请输入 Webhook URL' },
                    { type: 'url', message: '请输入有效的 URL' },
                  ]}
                >
                  <Input placeholder="https://example.com/webhook" />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
