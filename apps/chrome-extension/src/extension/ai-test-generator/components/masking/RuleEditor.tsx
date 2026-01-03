/**
 * Rule Editor Component
 * Modal form for creating and editing detection rules
 */

import {
  DeleteOutlined,
  ExperimentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  message,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
  DetectionRule,
  DetectionType,
  MaskingMethod,
  MaskingScope,
  SensitiveCategory,
} from '../../types/masking';

/**
 * Category options for select
 */
const CATEGORY_OPTIONS: { value: SensitiveCategory; label: string }[] = [
  { value: 'credential', label: '凭证' },
  { value: 'pii', label: '个人信息' },
  { value: 'financial', label: '金融' },
  { value: 'health', label: '健康' },
  { value: 'custom', label: '自定义' },
];

/**
 * Detection type options
 */
const DETECTION_TYPE_OPTIONS: { value: DetectionType; label: string }[] = [
  { value: 'regex', label: '正则表达式' },
  { value: 'keyword', label: '关键词' },
  { value: 'pattern', label: '模式匹配' },
];

/**
 * Masking method options
 */
const MASKING_METHOD_OPTIONS: { value: MaskingMethod; label: string }[] = [
  { value: 'full', label: '完全遮盖 (********)' },
  { value: 'partial', label: '部分保留 (138****5678)' },
  { value: 'hash', label: '哈希替换 ([MASKED:a1b2c3])' },
  { value: 'placeholder', label: '占位符 ([PASSWORD])' },
];

/**
 * Form values interface
 */
interface RuleFormValues {
  name: string;
  description: string;
  priority: number;
  category: SensitiveCategory;
  detectionType: DetectionType;
  pattern: string;
  flags: string;
  contextBefore?: string;
  contextAfter?: string;
  maskingMethod: MaskingMethod;
  keepStart?: number;
  keepEnd?: number;
  maskChar?: string;
  hashLength?: number;
  placeholder?: string;
  scopeText: boolean;
  scopeScreenshot: boolean;
  scopeLog: boolean;
  scopeYaml: boolean;
}

interface RuleEditorProps {
  visible: boolean;
  rule?: DetectionRule | null;
  onSave: (rule: DetectionRule) => void;
  onCancel: () => void;
  onDelete?: (ruleId: string) => void;
  existingRuleIds?: string[];
}

/**
 * Generate unique rule ID
 */
function generateRuleId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Validate regex pattern
 */
function validateRegex(pattern: string, flags = ''): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * RuleEditor component
 */
