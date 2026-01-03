/**
 * Shared Data Panel Component
 * Displays and manages shared variables across devices
 */

import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useState, useCallback, useMemo } from 'react';
import type { DataChangeEvent } from '../../services/multiDevice/dataChannel';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;
const { TextArea } = Input;

/**
 * Shared data entry
 */
interface SharedDataEntry {
  key: string;
  value: any;
  source: string;
  timestamp: number;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

/**
 * Props for SharedDataPanel
 */
interface SharedDataPanelProps {
  data: Record<string, any>;
  history: DataChangeEvent[];
  onSetValue?: (key: string, value: any, source?: string) => void;
  onDeleteKey?: (key: string) => void;
  onClearAll?: () => void;
  onRefresh?: () => void;
  disabled?: boolean;
}

/**
 * Format value for display
 */
function formatValue(value: any): { display: string; type: string } {
  if (value === null) return { display: 'null', type: 'null' };
  if (value === undefined) return { display: 'undefined', type: 'undefined' };

  const type = Array.isArray(value)
    ? 'array'
    : typeof value;

  let display: string;
  if (typeof value === 'object') {
    display = JSON.stringify(value, null, 2);
  } else {
    display = String(value);
  }

  return { display, type };
}

/**
 * Parse value from string input
 */
function parseValue(input: string, type: string): any {
  switch (type) {
    case 'number':
      return Number(input);
    case 'boolean':
      return input.toLowerCase() === 'true';
    case 'object':
    case 'array':
      try {
        return JSON.parse(input);
      } catch {
        return input;
      }
    default:
      return input;
  }
}

/**
 * Type colors
 */
const typeColors: Record<string, string> = {
  string: 'green',
  number: 'blue',
  boolean: 'orange',
  object: 'purple',
  array: 'cyan',
  null: 'default',
  undefined: 'default',
};

/**
 * Shared Data Panel Component
 */
export function SharedDataPanel({
  data,
  history,
  onSetValue,
  onDeleteKey,
  onClearAll,
  onRefresh,
  disabled = false,
}: SharedDataPanelProps) {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // Convert data to entries
  const entries = useMemo((): SharedDataEntry[] => {
    return Object.entries(data)
      .filter(([key]) =>
        key.toLowerCase().includes(searchText.toLowerCase()),
      )
      .map(([key, value]) => {
        const formatted = formatValue(value);
        const historyEntry = [...history]
          .reverse()
          .find((h) => h.key === key);

        return {
          key,
          value,
          source: historyEntry?.source || 'unknown',
          timestamp: historyEntry?.timestamp || Date.now(),
          type: formatted.type as SharedDataEntry['type'],
        };
      });
  }, [data, history, searchText]);

  // Recent changes
  const recentChanges = useMemo(() => {
    return [...history].reverse().slice(0, 20);
  }, [history]);

  // Open add/edit modal
  const openAddModal = useCallback(
    (key?: string) => {
      form.resetFields();
      if (key) {
        setEditingKey(key);
        const value = data[key];
        const formatted = formatValue(value);
        form.setFieldsValue({
          key,
          value: formatted.display,
          type: formatted.type,
        });
      } else {
        setEditingKey(null);
        form.setFieldsValue({
          type: 'string',
        });
      }
      setAddModalVisible(true);
    },
    [data, form],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const parsedValue = parseValue(values.value, values.type);

      if (onSetValue) {
        onSetValue(values.key, parsedValue, 'manual');
        message.success(editingKey ? '更新成功' : '添加成功');
      }

      setAddModalVisible(false);
      setEditingKey(null);
    } catch (error) {
      // Validation error
    }
  }, [form, onSetValue, editingKey]);

  // Handle delete
  const handleDelete = useCallback(
    (key: string) => {
      if (onDeleteKey) {
        onDeleteKey(key);
        message.success(`已删除: ${key}`);
      }
    },
    [onDeleteKey],
  );

  // Copy value
  const copyValue = useCallback((value: any) => {
    const text =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    navigator.clipboard.writeText(text);
    message.success('已复制');
  }, []);

  // Table columns
  const columns: ColumnsType<SharedDataEntry> = [
    {
      title: '键名',
      dataIndex: 'key',
      key: 'key',
      width: 150,
      render: (key: string) => (
        <Text strong copyable style={{ fontFamily: 'monospace' }}>
          {key}
        </Text>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: any, record) => {
        const formatted = formatValue(value);
        return (
          <Space>
            <Tag color={typeColors[formatted.type]}>{formatted.type}</Tag>
            <Tooltip
              title={
                formatted.display.length > 100 ? formatted.display : undefined
              }
            >
              <Text
                code
                style={{
                  fontSize: 12,
                  maxWidth: 200,
                  display: 'inline-block',
                }}
                ellipsis
              >
                {formatted.display.length > 50
                  ? `${formatted.display.slice(0, 50)}...`
                  : formatted.display}
              </Text>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {source}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyValue(record.value)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openAddModal(record.key)}
              disabled={disabled}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此变量？"
            onConfirm={() => handleDelete(record.key)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Render change history item
  const renderHistoryItem = useCallback((event: DataChangeEvent) => {
    const time = new Date(event.timestamp).toLocaleTimeString();
    const formatted = formatValue(event.value);

    let color = 'blue';
    if (event.source === 'delete') {
      color = 'red';
    } else if (event.previousValue !== undefined) {
      color = 'orange';
    } else {
      color = 'green';
    }

    return (
      <Timeline.Item key={`${event.key}_${event.timestamp}`} color={color}>
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong style={{ fontSize: 12 }}>
              {event.key}
            </Text>
            <Tag color={typeColors[formatted.type]} style={{ fontSize: 10 }}>
              {formatted.type}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {time} · {event.source}
          </Text>
          <Text code style={{ fontSize: 11 }}>
            {formatted.display.length > 30
              ? `${formatted.display.slice(0, 30)}...`
              : formatted.display}
          </Text>
        </Space>
      </Timeline.Item>
    );
  }, []);

  return (
    <Card
      title={
        <Space>
          <SyncOutlined />
          <span>共享数据</span>
          <Badge count={entries.length} style={{ backgroundColor: '#52c41a' }} />
        </Space>
      }
      size="small"
      extra={
        <Space>
          {onRefresh && (
            <Tooltip title="刷新">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
              />
            </Tooltip>
          )}
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openAddModal()}
            disabled={disabled}
          >
            添加变量
          </Button>
          {entries.length > 0 && onClearAll && (
            <Popconfirm
              title="确定清空所有数据？"
              onConfirm={onClearAll}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger disabled={disabled}>
                清空
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Collapse defaultActiveKey={['data']} ghost>
        {/* Current Data */}
        <Panel
          header={
            <Space>
              <span>当前数据</span>
              <Input
                size="small"
                placeholder="搜索键名..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 150 }}
                allowClear
              />
            </Space>
          }
          key="data"
        >
          {entries.length === 0 ? (
            <Empty
              description={
                searchText ? '未找到匹配项' : '暂无共享数据'
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              columns={columns}
              dataSource={entries}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ y: 200 }}
            />
          )}
        </Panel>

        {/* Change History */}
        <Panel
          header={
            <Space>
              <HistoryOutlined />
              <span>变更历史</span>
              <Badge count={recentChanges.length} size="small" />
            </Space>
          }
          key="history"
        >
          {recentChanges.length === 0 ? (
            <Empty
              description="暂无变更记录"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <Timeline>{recentChanges.map(renderHistoryItem)}</Timeline>
            </div>
          )}
        </Panel>

        {/* Variable Templates */}
        <Panel
          header={
            <Space>
              <span>变量插值语法</span>
            </Space>
          }
          key="syntax"
        >
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="基本引用">
              <Text code>{'${variableName}'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="带转换器">
              <Text code>{'${variableName | uppercase}'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="带参数">
              <Text code>{"${variableName | format:'YYYY-MM-DD'}"}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="可用转换器">
              <Space wrap>
                <Tag>trim</Tag>
                <Tag>number</Tag>
                <Tag>uppercase</Tag>
                <Tag>lowercase</Tag>
                <Tag>format</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Panel>
      </Collapse>

      {/* Add/Edit Modal */}
      <Modal
        title={editingKey ? '编辑变量' : '添加变量'}
        open={addModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setAddModalVisible(false);
          setEditingKey(null);
        }}
        width={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="key"
            label="键名"
            rules={[{ required: true, message: '请输入键名' }]}
          >
            <Input
              placeholder="variableName"
              disabled={!!editingKey}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="选择类型">
              <Option value="string">String</Option>
              <Option value="number">Number</Option>
              <Option value="boolean">Boolean</Option>
              <Option value="object">Object</Option>
              <Option value="array">Array</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="value"
            label="值"
            rules={[{ required: true, message: '请输入值' }]}
          >
            <TextArea
              rows={4}
              placeholder="输入值 (JSON 格式用于 object/array)"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default SharedDataPanel;
