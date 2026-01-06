/**
 * Review Panel Component
 *
 * Displays review requests, changes, and approval workflow.
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import type {
  Change,
  Comment,
  Review,
  ReviewStatus,
} from '../../types/collaboration';

/**
 * Props for ReviewPanel
 */
export interface ReviewPanelProps {
  /** Review to display */
  review: Review;
  /** Current user ID */
  currentUserId: string;
  /** Callback when review status changes */
  onStatusChange?: (reviewId: string, status: ReviewStatus) => void;
  /** Callback when comment is added */
  onCommentAdd?: (
    reviewId: string,
    content: string,
    fileId?: string,
    lineNumber?: number,
  ) => void;
  /** Callback when change is viewed */
  onChangeView?: (changeId: string) => void;
}

/**
 * Review Panel Component
 */
export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  review,
  currentUserId,
  onStatusChange,
  onCommentAdd,
  onChangeView,
}) => {
  const [selectedChangeIndex, setSelectedChangeIndex] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [selectedLine, setSelectedLine] = useState<number | undefined>();

  /**
   * Get current user's reviewer status
   */
  const currentUserReviewer = review.reviewers.find(
    (r) => r.userId === currentUserId,
  );

  /**
   * Check if user can approve
   */
  const canApprove =
    currentUserReviewer?.status === 'pending' ||
    review.author === currentUserId;

  /**
   * Get status badge color
   */
  const getStatusColor = (status: ReviewStatus): string => {
    switch (status) {
      case 'draft':
        return 'gray';
      case 'pending':
        return 'blue';
      case 'changes_requested':
        return 'orange';
      case 'approved':
        return 'green';
      case 'merged':
        return 'purple';
      case 'closed':
        return 'red';
      default:
        return 'gray';
    }
  };

  /**
   * Handle approval
   */
  const handleApprove = () => {
    if (onStatusChange && canApprove) {
      onStatusChange(review.id, 'approved');
    }
  };

  /**
   * Handle changes request
   */
  const handleRequestChanges = () => {
    if (onStatusChange && canApprove) {
      onStatusChange(review.id, 'changes_requested');
    }
  };

  /**
   * Handle comment submission
   */
  const handleCommentSubmit = () => {
    if (newComment.trim() && onCommentAdd) {
      const change = review.changes[selectedChangeIndex];
      onCommentAdd(review.id, newComment, change?.fileId, selectedLine);
      setNewComment('');
      setSelectedLine(undefined);
    }
  };

  /**
   * Handle line click for inline comment
   */
  const handleLineClick = (lineNumber: number) => {
    setSelectedLine(lineNumber);
  };

  /**
   * Get file extension icon
   */
  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      ts: '⚡',
      tsx: '⚛️',
      js: '📜',
      jsx: '⚛️',
      css: '🎨',
      html: '🌐',
      json: '📋',
      md: '📝',
    };
    return icons[ext || ''] || '📄';
  };

  /**
   * Render diff hunk
   */
  const renderDiffHunk = (change: Change) => {
    const lines = change.diff.split('\n');
    let lineA = 1;
    let lineB = 1;

    return (
      <div className="diff-view">
        {lines.map((line, idx) => {
          const type = line.startsWith('@@')
            ? 'hunk'
            : line.startsWith('+')
              ? 'add'
              : line.startsWith('-')
                ? 'delete'
                : 'context';
          const content = line.replace(/^@@.*@@/, '').replace(/^[+-]/, '');

          if (type === 'hunk') {
            return (
              <div key={idx} className="diff-hunk-header">
                {line}
              </div>
            );
          }

          if (type === 'add') {
            const num = lineB++;
            return (
              <div
                key={idx}
                className={`diff-line diff-line-add ${selectedLine === num ? 'selected' : ''}`}
                onClick={() => handleLineClick(num)}
              >
                <span className="line-num">{num}</span>
                <span className="line-content">{content}</span>
                <span className="line-action">+</span>
              </div>
            );
          }

          if (type === 'delete') {
            lineA++;
            return (
              <div key={idx} className="diff-line diff-line-delete">
                <span className="line-num">{lineA}</span>
                <span className="line-content">{content}</span>
                <span className="line-action">-</span>
              </div>
            );
          }

          lineA++;
          lineB++;
          return (
            <div key={idx} className="diff-line diff-line-context">
              <span className="line-num">{lineA}</span>
              <span className="line-content">{content}</span>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Render reviewers
   */
  const renderReviewers = () => (
    <div className="reviewers">
      <h4>Reviewers</h4>
      <div className="reviewer-list">
        {review.reviewers.map((reviewer) => (
          <div key={reviewer.userId} className="reviewer-item">
            <div className="reviewer-avatar">
              {reviewer.userId.charAt(0).toUpperCase()}
            </div>
            <div className="reviewer-info">
              <div className="reviewer-name">{reviewer.userId}</div>
              <div className={`reviewer-status ${reviewer.status}`}>
                {reviewer.status.replace('_', ' ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render comments
   */
  const renderComments = () => {
    const changeComments = review.comments.filter(
      (c) =>
        !selectedChangeIndex ||
        c.fileId === review.changes[selectedChangeIndex]?.fileId,
    );

    return (
      <div className="review-comments">
        <h4>Comments ({changeComments.length})</h4>
        <div className="comment-list">
          {changeComments.map((comment) => (
            <div
              key={comment.id}
              className={`comment ${comment.resolved ? 'resolved' : ''}`}
            >
              <div className="comment-avatar">
                {comment.author.charAt(0).toUpperCase()}
              </div>
              <div className="comment-content">
                <div className="comment-header">
                  <span className="comment-author">{comment.author}</span>
                  <span className="comment-time">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                  {comment.resolved && (
                    <span className="comment-resolved">✓ Resolved</span>
                  )}
                </div>
                <div className="comment-body">{comment.content}</div>
                {comment.mentions.length > 0 && (
                  <div className="comment-mentions">
                    Mentioned: {comment.mentions.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Render change sidebar
   */
  const renderChangesSidebar = () => (
    <div className="changes-sidebar">
      <h4>Changes ({review.changes.length})</h4>
      <div className="change-list">
        {review.changes.map((change, idx) => (
          <div
            key={change.fileId}
            className={`change-item ${selectedChangeIndex === idx ? 'active' : ''}`}
            onClick={() => setSelectedChangeIndex(idx)}
          >
            <span className="change-icon">{getFileIcon(change.fileName)}</span>
            <div className="change-info">
              <div className="change-name">{change.fileName}</div>
              <div className={`change-type ${change.changeType}`}>
                {change.changeType}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="review-panel">
      {/* Header */}
      <div className="review-header">
        <div className="review-title">
          <h2>{review.title}</h2>
          <span className={`status-badge ${getStatusColor(review.status)}`}>
            {review.status.replace('_', ' ')}
          </span>
        </div>
        <div className="review-actions">
          {canApprove && review.status === 'pending' && (
            <>
              <button className="btn-success" onClick={handleApprove}>
                Approve
              </button>
              <button className="btn-warning" onClick={handleRequestChanges}>
                Request Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="review-description">
        <p>{review.description}</p>
      </div>

      {/* Main content */}
      <div className="review-content">
        {renderChangesSidebar()}

        <div className="review-main">
          {review.changes.length > 0 ? (
            renderDiffHunk(review.changes[selectedChangeIndex])
          ) : (
            <div className="empty-state">No changes in this review</div>
          )}
        </div>

        <div className="review-sidebar">
          {renderReviewers()}
          {renderComments()}

          {/* Comment input */}
          <div className="comment-input-section">
            <textarea
              placeholder="Add a comment... (Use @username to mention)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="comment-textarea"
              rows={3}
            />
            <button
              className="btn-primary"
              onClick={handleCommentSubmit}
              disabled={!newComment.trim()}
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel;
