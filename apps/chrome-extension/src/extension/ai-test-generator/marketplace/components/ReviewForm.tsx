/**
 * Review Form Component
 * Form for submitting template reviews
 */

import { StarFilled, StarOutlined } from '@ant-design/icons';
import {
  Button,
  Form,
  Input,
  message,
  Space,
} from 'antd';
import type React from 'react';
import { useCallback, useState } from 'react';

const { TextArea } = Input;

interface ReviewFormProps {
  templateId: string;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  existingReview?: {
    rating: number;
    comment: string;
  };
  loading?: boolean;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  templateId,
  onSubmit,
  existingReview,
  loading = false,
}) => {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment || '');

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      message.warning('Please select a rating');
      return;
    }
    if (comment.trim().length < 10) {
      message.warning('Please write at least 10 characters');
      return;
    }

    try {
      await onSubmit(rating, comment.trim());
      if (!existingReview) {
        setRating(0);
        setComment('');
      }
      message.success(existingReview ? 'Review updated!' : 'Review submitted!');
    } catch (error) {
      message.error('Failed to submit review');
    }
  }, [rating, comment, onSubmit, existingReview]);

  const displayRating = hoverRating || rating;

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
      <Form layout="vertical">
        {/* Rating */}
        <Form.Item
          label="Your Rating"
          required
        >
          <Space size={4}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                style={{ cursor: 'pointer', fontSize: 24 }}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
              >
                {star <= displayRating ? (
                  <StarFilled style={{ color: '#fadb14' }} />
                ) : (
                  <StarOutlined style={{ color: '#d9d9d9' }} />
                )}
              </span>
            ))}
            {displayRating > 0 && (
              <span style={{ marginLeft: 8, color: '#8c8c8c' }}>
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][displayRating]}
              </span>
            )}
          </Space>
        </Form.Item>

        {/* Comment */}
        <Form.Item
          label="Your Review"
          required
        >
          <TextArea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this template..."
            rows={4}
            maxLength={1000}
            showCount
            disabled={loading}
          />
        </Form.Item>

        {/* Submit */}
        <Form.Item>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={rating === 0 || comment.trim().length < 10}
          >
            {existingReview ? 'Update Review' : 'Submit Review'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default ReviewForm;
