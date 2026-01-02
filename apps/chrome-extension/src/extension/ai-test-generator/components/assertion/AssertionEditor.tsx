/**
 * Assertion Editor Component
 * Allows editing assertion parameters and creating custom assertions
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Typography,
  Divider,
} from 'antd';
import type {
  AssertionRecommendation,
  AssertionType,
  AssertionOperator,
  AssertionParams,
} from '../../types/assertion';
import { ASSERTION_TYPE_LABELS } from '../../types/assertion';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface AssertionEditorProps {
  visible: boolean;
  recommendation?: AssertionRecommendation | null;
  onSave: (recommendation: AssertionRecommendation) => void;
  onCancel: () => void;
  mode?: 'edit' | 'create';
}

/**
 * Assertion types with descriptions
 */
const ASSERTION_TYPE_OPTIONS: {
  value: AssertionType;
  label: string;
  description: string;
}[] = [
  {
    value: 'text_contains',
    label: '文本包含',
    description: '验证页面包含指定文本',
  },
  {
    value: 'text_equals',
    label: '文本等于',
    description: '验证元素文本完全等于预期值',
  },
  {
    value: 'element_exists',
    label: '元素存在',
    description: '验证页面上存在指定元素',
  },
  {
    value: 'element_visible',
    label: '元素可见',
    description: '验证元素存在且可见',
  },
  {
    value: 'url_contains',
    label: 'URL 包含',
    description: '验证当前 URL 包含指定内容',
  },
  {
    value: 'url_equals',
    label: 'URL 等于',
    description: '验证当前 URL 完全等于预期值',
  },
  {
    value: 'value_equals',
    label: '值等于',
    description: '验证输入框的值等于预期',
  },
  {
    value: 'count_equals',
    label: '数量等于',
    description: '验证匹配元素的数量',
  },
  {
    value: 'enabled',
    label: '已启用',
    description: '验证元素处于启用状态',
  },
  {
    value: 'disabled',
    label: '已禁用',
    description: '验证元素处于禁用状态',
  },
  {
    value: 'checked',
    label: '已选中',
    description: '验证复选框/单选框已选中',
  },
  {
    value: 'unchecked',
    label: '未选中',
    description: '验证复选框/单选框未选中',
  },
];

/**
 * Operator options
 */