export const RuleEditor: React.FC<RuleEditorProps> = ({
  visible,
  rule,
  onSave,
  onCancel,
  onDelete,
  existingRuleIds = [],
}) => {
  const [form] = Form.useForm<RuleFormValues>();
  const [regexTestInput, setRegexTestInput] = useState('');
  const [regexTestResult, setRegexTestResult] = useState<{
    matches: string[];
    error?: string;
  } | null>(null);

  const isEditing = !!rule;
  const isBuiltIn = rule?.builtIn ?? false;

  // Reset form when rule changes
  useEffect(() => {
    if (visible) {
      if (rule) {
        form.setFieldsValue({
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          category: rule.category,
          detectionType: rule.detection.type,
          pattern: rule.detection.pattern,
          flags: rule.detection.flags || '',
          contextBefore: rule.detection.context?.before,
          contextAfter: rule.detection.context?.after,
          maskingMethod: rule.masking.method,
          keepStart: rule.masking.options?.keepStart,
          keepEnd: rule.masking.options?.keepEnd,
          maskChar: rule.masking.options?.maskChar,
          hashLength: rule.masking.options?.hashLength,
          placeholder: rule.masking.options?.placeholder,
          scopeText: rule.scope.text,
          scopeScreenshot: rule.scope.screenshot,
          scopeLog: rule.scope.log,
          scopeYaml: rule.scope.yaml,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          priority: 50,
          category: 'custom',
          detectionType: 'regex',
          maskingMethod: 'full',
          flags: 'gi',
          scopeText: true,
          scopeScreenshot: true,
          scopeLog: true,
          scopeYaml: true,
        });
      }
      setRegexTestInput('');
      setRegexTestResult(null);
    }
  }, [visible, rule, form]);

  // Handle form submit
  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();

      // Validate regex pattern
      if (values.detectionType === 'regex') {
        const validation = validateRegex(values.pattern, values.flags);
        if (!validation.valid) {
          message.error(`正则表达式无效: ${validation.error}`);
          return;
        }
      }

      // Build the rule
      const scope: MaskingScope = {
        text: values.scopeText,
        screenshot: values.scopeScreenshot,
        log: values.scopeLog,
        yaml: values.scopeYaml,
      };

      const now = Date.now();
      const newRule: DetectionRule = {
        id: rule?.id || generateRuleId(),
        name: values.name,
        description: values.description,
        enabled: rule?.enabled ?? true,
        priority: values.priority,
        detection: {
          type: values.detectionType,
          pattern: values.pattern,
          flags: values.flags || undefined,
          context:
            values.contextBefore || values.contextAfter
              ? {
                  before: values.contextBefore,
                  after: values.contextAfter,
                }
              : undefined,
        },
        masking: {
          method: values.maskingMethod,
          options: buildMaskingOptions(values),
        },
        scope,
        category: values.category,
        builtIn: isBuiltIn,
        createdAt: rule?.createdAt || now,
        updatedAt: now,
      };

      onSave(newRule);
      message.success(isEditing ? '规则已更新' : '规则已创建');
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  }, [form, rule, isEditing, isBuiltIn, onSave]);

  // Build masking options based on method
  const buildMaskingOptions = (values: RuleFormValues) => {
    switch (values.maskingMethod) {
      case 'partial':
        return {
          keepStart: values.keepStart ?? 3,
          keepEnd: values.keepEnd ?? 4,
          maskChar: values.maskChar ?? '*',
        };
      case 'hash':
        return {
          hashLength: values.hashLength ?? 8,
        };
      case 'placeholder':
        return {
          placeholder: values.placeholder ?? `[${values.category.toUpperCase()}]`,
        };
      default:
        return undefined;
    }
  };

  // Test regex pattern
  const handleTestRegex = useCallback(() => {
    const pattern = form.getFieldValue('pattern');
    const flags = form.getFieldValue('flags') || '';

    if (!pattern) {
      message.warning('请输入正则表达式');
      return;
    }

    if (!regexTestInput) {
      message.warning('请输入测试文本');
      return;
    }

    const validation = validateRegex(pattern, flags);
    if (!validation.valid) {
      setRegexTestResult({ matches: [], error: validation.error });
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);
      const matches: string[] = [];
      let match: RegExpExecArray | null;

      if (flags.includes('g')) {
        while ((match = regex.exec(regexTestInput)) !== null) {
          matches.push(match[0]);
          if (!flags.includes('g')) break;
        }
      } else {
        match = regex.exec(regexTestInput);
        if (match) {
          matches.push(match[0]);
        }
      }

      setRegexTestResult({ matches });
    } catch (e) {
      setRegexTestResult({ matches: [], error: (e as Error).message });
    }
  }, [form, regexTestInput]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (rule && onDelete) {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除规则 "${rule.name}" 吗？此操作不可撤销。`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => {
          onDelete(rule.id);
          message.success('规则已删除');
        },
      });
    }
  }, [rule, onDelete]);

  const maskingMethod = Form.useWatch('maskingMethod', form);

  return (
    <Modal
      title={
        <Space>
          {isEditing ? '编辑规则' : '新建规则'}
          {isBuiltIn && (
            <Tag color="geekblue" style={{ marginLeft: 8 }}>
              内置规则
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={[
        rule && !isBuiltIn && onDelete && (
          <Button
            key="delete"
            danger
            icon={<DeleteOutlined />}
            onClick={handleDelete}
            style={{ float: 'left' }}
          >
            删除
          </Button>
        ),
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSubmit}>
          保存
        </Button>,
      ].filter(Boolean)}
    >
      <Form
        form={form}
        layout="vertical"
        size="small"
        disabled={isBuiltIn}
        style={{ maxHeight: 500, overflowY: 'auto', paddingRight: 8 }}
      >
        {/* Basic Info */}
        <Form.Item
          name="name"
          label="规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
        >
          <Input placeholder="例如：手机号检测" maxLength={50} />
        </Form.Item>

        <Form.Item
          name="description"
          label="描述"
          rules={[{ required: true, message: '请输入规则描述' }]}
        >
          <Input.TextArea placeholder="描述此规则的用途" rows={2} maxLength={200} />
        </Form.Item>

        <Space style={{ width: '100%' }}>
          <Form.Item
            name="category"
            label="类别"
            rules={[{ required: true }]}
            style={{ width: 150 }}
          >
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级 (0-100)"
            rules={[{ required: true }]}
            style={{ width: 150 }}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        {/* Detection Config */}
        <Form.Item name="detectionType" label="检测方式">
          <Radio.Group options={DETECTION_TYPE_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="pattern"
          label="匹配模式"
          rules={[{ required: true, message: '请输入匹配模式' }]}
        >
          <Input.TextArea
            placeholder="正则表达式或关键词，例如：1[3-9]\d{9}"
            rows={2}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item name="flags" label="正则标志">
          <Input placeholder="gi" maxLength={10} style={{ width: 100 }} />
        </Form.Item>

        {/* Regex Tester */}
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            <ExperimentOutlined /> 测试正则
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="输入测试文本"
              value={regexTestInput}
              onChange={(e) => setRegexTestInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleTestRegex}>测试</Button>
          </Space.Compact>
          {regexTestResult && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {regexTestResult.error ? (
                <span style={{ color: '#ff4d4f' }}>错误: {regexTestResult.error}</span>
              ) : regexTestResult.matches.length > 0 ? (
                <span style={{ color: '#52c41a' }}>
                  匹配 {regexTestResult.matches.length} 处:{' '}
                  {regexTestResult.matches.map((m, i) => (
                    <Tag key={i} color="green" style={{ marginLeft: 4 }}>
                      {m}
                    </Tag>
                  ))}
                </span>
              ) : (
                <span style={{ color: '#999' }}>无匹配</span>
              )}
            </div>
          )}
        </div>

        {/* Context Matching (Optional) */}
        <Space style={{ width: '100%' }}>
          <Form.Item name="contextBefore" label="前置上下文" style={{ flex: 1 }}>
            <Input placeholder="可选，匹配前的文本" />
          </Form.Item>
          <Form.Item name="contextAfter" label="后置上下文" style={{ flex: 1 }}>
            <Input placeholder="可选，匹配后的文本" />
          </Form.Item>
        </Space>

        {/* Masking Config */}
        <Form.Item name="maskingMethod" label="脱敏方式">
          <Select options={MASKING_METHOD_OPTIONS} style={{ width: 250 }} />
        </Form.Item>

        {/* Partial masking options */}
        {maskingMethod === 'partial' && (
          <Space>
            <Form.Item name="keepStart" label="保留前">
              <InputNumber min={0} max={10} addonAfter="位" />
            </Form.Item>
            <Form.Item name="keepEnd" label="保留后">
              <InputNumber min={0} max={10} addonAfter="位" />
            </Form.Item>
            <Form.Item name="maskChar" label="遮盖字符">
              <Input style={{ width: 60 }} maxLength={1} />
            </Form.Item>
          </Space>
        )}

        {/* Hash options */}
        {maskingMethod === 'hash' && (
          <Form.Item name="hashLength" label="哈希长度">
            <InputNumber min={4} max={16} addonAfter="位" />
          </Form.Item>
        )}

        {/* Placeholder options */}
        {maskingMethod === 'placeholder' && (
          <Form.Item name="placeholder" label="占位符文本">
            <Input placeholder="[PASSWORD]" style={{ width: 200 }} />
          </Form.Item>
        )}

        {/* Scope Config */}
        <Form.Item label="适用范围">
          <Space direction="vertical">
            <Form.Item name="scopeText" valuePropName="checked" noStyle>
              <Checkbox>文本内容</Checkbox>
            </Form.Item>
            <Form.Item name="scopeScreenshot" valuePropName="checked" noStyle>
              <Checkbox>截图</Checkbox>
            </Form.Item>
            <Form.Item name="scopeLog" valuePropName="checked" noStyle>
              <Checkbox>日志输出</Checkbox>
            </Form.Item>
            <Form.Item name="scopeYaml" valuePropName="checked" noStyle>
              <Checkbox>YAML 脚本</Checkbox>
            </Form.Item>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RuleEditor;
