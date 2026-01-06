/**
 * Review System Service
 *
 * Manages the review and approval workflow for changes.
 */

import type {
  ChangeType,
  Comment,
  Review,
  ReviewStatus,
  Reviewer,
} from '../../types/collaboration';
import { auditLogger } from './auditLogger';
import type {
  CreateCommentData,
  CreateReviewData,
  IReviewSystem,
  ReviewFilters,
  ReviewResult,
} from './interfaces';
import { permissionEngine } from './permissionEngine';

/**
 * Review state transition rules
 */
const STATUS_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  draft: ['pending', 'closed'],
  pending: ['changes_requested', 'approved', 'closed'],
  changes_requested: ['pending', 'approved', 'closed'],
  approved: ['merged', 'closed'],
  merged: [],
  closed: [],
};

/**
 * In-memory storage for reviews
 * In production, this would be replaced with a database
 */
interface ReviewStorage {
  reviews: Map<string, Review>;
  byWorkspace: Map<string, Set<string>>;
  byAuthor: Map<string, Set<string>>;
}

/**
 * Review System Implementation
 */
export class ReviewSystem implements IReviewSystem {
  private storage: ReviewStorage;

  constructor() {
    this.storage = {
      reviews: new Map(),
      byWorkspace: new Map(),
      byAuthor: new Map(),
    };
  }

  /**
   * Create a new review
   */
  async createReview(data: CreateReviewData): Promise<Review> {
    const id = this.generateId();
    const now = Date.now();

    const reviewers: Reviewer[] = data.reviewerIds.map((userId) => ({
      userId,
      status: 'pending',
    }));

    const review: Review = {
      id,
      workspaceId: data.workspaceId,
      title: data.title,
      description: data.description,
      status: 'draft',
      author: data.author,
      reviewers,
      changes: data.changes.map((c, idx) => ({
        fileId: c.fileId,
        fileName: c.fileName,
        changeType: c.changeType as ChangeType,
        diff: c.diff,
      })),
      comments: [],
      createdAt: now,
      updatedAt: now,
    };

    this.storage.reviews.set(id, review);
    this.addToIndex(this.storage.byWorkspace, data.workspaceId, id);
    this.addToIndex(this.storage.byAuthor, data.author, id);

    // Log the creation
    await auditLogger.log({
      userId: data.author,
      action: 'create_review',
      resourceType: 'review',
      resourceId: id,
      workspaceId: data.workspaceId,
      success: true,
    });

    return {
      ...review,
      reviewers: [...reviewers],
      changes: [...review.changes],
    };
  }

  /**
   * Get a review by ID
   */
  async getReview(id: string): Promise<Review | null> {
    const review = this.storage.reviews.get(id);
    if (!review) {
      return null;
    }

    return {
      ...review,
      reviewers: [...review.reviewers],
      changes: [...review.changes],
      comments: [...review.comments],
    };
  }

  /**
   * Submit a review for review
   */
  async submitReview(id: string): Promise<void> {
    const review = this.storage.reviews.get(id);
    if (!review) {
      throw new Error(`Review not found: ${id}`);
    }

    if (review.status !== 'draft') {
      throw new Error(`Can only submit draft reviews`);
    }

    review.status = 'pending';
    review.updatedAt = Date.now();

    await auditLogger.log({
      userId: review.author,
      action: 'submit_review',
      resourceType: 'review',
      resourceId: id,
      workspaceId: review.workspaceId,
      success: true,
    });
  }

  /**
   * Add a reviewer to a review
   */
  async addReviewer(reviewId: string, userId: string): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (review.reviewers.some((r) => r.userId === userId)) {
      throw new Error(`User is already a reviewer`);
    }

