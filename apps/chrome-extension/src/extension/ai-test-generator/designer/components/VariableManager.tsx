/**
 * Variable Manager Component
 * 变量管理器 - 管理测试流程中的变量定义
 */

import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { VariableDefinition, VariableType } from '../types/designer';
import { useDesignerStore } from '../store/designerStore';

const VARIABLE_TYPE_OPTIONS: { value: VariableType; label: string; color: string }[] = [
  { value: 'string', label: '字符串', color: 'blue' },
  { value: 'number', label: '数字', color: 'green' },
  { value: 'boolean', label: '布尔', color: 'orange' },
  { value: 'array', label: '数组', color: 'purple' },
  { value: 'object', label: '对象', color: 'cyan' },
];

interface VariableReference {
  nodeId: string;
  nodeName: string;
  field: string;
}

interface VariableFormData {
  name: string;
  type: VariableType;
  defaultValue?: string;
  description?: string;
}

interface VariableManagerProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * 检查变量在节点中的引用
 */
function findVariableReferences(
  variableName: string,
  nodes: any[],
): VariableReference[] {
  const references: VariableReference[] = [];

  for (const node of nodes) {
    const config = node.data?.config;
    if (!config) continue;

    // 检查配置对象中所有字符串值是否包含变量引用 ${varName}
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.includes(`\${${variableName}}`)) {
        references.push({
          nodeId: node.id,
          nodeName: node.data?.label || node.type,
          field: key,
        });
      }
    }
  }

  return references;
}

/**
 * 变量编辑对话框
 */
function VariableEditDialog({
  visible,
  variable,
  onSave,
  onCancel,
  existingNames = [],
}: {
  visible: boolean;
  variable?: VariableDefinition;
  onSave: (data: VariableFormData) => void;
  onCancel: () => void;
  existingNames?: string[];
}) {
  const [form, setForm] = useState<VariableFormData>({
    name: variable?.name || '',
    type: variable?.type || 'string',
    defaultValue: variable?.defaultValue?.toString() || '',
    description: variable?.description || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof VariableFormData, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof VariableFormData, string>> = {};

    // 验证变量名
    if (!form.name.trim()) {
      newErrors.name = '变量名不能为空';
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(form.name)) {
      newErrors.name = '变量名只能包含字母、数字和下划线，且必须以字母或下划线开头';
    } else if (
      existingNames.includes(form.name) &&
      form.name !== variable?.name
    ) {
      newErrors.name = '变量名已存在';
    }

    // 验证默认值
    if (form.defaultValue) {
      switch (form.type) {
        case 'number':
          if (isNaN(Number(form.defaultValue))) {
            newErrors.defaultValue = '请输入有效的数字';
          }
          break;
        case 'boolean':
          if (!['true', 'false'].includes(form.defaultValue.toLowerCase())) {
            newErrors.defaultValue = '请输入 true 或 false';
          }
          break;
        case 'array':
        case 'object':
          try {
            JSON.parse(form.defaultValue);
          } catch {
            newErrors.defaultValue = '请输入有效的 JSON 格式';
          }
          break;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(form);
    }
  };

  return (
    <Modal
      title={variable ? '编辑变量' : '添加变量'}
      open={visible}
      onOk={handleSave}
      onCancel={onCancel}
      okText="保存"
      cancelText="取消"
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 变量名 */}
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>
            变量名 <span style={{ color: 'red' }}>*</span>
          </label>
          <Input
            placeholder="例如: userId, username"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            status={errors.name ? 'error' : undefined}
          />
          {errors.name && (
            <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
              {errors.name}
            </div>
          )}
        </div>

        {/* 变量类型 */}
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>
            类型 <span style={{ color: 'red' }}>*</span>
          </label>
          <Select
            style={{ width: '100%' }}
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value, defaultValue: '' })}
            options={VARIABLE_TYPE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
          />
        </div>

        {/* 默认值 */}
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>默认值</label>
          <Input.TextArea
            placeholder={
              form.type === 'array' || form.type === 'object'
                ? 'JSON 格式，例如: ["a", "b"] 或 {"key": "value"}'
                : '输入默认值'
            }
            value={form.defaultValue}
            onChange={(e) => setForm({ ...form, defaultValue: e.target.value })}
            rows={2}
            status={errors.defaultValue ? 'error' : undefined}
          />
          {errors.defaultValue && (
            <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
              {errors.defaultValue}
            </div>
          )}
        </div>

        {/* 描述 */}
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>描述</label>
          <Input.TextArea
            placeholder="变量的用途说明"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            maxLength={200}
            showCount
          />
        </div>
      </Space>
    </Modal>
  );
}

/**
 * Variable Manager Component
 */
