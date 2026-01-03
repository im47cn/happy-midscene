/**
 * Template Detail Component
 * Displays full template details with parameter configuration
 */

import {
  AndroidOutlined,
  AppleOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  DownloadOutlined,
  GlobalOutlined,
  HeartFilled,
  HeartOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  message,
  Row,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { templateApplier, templateStorage, ratingSystem } from '../services';
import type { PlatformType, Template, TemplateReview } from '../types';
import { ParameterForm } from './ParameterForm';
import { ReviewForm } from './ReviewForm';
import { ReviewList } from './ReviewList';
import { YamlPreview } from './YamlPreview';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface TemplateDetailProps {
  template: Template;
  onBack: () => void;
  onApply?: (yaml: string, template: Template) => void;
  loading?: boolean;
}

/**
 * Platform icon component
 */
const PlatformIcon: React.FC<{ platform: PlatformType }> = ({ platform }) => {
  switch (platform) {
    case 'web':
      return <GlobalOutlined />;
    case 'android':
      return <AndroidOutlined />;
    case 'ios':
      return <AppleOutlined />;
    default:
      return null;
  }
};

/**
 * Format date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const TemplateDetail: React.FC<TemplateDetailProps> = ({
  template,
  onBack,
  onApply,
  loading = false,
}) => {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviews, setReviews] = useState<TemplateReview[]>([]);
  const [reviewStats, setReviewStats] = useState<{
    average: number;
    count: number;
    distribution: Record<number, number>;
  }>();
  const [reviewLoading, setReviewLoading] = useState(false);

  // Initialize default parameters
  useEffect(() => {
    const defaults = templateApplier.getDefaultParams(template.content.parameters);
    setParams(defaults);
  }, [template]);

  // Load favorite status
  useEffect(() => {
    templateStorage.getTemplate(template.id).then((local) => {
      if (local) {
        setIsFavorite(local.isFavorite);
      }
    });
  }, [template.id]);

  // Load reviews
  useEffect(() => {
    const loadReviews = async () => {
      setReviewLoading(true);
      try {
        const [reviewList, stats] = await Promise.all([
          ratingSystem.getTemplateReviews(template.id),
          ratingSystem.getReviewStats(template.id),
        ]);
        setReviews(reviewList);
        setReviewStats(stats);
      } finally {
        setReviewLoading(false);
      }
    };
    loadReviews();
  }, [template.id]);

  const handleParamsChange = useCallback((newParams: Record<string, unknown>) => {
    setParams(newParams);
    // Validate on change
    const validation = templateApplier.validateParams(template.content.parameters, newParams);
    setErrors(validation.errors);
  }, [template.content.parameters]);

  const handleApply = useCallback(() => {
    const validation = templateApplier.validateParams(template.content.parameters, params);
    if (!validation.valid) {
      setErrors(validation.errors);
      message.error('Please fix the errors before applying');
      return;
    }

    const yaml = templateApplier.apply(template, params);
    templateStorage.recordUsage(template.id, params, yaml);

    if (onApply) {
      onApply(yaml, template);
    } else {
      navigator.clipboard.writeText(yaml);
      message.success('YAML copied to clipboard!');
    }
  }, [template, params, onApply]);

  const handleFavoriteClick = useCallback(async () => {
    await templateStorage.saveTemplate(template);
    await templateStorage.setFavorite(template.id, !isFavorite);
    setIsFavorite(!isFavorite);
    message.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
  }, [template, isFavorite]);

  const handleCopyYaml = useCallback(async () => {
    const yaml = templateApplier.previewYaml(template, params);
    await navigator.clipboard.writeText(yaml);
    message.success('YAML copied to clipboard');
  }, [template, params]);

  const handleReviewSubmit = useCallback(async (rating: number, comment: string) => {
    await ratingSystem.submitReview({
      templateId: template.id,
      userId: 'current-user', // TODO: Get from auth
      userName: 'You',
      rating: rating as 1 | 2 | 3 | 4 | 5,
      comment,
    });

    // Refresh reviews
    const [reviewList, stats] = await Promise.all([
      ratingSystem.getTemplateReviews(template.id),
      ratingSystem.getReviewStats(template.id),
    ]);
    setReviews(reviewList);
    setReviewStats(stats);
  }, [template.id]);

  const handleVoteHelpful = useCallback(async (reviewId: string, helpful: boolean) => {
    await ratingSystem.voteHelpful(reviewId, helpful);
    // Refresh reviews
    const reviewList = await ratingSystem.getTemplateReviews(template.id);
    setReviews(reviewList);
  }, [template.id]);

  const previewYaml = templateApplier.previewYaml(template, params);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="template-detail">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back
        </Button>
      </div>

      {/* Title Section */}
      <div style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space align="center" size={12}>
              <Title level={4} style={{ margin: 0 }}>
                {template.name}
              </Title>
              {template.verified && (
                <Tooltip title="Verified Template">
                  <SafetyCertificateOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                </Tooltip>
              )}
              {template.featured && (
                <Tag color="gold">Featured</Tag>
              )}
            </Space>
            <Space style={{ marginTop: 8 }}>
              <Space size={4}>
                <StarFilled style={{ color: '#fadb14' }} />
                <Text strong>{template.stats.rating.toFixed(1)}</Text>
                <Text type="secondary">({template.stats.ratingCount} reviews)</Text>
              </Space>
              <Divider type="vertical" />
              <Space size={4}>
                <DownloadOutlined />
                <Text>{template.stats.downloads.toLocaleString()} downloads</Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={isFavorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                onClick={handleFavoriteClick}
              >
                {isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
              <Button type="primary" onClick={handleApply}>
                Use Template
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Main Content */}
      <Tabs defaultActiveKey="overview">
        <TabPane tab="Overview" key="overview">
          <Row gutter={24}>
            <Col span={16}>
              {/* Description */}
              <Card title="Description" size="small" style={{ marginBottom: 16 }}>
                <Paragraph>{template.description}</Paragraph>
              </Card>

              {/* Parameters */}
              {template.content.parameters.length > 0 && (
                <Card title="Configure Parameters" size="small" style={{ marginBottom: 16 }}>
                  <ParameterForm
                    parameters={template.content.parameters}
                    values={params}
                    errors={errors}
                    onChange={handleParamsChange}
                  />
                </Card>
              )}

              {/* YAML Preview */}
              <Card
                title="YAML Preview"
                size="small"
                extra={
                  <Button type="text" icon={<CopyOutlined />} onClick={handleCopyYaml}>
                    Copy
                  </Button>
                }
              >
                <YamlPreview yaml={previewYaml} maxHeight={300} />
              </Card>
            </Col>

            <Col span={8}>
              {/* Template Info */}
              <Card title="Details" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Version">
                    v{template.version}
                  </Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Tag>{template.category}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Platforms">
                    <Space>
                      {template.platforms.map((p) => (
                        <Tooltip key={p} title={p.toUpperCase()}>
                          <PlatformIcon platform={p} />
                        </Tooltip>
                      ))}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="License">
                    {template.license}
                  </Descriptions.Item>
                  <Descriptions.Item label="Updated">
                    {formatDate(template.updatedAt)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* Publisher */}
              <Card title="Publisher" size="small" style={{ marginBottom: 16 }}>
                <Space>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {template.publisher.avatar ? (
                      <img
                        src={template.publisher.avatar}
                        alt={template.publisher.name}
                        style={{ width: '100%', borderRadius: 20 }}
                      />
                    ) : (
                      <Text strong style={{ fontSize: 16 }}>
                        {template.publisher.name.charAt(0)}
                      </Text>
                    )}
                  </div>
                  <div>
                    <Space size={4}>
                      <Text strong>{template.publisher.name}</Text>
                      {template.publisher.verified && (
                        <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
                      )}
                    </Space>
                    {template.publisher.bio && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {template.publisher.bio}
                        </Text>
                      </div>
                    )}
                  </div>
                </Space>
              </Card>

              {/* Tags */}
              {template.tags.length > 0 && (
                <Card title="Tags" size="small">
                  <Space wrap>
                    {template.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </Space>
                </Card>
              )}
            </Col>
          </Row>
        </TabPane>

        <TabPane tab={`Reviews (${reviews.length})`} key="reviews">
          <Card>
            <ReviewForm
              templateId={template.id}
              onSubmit={handleReviewSubmit}
            />
            <Divider />
            <ReviewList
              reviews={reviews}
              stats={reviewStats}
              onVoteHelpful={handleVoteHelpful}
              loading={reviewLoading}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default TemplateDetail;