const OPERATOR_OPTIONS: { value: AssertionOperator; label: string }[] = [
  { value: 'equals', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'matches', label: '匹配正则' },
  { value: 'gt', label: '大于' },
  { value: 'lt', label: '小于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
];

/**
 * Generate unique ID
 */
function generateId(): string {
  return `ast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate YAML output from form values
 */
function generateYaml(type: AssertionType, params: AssertionParams): string {
  switch (type) {
    case 'text_contains':
      return `- aiAssert: "页面包含文本 '${params.expectedValue || params.target || ''}'"`;

    case 'text_equals':
      return `- aiAssert: "元素 '${params.target || ''}' 的文本等于 '${params.expectedValue || ''}'"`;

    case 'element_exists':
      return `- aiAssert: "元素 '${params.target || ''}' 存在"`;

    case 'element_visible':
      return `- aiAssert: "元素 '${params.target || ''}' 可见"`;

    case 'url_contains':
      return `- aiAssert: "当前 URL 包含 '${params.expectedValue || ''}'"`;

    case 'url_equals':
      return `- aiAssert: "当前 URL 等于 '${params.expectedValue || ''}'"`;

    case 'value_equals':
      return `- aiAssert: "'${params.target || ''}' 的值等于 '${params.expectedValue || ''}'"`;

    case 'count_equals':
      return `- ai: "验证 '${params.target || ''}' 的数量为 ${params.expectedValue || 0}"`;

    case 'enabled':
      return `- aiAssert: "元素 '${params.target || ''}' 已启用"`;

    case 'disabled':
      return `- aiAssert: "元素 '${params.target || ''}' 已禁用"`;

    case 'checked':
      return `- aiAssert: "'${params.target || ''}' 已选中"`;

    case 'unchecked':
      return `- aiAssert: "'${params.target || ''}' 未选中"`;

    default:
      return `- ai: "验证 ${params.target || ''}"`;
  }
}

/**
 * Generate description from form values
 */
function generateDescription(type: AssertionType, params: AssertionParams): string {
  const typeLabel = ASSERTION_TYPE_LABELS[type] || type;
  const target = params.target || params.expectedValue || '';

  return `验证${typeLabel}: ${target}`;
}

export function AssertionEditor({
  visible,
  recommendation,
  onSave,
  onCancel,
  mode = 'edit',
}: AssertionEditorProps) {
  const [form] = Form.useForm();
  const [previewYaml, setPreviewYaml] = useState('');

  // Initialize form with recommendation data
  useEffect(() => {
    if (visible && recommendation) {
      form.setFieldsValue({
        type: recommendation.type,
        target: recommendation.parameters.target,
        expectedValue: recommendation.parameters.expectedValue,
        operator: recommendation.parameters.operator || 'contains',
        timeout: recommendation.parameters.timeout || 5000,
        description: recommendation.description,
      });
      setPreviewYaml(recommendation.yamlOutput);
    } else if (visible && mode === 'create') {
      form.resetFields();
      form.setFieldsValue({
        type: 'text_contains',
        operator: 'contains',
        timeout: 5000,
      });
      setPreviewYaml('');
    }
  }, [visible, recommendation, form, mode]);

  // Update preview when form changes
  const handleValuesChange = () => {
    const values = form.getFieldsValue();
    const yaml = generateYaml(values.type, {
      target: values.target,
      expectedValue: values.expectedValue,
      operator: values.operator,
      timeout: values.timeout,
    });
    setPreviewYaml(yaml);
  };

  // Save handler
  const handleSave = () => {
    form.validateFields().then((values) => {
      const params: AssertionParams = {
        target: values.target,
        expectedValue: values.expectedValue,
        operator: values.operator,
        timeout: values.timeout,
      };

      const newRecommendation: AssertionRecommendation = {
        id: recommendation?.id || generateId(),
        type: values.type,
        description: values.description || generateDescription(values.type, params),
        confidence: recommendation?.confidence || 100,
        reason: mode === 'create' ? '用户自定义断言' : recommendation?.reason || '',
        parameters: params,
        yamlOutput: generateYaml(values.type, params),
        source: 'rule',
      };

      onSave(newRecommendation);
    });
  };

  // Check which fields to show based on type
  const selectedType = Form.useWatch('type', form);
  const showTarget = !['url_contains', 'url_equals'].includes(selectedType);
  const showExpectedValue = [
    'text_contains',
    'text_equals',
    'url_contains',
    'url_equals',
    'value_equals',
    'count_equals',
    'attribute_equals',
  ].includes(selectedType);
  const showOperator = ['text_contains', 'text_equals', 'value_equals'].includes(
    selectedType
  );

  return (
    <Modal
      title={mode === 'create' ? '创建断言' : '编辑断言'}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          保存
        </Button>,
      ]}
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        className="assertion-editor-form"
      >
        <Form.Item
          name="type"
          label="断言类型"
          rules={[{ required: true, message: '请选择断言类型' }]}
        >
          <Select placeholder="选择断言类型">
            {ASSERTION_TYPE_OPTIONS.map((opt) => (
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

        {showTarget && (
          <Form.Item
            name="target"
            label="目标元素"
            rules={[{ required: true, message: '请输入目标元素描述' }]}
          >
            <Input placeholder="输入元素描述，如：登录按钮、用户名输入框" />
          </Form.Item>
        )}

        {showExpectedValue && (
          <Form.Item
            name="expectedValue"
            label="预期值"
            rules={[{ required: true, message: '请输入预期值' }]}
          >
            <Input placeholder="输入预期的值或文本" />
          </Form.Item>
        )}

        {showOperator && (
          <Form.Item name="operator" label="匹配方式">
            <Select>
              {OPERATOR_OPTIONS.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item name="timeout" label="超时时间 (毫秒)">
          <InputNumber min={1000} max={30000} step={1000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="description" label="断言描述">
          <TextArea
            rows={2}
            placeholder="自定义断言描述（可选）"
          />
        </Form.Item>

        <Divider>预览</Divider>

        <div
          style={{
            padding: 12,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        >
          <Text code>{previewYaml || '- # 请填写断言参数'}</Text>
        </div>
      </Form>
    </Modal>
  );
}

export default AssertionEditor;
