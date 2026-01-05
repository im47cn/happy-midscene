/**
 * Comment Service
 *
 * Manages comments on files and reviews.
 */

import type { Comment } from '../../types/collaboration';
import type {
  ICommentService,
  CreateCommentData,
  CommentQueryOptions,
} from './interfaces';
import { auditLogger } from './auditLogger';

/**
 * In-memory storage for comments
 * In production, this would be replaced with a database
 */
interface CommentStorage {
  comments: Map<string, Comment>;
  byFile: Map<string, Set<string>>;
  byReview: Map<string, Set<string>>;
  byParent: Map<string, Set<string>>;
}

/**
 * Comment Service Implementation
 */
export class CommentService implements ICommentService {
  private storage: CommentStorage;

  constructor() {
    this.storage = {
      comments: new Map(),
      byFile: new Map(),
      byReview: new Map(),
      byParent: new Map(),
    };
  }

  /**
   * Add a comment
   */
  async addComment(data: CreateCommentData & { reviewId?: string }): Promise<Comment> {
    const id = this.generateId();
    const now = Date.now();

    const comment: Comment = {
      id,
      reviewId: data.reviewId,
      fileId: data.fileId,
      lineNumber: data.lineNumber,
      author: data.author,
      content: data.content,
      mentions: data.mentions || [],
      parentId: data.parentId,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    };

    this.storage.comments.set(id, comment);
    this.addToIndex(this.storage.byFile, data.fileId, id);

    if (data.reviewId) {
      this.addToIndex(this.storage.byReview, data.reviewId, id);
    }

    if (data.parentId) {
      this.addToIndex(this.storage.byParent, data.parentId, id);
    }

    // Log comment creation
    await auditLogger.log({
      userId: data.author,
      action: 'create_comment',
      resourceType: 'comment',
      resourceId: id,
      workspaceId: '', // Will be filled by caller
      success: true,
    });

    return { ...comment };
  }

  /**
   * Update a comment
   */
  async updateComment(id: string, content: string): Promise<void> {
    const comment = this.storage.comments.get(id);
    if (!comment) {
      throw new Error(`Comment not found: ${id}`);
    }

    comment.content = content;
    comment.updatedAt = Date.now();
  }

  /**
   * Delete a comment
   */
  async deleteComment(id: string): Promise<void> {
    const comment = this.storage.comments.get(id);
    if (!comment) {
      throw new Error(`Comment not found: ${id}`);
    }

    // Also delete all replies
    const replyIds = this.storage.byParent.get(id);
    if (replyIds) {
      for (const replyId of replyIds) {
        this.storage.comments.delete(replyId);
        this.removeFromIndex(this.storage.byFile, comment.fileId, replyId);
        if (comment.reviewId) {
          this.removeFromIndex(this.storage.byReview, comment.reviewId, replyId);
        }
      }
      this.storage.byParent.delete(id);
    }

    this.storage.comments.delete(id);
    this.removeFromIndex(this.storage.byFile, comment.fileId, id);
    if (comment.reviewId) {
      this.removeFromIndex(this.storage.byReview, comment.reviewId, id);
    }
    if (comment.parentId) {
      this.removeFromIndex(this.storage.byParent, comment.parentId, id);
    }
  }

  /**
   * Resolve a comment
   */
  async resolveComment(id: string, userId: string): Promise<void> {
    const comment = this.storage.comments.get(id);
    if (!comment) {
      throw new Error(`Comment not found: ${id}`);
    }

    comment.resolved = true;
    comment.resolvedBy = userId;
    comment.updatedAt = Date.now();
  }

  /**
   * Unresolve a comment
   */
  async unresolveComment(id: string): Promise<void> {
    const comment = this.storage.comments.get(id);
    if (!comment) {
      throw new Error(`Comment not found: ${id}`);
    }

    comment.resolved = false;
    comment.resolvedBy = undefined;
    comment.updatedAt = Date.now();
  }

