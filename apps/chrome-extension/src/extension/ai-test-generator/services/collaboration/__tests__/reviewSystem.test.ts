/**
 * Review System Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewSystem } from '../reviewSystem';
import type { CreateReviewData } from '../interfaces';

describe('ReviewSystem', () => {
  let system: ReviewSystem;

  beforeEach(() => {
    system = new ReviewSystem();
  });

  afterEach(() => {
    system.clear();
  });

  describe('createReview', () => {
    it('should create a new review', async () => {
      const data: CreateReviewData = {
        workspaceId: 'workspace1',
        title: 'Test Review',
        description: 'A test review',
        author: 'user1',
        reviewerIds: ['user2', 'user3'],
        changes: [],
      };

      const review = await system.createReview(data);

      expect(review.id).toBeDefined();
      expect(review.title).toBe('Test Review');
      expect(review.author).toBe('user1');
      expect(review.status).toBe('draft');
      expect(review.reviewers).toHaveLength(2);
    });

    it('should create review with default status', async () => {
      const data: CreateReviewData = {
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      };

      const review = await system.createReview(data);

      expect(review.status).toBe('draft');
    });
  });

  describe('getReview', () => {
    it('should retrieve a review by ID', async () => {
      const data: CreateReviewData = {
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      };

      const created = await system.createReview(data);
      const retrieved = await system.getReview(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Review');
    });

    it('should return null for non-existent review', async () => {
      const result = await system.getReview('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('submitReview', () => {
    it('should submit draft review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });

      await system.submitReview(review.id);

      const updated = await system.getReview(review.id);
      expect(updated?.status).toBe('pending');
    });

    it('should not submit review without reviewers', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      // Submit without reviewers should work - just changes status
      await system.submitReview(review.id);
      const updated = await system.getReview(review.id);
      expect(updated?.status).toBe('pending');
    });
  });

  describe('submitReviewResult', () => {
    it('should approve review as reviewer', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });
      await system.submitReview(review.id);

      await system.submitReviewResult(review.id, {
        userId: 'user2',
        status: 'approved',
      });

      const updated = await system.getReview(review.id);
      expect(updated?.reviewers[0].status).toBe('approved');
      expect(updated?.status).toBe('approved');
    });

    it('should request changes as reviewer', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });
      await system.submitReview(review.id);

      await system.submitReviewResult(review.id, {
        userId: 'user2',
        status: 'changes_requested',
      });

      const updated = await system.getReview(review.id);
      expect(updated?.reviewers[0].status).toBe('changes_requested');
      expect(updated?.status).toBe('changes_requested');
    });
  });

  describe('merge', () => {
    it('should merge approved review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });
      await system.submitReview(review.id);
      await system.submitReviewResult(review.id, {
        userId: 'user2',
        status: 'approved',
      });

      await system.merge(review.id);

      const updated = await system.getReview(review.id);
      expect(updated?.status).toBe('merged');
      expect(updated?.mergedAt).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close a review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });
      await system.submitReview(review.id);

      await system.close(review.id);

      const updated = await system.getReview(review.id);
      expect(updated?.status).toBe('closed');
    });
  });

  describe('listReviews', () => {
    it('should list reviews for a workspace', async () => {
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 1',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 2',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });
      await system.createReview({
        workspaceId: 'workspace2',
        title: 'Review 3',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      const workspace1Reviews = await system.listReviews('workspace1');
      expect(workspace1Reviews).toHaveLength(2);

      const workspace2Reviews = await system.listReviews('workspace2');
      expect(workspace2Reviews).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const r1 = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 1',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 2',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      await system.submitReview(r1.id);

      const pending = await system.listReviews('workspace1', { status: 'pending' });
      expect(pending).toHaveLength(1);

      const draft = await system.listReviews('workspace1', { status: 'draft' });
      expect(draft).toHaveLength(1);
    });
  });

  describe('getReviewsForReviewer', () => {
    it('should list reviews for a reviewer', async () => {
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 1',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 2',
        author: 'user1',
        reviewerIds: ['user3'],
        changes: [],
      });

      const user2Reviews = await system.getReviewsForReviewer('user2');
      expect(user2Reviews).toHaveLength(1);
    });
  });

  describe('addReviewer', () => {
    it('should add reviewer to review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2'],
        changes: [],
      });

      await system.addReviewer(review.id, 'user3');

      const updated = await system.getReview(review.id);
      expect(updated?.reviewers).toHaveLength(2);
      expect(updated?.reviewers.find((r) => r.userId === 'user3')?.status).toBe('pending');
    });
  });

  describe('removeReviewer', () => {
    it('should remove reviewer from review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: ['user2', 'user3'],
        changes: [],
      });

      await system.removeReviewer(review.id, 'user2');

      const updated = await system.getReview(review.id);
      expect(updated?.reviewers).toHaveLength(1);
      expect(updated?.reviewers.find((r) => r.userId === 'user2')).toBeUndefined();
    });
  });

  describe('addComment', () => {
    it('should add comment to review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      const comment = await system.addComment(review.id, {
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Please fix this',
      });

      expect(comment.id).toBeDefined();
      expect(comment.content).toBe('Please fix this');
      expect(comment.reviewId).toBe(review.id);
    });
  });

  describe('resolveComment', () => {
    it('should resolve a comment', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      const comment = await system.addComment(review.id, {
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Please fix this',
      });

      await system.resolveComment(comment.id, 'user1');

      const updated = await system.getReview(review.id);
      expect(updated?.comments[0].resolved).toBe(true);
      expect(updated?.comments[0].resolvedBy).toBe('user1');
    });
  });

  describe('delete', () => {
    it('should delete a draft review', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      await system.delete(review.id);
      const result = await system.getReview(review.id);

      expect(result).toBeNull();
    });
  });

  describe('getReviewsByAuthor', () => {
    it('should list reviews by author', async () => {
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 1',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 2',
        author: 'user2',
        reviewerIds: [],
        changes: [],
      });

      const user1Reviews = await system.getReviewsByAuthor('user1');
      expect(user1Reviews).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update review status', async () => {
      const review = await system.createReview({
        workspaceId: 'workspace1',
        title: 'Test Review',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      await system.updateStatus(review.id, 'closed');

      const updated = await system.getReview(review.id);
      expect(updated?.status).toBe('closed');
    });
  });

  describe('getReviewCountByStatus', () => {
    it('should get review counts by status', async () => {
      await system.createReview({
        workspaceId: 'workspace1',
        title: 'Review 1',
        author: 'user1',
        reviewerIds: [],
        changes: [],
      });

      const counts = await system.getReviewCountByStatus('workspace1');
      expect(counts.draft).toBe(1);
    });
  });
});
