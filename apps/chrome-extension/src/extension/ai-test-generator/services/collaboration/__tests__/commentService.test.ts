/**
 * Comment Service Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommentService } from '../commentService';

describe('CommentService', () => {
  let cs: CommentService;

  beforeEach(() => {
    cs = new CommentService();
  });

  afterEach(() => {
    cs.clear();
  });

  describe('addComment', () => {
    it('should create a new comment', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'This is a comment',
      });

      expect(comment.id).toBeDefined();
      expect(comment.fileId).toBe('file1');
      expect(comment.lineNumber).toBe(10);
      expect(comment.author).toBe('user1');
      expect(comment.content).toBe('This is a comment');
      expect(comment.resolved).toBe(false);
      expect(comment.createdAt).toBeDefined();
    });

    it('should create comment with mentions', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: '@user2 please review',
        mentions: ['user2'],
      });

      expect(comment.mentions).toEqual(['user2']);
    });

    it('should create reply with parentId', async () => {
      const parent = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Parent comment',
      });

      const reply = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Reply comment',
        parentId: parent.id,
      });

      expect(reply.parentId).toBe(parent.id);
    });

    it('should create comment with reviewId', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Review comment',
        reviewId: 'review1',
      });

      expect(comment.reviewId).toBe('review1');
    });

    it('should generate unique IDs for each comment', async () => {
      const comment1 = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment 1',
      });

      const comment2 = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment 2',
      });

      expect(comment1.id).not.toBe(comment2.id);
    });
  });

  describe('updateComment', () => {
    it('should update comment content', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Original content',
      });

      await cs.updateComment(comment.id, 'Updated content');

      const updated = await cs.getComment(comment.id);
      expect(updated?.content).toBe('Updated content');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(comment.updatedAt);
    });

    it('should throw error for non-existent comment', async () => {
      await expect(cs.updateComment('non-existent', 'content')).rejects.toThrow(
        'Comment not found',
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'To be deleted',
      });

      await cs.deleteComment(comment.id);

      const deleted = await cs.getComment(comment.id);
      expect(deleted).toBeNull();
    });

    it('should cascade delete replies', async () => {
      const parent = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Parent',
      });

      const reply = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Reply',
        parentId: parent.id,
      });

      await cs.deleteComment(parent.id);

      const parentDeleted = await cs.getComment(parent.id);
      const replyDeleted = await cs.getComment(reply.id);

      expect(parentDeleted).toBeNull();
      expect(replyDeleted).toBeNull();
    });

    it('should throw error for non-existent comment', async () => {
      await expect(cs.deleteComment('non-existent')).rejects.toThrow(
        'Comment not found',
      );
    });
  });

  describe('resolveComment', () => {
    it('should mark comment as resolved', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Fix this bug',
      });

      await cs.resolveComment(comment.id, 'user2');

      const resolved = await cs.getComment(comment.id);
      expect(resolved?.resolved).toBe(true);
      expect(resolved?.resolvedBy).toBe('user2');
    });

    it('should throw error for non-existent comment', async () => {
      await expect(cs.resolveComment('non-existent', 'user1')).rejects.toThrow(
        'Comment not found',
      );
    });
  });

  describe('unresolveComment', () => {
    it('should mark comment as unresolved', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Fix this bug',
      });

      await cs.resolveComment(comment.id, 'user2');
      await cs.unresolveComment(comment.id);

      const unresolved = await cs.getComment(comment.id);
      expect(unresolved?.resolved).toBe(false);
      expect(unresolved?.resolvedBy).toBeUndefined();
    });

    it('should throw error for non-existent comment', async () => {
      await expect(cs.unresolveComment('non-existent')).rejects.toThrow(
        'Comment not found',
      );
    });
  });

  describe('getFileComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment at line 10',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user2',
        content: 'Comment at line 20',
      });

      await cs.addComment({
        fileId: 'file2',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment on file2',
      });
    });

    it('should return all comments for a file', async () => {
      const comments = await cs.getFileComments('file1');

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => c.fileId === 'file1')).toBe(true);
    });

    it('should return empty array for file with no comments', async () => {
      const comments = await cs.getFileComments('nonexistent');

      expect(comments).toEqual([]);
    });

    it('should filter by line number', async () => {
      const comments = await cs.getFileComments('file1', { line: 10 });

      expect(comments).toHaveLength(1);
      expect(comments[0].lineNumber).toBe(10);
    });

    it('should filter to exclude resolved comments', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 30,
        author: 'user1',
        content: 'Unresolved',
      });

      await cs.resolveComment(comment.id, 'user1');

      const comments = await cs.getFileComments('file1', {
        includeResolved: false,
      });

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => !c.resolved)).toBe(true);
    });

    it('should sort by created time ascending', async () => {
      const comments = await cs.getFileComments('file1');

      for (let i = 0; i < comments.length - 1; i++) {
        expect(comments[i].createdAt).toBeLessThanOrEqual(
          comments[i + 1].createdAt,
        );
      }
    });
  });

  describe('getReviewComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Review 1 comment',
        reviewId: 'review1',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user2',
        content: 'Review 1 comment 2',
        reviewId: 'review1',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Review 2 comment',
        reviewId: 'review2',
      });
    });

    it('should return all comments for a review', async () => {
      const comments = await cs.getReviewComments('review1');

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => c.reviewId === 'review1')).toBe(true);
    });

    it('should return empty array for review with no comments', async () => {
      const comments = await cs.getReviewComments('nonexistent');

      expect(comments).toEqual([]);
    });
  });

  describe('getReplies', () => {
    it('should return replies to a comment', async () => {
      const parent = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Parent',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Reply 1',
        parentId: parent.id,
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user3',
        content: 'Reply 2',
        parentId: parent.id,
      });

      const replies = await cs.getReplies(parent.id);

      expect(replies).toHaveLength(2);
      expect(replies.every((r) => r.parentId === parent.id)).toBe(true);
    });

    it('should return empty array for comment with no replies', async () => {
      const comment = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'No replies',
      });

      const replies = await cs.getReplies(comment.id);

      expect(replies).toEqual([]);
    });
  });

  describe('getComment', () => {
    it('should return comment by ID', async () => {
      const created = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Test',
      });

      const retrieved = await cs.getComment(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent comment', async () => {
      const retrieved = await cs.getComment('non-existent');

      expect(retrieved).toBeNull();
    });
  });

  describe('getUnresolvedComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Unresolved 1',
      });

      const resolved = await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user1',
        content: 'To be resolved',
      });

      await cs.resolveComment(resolved.id, 'user1');

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 30,
        author: 'user1',
        content: 'Unresolved 2',
      });
    });

    it('should return only unresolved comments', async () => {
      const comments = await cs.getUnresolvedComments('file1');

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => !c.resolved)).toBe(true);
    });
  });

  describe('getCommentThread', () => {
    it('should return comment with replies', async () => {
      const parent = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Parent',
      });

      const reply1 = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user2',
        content: 'Reply 1',
        parentId: parent.id,
      });

      const reply2 = await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user3',
        content: 'Reply 2',
        parentId: parent.id,
      });

      const thread = await cs.getCommentThread(parent.id);

      expect(thread).toHaveLength(3);
      expect(thread[0].id).toBe(parent.id);
      expect(thread[1].id).toBe(reply1.id);
      expect(thread[2].id).toBe(reply2.id);
    });

    it('should return empty array for non-existent comment', async () => {
      const thread = await cs.getCommentThread('non-existent');

      expect(thread).toEqual([]);
    });
  });

  describe('getCommentsByAuthor', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'User 1 comment 1',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user1',
        content: 'User 1 comment 2',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 30,
        author: 'user2',
        content: 'User 2 comment',
      });
    });

    it('should return comments by author', async () => {
      const comments = await cs.getCommentsByAuthor('user1');

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => c.author === 'user1')).toBe(true);
    });

    it('should return empty array for author with no comments', async () => {
      const comments = await cs.getCommentsByAuthor('nonexistent');

      expect(comments).toEqual([]);
    });

    it('should sort by created time descending', async () => {
      const comments = await cs.getCommentsByAuthor('user1');

      for (let i = 0; i < comments.length - 1; i++) {
        expect(comments[i].createdAt).toBeGreaterThanOrEqual(
          comments[i + 1].createdAt,
        );
      }
    });
  });

  describe('getMentions', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: '@user2 please review',
        mentions: ['user2'],
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user1',
        content: 'No mentions',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 30,
        author: 'user3',
        content: '@user2 and @user4',
        mentions: ['user2', 'user4'],
      });
    });

    it('should return comments where user is mentioned', async () => {
      const comments = await cs.getMentions('user2');

      expect(comments).toHaveLength(2);
      expect(comments.every((c) => c.mentions.includes('user2'))).toBe(true);
    });

    it('should return empty array for user not mentioned', async () => {
      const comments = await cs.getMentions('nonexistent');

      expect(comments).toEqual([]);
    });
  });

  describe('countComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment 1',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user2',
        content: 'Comment 2',
      });

      await cs.addComment({
        fileId: 'file2',
        lineNumber: 10,
        author: 'user1',
        content: 'Comment on file2',
      });
    });

    it('should count comments for a file', async () => {
      const count = await cs.countComments('file1');

      expect(count).toBe(2);
    });

    it('should return 0 for file with no comments', async () => {
      const count = await cs.countComments('nonexistent');

      expect(count).toBe(0);
    });
  });

  describe('countUnresolvedComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Unresolved',
      });

      const resolved = await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user1',
        content: 'To be resolved',
      });

      await cs.resolveComment(resolved.id, 'user1');
    });

    it('should count unresolved comments', async () => {
      const count = await cs.countUnresolvedComments('file1');

      expect(count).toBe(1);
    });
  });

  describe('searchComments', () => {
    beforeEach(async () => {
      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'This is a bug fix',
      });

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 20,
        author: 'user2',
        content: 'This is a feature',
      });

      await cs.addComment({
        fileId: 'file2',
        lineNumber: 10,
        author: 'user1',
        content: 'Bug in file2',
      });
    });

    it('should search comments by content', async () => {
      const results = await cs.searchComments('bug');

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.every((r) => r.content.toLowerCase().includes('bug')),
      ).toBe(true);
    });

    it('should search case insensitive', async () => {
      const results = await cs.searchComments('BUG');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should filter by fileId when provided', async () => {
      const results = await cs.searchComments('bug', 'file1');

      expect(results).toHaveLength(1);
      expect(results[0].fileId).toBe('file1');
    });

    it('should search across all files when fileId not provided', async () => {
      const results = await cs.searchComments('bug');

      expect(results.length).toBeGreaterThan(1);
    });

    it('should return empty array when no matches', async () => {
      const results = await cs.searchComments('nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return number of comments', async () => {
      expect(cs.size()).toBe(0);

      await cs.addComment({
        fileId: 'file1',
        lineNumber: 10,
        author: 'user1',
        content: 'Test',
      });

      expect(cs.size()).toBe(1);
    });
  });
});
