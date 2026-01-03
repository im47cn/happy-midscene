/**
 * Publish Form Component
 * Form for creating and editing templates for publication
 */

import {
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { templateApplier, templateAuditor } from '../services';
import type {
  AuditResult,
  ParameterDef,
  TemplateCategory,
  TemplateDraft,
} from '../types';
import { YamlPreview } from './YamlPreview';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface PublishFormProps {
  initialDraft?: Partial<TemplateDraft>;
  onSubmit: (draft: TemplateDraft) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'authentication', label: 'Authentication' },
  { value: 'navigation', label: 'Navigation' },
  { value: 'form-filling', label: 'Form Filling' },
  { value: 'data-extraction', label: 'Data Extraction' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'testing', label: 'Testing' },
  { value: 'utility', label: 'Utility' },
];

const PLATFORMS = [
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'desktop', label: 'Desktop' },
];

const PARAMETER_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
  { value: 'select', label: 'Select (Dropdown)' },
];

const LICENSES = [
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache 2.0' },
  { value: 'GPL-3.0', label: 'GPL 3.0' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause' },
  { value: 'CC-BY-4.0', label: 'CC BY 4.0' },
  { value: 'Unlicense', label: 'Unlicense' },
];

export const PublishForm: React.FC<PublishFormProps> = ({
  initialDraft,
  onSubmit,
  onCancel,
  isEditing = false,
}) => {
  const [form] = Form.useForm();
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [parameters, setParameters] = useState<ParameterDef[]>(
    initialDraft?.content?.parameters || []
  );
  const [yamlContent, setYamlContent] = useState(
    initialDraft?.content?.yaml || ''
  );

  // Extract parameters from YAML when it changes
  const handleYamlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const yaml = e.target.value;
      setYamlContent(yaml);

      // Auto-detect parameters from YAML
      const detectedParams = templateApplier.extractParameters(yaml);
      const existingNames = new Set(parameters.map((p) => p.name));

      // Add newly detected parameters
      const newParams = detectedParams
        .filter((name) => !existingNames.has(name))
        .map(
          (name): ParameterDef => ({
            name,
            label: formatLabel(name),
            type: 'string',
            required: true,
          })
        );

      if (newParams.length > 0) {
        setParameters((prev) => [...prev, ...newParams]);
      }
    },
    [parameters]
  );

  const handleAddParameter = useCallback(() => {
    const newParam: ParameterDef = {
      name: `param${parameters.length + 1}`,
      label: `Parameter ${parameters.length + 1}`,
      type: 'string',
      required: false,
    };
    setParameters((prev) => [...prev, newParam]);
  }, [parameters.length]);

  const handleRemoveParameter = useCallback((index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleParameterChange = useCallback(
    (index: number, field: keyof ParameterDef, value: unknown) => {
      setParameters((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleAudit = useCallback(async () => {
    setIsAuditing(true);
    try {
      const values = form.getFieldsValue();
      const draft: TemplateDraft = {
        name: values.name || '',
        description: values.description || '',
        shortDescription: values.shortDescription || '',
        category: values.category || 'utility',
        tags: values.tags || [],
        platforms: values.platforms || ['web'],
        language: values.language || 'en',
        content: {
          yaml: yamlContent,
          parameters,
        },
        license: values.license || 'MIT',
        version: values.version || '1.0.0',
      };

      const result = await templateAuditor.audit(draft);
      setAuditResult(result);
    } finally {
      setIsAuditing(false);
    }
  }, [form, yamlContent, parameters]);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const draft: TemplateDraft = {
        name: values.name as string,
        description: values.description as string,
        shortDescription: values.shortDescription as string,
        category: values.category as TemplateCategory,
        tags: values.tags as string[],
        platforms: values.platforms as string[],
        language: (values.language as string) || 'en',
        content: {
          yaml: yamlContent,
          parameters,
        },
        license: values.license as string,
        version: values.version as string,
      };

      // Run audit before submission
      const result = await templateAuditor.audit(draft);
      setAuditResult(result);

      if (result.passed) {
        onSubmit(draft);
      }
    },
    [yamlContent, parameters, onSubmit]
  );

  // Initialize form with initial draft values
  useEffect(() => {
    if (initialDraft) {
      form.setFieldsValue({
        name: initialDraft.name,
        description: initialDraft.description,
        shortDescription: initialDraft.shortDescription,
        category: initialDraft.category,
        tags: initialDraft.tags,
        platforms: initialDraft.platforms,
        language: initialDraft.language,
        license: initialDraft.license,
        version: initialDraft.version,
      });
    }
  }, [form, initialDraft]);

  return (
    <div className="publish-form">
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          category: 'utility',
          platforms: ['web'],
          language: 'en',
          license: 'MIT',
          version: '1.0.0',
        }}
      >
        <Title level={4}>
          {isEditing ? 'Edit Template' : 'Create New Template'}
        </Title>

        {/* Basic Information */}
        <Card size="small" title="Basic Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Template Name"
                rules={[
                  { required: true, message: 'Please enter a name' },
                  { min: 3, message: 'Name must be at least 3 characters' },
                  { max: 50, message: 'Name must be at most 50 characters' },
                ]}
              >
                <Input placeholder="e.g., Login Flow Template" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="version"
                label="Version"
                rules={[
                  { required: true, message: 'Please enter a version' },
                  {
                    pattern: /^\d+\.\d+\.\d+$/,
                    message: 'Use semantic versioning (e.g., 1.0.0)',
                  },
                ]}
              >
                <Input placeholder="1.0.0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="shortDescription"
            label="Short Description"
            rules={[
              { required: true, message: 'Please enter a short description' },
              { max: 100, message: 'Keep it under 100 characters' },
            ]}
          >
            <Input placeholder="Brief summary shown in search results" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Full Description"
            rules={[
              { required: true, message: 'Please enter a description' },
              { min: 20, message: 'Description should be at least 20 characters' },
            ]}
          >
            <TextArea
              rows={3}
              placeholder="Detailed description of what this template does..."
            />
          </Form.Item>
        </Card>

        {/* Classification */}
        <Card size="small" title="Classification" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true }]}
              >
                <Select options={CATEGORIES} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="platforms"
                label="Platforms"
                rules={[{ required: true }]}
              >
                <Checkbox.Group options={PLATFORMS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="license" label="License">
                <Select options={LICENSES} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="tags" label="Tags">
            <Select
              mode="tags"
              placeholder="Add relevant tags (press Enter to add)"
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Card>

        {/* YAML Content */}
        <Card size="small" title="Template YAML" style={{ marginBottom: 16 }}>
          <Form.Item
            name="yaml"
            label={
              <Space>
                <span>YAML Content</span>
                <Text type="secondary" style={{ fontWeight: 'normal' }}>
                  Use ${'{paramName}'} for parameters
                </Text>
              </Space>
            }
            rules={[{ required: true, message: 'YAML content is required' }]}
          >
            <TextArea
              rows={10}
              value={yamlContent}
              onChange={handleYamlChange}
              placeholder={`target:
  url: "\${loginUrl}"
flow:
  - ai: "Enter \${username} in username field"
  - ai: "Enter password"
  - ai: "Click login button"`}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <YamlPreview yaml={yamlContent} title="Preview" maxHeight={200} />
        </Card>

        {/* Parameters */}
        <Card
          size="small"
          title={
            <Space>
              <span>Parameters</span>
              <Text type="secondary" style={{ fontWeight: 'normal' }}>
                ({parameters.length} defined)
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddParameter}
            >
              Add Parameter
            </Button>
          }
        >
          {parameters.length === 0 ? (
            <Text type="secondary">
              No parameters defined. Parameters will be auto-detected from YAML
              content.
            </Text>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              {parameters.map((param, index) => (
                <Card
                  key={param.name}
                  size="small"
                  style={{ backgroundColor: '#fafafa' }}
                  extra={
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveParameter(index)}
                    />
                  }
                >
                  <Row gutter={8}>
                    <Col span={6}>
                      <Input
                        size="small"
                        placeholder="Name"
                        value={param.name}
                        onChange={(e) =>
                          handleParameterChange(index, 'name', e.target.value)
                        }
                        addonBefore="name"
                      />
                    </Col>
                    <Col span={6}>
                      <Input
                        size="small"
                        placeholder="Label"
                        value={param.label}
                        onChange={(e) =>
                          handleParameterChange(index, 'label', e.target.value)
                        }
                        addonBefore="label"
                      />
                    </Col>
                    <Col span={4}>
                      <Select
                        size="small"
                        value={param.type}
                        onChange={(val) =>
                          handleParameterChange(index, 'type', val)
                        }
                        options={PARAMETER_TYPES}
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col span={4}>
                      <Checkbox
                        checked={param.required}
                        onChange={(e) =>
                          handleParameterChange(
                            index,
                            'required',
                            e.target.checked
                          )
                        }
                      >
                        Required
                      </Checkbox>
                    </Col>
                    <Col span={4}>
                      <Input
                        size="small"
                        placeholder="Default"
                        value={param.default as string}
                        onChange={(e) =>
                          handleParameterChange(index, 'default', e.target.value)
                        }
                      />
                    </Col>
                  </Row>
                  <Input
                    size="small"
                    placeholder="Description"
                    value={param.description}
                    onChange={(e) =>
                      handleParameterChange(index, 'description', e.target.value)
                    }
                    style={{ marginTop: 8 }}
                    prefix={<InfoCircleOutlined />}
                  />
                </Card>
              ))}
            </Space>
          )}
        </Card>

        {/* Audit Results */}
        {auditResult && (
          <Card
            size="small"
            title="Security Audit"
            style={{ marginBottom: 16 }}
          >
            {auditResult.passed ? (
              <Alert
                type="success"
                message="Audit Passed"
                description="Your template passed all security checks."
                showIcon
              />
            ) : (
              <Alert
                type="error"
                message="Audit Failed"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {auditResult.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                }
                showIcon
              />
            )}
            {auditResult.warnings && auditResult.warnings.length > 0 && (
              <Alert
                type="warning"
                message="Warnings"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {auditResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                }
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Space>
            <Button onClick={handleAudit} loading={isAuditing}>
              Run Audit
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              disabled={auditResult !== null && !auditResult.passed}
            >
              {isEditing ? 'Save Changes' : 'Publish Template'}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

/**
 * Convert camelCase or snake_case to Title Case
 */
function formatLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\s/, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default PublishForm;