export function VariableManager({ visible = true, onClose }: VariableManagerProps) {
  const flow = useDesignerStore((state) => state.flow);
  const updateFlow = useDesignerStore((state) => state.setFlow);

  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingVariable, setEditingVariable] = useState<VariableDefinition | undefined>();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingVariable, setDeletingVariable] = useState<VariableDefinition | undefined>();
  const [variableReferences, setVariableReferences] = useState<VariableReference[]>([]);

  const variables = flow?.variables || [];

  /**
   * 添加新变量
   */
  const handleAddVariable = () => {
    setEditingVariable(undefined);
    setEditDialogVisible(true);
  };

  /**
   * 编辑变量
   */
  const handleEditVariable = (variable: VariableDefinition) => {
    setEditingVariable(variable);
    setEditDialogVisible(true);
  };

  /**
   * 保存变量
   */
  const handleSaveVariable = (data: VariableFormData) => {
    if (!flow) return;

    const existingNames = variables
      .filter((v) => v.name !== editingVariable?.name)
      .map((v) => v.name);

    // 验证变量名唯一性
    if (existingNames.includes(data.name)) {
      message.error('变量名已存在');
      return;
    }

    let defaultValue: unknown = data.defaultValue;
    if (data.defaultValue) {
      switch (data.type) {
        case 'number':
          defaultValue = Number(data.defaultValue);
          break;
        case 'boolean':
          defaultValue = data.defaultValue.toLowerCase() === 'true';
          break;
        case 'array':
        case 'object':
          try {
            defaultValue = JSON.parse(data.defaultValue);
          } catch {
            defaultValue = data.defaultValue;
          }
          break;
      }
    }

    const newVariable: VariableDefinition = {
      name: data.name,
      type: data.type,
      defaultValue,
      description: data.description,
    };

    let newVariables: VariableDefinition[];
    if (editingVariable) {
      // 更新现有变量
      newVariables = variables.map((v) =>
        v.name === editingVariable.name ? newVariable : v,
      );
    } else {
      // 添加新变量
      newVariables = [...variables, newVariable];
    }

    updateFlow({
      ...flow,
      variables: newVariables,
      metadata: {
        ...flow.metadata,
        updatedAt: Date.now(),
      },
    });

    setEditDialogVisible(false);
    message.success(editingVariable ? '变量已更新' : '变量已添加');
  };

  /**
   * 删除变量前检查引用
   */
  const handleDeleteClick = (variable: VariableDefinition) => {
    if (!flow) return;

    const references = findVariableReferences(variable.name, flow.nodes);
    setVariableReferences(references);
    setDeletingVariable(variable);

    if (references.length > 0) {
      setDeleteConfirmVisible(true);
    } else {
      // 直接删除
      performDelete(variable);
    }
  };

  /**
   * 执行删除
   */
  const performDelete = (variable: VariableDefinition) => {
    if (!flow) return;

    const newVariables = variables.filter((v) => v.name !== variable.name);
    updateFlow({
      ...flow,
      variables: newVariables,
      metadata: {
        ...flow.metadata,
        updatedAt: Date.now(),
      },
    });

    setDeleteConfirmVisible(false);
    message.success('变量已删除');
  };

  /**
   * 格式化显示默认值
   */
  const formatDefaultValue = (variable: VariableDefinition): string => {
    const { defaultValue, type } = variable;
    if (defaultValue === undefined || defaultValue === null) {
      return '-';
    }
    if (type === 'array' || type === 'object') {
      return JSON.stringify(defaultValue);
    }
    return String(defaultValue);
  };

  const columns: ColumnsType<VariableDefinition> = [
    {
      title: '变量名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string) => (
        <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>
          {name}
        </code>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: VariableType) => {
        const option = VARIABLE_TYPE_OPTIONS.find((opt) => opt.value === type);
        return <Tag color={option?.color}>{option?.label}</Tag>;
      },
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      ellipsis: true,
      render: (_, variable) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {formatDefaultValue(variable)}
        </span>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string) => desc || '-',
    },
    {
      title: '引用数',
      key: 'references',
      width: 80,
      align: 'center',
      render: (_, variable) => {
        if (!flow) return 0;
        const refs = findVariableReferences(variable.name, flow.nodes);
        return refs.length > 0 ? (
          <Tag color="blue">{refs.length}</Tag>
        ) : (
          <span style={{ color: '#999' }}>0</span>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, variable) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditVariable(variable)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(variable)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!visible) return null;

  return (
    <div className="variable-manager">
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CodeOutlined style={{ fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 500 }}>变量管理</span>
          <Tag color="blue">{variables.length} 个变量</Tag>
        </div>
        <Space>
          <Button size="small" onClick={onClose}>
            关闭
          </Button>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddVariable}>
            添加变量
          </Button>
        </Space>
      </div>

      {/* 变量列表 */}
      <Table
        columns={columns}
        dataSource={variables}
        rowKey="name"
        size="small"
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{
          emptyText: (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ccc' }} />
              <p style={{ marginTop: 8, color: '#999' }}>暂无变量</p>
              <Button type="link" onClick={handleAddVariable}>
                添加第一个变量
              </Button>
            </div>
          ),
        }}
      />

      {/* 编辑对话框 */}
      <VariableEditDialog
        visible={editDialogVisible}
        variable={editingVariable}
        onSave={handleSaveVariable}
        onCancel={() => setEditDialogVisible(false)}
        existingNames={variables.map((v) => v.name)}
      />

      {/* 删除确认对话框 */}
      <Modal
        title="确认删除"
        open={deleteConfirmVisible}
        onOk={() => deletingVariable && performDelete(deletingVariable)}
        onCancel={() => setDeleteConfirmVisible(false)}
        okText="仍要删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginTop: 16 }}>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 24, marginRight: 8 }} />
          <span>
            变量 <code>{deletingVariable?.name}</code> 被 {variableReferences.length} 个节点引用：
          </span>
          <ul style={{ marginTop: 12, paddingLeft: 20 }}>
            {variableReferences.map((ref) => (
              <li key={ref.nodeId}>
                <strong>{ref.nodeName}</strong> - {ref.field}
              </li>
            ))}
          </ul>
          <p style={{ color: '#ff4d4f', marginTop: 12 }}>
            删除后，这些节点中的变量引用将失效，可能导致执行错误。
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default VariableManager;
