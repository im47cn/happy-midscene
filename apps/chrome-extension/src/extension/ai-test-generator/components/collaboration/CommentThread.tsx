/**
 * Comment Thread Component
 *
 * Displays threaded comments with reply functionality.
 */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Comment } from '../../types/collaboration';

/**
 * Props for CommentThread
 */
export interface CommentThreadProps {
  /** Comments to display */
  comments: Comment[];
  /** Current user ID */
  currentUserId: string;
  /** Callback when comment is added */
  onCommentAdd?: (content: string, parentId?: string) => void;
  /** Callback when comment is edited */
  onCommentEdit?: (commentId: string, content: string) => void;
  /** Callback when comment is deleted */
  onCommentDelete?: (commentId: string) => void;
  /** Callback when comment is resolved/unresolved */
  onCommentResolve?: (commentId: string, resolved: boolean) => void;
  /** Callback when user is mentioned */
  onMention?: (userId: string) => void;
  /** Show resolved comments */
  showResolved?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Mention suggestion
 */
interface MentionSuggestion {
  userId: string;
  username: string;
}

/**
 * Comment Thread Component
 */
export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  currentUserId,
  onCommentAdd,
  onCommentEdit,
  onCommentDelete,
  onCommentResolve,
  onMention,
  showResolved = true,
  compact = false,
}) => {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newContent, setNewContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<
    MentionSuggestion[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');

  const newCommentRef = useRef<HTMLTextAreaElement>(null);
  const replyRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  /**
   * Focus new comment input on mount
   */
  useEffect(() => {
    if (newCommentRef.current && !compact) {
      newCommentRef.current.focus();
    }
  }, []);

  /**
   * Get root comments (no parent)
   */
  const rootComments = comments.filter((c) => !c.parentId);

  /**
   * Get replies for a comment
   */
  const getReplies = (parentId: string): Comment[] => {
    return comments.filter((c) => c.parentId === parentId);
  };

  /**
   * Handle mention input
   */
  const handleInputChange = (
    value: string,
    isReply = false,
    commentId?: string,
  ) => {
    if (isReply) {
      setReplyContent(value);
    } else if (commentId) {
      setEditContent(value);
    } else {
      setNewContent(value);
    }

    // Check for @ mention
    const match = value.match(/@(\w*)$/);
    if (match) {
      setSuggestionFilter(match[1]);
      setShowSuggestions(true);
      // In production, fetch user suggestions
      // const suggestions = await mentionHandler.searchMentionable(match[1]);
      // setMentionSuggestions(suggestions);
    } else {
      setShowSuggestions(false);
    }
  };

  /**
   * Insert mention
   */
  const insertMention = (
    username: string,
    isReply = false,
    commentId?: string,
  ) => {
    const mention = `@${username} `;
    if (isReply) {
      setReplyContent(replyContent.replace(/@\w*$/, mention));
    } else if (commentId) {
      setEditContent(editContent.replace(/@\w*$/, mention));
    } else {
      setNewContent(newContent.replace(/@\w*$/, mention));
    }
    setShowSuggestions(false);
  };

  /**
   * Handle new comment submit
   */
  const handleNewCommentSubmit = () => {
    if (newContent.trim() && onCommentAdd) {
      onCommentAdd(newContent);
      setNewContent('');
    }
  };

  /**
   * Handle reply submit
   */
  const handleReplySubmit = (parentId: string) => {
    if (replyContent.trim() && onCommentAdd) {
      onCommentAdd(replyContent, parentId);
      setReplyContent('');
      setReplyTo(null);
    }
  };

  /**
   * Handle edit submit
   */
  const handleEditSubmit = (commentId: string) => {
    if (editContent.trim() && onCommentEdit) {
      onCommentEdit(commentId, editContent);
      setEditingId(null);
      setEditContent('');
    }
  };

  /**
   * Handle delete
   */
  const handleDelete = (commentId: string) => {
    if (onCommentDelete && confirm('Delete this comment?')) {
      onCommentDelete(commentId);
    }
  };

  /**
   * Handle resolve toggle
   */
  const handleResolveToggle = (comment: Comment) => {
    if (onCommentResolve) {
      onCommentResolve(comment.id, !comment.resolved);
    }
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  /**
   * Render comment item
   */
  const renderComment = (comment: Comment, isReply = false): JSX.Element => {
    const isEditing = editingId === comment.id;
    const replies = getReplies(comment.id);
    const canEdit = comment.author === currentUserId;
    const canModerate = !isReply; // Only root comments can be resolved

    return (
      <div
        key={comment.id}
        className={`comment-item ${isReply ? 'comment-reply' : ''} ${comment.resolved ? 'resolved' : ''}`}
      >
        {/* Comment header */}
        <div className="comment-header">
          <div className="comment-avatar">
            {comment.author.charAt(0).toUpperCase()}
          </div>
          <div className="comment-meta">
            <span className="comment-author">{comment.author}</span>
            <span className="comment-time">
              {formatTime(comment.createdAt)}
            </span>
            {comment.resolved && (
              <span className="comment-resolved-badge">✓ Resolved</span>
            )}
            {comment.updatedAt - comment.createdAt > 1000 && (
              <span className="comment-edited-badge">edited</span>
            )}
          </div>
          <div className="comment-actions">
            {canEdit && !isEditing && (
              <button
                className="btn-icon"
                onClick={() => {
                  setEditingId(comment.id);
                  setEditContent(comment.content);
                }}
                title="Edit"
              >
                ✏️
              </button>
            )}
            {canEdit && (
              <button
                className="btn-icon btn-danger"
                onClick={() => handleDelete(comment.id)}
                title="Delete"
              >
                🗑️
              </button>
            )}
            {canModerate && !comment.parentId && (
              <button
                className="btn-icon"
                onClick={() => handleResolveToggle(comment)}
                title={comment.resolved ? 'Unresolve' : 'Resolve'}
              >
                {comment.resolved ? '↩️' : '✓'}
              </button>
            )}
          </div>
        </div>

        {/* Comment body */}
        {isEditing ? (
          <div className="comment-edit-form">
            <textarea
              ref={(el) => {
                if (el) replyRefs.current.set(comment.id, el);
              }}
              value={editContent}
              onChange={(e) =>
                handleInputChange(e.target.value, false, comment.id)
              }
              className="comment-textarea"
              rows={3}
              autoFocus
            />
            <div className="edit-actions">
              <button
                className="btn-primary"
                onClick={() => handleEditSubmit(comment.id)}
              >
                Save
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setEditContent('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-body">
            {comment.content}
            {comment.mentions.length > 0 && (
              <div className="comment-mentions">
                {comment.mentions.map((userId) => (
                  <span
                    key={userId}
                    className="mention-tag"
                    onClick={() => onMention?.(userId)}
                  >
                    @{userId}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reply section */}
        {!comment.resolved && !isEditing && (
          <div className="comment-reply-section">
            {replyTo === comment.id ? (
              <div className="reply-form">
                <textarea
                  ref={(el) => {
                    if (el) replyRefs.current.set(`reply-${comment.id}`, el);
                  }}
                  value={replyContent}
                  onChange={(e) => handleInputChange(e.target.value, true)}
                  className="comment-textarea"
                  rows={2}
                  placeholder="Write a reply..."
                  autoFocus
                />
                <div className="reply-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleReplySubmit(comment.id)}
                    disabled={!replyContent.trim()}
                  >
                    Reply
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn-reply"
                onClick={() => {
                  setReplyTo(comment.id);
                  setTimeout(() => {
                    const textarea = replyRefs.current.get(
                      `reply-${comment.id}`,
                    );
                    textarea?.focus();
                  }, 0);
                }}
              >
                Reply
              </button>
            )}
          </div>
        )}

        {/* Nested replies */}
        {replies.length > 0 && (
          <div className="comment-replies">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}

        {/* Mention suggestions */}
        {showSuggestions && (
          <div className="mention-suggestions">
            {mentionSuggestions
              .filter((s) =>
                s.username
                  .toLowerCase()
                  .includes(suggestionFilter.toLowerCase()),
              )
              .slice(0, 5)
              .map((suggestion) => (
                <div
                  key={suggestion.userId}
                  className="mention-suggestion-item"
                  onClick={() =>
                    insertMention(
                      suggestion.username,
                      replyTo !== null || editingId !== null,
                    )
                  }
                >
                  @{suggestion.username}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Render compact mode
   */
  if (compact) {
    return (
      <div className="comment-thread comment-thread-compact">
        <div className="comment-count">
          {comments.filter((c) => !c.resolved).length} comments
        </div>
      </div>
    );
  }

  return (
    <div className="comment-thread">
      {/* New comment form */}
      <div className="comment-new">
        <div className="comment-avatar current-user">
          {currentUserId.charAt(0).toUpperCase()}
        </div>
        <div className="comment-new-form">
          <textarea
            ref={newCommentRef}
            value={newContent}
            onChange={(e) => handleInputChange(e.target.value)}
            className="comment-textarea"
            rows={3}
            placeholder="Write a comment... (Use @username to mention)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleNewCommentSubmit();
              }
            }}
          />
          <div className="comment-new-actions">
            <span className="comment-hint">Press Ctrl+Enter to submit</span>
            <button
              className="btn-primary"
              onClick={handleNewCommentSubmit}
              disabled={!newContent.trim()}
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* Filter options */}
      <div className="comment-filters">
        <label className="filter-option">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => {
              // In production, update filter state
            }}
          />
          Show resolved
        </label>
      </div>

      {/* Comments list */}
      <div className="comments-list">
        {rootComments.length === 0 ? (
          <div className="comments-empty">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          rootComments.map((comment) => {
            if (!showResolved && comment.resolved) return null;
            return renderComment(comment);
          })
        )}
      </div>
    </div>
  );
};

export default CommentThread;