    review.reviewers.push({
      userId,
      status: 'pending',
    });
    review.updatedAt = Date.now();
  }

  /**
   * Remove a reviewer from a review
   */
  async removeReviewer(reviewId: string, userId: string): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const index = review.reviewers.findIndex((r) => r.userId === userId);
    if (index === -1) {
      throw new Error(`User is not a reviewer`);
    }

    review.reviewers.splice(index, 1);
    review.updatedAt = Date.now();
  }

  /**
   * Submit a review result
   */
  async submitReviewResult(
    reviewId: string,
    result: ReviewResult,
  ): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const reviewer = review.reviewers.find((r) => r.userId === result.userId);
    if (!reviewer) {
      throw new Error(`User is not a reviewer`);
    }

    reviewer.status = result.status;
    reviewer.reviewedAt = Date.now();
    review.updatedAt = Date.now();

    // Check if all reviewers have responded
    const allResponded = review.reviewers.every((r) => r.status !== 'pending');
    if (allResponded) {
      // Update review status based on reviewer responses
      const anyChangesRequested = review.reviewers.some(
        (r) => r.status === 'changes_requested',
      );
      const allApproved = review.reviewers.every(
        (r) => r.status === 'approved',
      );

      if (allApproved) {
        review.status = 'approved';
      } else if (anyChangesRequested) {
        review.status = 'changes_requested';
      }
    }

    await auditLogger.log({
      userId: result.userId,
      action: 'submit_review_result',
      resourceType: 'review',
      resourceId: reviewId,
      workspaceId: review.workspaceId,
      success: true,
      metadata: { result: result.status },
    });
  }

  /**
   * Merge a review
   */
  async merge(reviewId: string): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (review.status !== 'approved') {
      throw new Error(`Can only merge approved reviews`);
    }

    review.status = 'merged';
    review.mergedAt = Date.now();
    review.updatedAt = Date.now();

    await auditLogger.log({
      userId: review.author,
      action: 'merge_review',
      resourceType: 'review',
      resourceId: reviewId,
      workspaceId: review.workspaceId,
      success: true,
    });
  }

  /**
   * Close a review
   */
  async close(reviewId: string): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (review.status === 'merged') {
      throw new Error(`Cannot close merged reviews`);
    }

    review.status = 'closed';
    review.updatedAt = Date.now();

    await auditLogger.log({
      userId: review.author,
      action: 'close_review',
      resourceType: 'review',
      resourceId: reviewId,
      workspaceId: review.workspaceId,
      success: true,
    });
  }

  /**
   * List reviews for a workspace
   */
  async listReviews(
    workspaceId: string,
    filters?: ReviewFilters,
  ): Promise<Review[]> {
    const reviewIds = this.storage.byWorkspace.get(workspaceId);
    if (!reviewIds) {
      return [];
    }

    let reviews: Review[] = [];
    for (const id of reviewIds) {
      const review = this.storage.reviews.get(id);
      if (review) {
        reviews.push({
          ...review,
          reviewers: [...review.reviewers],
          changes: [...review.changes],
          comments: [...review.comments],
        });
      }
    }

    // Apply filters
    if (filters?.status) {
      reviews = reviews.filter((r) => r.status === filters.status);
    }
    if (filters?.author) {
      reviews = reviews.filter((r) => r.author === filters.author);
    }
    if (filters?.reviewer) {
      reviews = reviews.filter((r) =>
        r.reviewers.some((rev) => rev.userId === filters.reviewer),
      );
    }
    if (filters?.startTime) {
      reviews = reviews.filter((r) => r.createdAt >= filters.startTime!);
    }
    if (filters?.endTime) {
      reviews = reviews.filter((r) => r.createdAt <= filters.endTime!);
    }

    return reviews.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Add a comment to a review
   */
  async addComment(
    reviewId: string,
    data: CreateCommentData,
  ): Promise<Comment> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const id = this.generateId();
    const now = Date.now();

    const comment: Comment = {
      id,
      reviewId,
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

    review.comments.push(comment);
    review.updatedAt = now;

    return { ...comment };
  }

  /**
   * Resolve a comment
   */
  async resolveComment(commentId: string, userId: string): Promise<void> {
    for (const review of this.storage.reviews.values()) {
      const comment = review.comments.find((c) => c.id === commentId);
      if (comment) {
        comment.resolved = true;
        comment.resolvedBy = userId;
        review.updatedAt = Date.now();
        return;
      }
    }

    throw new Error(`Comment not found: ${commentId}`);
  }

  /**
   * Get reviews by author
   */
  async getReviewsByAuthor(authorId: string): Promise<Review[]> {
    const reviewIds = this.storage.byAuthor.get(authorId);
    if (!reviewIds) {
      return [];
    }

    const reviews: Review[] = [];
    for (const id of reviewIds) {
      const review = this.storage.reviews.get(id);
      if (review) {
        reviews.push({
          ...review,
          reviewers: [...review.reviewers],
          changes: [...review.changes],
          comments: [...review.comments],
        });
      }
    }

    return reviews.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Get reviews where user is a reviewer
   */
  async getReviewsForReviewer(reviewerId: string): Promise<Review[]> {
    const reviews: Review[] = [];

    for (const review of this.storage.reviews.values()) {
      if (review.reviewers.some((r) => r.userId === reviewerId)) {
        reviews.push({
          ...review,
          reviewers: [...review.reviewers],
          changes: [...review.changes],
          comments: [...review.comments],
        });
      }
    }

    return reviews.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update review status
   */
  async updateStatus(reviewId: string, newStatus: ReviewStatus): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const allowedTransitions = STATUS_TRANSITIONS[review.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Cannot transition from ${review.status} to ${newStatus}`,
      );
    }

    review.status = newStatus;
    review.updatedAt = Date.now();
  }

  /**
   * Get review count by status
   */
  async getReviewCountByStatus(
    workspaceId: string,
  ): Promise<Record<ReviewStatus, number>> {
    const reviews = await this.listReviews(workspaceId);
    const counts: Record<string, number> = {
      draft: 0,
      pending: 0,
      changes_requested: 0,
      approved: 0,
      merged: 0,
      closed: 0,
    };

    for (const review of reviews) {
      counts[review.status]++;
    }

    return counts as Record<ReviewStatus, number>;
  }

  /**
   * Delete a review
   */
  async delete(reviewId: string): Promise<void> {
    const review = this.storage.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (review.status !== 'draft') {
      throw new Error(`Can only delete draft reviews`);
    }

    this.storage.reviews.delete(reviewId);
    this.removeFromIndex(
      this.storage.byWorkspace,
      review.workspaceId,
      reviewId,
    );
    this.removeFromIndex(this.storage.byAuthor, review.author, reviewId);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to index
   */
  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string,
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
    value: string,
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
   * Clear all reviews (for testing)
   */
  clear(): void {
    this.storage.reviews.clear();
    this.storage.byWorkspace.clear();
    this.storage.byAuthor.clear();
  }

  /**
   * Get storage size (for testing)
   */
  size(): number {
    return this.storage.reviews.size;
  }
}

// Export singleton instance
export const reviewSystem = new ReviewSystem();
