/**
 * Review List Component
 * Displays template reviews with ratings and helpfulness voting
 */

import {
  DislikeFilled,
  DislikeOutlined,
  LikeFilled,
  LikeOutlined,
  StarFilled,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Empty, List, Progress, Space, Typography } from 'antd';
import type React from 'react';
import type { TemplateReview } from '../types';

const { Text, Paragraph } = Typography;

interface ReviewListProps {
  reviews: TemplateReview[];
  stats?: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
  onVoteHelpful?: (reviewId: string, helpful: boolean) => void;
  loading?: boolean;
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Rating stars component
 */
const RatingStars: React.FC<{ rating: number; size?: number }> = ({
  rating,
  size = 14,
}) => (
  <Space size={2}>
    {[1, 2, 3, 4, 5].map((star) => (
      <StarFilled
        key={star}
        style={{
          fontSize: size,
          color: star <= rating ? '#fadb14' : '#d9d9d9',
        }}
      />
    ))}
  </Space>
);

/**
 * Review statistics summary
 */
const ReviewStats: React.FC<{
  stats: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
}> = ({ stats }) => {
  const maxCount = Math.max(...Object.values(stats.distribution));

  return (
    <div
      style={{
        display: 'flex',
        gap: 24,
        padding: '16px 0',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      {/* Average rating */}
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 36, fontWeight: 'bold', lineHeight: 1 }}>
          {stats.average.toFixed(1)}
        </div>
        <RatingStars rating={Math.round(stats.average)} size={16} />
        <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
          {stats.count} reviews
        </div>
      </div>

      {/* Distribution */}
      <div style={{ flex: 1 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.distribution[star] || 0;
          const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div
              key={star}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <Text style={{ width: 12, fontSize: 12 }}>{star}</Text>
              <StarFilled style={{ fontSize: 12, color: '#fadb14' }} />
              <Progress
                percent={percent}
                showInfo={false}
                size="small"
                strokeColor="#fadb14"
                style={{ flex: 1, margin: 0 }}
              />
              <Text
                style={{
                  width: 24,
                  fontSize: 12,
                  textAlign: 'right',
                  color: '#8c8c8c',
                }}
              >
                {count}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  stats,
  onVoteHelpful,
  loading = false,
}) => {
  if (reviews.length === 0 && !loading) {
    return (
      <Empty
        description="No reviews yet"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div>
      {stats && <ReviewStats stats={stats} />}

      <List
        loading={loading}
        dataSource={reviews}
        renderItem={(review) => (
          <List.Item style={{ padding: '16px 0', alignItems: 'flex-start' }}>
            <div style={{ width: '100%' }}>
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  src={review.userAvatar}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Text strong>{review.userName}</Text>
                    <RatingStars rating={review.rating} />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDate(review.createdAt)}
                    {review.updatedAt && ' (edited)'}
                  </Text>
                </div>
              </div>

              {/* Comment */}
              <Paragraph style={{ margin: '8px 0' }}>
                {review.comment}
              </Paragraph>

              {/* Helpfulness */}
              <Space size={16}>
                <Button
                  type="text"
                  size="small"
                  icon={review.helpful > 0 ? <LikeFilled /> : <LikeOutlined />}
                  onClick={() => onVoteHelpful?.(review.id, true)}
                >
                  Helpful ({review.helpful})
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={
                    review.notHelpful > 0 ? (
                      <DislikeFilled />
                    ) : (
                      <DislikeOutlined />
                    )
                  }
                  onClick={() => onVoteHelpful?.(review.id, false)}
                >
                  Not helpful ({review.notHelpful})
                </Button>
              </Space>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
};

export default ReviewList;
