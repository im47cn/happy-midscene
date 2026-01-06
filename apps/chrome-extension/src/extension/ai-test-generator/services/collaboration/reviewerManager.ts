/**
 * Reviewer Manager Service
 *
 * Manages reviewer assignments and suggestions.
 */

import type { ReviewerStatus } from '../../types/collaboration';
import { auditLogger } from './auditLogger';
import type { IReviewerManager } from './interfaces';
import { memberManager } from './memberManager';
import { reviewSystem } from './reviewSystem';

/**
 * Tracks file contribution to suggest reviewers
 */
interface FileContribution {
  fileId: string;
  userId: string;
  contributionScore: number;
  lastContributedAt: number;
}

/**
 * In-memory storage for file contributions
 * In production, this would be calculated from git history
 */
interface ContributionStorage {
  contributions: Map<string, FileContribution[]>;
}

/**
 * Reviewer Manager Implementation
 */
export class ReviewerManager implements IReviewerManager {
  private contributionStorage: ContributionStorage;

  constructor() {
    this.contributionStorage = {
      contributions: new Map(),
    };
  }

  /**
   * Get suggested reviewers for a review
   */
  async getSuggestedReviewers(
    workspaceId: string,
    fileIds: string[],
  ): Promise<string[]> {
    const suggested = new Set<string>();
    const scores = new Map<string, number>();

    // Get contributions for each file
    for (const fileId of fileIds) {
      const contributions = this.contributionStorage.contributions.get(fileId);
      if (contributions) {
        for (const contrib of contributions) {
          const currentScore = scores.get(contrib.userId) || 0;
          scores.set(contrib.userId, currentScore + contrib.contributionScore);
        }
      }
    }

    // Get editable members
    const editableMembers = await memberManager.getEditableMembers(workspaceId);

    // Filter by editable members and sort by score
    const suggestions = editableMembers
      .filter((m) => scores.has(m.userId))
      .map((m) => ({ userId: m.userId, score: scores.get(m.userId)! }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.userId);

    return suggestions;
  }

  /**
   * Check if a user can review
   */
  async canReview(userId: string, reviewId: string): Promise<boolean> {
    const review = await reviewSystem.getReview(reviewId);
    if (!review) {
      return false;
    }

    // Check if user is a reviewer
    const isReviewer = review.reviewers.some((r) => r.userId === userId);
    if (!isReviewer) {
      return false;
    }

    // Check if user has permission
    const member = await memberManager.getMember(review.workspaceId, userId);
    if (!member) {
      return false;
    }

    // Only editors, admins, and owners can review
    return ['editor', 'admin', 'owner'].includes(member.role);
  }

  /**
   * Get reviewer status
   */
  async getReviewerStatus(
    reviewId: string,
    userId: string,
  ): Promise<ReviewerStatus | null> {
    const review = await reviewSystem.getReview(reviewId);
    if (!review) {
      return null;
    }

    const reviewer = review.reviewers.find((r) => r.userId === userId);
    return reviewer ? reviewer.status : null;
  }

  /**
   * Assign reviewers to a review
   */
  async assignReviewers(
    reviewId: string,
    reviewerIds: string[],
  ): Promise<void> {
    const review = await reviewSystem.getReview(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    for (const userId of reviewerIds) {
      try {
        await reviewSystem.addReviewer(reviewId, userId);
      } catch (e) {
        // Skip if already added
        // biome-ignore lint/suspicious/noExplicitAny: error handling
        if ((e as any).message?.includes?.('already a reviewer')) {
          continue;
        }
        throw e;
      }
    }
  }

  /**
   * Get reviewer workload
   */
  async getReviewerWorkload(userId: string): Promise<{
    pendingReviews: number;
    totalReviews: number;
    avgCompletionTime: number;
  }> {
    const reviews = await reviewSystem.getReviewsForReviewer(userId);

    const pendingReviews = reviews.filter((r) => {
      const reviewer = r.reviewers.find((rev) => rev.userId === userId);
      return reviewer?.status === 'pending';
    }).length;

    // Calculate average completion time
    const completedReviews = reviews.filter((r) => {
      const reviewer = r.reviewers.find((rev) => rev.userId === userId);
      return reviewer?.status !== 'pending' && reviewer?.reviewedAt;
    });

    let avgCompletionTime = 0;
    if (completedReviews.length > 0) {
      const totalTime = completedReviews.reduce((sum, r) => {
        const reviewer = r.reviewers.find((rev) => rev.userId === userId);
        return sum + (reviewer?.reviewedAt || 0) - r.createdAt;
      }, 0);
      avgCompletionTime = totalTime / completedReviews.length;
    }

    return {
      pendingReviews,
      totalReviews: reviews.length,
      avgCompletionTime,
    };
  }

  /**
   * Get available reviewers for a workspace
   */
  async getAvailableReviewers(workspaceId: string): Promise<string[]> {
    const editableMembers = await memberManager.getEditableMembers(workspaceId);
    const available: string[] = [];

    for (const member of editableMembers) {
      const workload = await this.getReviewerWorkload(member.userId);
      // Consider reviewers with less than 10 pending reviews as available
      if (workload.pendingReviews < 10) {
        available.push(member.userId);
      }
    }

    return available;
  }

  /**
   * Auto-assign reviewers to a review
   */
  async autoAssignReviewers(reviewId: string, count = 2): Promise<string[]> {
    const review = await reviewSystem.getReview(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    const fileIds = review.changes.map((c) => c.fileId);
    const suggested = await this.getSuggestedReviewers(
      review.workspaceId,
      fileIds,
    );

    // Get available reviewers
    const available = await this.getAvailableReviewers(review.workspaceId);

    // Intersect suggested with available
    const candidates = suggested.filter((id) => available.includes(id));

    // Assign top candidates
    const toAssign = candidates.slice(0, count);
    for (const userId of toAssign) {
      await reviewSystem.addReviewer(reviewId, userId);
    }

    return toAssign;
  }

  /**
   * Record file contribution for reviewer suggestions
   */
  async recordContribution(
    fileId: string,
    userId: string,
    score = 1,
  ): Promise<void> {
    if (!this.contributionStorage.contributions.has(fileId)) {
      this.contributionStorage.contributions.set(fileId, []);
    }

    const contributions = this.contributionStorage.contributions.get(fileId)!;

    // Update existing contribution or add new
    const existing = contributions.find((c) => c.userId === userId);
    if (existing) {
      existing.contributionScore += score;
      existing.lastContributedAt = Date.now();
    } else {
      contributions.push({
        fileId,
        userId,
        contributionScore: score,
        lastContributedAt: Date.now(),
      });
    }
  }

  /**
   * Get contributions for a file
   */
  async getFileContributions(fileId: string): Promise<FileContribution[]> {
    return this.contributionStorage.contributions.get(fileId) || [];
  }

  /**
   * Get reviewer statistics
   */
  async getReviewerStats(userId: string): Promise<{
    totalReviews: number;
    approvalsGiven: number;
    changesRequested: number;
    avgReviewTime: number;
  }> {
    const reviews = await reviewSystem.getReviewsForReviewer(userId);

    let approvalsGiven = 0;
    let changesRequested = 0;
    let totalReviewTime = 0;
    let completedCount = 0;

    for (const review of reviews) {
      const reviewer = review.reviewers.find((r) => r.userId === userId);
      if (reviewer && reviewer.status !== 'pending' && reviewer.reviewedAt) {
        if (reviewer.status === 'approved') {
          approvalsGiven++;
        } else if (reviewer.status === 'changes_requested') {
          changesRequested++;
        }
        totalReviewTime += reviewer.reviewedAt - review.createdAt;
        completedCount++;
      }
    }

    return {
      totalReviews: reviews.length,
      approvalsGiven,
      changesRequested,
      avgReviewTime: completedCount > 0 ? totalReviewTime / completedCount : 0,
    };
  }

  /**
   * Clear contributions (for testing)
   */
  clearContributions(): void {
    this.contributionStorage.contributions.clear();
  }
}

// Export singleton instance
export const reviewerManager = new ReviewerManager();