  /**
   * Get comments for a file
   */
  async getFileComments(
    fileId: string,
    options?: CommentQueryOptions
  ): Promise<Comment[]> {
    const commentIds = this.storage.byFile.get(fileId);
    if (!commentIds) {
      return [];
    }

    let comments: Comment[] = [];
    for (const id of commentIds) {
      const comment = this.storage.comments.get(id);
      if (comment) {
        comments.push({ ...comment });
      }
    }

    // Apply filters
    if (options?.includeResolved === false) {
      comments = comments.filter((c) => !c.resolved);
    }

    if (options?.line !== undefined) {
      comments = comments.filter((c) => c.lineNumber === options.line);
    }

    if (options?.startTime) {
      comments = comments.filter((c) => c.createdAt >= options.startTime!);
    }

    if (options?.endTime) {
      comments = comments.filter((c) => c.createdAt <= options.endTime!);
    }

    return comments.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get comments for a review
   */
  async getReviewComments(reviewId: string): Promise<Comment[]> {
    const commentIds = this.storage.byReview.get(reviewId);
    if (!commentIds) {
      return [];
    }

    const comments: Comment[] = [];
    for (const id of commentIds) {
      const comment = this.storage.comments.get(id);
      if (comment) {
        comments.push({ ...comment });
      }
    }

    return comments.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get replies to a comment
   */
  async getReplies(parentId: string): Promise<Comment[]> {
    const replyIds = this.storage.byParent.get(parentId);
    if (!replyIds) {
      return [];
    }

    const replies: Comment[] = [];
    for (const id of replyIds) {
      const comment = this.storage.comments.get(id);
      if (comment) {
        replies.push({ ...comment });
      }
    }

    return replies.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get a comment by ID
   */
  async getComment(id: string): Promise<Comment | null> {
    const comment = this.storage.comments.get(id);
    return comment ? { ...comment } : null;
  }

  /**
   * Get unresolved comments for a file
   */
  async getUnresolvedComments(fileId: string): Promise<Comment[]> {
    return this.getFileComments(fileId, { includeResolved: false });
  }

  /**
   * Get comment thread (comment + replies)
   */
  async getCommentThread(commentId: string): Promise<Comment[]> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      return [];
    }

    const replies = await this.getReplies(commentId);
    return [comment, ...replies];
  }

  /**
   * Get comments by author
   */
  async getCommentsByAuthor(authorId: string): Promise<Comment[]> {
    const comments: Comment[] = [];

    for (const comment of this.storage.comments.values()) {
      if (comment.author === authorId) {
        comments.push({ ...comment });
      }
    }

    return comments.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get comments where user is mentioned
   */
  async getMentions(userId: string): Promise<Comment[]> {
    const comments: Comment[] = [];

    for (const comment of this.storage.comments.values()) {
      if (comment.mentions.includes(userId)) {
        comments.push({ ...comment });
      }
    }

    return comments.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Count comments for a file
   */
  async countComments(fileId: string): Promise<number> {
    const commentIds = this.storage.byFile.get(fileId);
    return commentIds ? commentIds.size : 0;
  }

  /**
   * Count unresolved comments for a file
   */
  async countUnresolvedComments(fileId: string): Promise<number> {
    const comments = await this.getUnresolvedComments(fileId);
    return comments.length;
  }

  /**
   * Search comments by content
   */
  async searchComments(query: string, fileId?: string): Promise<Comment[]> {
    const lowerQuery = query.toLowerCase();
    const results: Comment[] = [];

    for (const comment of this.storage.comments.values()) {
      if (fileId && comment.fileId !== fileId) {
        continue;
      }

      if (
        comment.content.toLowerCase().includes(lowerQuery) ||
        comment.author.toLowerCase().includes(lowerQuery)
      ) {
        results.push({ ...comment });
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  /**
   * Remove from index
   */
  private removeFromIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    const set = index.get(key);
    if (set) {
      set.delete(value);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Clear all comments (for testing)
   */
  clear(): void {
    this.storage.comments.clear();
    this.storage.byFile.clear();
    this.storage.byReview.clear();
    this.storage.byParent.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.comments.size;
  }
}

// Export singleton instance
export const commentService = new CommentService();
