/**
 * Data Generation Panel Component
 * Provides UI for generating and managing test data
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Select,
  Input,
  Table,
  Tag,
  Space,
  Tooltip,
  message,
  Collapse,
  Typography,
  Badge,
  Divider,
} from 'antd';
import {
  ThunderboltOutlined,
  CopyOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DatabaseOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { SemanticType, FieldDefinition } from '../../types/dataGen';
import { dataGenerator } from '../../services/dataGen/dataGenerator';
import { dataMasker, isSensitiveType } from '../../services/dataGen/dataMasker';
import { templateManager } from '../../services/dataGen/templateManager';
import { createFormFields } from '../../services/dataGen/fieldRecognizer';

const { Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

/**
 * Semantic type options with labels
 */
const SEMANTIC_TYPE_OPTIONS: Array<{ value: SemanticType; label: string; category: string }> = [
  // Personal
  { value: 'username', label: '用户名', category: '个人信息' },
  { value: 'realname', label: '真实姓名', category: '个人信息' },
  { value: 'nickname', label: '昵称', category: '个人信息' },
  { value: 'email', label: '邮箱', category: '个人信息' },
  { value: 'mobile_phone', label: '手机号', category: '个人信息' },
  { value: 'id_card', label: '身份证号', category: '个人信息' },
  // Financial
  { value: 'bank_card', label: '银行卡号', category: '金融信息' },
  { value: 'amount', label: '金额', category: '金融信息' },
  // Location
  { value: 'address', label: '地址', category: '位置信息' },
  { value: 'city', label: '城市', category: '位置信息' },
  { value: 'province', label: '省份', category: '位置信息' },
  { value: 'postal_code', label: '邮编', category: '位置信息' },
  // Business
  { value: 'company', label: '公司名称', category: '商业信息' },
  { value: 'job_title', label: '职位', category: '商业信息' },
  { value: 'url', label: 'URL', category: '商业信息' },
  // Security
  { value: 'password', label: '密码', category: '安全信息' },
  { value: 'captcha', label: '验证码', category: '安全信息' },
  // Other
  { value: 'description', label: '描述', category: '其他' },
  { value: 'quantity', label: '数量', category: '其他' },
  { value: 'date_of_birth', label: '出生日期', category: '其他' },
];

/**
 * Generated data item
 */
interface GeneratedItem {
  key: string;
  semanticType: SemanticType;
  label: string;
  value: string;
  maskedValue: string;
  isSensitive: boolean;
}

/**
 * Props for DataGenPanel
 */
interface DataGenPanelProps {
  onInsertValue?: (value: string, semanticType: SemanticType) => void;
  compact?: boolean;
}

/**
 * Data Generation Panel Component
 */
