/**
 * Whitelist Manager Component
 * UI for managing whitelist entries for sensitive data detection exclusions
 */

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Switch,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  type WhitelistEntry,
  type WhitelistType,
  whitelistManager,
} from '../../services/masking';

/**
 * Type display configuration
 */
const TYPE_CONFIG: Record<
  WhitelistType,
  { color: string; label: string; description: string }
> = {
  exact: { color: 'blue', label: '精确匹配', description: '完全匹配指定值' },
  pattern: {
    color: 'purple',
    label: '正则模式',
    description: '使用正则表达式匹配',
  },
  domain: {
    color: 'green',
    label: '域名',
    description: '匹配指定域名及其子域名',
  },
  path: { color: 'orange', label: '路径前缀', description: '匹配指定路径前缀' },
};

/**
 * Form values interface
 */
interface EntryFormValues {
  type: WhitelistType;
  value: string;
  description?: string;
}

interface WhitelistManagerProps {
  onClose?: () => void;
}

/**
 * WhitelistManager component
 */
export const WhitelistManagerUI: React.FC<WhitelistManagerProps> = ({
  onClose,
}) => {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WhitelistEntry | null>(null);
  const [form] = Form.useForm<EntryFormValues>();

  // Load entries on mount
  useEffect(() => {
    setEntries(whitelistManager.getEntries());
    setEnabled(whitelistManager.isEnabled());
  }, []);

  // Toggle global whitelist
  const handleToggleEnabled = useCallback((checked: boolean) => {
    if (checked) {
      whitelistManager.enable();
    } else {
      whitelistManager.disable();
    }
    setEnabled(checked);
  }, []);

  // Toggle entry enabled state
  const handleToggleEntry = useCallback((id: string, checked: boolean) => {
    if (checked) {
      whitelistManager.enableEntry(id);
    } else {
      whitelistManager.disableEntry(id);
    }
    setEntries(whitelistManager.getEntries());
  }, []);

  // Open editor for new entry
  const handleAdd = useCallback(() => {
    setEditingEntry(null);
    form.resetFields();
    form.setFieldsValue({ type: 'exact' });
    setShowEditor(true);
  }, [form]);

  // Open editor for existing entry
  const handleEdit = useCallback(
    (entry: WhitelistEntry) => {
      setEditingEntry(entry);
      form.setFieldsValue({
        type: entry.type,
        value: entry.value,
        description: entry.description,
      });
      setShowEditor(true);
    },
    [form],
  );

  // Save entry
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();

      // Validate pattern if type is pattern
      if (values.type === 'pattern') {
        try {
          new RegExp(values.value);
        } catch (e) {
          message.error(`正则表达式无效: ${(e as Error).message}`);
          return;
        }
      }

      if (editingEntry) {
        whitelistManager.updateEntry(editingEntry.id, values);
        message.success('白名单项已更新');
      } else {
        whitelistManager.addEntry({
          ...values,
          enabled: true,
        });
        message.success('白名单项已添加');
      }

      setEntries(whitelistManager.getEntries());
      setShowEditor(false);
      setEditingEntry(null);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  }, [form, editingEntry]);

  // Delete entry
  const handleDelete = useCallback((id: string) => {
    whitelistManager.removeEntry(id);
    setEntries(whitelistManager.getEntries());
    message.success('白名单项已删除');
  }, []);

  // Clear all entries
  const handleClearAll = useCallback(() => {
    whitelistManager.clear();
    setEntries([]);
    message.success('所有白名单项已清除');
  }, []);

  // Export to JSON
  const handleExport = useCallback(() => {
    const json = whitelistManager.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masking-whitelist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('白名单已导出');
  }, []);

  // Import from JSON
  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = whitelistManager.importFromJSON(content);
      if (result.success) {
        setEntries(whitelistManager.getEntries());
        message.success(`成功导入 ${result.count} 条白名单项`);
      } else {
        message.error(`导入失败: ${result.error}`);
      }
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  }, []);

  const stats = whitelistManager.getStats();

  return (
    <div className="whitelist-manager" style={{ padding: 16 }}>
      <Card
        title={
          <Space>
            <span>白名单管理</span>
            <Tag>{stats.total} 项</Tag>
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Switch
              checked={enabled}
              onChange={handleToggleEnabled}
              checkedChildren="启用"
              unCheckedChildren="禁用"
            />
            {onClose && (
              <Button size="small" onClick={onClose}>
                关闭
              </Button>
            )}
          </Space>
        }
      >
        {/* Actions */}
        <Space style={{ marginBottom: 16 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button size="small" icon={<UploadOutlined />}>
              导入
            </Button>
          </Upload>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            导出
          </Button>
          <Popconfirm
            title="确定要清除所有白名单项吗？"
            onConfirm={handleClearAll}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger disabled={entries.length === 0}>
              清空
            </Button>
          </Popconfirm>
        </Space>

        {/* Entries List */}
        <List
          size="small"
          dataSource={entries}
          locale={{ emptyText: '暂无白名单项' }}
          renderItem={(entry) => (
            <List.Item
              key={entry.id}
              actions={[
                <Tooltip key="edit" title="编辑">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(entry)}
                  />
                </Tooltip>,
                <Popconfirm
                  key="delete"
                  title="确定要删除吗？"
                  onConfirm={() => handleDelete(entry.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>,
                <Switch
                  key="switch"
                  size="small"
                  checked={entry.enabled}
                  onChange={(checked) => handleToggleEntry(entry.id, checked)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4}>
                    <Tag
                      color={TYPE_CONFIG[entry.type]?.color || 'default'}
                      style={{
                        fontSize: 10,
                        lineHeight: '16px',
                        padding: '0 4px',
                      }}
                    >
                      {TYPE_CONFIG[entry.type]?.label || entry.type}
                    </Tag>
                    <code
                      style={{
                        fontSize: 12,
                        background: '#f5f5f5',
                        padding: '0 4px',
                        borderRadius: 2,
                        wordBreak: 'break-all',
                      }}
                    >
                      {entry.value.length > 50
                        ? `${entry.value.substring(0, 50)}...`
                        : entry.value}
                    </code>
                  </Space>
                }
                description={
                  entry.description && (
                    <span style={{ fontSize: 11, color: '#999' }}>
                      {entry.description}
                    </span>
                  )
                }
              />
            </List.Item>
          )}
          style={{ maxHeight: 300, overflow: 'auto' }}
        />
      </Card>

      {/* Entry Editor Modal */}
      <Modal
        title={editingEntry ? '编辑白名单项' : '添加白名单项'}
        open={showEditor}
        onCancel={() => {
          setShowEditor(false);
          setEditingEntry(null);
        }}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="type"
            label="匹配类型"
            rules={[{ required: true, message: '请选择匹配类型' }]}
          >
            <Radio.Group>
              {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                <Radio.Button key={type} value={type}>
                  <Tooltip title={config.description}>{config.label}</Tooltip>
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="value"
            label="匹配值"
            rules={[{ required: true, message: '请输入匹配值' }]}
          >
            <Input.TextArea
              placeholder="输入要白名单的值"
              rows={2}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item name="description" label="描述（可选）">
            <Input placeholder="描述此白名单项的用途" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WhitelistManagerUI;
