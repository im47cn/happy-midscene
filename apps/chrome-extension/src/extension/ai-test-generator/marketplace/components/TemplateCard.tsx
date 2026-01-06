/**
 * Template Card Component
 * Displays a template summary in a card format
 */

import {
  AndroidOutlined,
  AppleOutlined,
  DownloadOutlined,
  GlobalOutlined,
  HeartFilled,
  HeartOutlined,
  SafetyCertificateOutlined,
  StarFilled,
} from '@ant-design/icons';
import { Card, Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { PlatformType, TemplateSummary } from '../types';

const { Text, Paragraph } = Typography;

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: (template: TemplateSummary) => void;
  onFavoriteClick?: (template: TemplateSummary, isFavorite: boolean) => void;
  isFavorite?: boolean;
  compact?: boolean;
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
 * Format download count
 */
function formatDownloads(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * Format date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  onClick,
  onFavoriteClick,
  isFavorite = false,
  compact = false,
}) => {
  const handleClick = () => {
    onClick?.(template);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteClick?.(template, !isFavorite);
  };

  const cardStyle = useMemo(
    () => ({
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.2s, transform 0.2s',
    }),
    [onClick],
  );

  if (compact) {
    return (
      <Card
        size="small"
        onClick={handleClick}
        style={cardStyle}
        hoverable={!!onClick}
        className="template-card-compact"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong ellipsis style={{ maxWidth: 150 }}>
                {template.name}
              </Text>
              {template.publisher.verified && (
                <Tooltip title="Verified Publisher">
                  <SafetyCertificateOutlined
                    style={{ color: '#1890ff', fontSize: 12 }}
                  />
                </Tooltip>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              v{template.version}
            </Text>
          </div>
          <Space size={4}>
            <StarFilled style={{ color: '#fadb14', fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>
              {template.stats.rating.toFixed(1)}
            </Text>
          </Space>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={handleClick}
      style={cardStyle}
      hoverable={!!onClick}
      className="template-card"
      cover={
        template.thumbnail ? (
          <div
            style={{
              height: 120,
              background: `url(${template.thumbnail}) center/cover`,
              borderRadius: '8px 8px 0 0',
            }}
          />
        ) : (
          <div
            style={{
              height: 120,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px 8px 0 0',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
              {template.name.charAt(0).toUpperCase()}
            </Text>
          </div>
        )
      }
      actions={[
        <Space key="platforms" size={4}>
          {template.platforms.map((platform) => (
            <Tooltip key={platform} title={platform.toUpperCase()}>
              <PlatformIcon platform={platform} />
            </Tooltip>
          ))}
        </Space>,
        <Space key="stats" size={4}>
          <DownloadOutlined />
          <Text style={{ fontSize: 12 }}>
            {formatDownloads(template.stats.downloads)}
          </Text>
        </Space>,
        <span key="favorite" onClick={handleFavoriteClick}>
          {isFavorite ? (
            <HeartFilled style={{ color: '#ff4d4f' }} />
          ) : (
            <HeartOutlined />
          )}
        </span>,
      ]}
    >
      <Card.Meta
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong ellipsis style={{ flex: 1 }}>
              {template.name}
            </Text>
            {template.featured && (
              <Tag color="gold" style={{ marginRight: 0 }}>
                Featured
              </Tag>
            )}
          </div>
        }
        description={
          <div>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.65)' }}
            >
              {template.shortDescription}
            </Paragraph>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Space size={4}>
                <StarFilled style={{ color: '#fadb14' }} />
                <Text strong>{template.stats.rating.toFixed(1)}</Text>
                <Text type="secondary">({template.stats.ratingCount})</Text>
              </Space>

              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatDate(template.publishedAt)}
              </Text>
            </div>

            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                by {template.publisher.name}
              </Text>
              {template.publisher.verified && (
                <Tooltip title="Verified Publisher">
                  <SafetyCertificateOutlined
                    style={{ color: '#1890ff', fontSize: 12 }}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        }
      />
    </Card>
  );
};

export default TemplateCard;