export function DataGenPanel({ onInsertValue, compact = false }: DataGenPanelProps) {
  const [selectedType, setSelectedType] = useState<SemanticType>('mobile_phone');
  const [generatedData, setGeneratedData] = useState<GeneratedItem[]>([]);
  const [showMasked, setShowMasked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      await templateManager.init();
      const allTemplates = await templateManager.list();
      setTemplates(allTemplates.map((t) => ({ id: t.id, name: t.name })));
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  // Generate single value
  const generateSingle = useCallback(async () => {
    setLoading(true);
    try {
      const label = SEMANTIC_TYPE_OPTIONS.find((o) => o.value === selectedType)?.label || selectedType;
      const field: FieldDefinition = {
        id: `gen_${Date.now()}`,
        name: selectedType,
        label,
        fieldType: 'text',
        semanticType: selectedType,
        constraints: { required: false },
        metadata: {},
      };

      const value = await dataGenerator.generate(field);
      const valueStr = String(value);
      const maskedValue = dataMasker.mask(value, selectedType);

      const newItem: GeneratedItem = {
        key: `${Date.now()}_${Math.random()}`,
        semanticType: selectedType,
        label,
        value: valueStr,
        maskedValue,
        isSensitive: isSensitiveType(selectedType),
      };

      setGeneratedData((prev) => [newItem, ...prev].slice(0, 20)); // Keep last 20
      message.success(`生成 ${label}: ${maskedValue}`);
    } catch (error) {
      message.error('生成失败');
      console.error('Generate error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedType]);

  // Generate from template
  const generateFromTemplate = useCallback(async (templateId: string) => {
    setLoading(true);
    try {
      const data = await templateManager.applyTemplate(templateId);
      const template = await templateManager.get(templateId);

      if (template) {
        const newItems: GeneratedItem[] = [];

        for (const field of template.fields) {
          const value = data[field.fieldId];
          if (value !== undefined) {
            const semanticType = (field.generatorId as SemanticType) || 'custom';
            const valueStr = String(value);
            const maskedValue = dataMasker.mask(value, semanticType);

            newItems.push({
              key: `${Date.now()}_${field.fieldId}`,
              semanticType,
              label: field.fieldName,
              value: valueStr,
              maskedValue,
              isSensitive: isSensitiveType(semanticType),
            });
          }
        }

        setGeneratedData((prev) => [...newItems, ...prev].slice(0, 20));
        message.success(`模板 "${template.name}" 生成成功`);
      }
    } catch (error) {
      message.error('模板生成失败');
      console.error('Template generate error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate preset form
  const generatePresetForm = useCallback(async (formType: 'login' | 'register' | 'profile' | 'payment') => {
    setLoading(true);
    try {
      const fields = createFormFields(formType);
      const result = await dataGenerator.generateForForm(fields);

      const newItems: GeneratedItem[] = [];

      for (const field of fields) {
        const genData = result.fields[field.id];
        if (genData) {
          const valueStr = String(genData.value);
          const maskedValue = genData.maskedValue || dataMasker.mask(genData.value, field.semanticType);

          newItems.push({
            key: `${Date.now()}_${field.id}`,
            semanticType: field.semanticType,
            label: field.label,
            value: valueStr,
            maskedValue,
            isSensitive: isSensitiveType(field.semanticType),
          });
        }
      }

      setGeneratedData((prev) => [...newItems, ...prev].slice(0, 20));
      message.success(`${formType} 表单生成成功`);
    } catch (error) {
      message.error('表单生成失败');
      console.error('Form generate error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle mask visibility
  const toggleMask = (key: string) => {
    setShowMasked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Copy value
  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    message.success('已复制');
  };

  // Insert value
  const handleInsert = (item: GeneratedItem) => {
    if (onInsertValue) {
      onInsertValue(item.value, item.semanticType);
      message.success('已插入');
    }
  };

  // Table columns
  const columns: ColumnsType<GeneratedItem> = [
    {
      title: '类型',
      dataIndex: 'label',
      key: 'label',
      width: 100,
      render: (label: string, record) => (
        <Tag color={record.isSensitive ? 'red' : 'blue'}>{label}</Tag>
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      render: (value: string, record) => {
        const displayValue = record.isSensitive && !showMasked[record.key]
          ? record.maskedValue
          : value;

        return (
          <Space>
            <Text copyable={{ text: value }} style={{ fontFamily: 'monospace' }}>
              {displayValue}
            </Text>
            {record.isSensitive && (
              <Tooltip title={showMasked[record.key] ? '隐藏' : '显示'}>
                <Button
                  type="text"
                  size="small"
                  icon={showMasked[record.key] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => toggleMask(record.key)}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyValue(record.value)}
            />
          </Tooltip>
          {onInsertValue && (
            <Tooltip title="插入">
              <Button
                type="primary"
                size="small"
                onClick={() => handleInsert(record)}
              >
                插入
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Compact view
  if (compact) {
    return (
      <div style={{ padding: 8 }}>
        <Space wrap>
          <Select
            value={selectedType}
            onChange={setSelectedType}
            style={{ width: 120 }}
            size="small"
          >
            {SEMANTIC_TYPE_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={generateSingle}
            loading={loading}
          >
            生成
          </Button>
        </Space>

        {generatedData.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Text strong>最新: </Text>
            <Text code copyable>
              {generatedData[0].isSensitive ? generatedData[0].maskedValue : generatedData[0].value}
            </Text>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          <span>智能数据生成</span>
          <Badge count={generatedData.length} style={{ marginLeft: 8 }} />
        </Space>
      }
      size="small"
    >
      <Collapse defaultActiveKey={['single', 'history']} ghost>
        {/* Single Generation */}
        <Panel header="单字段生成" key="single">
          <Space wrap>
            <Select
              value={selectedType}
              onChange={setSelectedType}
              style={{ width: 150 }}
              showSearch
              optionFilterProp="children"
            >
              {Object.entries(
                SEMANTIC_TYPE_OPTIONS.reduce((acc, opt) => {
                  if (!acc[opt.category]) acc[opt.category] = [];
                  acc[opt.category].push(opt);
                  return acc;
                }, {} as Record<string, typeof SEMANTIC_TYPE_OPTIONS>)
              ).map(([category, options]) => (
                <Select.OptGroup key={category} label={category}>
                  {options.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={generateSingle}
              loading={loading}
            >
              生成
            </Button>
          </Space>
        </Panel>

        {/* Preset Forms */}
        <Panel header="预设表单" key="forms">
          <Space wrap>
            <Button onClick={() => generatePresetForm('login')} loading={loading}>
              登录表单
            </Button>
            <Button onClick={() => generatePresetForm('register')} loading={loading}>
              注册表单
            </Button>
            <Button onClick={() => generatePresetForm('profile')} loading={loading}>
              个人信息
            </Button>
            <Button onClick={() => generatePresetForm('payment')} loading={loading}>
              支付表单
            </Button>
          </Space>
        </Panel>

        {/* Templates */}
        {templates.length > 0 && (
          <Panel
            header={
              <Space>
                <FileTextOutlined />
                模板
              </Space>
            }
            key="templates"
          >
            <Space wrap>
              {templates.map((t) => (
                <Button
                  key={t.id}
                  size="small"
                  onClick={() => generateFromTemplate(t.id)}
                  loading={loading}
                >
                  {t.name}
                </Button>
              ))}
            </Space>
          </Panel>
        )}

        {/* History */}
        <Panel
          header={
            <Space>
              <span>生成历史</span>
              {generatedData.length > 0 && (
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => setGeneratedData([])}
                >
                  清空
                </Button>
              )}
            </Space>
          }
          key="history"
        >
          <Table
            columns={columns}
            dataSource={generatedData}
            pagination={false}
            size="small"
            scroll={{ y: 200 }}
            locale={{ emptyText: '暂无数据，点击"生成"开始' }}
          />
        </Panel>
      </Collapse>
    </Card>
  );
}

export default DataGenPanel;
