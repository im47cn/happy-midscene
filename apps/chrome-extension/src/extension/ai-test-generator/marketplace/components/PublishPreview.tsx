/**
 * Publish Preview Component
 * Shows a preview of how the template will appear in the marketplace
 */

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  StarFilled,
  TagOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Space,
  Statistic,
  Steps,
  Tag,
  Typography,
} from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { TemplateDraft } from '../types';
import { YamlPreview } from './YamlPreview';

const { Title, Text, Paragraph } = Typography;

interface PublishPreviewProps {
  draft: TemplateDraft;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  authentication: 'blue',
  navigation: 'green',
  'form-filling': 'purple',
  'data-extraction': 'orange',
  'e-commerce': 'gold',
  'social-media': 'magenta',
  testing: 'cyan',
  utility: 'default',
};

export const PublishPreview: React.FC<PublishPreviewProps> = ({
  draft,
  onEdit,
  onConfirm,
  onCancel,
  isSubmitting = false,
}) => {
  const parameterCount = draft.content.parameters.length;
  const requiredParams = draft.content.parameters.filter(
    (p) => p.required,
  ).length;
  const optionalParams = parameterCount - requiredParams;

  const previewStats = useMemo(
    () => ({
      downloads: 0,
      rating: 0,
      reviews: 0,
    }),
    [],
  );

  return (
    <div className="publish-preview">
      <Title level={4}>Preview Your Template</Title>
      <Paragraph type="secondary">
        This is how your template will appear in the marketplace. Review it
        carefully before publishing.
      </Paragraph>

      {/* Publishing Steps */}
      <Steps
        current={2}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Create', icon: <EditOutlined /> },
          { title: 'Audit', icon: <CheckCircleOutlined /> },
          { title: 'Preview', icon: <EyeOutlined /> },
          { title: 'Publish', icon: <ClockCircleOutlined /> },
        ]}
      />

      {/* Card Preview */}
      <Card
        style={{ marginBottom: 24 }}
        title={
          <Space>
            <Badge.Ribbon
              text="New"
              color="green"
              style={{ right: -20, top: -8 }}
            >
              <span />
            </Badge.Ribbon>
            <Text strong>{draft.name}</Text>
          </Space>
        }
        extra={
          <Tag color={CATEGORY_COLORS[draft.category] || 'default'}>
            {draft.category}
          </Tag>
        }
      >
        <Row gutter={16}>
          <Col span={16}>
            <Paragraph>{draft.shortDescription}</Paragraph>
            <Space wrap>
              {draft.platforms.map((platform) => (
                <Tag key={platform}>{platform}</Tag>
              ))}
              {draft.tags?.slice(0, 3).map((tag) => (
                <Tag key={tag} icon={<TagOutlined />}>
                  {tag}
                </Tag>
              ))}
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
            <Space direction="vertical" size="small">
              <Space>
                <StarFilled style={{ color: '#faad14' }} />
                <Text type="secondary">No ratings yet</Text>
              </Space>
              <Space>
                <DownloadOutlined />
                <Text type="secondary">0 downloads</Text>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Detailed Preview */}
      <Row gutter={16}>
        <Col span={16}>
          {/* Description */}
          <Card size="small" title="Description" style={{ marginBottom: 16 }}>
            <Paragraph>{draft.description}</Paragraph>
          </Card>

          {/* YAML Preview */}
          <Card size="small" title="Template YAML" style={{ marginBottom: 16 }}>
            <YamlPreview
              yaml={draft.content.yaml}
              title={`${draft.name} YAML`}
              maxHeight={250}
            />
          </Card>

          {/* Parameters */}
          {parameterCount > 0 && (
            <Card
              size="small"
              title={`Parameters (${parameterCount})`}
              style={{ marginBottom: 16 }}
            >
              <Descriptions size="small" column={1} bordered>
                {draft.content.parameters.map((param) => (
                  <Descriptions.Item
                    key={param.name}
                    label={
                      <Space>
                        <Text code>{param.name}</Text>
                        {param.required && <Tag color="red">Required</Tag>}
                      </Space>
                    }
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{param.label}</Text>
                      {param.description && (
                        <Text type="secondary">{param.description}</Text>
                      )}
                      <Text type="secondary">Type: {param.type}</Text>
                      {param.default !== undefined && (
                        <Text type="secondary">
                          Default: {String(param.default)}
                        </Text>
                      )}
                    </Space>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
        </Col>

        <Col span={8}>
          {/* Template Info */}
          <Card size="small" title="Template Info" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Version">
                <Tag color="blue">{draft.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag color={CATEGORY_COLORS[draft.category] || 'default'}>
                  {draft.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Platforms">
                <Space wrap>
                  {draft.platforms.map((p) => (
                    <Tag key={p}>{p}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="License">
                {draft.license}
              </Descriptions.Item>
              <Descriptions.Item label="Language">
                {draft.language || 'en'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Stats Preview */}
          <Card
            size="small"
            title="Statistics (Preview)"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={8}>
              <Col span={8}>
                <Statistic
                  title="Downloads"
                  value={previewStats.downloads}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Rating"
                  value={previewStats.rating || '-'}
                  valueStyle={{ fontSize: 14 }}
                  prefix={<StarFilled style={{ color: '#faad14' }} />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Reviews"
                  value={previewStats.reviews}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
            </Row>
          </Card>

          {/* Parameters Summary */}
          <Card size="small" title="Parameters Summary">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">Total: </Text>
                <Text>{parameterCount}</Text>
              </div>
              <div>
                <Text type="secondary">Required: </Text>
                <Text>{requiredParams}</Text>
              </div>
              <div>
                <Text type="secondary">Optional: </Text>
                <Text>{optionalParams}</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* Publication Notice */}
      <Alert
        type="info"
        message="Publishing Guidelines"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Your template will be publicly available after publishing.</li>
            <li>Make sure you have the rights to share this content.</li>
            <li>
              Templates will be reviewed for security before being featured.
            </li>
            <li>You can update your template by publishing a new version.</li>
          </ul>
        }
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Space>
          <Button icon={<EditOutlined />} onClick={onEdit}>
            Edit Template
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={onConfirm}
            loading={isSubmitting}
          >
            Confirm & Publish
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default PublishPreview;
